import { Socket } from 'socket.io-client';

export interface ServerRecord {
    _id?: string;
    id?: string;
    name: string;
    ip: string;
    port: number;
    serverLoginName: string;
    privateKeyPath?: string;
    hostname?: string;
    status?: string;
    connectionStatus?: string;
}

export interface SessionOptions {
    server: ServerRecord;
    role?: string;
    cols?: number;
    rows?: number;
    quiet?: boolean;
}

export interface SessionConnection {
    socket: Socket;
    sessionId: string;
    server: ServerRecord;
}

export type SessionStatus =
    | 'connecting'
    | 'ready'
    | 'busy'
    | 'attached'
    | 'reconnecting'
    | 'error'
    | 'stopped';

export interface SessionRecord {
    id: string;
    serverName: string;
    serverId: string;
    apiSessionId: string;
    pid: number;
    startedAt: number;
    lastUsedAt: number;
    status: SessionStatus;
    reconnectCount: number;
    attachPort?: number;
}

export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
