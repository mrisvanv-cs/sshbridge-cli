import fs from 'fs';
import net from 'net';
import { spawn } from 'child_process';
import path from 'path';
import { daemonConfig } from '../config';
import { IPCRequest, IPCResponse, parseMessage, serializeMessage } from './ipc';

function ensureDataDir(): void {
    if (!fs.existsSync(daemonConfig.dataDir)) {
        fs.mkdirSync(daemonConfig.dataDir, { recursive: true });
    }
}

export function isDaemonRunning(): boolean {
    if (!fs.existsSync(daemonConfig.pidPath)) {
        return false;
    }

    try {
        const pid = parseInt(fs.readFileSync(daemonConfig.pidPath, 'utf8').trim(), 10);
        process.kill(pid, 0);
        return true;
    } catch {
        cleanupStaleDaemonFiles();
        return false;
    }
}

export function cleanupStaleDaemonFiles(): void {
    try {
        if (fs.existsSync(daemonConfig.pidPath)) fs.unlinkSync(daemonConfig.pidPath);
        if (fs.existsSync(daemonConfig.socketPath)) fs.unlinkSync(daemonConfig.socketPath);
    } catch {
        // ignore cleanup errors
    }
}

export async function startDaemon(): Promise<void> {
    ensureDataDir();

    if (isDaemonRunning()) {
        return;
    }

    cleanupStaleDaemonFiles();

    const daemonScript = path.join(__dirname, 'daemon.js');
    const child = spawn(process.execPath, [daemonScript], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env }
    });

    child.unref();

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        if (isDaemonRunning() && fs.existsSync(daemonConfig.socketPath)) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error('Daemon failed to start within timeout');
}

export async function ensureDaemonRunning(): Promise<void> {
    if (!isDaemonRunning()) {
        await startDaemon();
    }
}

export async function stopDaemon(): Promise<void> {
    if (!isDaemonRunning()) {
        cleanupStaleDaemonFiles();
        return;
    }

    try {
        await sendIPCRequest({ action: 'shutdown' });
    } catch {
        // ignore and force cleanup below
    }

    try {
        const pid = parseInt(fs.readFileSync(daemonConfig.pidPath, 'utf8').trim(), 10);
        process.kill(pid, 'SIGTERM');
    } catch {
        // ignore
    }

    cleanupStaleDaemonFiles();
}

export function sendIPCRequest(request: IPCRequest, timeoutMs: number = daemonConfig.ipcTimeout): Promise<IPCResponse> {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(daemonConfig.socketPath)) {
            reject(new Error('Daemon socket not found. Is the daemon running?'));
            return;
        }

        const client = net.createConnection(daemonConfig.socketPath);
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        let buffer = '';

        const timer = setTimeout(() => {
            client.destroy();
            reject(new Error('IPC request timed out'));
        }, timeoutMs);

        client.on('connect', () => {
            client.write(serializeMessage({ ...request, id: requestId }));
        });

        client.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                const response = parseMessage(line) as IPCResponse | null;
                if (!response) continue;
                if (response.id && response.id !== requestId) continue;

                clearTimeout(timer);
                client.end();
                resolve(response);
                return;
            }
        });

        client.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

export function createIPCServer(handler: (request: IPCRequest) => Promise<IPCResponse>): net.Server {
    ensureDataDir();

    if (fs.existsSync(daemonConfig.socketPath)) {
        try {
            fs.unlinkSync(daemonConfig.socketPath);
        } catch {
            // ignore
        }
    }

    const server = net.createServer((socket) => {
        let buffer = '';

        socket.on('data', async (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                const request = parseMessage(line) as IPCRequest | null;
                if (!request || !('action' in request)) continue;

                try {
                    const response = await handler(request);
                    socket.write(serializeMessage({ ...response, id: request.id }));
                } catch (error: any) {
                    socket.write(serializeMessage({
                        id: request.id,
                        success: false,
                        error: error.message || 'Unknown IPC error'
                    }));
                }
            }
        });
    });

    server.listen(daemonConfig.socketPath);
    return server;
}

export function writePidFile(): void {
    ensureDataDir();
    fs.writeFileSync(daemonConfig.pidPath, String(process.pid));
}

export function logDaemon(message: string): void {
    ensureDataDir();
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(daemonConfig.logPath, line);
}
