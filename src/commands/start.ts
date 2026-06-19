import chalk from 'chalk';
import { ensureDaemonRunning, sendIPCRequest } from '../daemon/lifecycle';
import { enforceProductionSafeguards } from '../session/safeguards';
import { resolveServerOrThrow } from '../session/resolver';

export async function start(serverName: string): Promise<void> {
    const server = await resolveServerOrThrow(serverName);
    const allowed = await enforceProductionSafeguards(server);
    if (!allowed) return;

    console.log(chalk.gray('Ensuring daemon is running...'));
    await ensureDaemonRunning();

    const response = await sendIPCRequest({ action: 'start', server: serverName });
    if (!response.success) {
        console.error(chalk.red(response.error || 'Failed to start session'));
        process.exit(1);
    }

    const data = response.data;
    if (data.already) {
        console.log(chalk.yellow(`Session for ${data.server} is already running (${data.status}).`));
    } else {
        console.log(chalk.green(`Session for ${data.server} started.`));
    }
}
