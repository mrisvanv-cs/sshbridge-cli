import chalk from 'chalk';
import net from 'net';
import { ensureDaemonRunning, sendIPCRequest } from '../daemon/lifecycle';
import { enforceProductionSafeguards } from '../session/safeguards';
import { resolveServerOrThrow } from '../session/resolver';

const DETACH_SEQUENCE = Buffer.from([0x1d]); // Ctrl+]

export async function attach(serverName: string): Promise<void> {
    const server = await resolveServerOrThrow(serverName);
    const allowed = await enforceProductionSafeguards(server);
    if (!allowed) return;

    await ensureDaemonRunning();

    const response = await sendIPCRequest({ action: 'attach', server: serverName });
    if (!response.success) {
        console.error(chalk.red(response.error || 'Failed to attach to session'));
        process.exit(1);
    }

    const port = response.data.port;
    console.log(chalk.green(`Attached to ${serverName} on localhost:${port}`));
    console.log(chalk.gray('Press Ctrl+] to detach.'));

    const client = net.createConnection({ host: '127.0.0.1', port });

    if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const cleanup = () => {
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdin.removeListener('data', onStdin);
        client.removeListener('data', onClientData);
        client.end();
    };

    const onStdin = (chunk: Buffer) => {
        if (chunk.equals(DETACH_SEQUENCE)) {
            cleanup();
            sendIPCRequest({ action: 'detach', server: serverName }).catch(() => undefined);
            console.log(chalk.yellow('\nDetached from session.'));
            process.exit(0);
            return;
        }
        if (!client.destroyed) {
            client.write(chunk);
        }
    };

    const onClientData = (chunk: Buffer) => {
        process.stdout.write(chunk);
    };

    process.stdin.on('data', onStdin);
    client.on('data', onClientData);

    client.on('close', () => {
        cleanup();
        sendIPCRequest({ action: 'detach', server: serverName }).catch(() => undefined);
        console.log(chalk.yellow('\nConnection closed.'));
        process.exit(0);
    });

    client.on('error', (err) => {
        cleanup();
        console.error(chalk.red(`Attach error: ${err.message}`));
        process.exit(1);
    });
}
