import chalk from 'chalk';
import { ensureDaemonRunning, sendIPCRequest } from '../daemon/lifecycle';

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

export async function sessions(): Promise<void> {
    await ensureDaemonRunning();

    const response = await sendIPCRequest({ action: 'list' });
    if (!response.success) {
        console.error(chalk.red(response.error || 'Failed to list sessions'));
        process.exit(1);
    }

    const list = response.data.sessions || [];
    if (list.length === 0) {
        console.log(chalk.yellow('No active background sessions.'));
        return;
    }

    const now = Date.now();
    console.log(chalk.cyan(`Active sessions (${list.length}):`));
    console.table(list.map((s: any) => ({
        Server: s.serverName,
        Status: s.status,
        Uptime: formatDuration(now - (s.startedAt || now)),
        'Last Used': formatDuration(now - (s.lastUsedAt || now)) + ' ago',
        Reconnects: s.reconnectCount || 0,
        AttachPort: s.attachPort || '-'
    })));
}
