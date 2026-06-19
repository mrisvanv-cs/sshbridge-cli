import fs from 'fs';
import path from 'path';
import { daemonConfig } from '../config';
import { SessionRecord } from '../session/types';

function ensureDataDir(): void {
    if (!fs.existsSync(daemonConfig.dataDir)) {
        fs.mkdirSync(daemonConfig.dataDir, { recursive: true });
    }
}

function readRegistry(): SessionRecord[] {
    ensureDataDir();
    if (!fs.existsSync(daemonConfig.registryPath)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(daemonConfig.registryPath, 'utf8');
        return JSON.parse(raw) as SessionRecord[];
    } catch {
        return [];
    }
}

function writeRegistry(sessions: SessionRecord[]): void {
    ensureDataDir();
    fs.writeFileSync(daemonConfig.registryPath, JSON.stringify(sessions, null, 2));
}

export class SessionRegistry {
    private sessions: SessionRecord[];

    constructor() {
        this.sessions = readRegistry();
        this.cleanupStale();
    }

    private cleanupStale(): void {
        this.sessions = this.sessions.filter((s) => s.status !== 'stopped');
        writeRegistry(this.sessions);
    }

    getAll(): SessionRecord[] {
        return [...this.sessions];
    }

    findByServer(serverName: string): SessionRecord | undefined {
        const normalized = serverName.toLowerCase();
        return this.sessions.find((s) => s.serverName.toLowerCase() === normalized);
    }

    findById(id: string): SessionRecord | undefined {
        return this.sessions.find((s) => s.id === id);
    }

    upsert(record: SessionRecord): void {
        const index = this.sessions.findIndex((s) => s.id === record.id);
        if (index >= 0) {
            this.sessions[index] = record;
        } else {
            this.sessions.push(record);
        }
        writeRegistry(this.sessions);
    }

    updateStatus(serverName: string, status: SessionRecord['status'], extra: Partial<SessionRecord> = {}): void {
        const session = this.findByServer(serverName);
        if (!session) return;
        Object.assign(session, { status, lastUsedAt: Date.now(), ...extra });
        this.upsert(session);
    }

    remove(serverName: string): boolean {
        const before = this.sessions.length;
        const normalized = serverName.toLowerCase();
        this.sessions = this.sessions.filter((s) => s.serverName.toLowerCase() !== normalized);
        writeRegistry(this.sessions);
        return this.sessions.length < before;
    }

    clear(): void {
        this.sessions = [];
        writeRegistry(this.sessions);
    }
}

export function generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
