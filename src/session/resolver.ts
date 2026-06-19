import chalk from 'chalk';
import { fetchServers } from '../commands/list';
import { ServerRecord } from './types';

export async function resolveServer(serverName: string): Promise<ServerRecord | null> {
    try {
        const servers = await fetchServers();
        const serverIndex = parseInt(serverName, 10);
        let server: ServerRecord | undefined;

        if (!isNaN(serverIndex) && serverIndex >= 0 && serverIndex < servers.length) {
            server = servers[serverIndex];
        } else {
            const normalized = serverName.toLowerCase();
            server = servers.find((s: ServerRecord) => {
                const name = (s.name || '').toLowerCase();
                const hostname = (s.hostname || '').toLowerCase();
                const id = (s._id || s.id || '').toLowerCase();
                return name === normalized || hostname === normalized || id === normalized;
            });
        }

        return server || null;
    } catch {
        return null;
    }
}

export async function resolveServerOrThrow(serverName: string): Promise<ServerRecord> {
    const server = await resolveServer(serverName);
    if (!server) {
        throw new Error(`Server "${serverName}" not found.`);
    }
    return server;
}

export function getServerKey(server: ServerRecord): string {
    return server.name;
}

export function logResolve(serverName: string): void {
    console.log(chalk.gray('Resolving server...'));
    console.log(chalk.cyan(`Initiating connection to ${serverName}...`));
}
