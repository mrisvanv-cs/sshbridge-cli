import chalk from 'chalk';
import { ensureDaemonRunning, sendIPCRequest } from '../daemon/lifecycle';

export async function stop(serverName: string): Promise<void> {
    await ensureDaemonRunning();

    const response = await sendIPCRequest({ action: 'stop', server: serverName });
    if (!response.success) {
        console.error(chalk.red(response.error || 'Failed to stop session'));
        process.exit(1);
    }

    if (response.data.stopped) {
        console.log(chalk.green(`Session for ${serverName} stopped.`));
    } else {
        console.log(chalk.yellow(`No active session found for ${serverName}.`));
    }
}
