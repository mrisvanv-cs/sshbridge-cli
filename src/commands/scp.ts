import axios from 'axios';
import chalk from 'chalk';
import io from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';
import { api, appConfig } from '../api';
import { login } from './auth';
import { fetchServers } from './list';

// Helper to resolve server
async function resolveServer(serverName: string) {
    try {
        const servers = await fetchServers();
        const serverIndex = parseInt(serverName, 10);
        let server;

        if (!isNaN(serverIndex) && serverIndex >= 0 && serverIndex < servers.length) {
            server = servers[serverIndex];
        } else {
            server = servers.find((s: any) => s.name === serverName || s.hostname === serverName);
        }
        return server;
    } catch (e) {
        return null;
    }
}

// Helper to setup socket connection
async function setupConnection(server: any) {
    const token = appConfig.get('token');
    
    console.log(chalk.gray(`Initializing session for ${server.name}...`));

    // 1. Create Session
    const payload = {
        serverId: server._id || server.id,
        name: server.name,
        ip: server.ip,
        port: server.port,
        username: server.serverLoginName,
        password: '',
        privateKeyPath: server.privateKeyPath
    };

    const sessionRes = await api.post(`/api/ssh-session`, payload);
    const { sessionId } = sessionRes.data;

    // 2. Connect Socket
    const socket = io('https://api.sshbridge.csiq.io', {
        query: { EIO: 4, transport: 'websocket', sessionId: sessionId },
        transports: ['websocket'],
        path: '/socket.io/',
        extraHeaders: {
            Origin: 'https://sshbridge.csiq.io',
            Authorization: `Bearer ${token}` 
        }
    });

    return new Promise<any>((resolve, reject) => {
        socket.on('connect', () => {
            // 3. Auth & Start SSH
            socket.emit('auth', token);

            const sshPayload = {
                name: server.name,
                host: server.ip,
                port: server.port,
                username: payload.username,
                password: '',
                privateKeyPath: server.privateKeyPath,
                serverId: server._id || server.id,
                cols: 80,
                rows: 24
            };
            
            socket.emit('startSSH', sshPayload);
            // Give it a moment to establish SSH connection before returning socket
            setTimeout(() => resolve(socket), 1000);
        });

        socket.on('connect_error', (err) => reject(err));
        socket.on('error', (err) => reject(err));
    });
}

export async function downloadFile(serverName: string, remotePath: string, localPath?: string) {
    const token = appConfig.get('token');
    if (!token) {
        if (!await login()) return;
    }

    const server = await resolveServer(serverName);
    if (!server) {
        console.error(chalk.red(`Server "${serverName}" not found.`));
        return;
    }

    // Determine secure local path
    const fileName = path.basename(remotePath);
    const destination = localPath 
        ? (fs.existsSync(localPath) && fs.lstatSync(localPath).isDirectory() ? path.join(localPath, fileName) : localPath)
        : path.join(process.cwd(), fileName);

    try {
        const socket = await setupConnection(server);

        socket.on('error', (err: any) => {
            console.error(chalk.red(`\nSocket Error: ${err.message || err}`));
        });
        
        console.log(chalk.cyan(`Downloading ${remotePath} from ${server.name}...`));

        const fileStream = fs.createWriteStream(destination);
        let downloadedBytes = 0;
        let totalBytes = 0; 
        let transferStarted = false;

        const progressBar = new cliProgress.SingleBar({
            format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} KB',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true,
            stopOnComplete: true
        });

        console.log(chalk.gray(`Requesting file ${remotePath}...`));
        
        // Wait for SSH ready (indicated by first output) before sending scp-download request
        socket.once('output', () => {
             console.log(chalk.gray('Connection established. Sending download request...'));
             socket.emit('scp-download', { path: remotePath });
        });

        socket.on('scp-download-result', (data: any) => {
            // Single shot download
            if (data.error) {
                console.error(chalk.red(`\nDownload failed: ${data.error}`));
                fileStream.close();
                if (fs.existsSync(destination)) fs.unlinkSync(destination);
                socket.disconnect();
                process.exit(1);
            }
            
            // Should be buffer or similar
            if (data.content) {
                 const buffer = Buffer.from(data.content);
                 fileStream.write(buffer);
                 fileStream.end();
                 progressBar.stop();
                 console.log(chalk.green(`\nDownload complete: ${destination}`));
                 socket.disconnect();
            }
        });

        socket.on('scp-download-chunk', (data: any) => {
            if (!transferStarted) {
                transferStarted = true;
                console.log(chalk.gray('Transfer started...'));
            }

            if (data.error) {
                 progressBar.stop();
                 console.error(chalk.red(`\nError: ${data.error}`));
                 socket.disconnect();
                 return;
            }
            
            if (data.chunk) {
                const buffer = Buffer.from(data.chunk);
                fileStream.write(buffer);
                downloadedBytes += buffer.length;
                
                if (totalBytes > 0) {
                    progressBar.update(Math.round(downloadedBytes / 1024));
                } else {
                    process.stdout.write(`\rDownloaded: ${(downloadedBytes / 1024).toFixed(2)} KB`);
                }
            }

            if (data.isLast) {
                fileStream.end();
                progressBar.stop();
                console.log(chalk.green(`\nDownload complete: ${destination}`));
                socket.disconnect();
            }
        });

        socket.on('download-progress', (data: any) => {
             if (data.totalSize) {
                 if (totalBytes === 0) {
                     totalBytes = data.totalSize;
                     progressBar.start(Math.round(totalBytes / 1024), 0);
                 }
                 progressBar.update(Math.round(data.downloaded / 1024));
             }
        });
        
        socket.on('disconnect', () => { 
             progressBar.stop();
        });

    } catch (error: any) {
        console.error(chalk.red(`Operation failed: ${error.message}`));
    }
}

export async function uploadFile(serverName: string, localPath: string, remotePath?: string) {
    const token = appConfig.get('token');
    if (!token) {
        if (!await login()) return;
    }

    if (!fs.existsSync(localPath)) {
        console.error(chalk.red(`Local file not found: ${localPath}`));
        return;
    }

    const server = await resolveServer(serverName);
    if (!server) {
        console.error(chalk.red(`Server "${serverName}" not found.`));
        return;
    }

    // Default remote path to /tmp/filename if not specified? 
    // Or just filename relative to user home (which scp usually does).
    // The web UI upload usually uploads to current PTY cwd or Home.
    // We will assume home directory or provided path.
    const fileName = path.basename(localPath);
    // If remotePath is not provided, we might send just file name? 
    // The scp-upload-chunk payload has 'fileName'.
    // If the server handles relative paths, sending just 'fileName' might put it in $HOME.
    const targetName = remotePath ? remotePath : fileName; // Actually payload expects 'fileName'. 
    // If 'remotePath' implies a full path /tmp/foo.txt, we should probably pass that as 'fileName'?
    // Browser agent said payload is { fileName: "example.txt", ... }. 
    // It's likely the server just puts it in the current PTY directory if it's just a name.
    // But for CLI, we might want to support paths. Let's try passing the full remote path as 'fileName'.
    
    const stats = fs.statSync(localPath);
    const fileSize = stats.size;
    const CHUNK_SIZE = 262144; // 256KB

    try {
        const socket = await setupConnection(server);
        console.log(chalk.cyan(`Uploading ${localPath} to ${server.name}:${targetName}...`));

        const progressBar = new cliProgress.SingleBar({
            format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} KB',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });

        // Wait for SSH ready before starting upload
        socket.once('output', () => {
            console.log(chalk.gray('Connection established. Starting upload...'));
            progressBar.start(Math.round(fileSize / 1024), 0);
            startUpload();
        });

        const fd = fs.openSync(localPath, 'r');
        let offset = 0;
        let chunkIndex = 0;
        const buffer = Buffer.alloc(CHUNK_SIZE);

        const startUpload = () => {
            const uploadNextChunk = () => {
                const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, offset);
                
                if (bytesRead === 0) {
                     fs.closeSync(fd);
                     progressBar.stop();
                     console.log(chalk.green('\nUpload complete.'));
                     socket.disconnect();
                     return;
                }
    
                const chunk = buffer.subarray(0, bytesRead);
                const isLast = (offset + bytesRead) >= fileSize;
    
                const payload = {
                    fileName: targetName,
                    chunk: chunk, // Socket.io handles Buffer -> ArrayBuffer/binary
                    offset: offset,
                    isLast: isLast,
                    chunkIndex: chunkIndex
                };
    
                socket.emit('scp-upload-chunk', payload);
                
                offset += bytesRead;
                chunkIndex++;
                
                progressBar.update(Math.round(offset / 1024));
    
                if (!isLast) {
                    setImmediate(uploadNextChunk);
                } else {
                     fs.closeSync(fd);
                     progressBar.stop();
                     console.log(chalk.green('\nUpload complete.'));
                     // Wait a sec for server to process write?
                     setTimeout(() => socket.disconnect(), 1000);
                }
            };
            uploadNextChunk();
        };
        
        // Listen for progress to ensure flow control? 
        // Or simply start uploading.
        
        socket.on('upload-progress', (data: any) => {
             // We can use this to sync if needed.
        });

    } catch (error: any) {
        console.error(chalk.red(`Upload failed: ${error.message}`));
    }
}
