import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';
import { appConfig } from '../api';
import { login } from './auth';
import { createSession } from '../session/connection';
import { resolveServer } from '../session/resolver';

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

    const fileName = path.basename(remotePath);
    const destination = localPath
        ? (fs.existsSync(localPath) && fs.lstatSync(localPath).isDirectory() ? path.join(localPath, fileName) : localPath)
        : path.join(process.cwd(), fileName);

    try {
        const { socket } = await createSession({ server, quiet: true });
        console.log(chalk.gray(`Initializing session for ${server.name}...`));

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

        console.log(chalk.gray('Connection established. Sending download request...'));
        socket.emit('scp-download', { path: remotePath });

        socket.on('scp-download-result', (data: any) => {
            if (data.error) {
                console.error(chalk.red(`\nDownload failed: ${data.error}`));
                fileStream.close();
                if (fs.existsSync(destination)) fs.unlinkSync(destination);
                socket.disconnect();
                process.exit(1);
            }

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

    const fileName = path.basename(localPath);
    const targetName = remotePath ? remotePath : fileName;
    const stats = fs.statSync(localPath);
    const fileSize = stats.size;
    const CHUNK_SIZE = 262144;

    try {
        const { socket } = await createSession({ server, quiet: true });
        console.log(chalk.gray(`Initializing session for ${server.name}...`));
        console.log(chalk.cyan(`Uploading ${localPath} to ${server.name}:${targetName}...`));

        const progressBar = new cliProgress.SingleBar({
            format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} KB',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
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
                    chunk,
                    offset,
                    isLast,
                    chunkIndex
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
                    setTimeout(() => socket.disconnect(), 1000);
                }
            };
            uploadNextChunk();
        };

        console.log(chalk.gray('Connection established. Starting upload...'));
        progressBar.start(Math.round(fileSize / 1024), 0);
        startUpload();
    } catch (error: any) {
        console.error(chalk.red(`Upload failed: ${error.message}`));
    }
}
