import chalk from 'chalk';
import io, { Socket } from 'socket.io-client';
import { api, appConfig } from '../api';
import { SOCKET_IO_ORIGIN, SOCKET_IO_URL } from '../config';
import { ServerRecord, SessionConnection, SessionOptions } from './types';

function buildSessionPayload(server: ServerRecord) {
    return {
        serverId: server._id || server.id,
        name: server.name,
        ip: server.ip,
        port: server.port,
        username: server.serverLoginName,
        password: '',
        privateKeyPath: server.privateKeyPath
    };
}

function buildSshPayload(server: ServerRecord, payload: ReturnType<typeof buildSessionPayload>, cols: number, rows: number) {
    return {
        name: server.name,
        host: server.ip,
        port: server.port,
        username: payload.username,
        password: payload.password,
        privateKeyPath: server.privateKeyPath,
        serverId: server._id || server.id,
        cols,
        rows
    };
}

export async function createApiSession(server: ServerRecord): Promise<string> {
    const payload = buildSessionPayload(server);
    const sessionRes = await api.post('/api/ssh-session', payload);
    return sessionRes.data.sessionId;
}

export function connectSocket(sessionId: string, token: string, includeSessionId = true): Socket {
    const query: Record<string, string> = { EIO: '4', transport: 'websocket' };
    if (includeSessionId) {
        query.sessionId = sessionId;
    }

    return io(SOCKET_IO_URL, {
        query,
        transports: ['websocket'],
        path: '/socket.io/',
        extraHeaders: {
            Origin: SOCKET_IO_ORIGIN,
            Authorization: `Bearer ${token}`
        }
    });
}

export async function createSession(options: SessionOptions): Promise<SessionConnection> {
    const { server, quiet = false } = options;
    const token = appConfig.get('token') as string;
    const cols = options.cols ?? (process.stdout.columns || 80);
    const rows = options.rows ?? (process.stdout.rows || 24);

    if (!quiet) {
        console.log(chalk.gray(`Requesting session for ${server.name} (${server.ip})...`));
    }

    const payload = buildSessionPayload(server);
    const sessionId = await createApiSession(server);

    if (!quiet) {
        console.log(chalk.green('Session created. Connecting to bridge...'));
    }

    const socket = connectSocket(sessionId, token, true);

    return new Promise<SessionConnection>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Connection timed out while establishing SSH session'));
        }, 30000);

        socket.on('connect', () => {
            if (!quiet) {
                console.log(chalk.green('Connected to socket. Authenticating...'));
                console.log(chalk.gray('Starting SSH session...'));
            }

            socket.emit('auth', token);
            socket.emit('startSSH', buildSshPayload(server, payload, cols, rows));
        });

        socket.once('output', () => {
            clearTimeout(timeout);
            resolve({ socket, sessionId, server });
        });

        socket.on('connect_error', (err: Error) => {
            clearTimeout(timeout);
            reject(err);
        });

        socket.on('error', (err: Error) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

export function waitForSocketReady(socket: Socket): Promise<void> {
    return new Promise((resolve) => {
        socket.once('output', () => resolve());
    });
}

export function attachInteractiveHandlers(socket: Socket): () => void {
    if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onData = (key: Buffer) => {
        socket.emit('input', key);
    };

    const onOutput = (data: string) => {
        process.stdout.write(data);
    };

    const onResize = () => {
        const { columns, rows } = process.stdout;
        socket.emit('resize', { cols: columns, rows });
    };

    const cleanup = () => {
        process.stdin.removeListener('data', onData);
        process.stdout.removeListener('resize', onResize);
        socket.off('output', onOutput);
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(false);
        }
        process.stdin.pause();
    };

    process.stdin.on('data', onData);
    socket.on('output', onOutput);
    process.stdout.on('resize', onResize);

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

    socket.on('connect_error', (err: Error) => {
        console.error(chalk.red('\nConnection Error:', err.message));
        cleanup();
        process.exit(1);
    });

    return cleanup;
}
