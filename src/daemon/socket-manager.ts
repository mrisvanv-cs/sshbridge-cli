import { Socket } from 'socket.io-client';
import { daemonConfig } from '../config';
import { createSession } from '../session/connection';
import { executeCommand } from '../session/executor';
import { resolveServerOrThrow } from '../session/resolver';
import { ExecResult, ServerRecord, SessionStatus } from '../session/types';
import { generateSessionId, SessionRegistry } from './registry';
import { logDaemon } from './lifecycle';

interface ManagedSession {
    recordId: string;
    serverName: string;
    server: ServerRecord;
    socket: Socket;
    apiSessionId: string;
    status: SessionStatus;
    commandQueue: Array<{
        command: string;
        timeout?: number;
        resolve: (result: ExecResult) => void;
        reject: (error: Error) => void;
    }>;
    processing: boolean;
    keepaliveTimer?: NodeJS.Timeout;
    reconnectAttempts: number;
    attachPort?: number;
}

export class SocketManager {
    private sessions = new Map<string, ManagedSession>();
    private registry: SessionRegistry;

    constructor(registry: SessionRegistry) {
        this.registry = registry;
    }

    hasSession(serverName: string): boolean {
        return this.sessions.has(serverName.toLowerCase());
    }

    getSession(serverName: string): ManagedSession | undefined {
        return this.sessions.get(serverName.toLowerCase());
    }

    async startSession(serverName: string): Promise<ManagedSession> {
        const key = serverName.toLowerCase();
        const existing = this.sessions.get(key);
        if (existing && (existing.status === 'ready' || existing.status === 'busy')) {
            return existing;
        }

        const server = await resolveServerOrThrow(serverName);
        const recordId = generateSessionId();

        this.registry.upsert({
            id: recordId,
            serverName: server.name,
            serverId: server._id || server.id || '',
            apiSessionId: '',
            pid: process.pid,
            startedAt: Date.now(),
            lastUsedAt: Date.now(),
            status: 'connecting',
            reconnectCount: 0
        });

        logDaemon(`Starting session for ${server.name}`);
        const { socket, sessionId } = await createSession({ server, quiet: true });

        const managed: ManagedSession = {
            recordId,
            serverName: server.name,
            server,
            socket,
            apiSessionId: sessionId,
            status: 'ready',
            commandQueue: [],
            processing: false,
            reconnectAttempts: 0
        };

        this.setupSocketHandlers(managed);
        this.startKeepalive(managed);
        this.sessions.set(key, managed);

        this.registry.upsert({
            id: recordId,
            serverName: server.name,
            serverId: server._id || server.id || '',
            apiSessionId: sessionId,
            pid: process.pid,
            startedAt: Date.now(),
            lastUsedAt: Date.now(),
            status: 'ready',
            reconnectCount: 0
        });

        logDaemon(`Session ready for ${server.name}`);
        return managed;
    }

    private setupSocketHandlers(session: ManagedSession): void {
        session.socket.on('disconnect', (reason) => {
            logDaemon(`Session ${session.serverName} disconnected: ${reason}`);
            if (session.status === 'stopped') return;
            this.handleReconnect(session, reason);
        });

        session.socket.on('sessionEnd', () => {
            logDaemon(`Session ${session.serverName} ended by server`);
            if (session.status === 'stopped') return;
            this.handleReconnect(session, 'sessionEnd');
        });
    }

    private async handleReconnect(session: ManagedSession, reason: string): Promise<void> {
        if (session.reconnectAttempts >= daemonConfig.maxReconnects) {
            session.status = 'error';
            this.registry.updateStatus(session.serverName, 'error');
            logDaemon(`Session ${session.serverName} exceeded max reconnect attempts (${reason})`);
            return;
        }

        session.status = 'reconnecting';
        session.reconnectAttempts += 1;
        this.registry.updateStatus(session.serverName, 'reconnecting', {
            reconnectCount: session.reconnectAttempts
        });

        const delay = daemonConfig.reconnectBackoff[
            Math.min(session.reconnectAttempts - 1, daemonConfig.reconnectBackoff.length - 1)
        ];

        await new Promise((resolve) => setTimeout(resolve, delay));

        try {
            const { socket, sessionId } = await createSession({ server: session.server, quiet: true });
            session.socket = socket;
            session.apiSessionId = sessionId;
            session.status = 'ready';
            this.setupSocketHandlers(session);
            this.registry.updateStatus(session.serverName, 'ready', {
                apiSessionId: sessionId,
                reconnectCount: session.reconnectAttempts
            });
            logDaemon(`Session ${session.serverName} reconnected`);
            this.processQueue(session);
        } catch (error: any) {
            logDaemon(`Reconnect failed for ${session.serverName}: ${error.message}`);
            this.handleReconnect(session, 'reconnect-failed');
        }
    }

    private startKeepalive(session: ManagedSession): void {
        if (session.keepaliveTimer) {
            clearInterval(session.keepaliveTimer);
        }

        session.keepaliveTimer = setInterval(() => {
            if (session.status === 'ready' && session.socket.connected) {
                session.socket.emit('input', Buffer.from(''));
            }
        }, daemonConfig.keepaliveInterval);
    }

    async exec(serverName: string, command: string, timeout?: number): Promise<ExecResult> {
        const session = await this.startSession(serverName);

        if (session.status === 'attached') {
            throw new Error(`Session ${serverName} is currently attached. Detach before running exec.`);
        }

        return new Promise<ExecResult>((resolve, reject) => {
            session.commandQueue.push({ command, timeout, resolve, reject });
            this.processQueue(session);
        });
    }

    private async processQueue(session: ManagedSession): Promise<void> {
        if (session.processing || session.commandQueue.length === 0) return;
        if (session.status !== 'ready') return;

        session.processing = true;
        session.status = 'busy';
        this.registry.updateStatus(session.serverName, 'busy');

        const job = session.commandQueue.shift();
        if (!job) {
            session.processing = false;
            session.status = 'ready';
            this.registry.updateStatus(session.serverName, 'ready');
            return;
        }

        try {
            const result = await executeCommand(session.socket, job.command, job.timeout ?? daemonConfig.execTimeout);
            job.resolve(result);
        } catch (error: any) {
            job.reject(error);
        } finally {
            session.processing = false;
            session.status = 'ready';
            this.registry.updateStatus(session.serverName, 'ready');
            this.processQueue(session);
        }
    }

    setAttached(serverName: string, port?: number): void {
        const session = this.getSession(serverName);
        if (!session) return;
        session.status = 'attached';
        session.attachPort = port;
        this.registry.updateStatus(serverName, 'attached', { attachPort: port });
    }

    setDetached(serverName: string): void {
        const session = this.getSession(serverName);
        if (!session) return;
        session.status = 'ready';
        session.attachPort = undefined;
        this.registry.updateStatus(serverName, 'ready', { attachPort: undefined });
    }

    async stopSession(serverName: string): Promise<boolean> {
        const key = serverName.toLowerCase();
        const session = this.sessions.get(key);
        if (!session) {
            this.registry.remove(serverName);
            return false;
        }

        session.status = 'stopped';
        if (session.keepaliveTimer) clearInterval(session.keepaliveTimer);
        session.socket.disconnect();
        this.sessions.delete(key);
        this.registry.remove(serverName);
        logDaemon(`Stopped session for ${serverName}`);
        return true;
    }

    listSessions(): Array<{
        serverName: string;
        status: SessionStatus;
        startedAt: number;
        lastUsedAt: number;
        reconnectCount: number;
        attachPort?: number;
    }> {
        return Array.from(this.sessions.values()).map((s) => ({
            serverName: s.serverName,
            status: s.status,
            startedAt: this.registry.findByServer(s.serverName)?.startedAt || Date.now(),
            lastUsedAt: this.registry.findByServer(s.serverName)?.lastUsedAt || Date.now(),
            reconnectCount: s.reconnectAttempts,
            attachPort: s.attachPort
        }));
    }

    async shutdown(): Promise<void> {
        const names = Array.from(this.sessions.keys());
        for (const name of names) {
            await this.stopSession(name);
        }
        this.registry.clear();
    }
}
