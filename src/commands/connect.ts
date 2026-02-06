import axios from 'axios';
import chalk from 'chalk';
import io from 'socket.io-client';
import { api, appConfig } from '../api';
import { login, verifyPassword } from './auth';

export async function connectToServer(server: any, role: string = 'user') {
    const token = appConfig.get('token');
    if (!token) {
        console.log(chalk.yellow('Not authenticated.'));
        const success = await login();
        if (!success) return;
    }

    // Check for production server access
    if (server.name.toUpperCase().includes('PROD')) {
        const verified = await verifyPassword();
        if (!verified) {
            return;
        }
    }

    try {
        console.log(chalk.gray(`Requesting session for ${server.name} (${server.ip}) as ${role}...`));
        
        // Construct payload mimicking browser behavior
        const payload = {
            serverId: server._id, // Use _id, not id
            name: server.name,
            ip: server.ip,
            port: server.port,
            username: server.serverLoginName,
            password: '', 
            privateKeyPath: server.privateKeyPath
        };

        // Correct Endpoint
        const sessionRes = await api.post(`/api/ssh-session`, payload);
        const { sessionId } = sessionRes.data;

        // 2. Connect via Socket.IO
        console.log(chalk.green(`Session created. Connecting to bridge...`));
        
        const socket = io('https://api.sshbridge.csiq.io', {
            query: { EIO: 4, transport: 'websocket' },
            transports: ['websocket'],
            path: '/socket.io/',
            extraHeaders: {
                Origin: 'https://sshbridge.csiq.io'
            }
        });

        socket.on('connect', () => {
            console.log(chalk.green('Connected to socket. Authenticating...'));
            
            // 3. Emit Auth
            socket.emit('auth', appConfig.get('token'));

            const sshPayload = {
                 name: server.name,
                 host: server.ip,
                 port: server.port,
                 username: payload.username,
                 password: payload.password,
                 privateKeyPath: server.privateKeyPath,
                 serverId: server._id,
                 cols: process.stdout.columns || 80,
                 rows: process.stdout.rows || 24
            };
            
            console.log(chalk.gray('Starting SSH session...'));
            socket.emit('startSSH', sshPayload);

            if (process.stdin.setRawMode) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
        });

        socket.on('output', (data: string) => {
            process.stdout.write(data);
        });

        socket.on('sessionEnd', () => {
            console.log(chalk.yellow('\nSession ended by server.'));
            cleanup();
            socket.disconnect();
            process.exit(0);
        });

        socket.on('disconnect', (reason) => {
             console.log(chalk.yellow(`\nDisconnected from server (reason: ${reason}).`));
             cleanup();
             process.exit(0);
        });

        socket.on('connect_error', (err: any) => {
            console.error(chalk.red('\nConnection Error:', err.message));
            cleanup();
            process.exit(1);
        });

        process.stdin.on('data', (key) => {
            socket.emit('input', key);
        });

        process.stdout.on('resize', () => {
             const { columns, rows } = process.stdout;
             socket.emit('resize', { cols: columns, rows });
        });

        function cleanup() {
            if (process.stdin.setRawMode) {
                process.stdin.setRawMode(false);
            }
            process.stdin.pause();
        }

    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await login();
            if (success) {
                return connectToServer(server, role);
            }
        } else {
            console.error(chalk.red(`Connection Failed: ${error.message}`));
            if (error.response) {
                console.error(chalk.dim(JSON.stringify(error.response.data)));
            }
        }
    }
}

export async function connect(serverName: string) {
    const token = appConfig.get('token');
    if (!token) {
        const success = await login();
        if (!success) return;
    }

    console.log(chalk.cyan(`Initiating connection to ${serverName}...`));

    try {
        console.log(chalk.gray('Resolving server...'));
        const serversRes = await api.get('/api/servers'); 
        
        const serversList = Array.isArray(serversRes.data.servers) 
            ? serversRes.data.servers 
            : (Array.isArray(serversRes.data) ? serversRes.data : []);
        
        if (serversList.length === 0) {
            console.error(chalk.red('No servers available.'));
            return;
        }
        
        const serverIndex = parseInt(serverName, 10);
        let server;
        
        if (!isNaN(serverIndex) && serverIndex >= 0 && serverIndex < serversList.length) {
            server = serversList[serverIndex];
        } else {
            server = serversList.find((s: any) => s.name === serverName || s.hostname === serverName);
        }

        if (!server) {
            console.error(chalk.red(`Server "${serverName}" not found.`));
            return;
        }

        await connectToServer(server, 'user');

    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await login();
            if (success) {
                return connect(serverName);
            }
        } else {
            console.error(chalk.red(`Connection Failed: ${error.message}`));
        }
    }
}
