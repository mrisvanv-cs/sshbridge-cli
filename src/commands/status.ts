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

export async function status(serverName: string): Promise<void> {
    await ensureDaemonRunning();

    const response = await sendIPCRequest({ action: 'status', server: serverName });
    if (!response.success) {
        console.error(chalk.red(response.error || 'Failed to get session status'));
        process.exit(1);
    }

    const data = response.data;
    const now = Date.now();

    console.log(chalk.cyan(`Session status for ${data.serverName}:`));
    console.log(`  Status:       ${data.status}`);
    console.log(`  Connected:    ${data.connected ? 'yes' : 'no'}`);
    console.log(`  Uptime:       ${formatDuration(now - (data.startedAt || now))}`);
    console.log(`  Last used:    ${formatDuration(now - (data.lastUsedAt || now))} ago`);
    console.log(`  Reconnects:   ${data.reconnectCount || 0}`);
    if (data.attachPort) {
        console.log(`  Attach port:  ${data.attachPort}`);
    }
}
