import chalk from 'chalk';
import { IPCRequest, IPCResponse } from './ipc';
import { createIPCServer, logDaemon, writePidFile } from './lifecycle';
import { SessionRegistry } from './registry';
import { SocketManager } from './socket-manager';
import { createAttachProxy } from './tcp-proxy';

const registry = new SessionRegistry();
const socketManager = new SocketManager(registry);
const attachProxies = new Map<string, { close: () => void }>();

async function handleRequest(request: IPCRequest): Promise<IPCResponse> {
    switch (request.action) {
        case 'start': {
            const existing = socketManager.getSession(request.server);
            if (existing && (existing.status === 'ready' || existing.status === 'busy' || existing.status === 'attached')) {
                return { success: true, data: { server: existing.serverName, status: existing.status, already: true } };
            }
            const session = await socketManager.startSession(request.server);
            return { success: true, data: { server: session.serverName, status: session.status } };
        }

        case 'exec': {
            const result = await socketManager.exec(request.server, request.command, request.timeout);
            return { success: true, data: result };
        }

        case 'attach': {
            const session = await socketManager.startSession(request.server);
            if (session.status === 'attached') {
                return { success: false, error: 'Session is already attached' };
            }

            const existingProxy = attachProxies.get(session.serverName.toLowerCase());
            if (existingProxy) {
                existingProxy.close();
            }

            const proxy = await createAttachProxy(session.socket, () => {
                socketManager.setDetached(session.serverName);
                attachProxies.delete(session.serverName.toLowerCase());
            });

            attachProxies.set(session.serverName.toLowerCase(), proxy);
            socketManager.setAttached(session.serverName, proxy.port);

            return { success: true, data: { port: proxy.port, server: session.serverName } };
        }

        case 'detach': {
            const proxy = attachProxies.get(request.server.toLowerCase());
            if (proxy) {
                proxy.close();
                attachProxies.delete(request.server.toLowerCase());
            }
            socketManager.setDetached(request.server);
            return { success: true, data: { server: request.server } };
        }

        case 'list': {
            return { success: true, data: { sessions: socketManager.listSessions() } };
        }

        case 'status': {
            const session = socketManager.getSession(request.server);
            if (!session) {
                return { success: false, error: `No active session for ${request.server}` };
            }
            const record = registry.findByServer(request.server);
            return {
                success: true,
                data: {
                    serverName: session.serverName,
                    status: session.status,
                    reconnectCount: session.reconnectAttempts,
                    attachPort: session.attachPort,
                    startedAt: record?.startedAt,
                    lastUsedAt: record?.lastUsedAt,
                    connected: session.socket.connected
                }
            };
        }

        case 'stop': {
            const stopped = await socketManager.stopSession(request.server);
            const proxy = attachProxies.get(request.server.toLowerCase());
            if (proxy) {
                proxy.close();
                attachProxies.delete(request.server.toLowerCase());
            }
            return { success: true, data: { stopped } };
        }

        case 'shutdown': {
            for (const [name, proxy] of attachProxies.entries()) {
                proxy.close();
                attachProxies.delete(name);
            }
            await socketManager.shutdown();
            setTimeout(() => process.exit(0), 100);
            return { success: true, data: { shutdown: true } };
        }

        default:
            return { success: false, error: `Unknown action: ${(request as any).action}` };
    }
}

function setupSignalHandlers(): void {
    const shutdown = async () => {
        logDaemon('Daemon shutting down');
        for (const proxy of attachProxies.values()) {
            proxy.close();
        }
        await socketManager.shutdown();
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

async function main(): Promise<void> {
    writePidFile();
    setupSignalHandlers();
    createIPCServer(handleRequest);
    logDaemon(`Daemon started (pid ${process.pid})`);
}

main().catch((error) => {
    logDaemon(`Daemon failed to start: ${error.message}`);
    console.error(chalk.red(error.message));
    process.exit(1);
});
