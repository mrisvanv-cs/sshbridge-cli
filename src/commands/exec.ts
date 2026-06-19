import axios from 'axios';
import chalk from 'chalk';
import { appConfig } from '../api';
import { login } from './auth';
import { createSession } from '../session/connection';
import { executeCommand, printExecResult } from '../session/executor';
import { resolveServerOrThrow } from '../session/resolver';
import { enforceProductionSafeguards } from '../session/safeguards';
import { daemonConfig } from '../config';

export interface ExecOptions {
    timeout?: number;
    quiet?: boolean;
    useDaemon?: boolean;
}

export async function execDirect(serverName: string, command: string, options: ExecOptions = {}): Promise<number> {
    const token = appConfig.get('token');
    if (!token) {
        const success = await login();
        if (!success) return 1;
    }

    try {
        const server = await resolveServerOrThrow(serverName);
        const allowed = await enforceProductionSafeguards(server);
        if (!allowed) return 1;

        if (!options.quiet) {
            console.log(chalk.gray(`Executing on ${server.name}: ${command}`));
        }

        const { socket } = await createSession({ server, quiet: true });
        const result = await executeCommand(socket, command, options.timeout ?? daemonConfig.execTimeout);
        socket.disconnect();

        printExecResult(result);
        return result.exitCode;
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await login();
            if (success) {
                return execDirect(serverName, command, options);
            }
        } else {
            console.error(chalk.red(`Exec failed: ${error.message}`));
        }
        return 1;
    }
}

export async function execCommand(serverName: string, command: string, options: ExecOptions = {}): Promise<number> {
    if (options.useDaemon !== false) {
        try {
            const { sendIPCRequest, ensureDaemonRunning } = await import('../daemon/lifecycle');
            await ensureDaemonRunning();

            const startResponse = await sendIPCRequest({ action: 'start', server: serverName });
            if (!startResponse.success && !startResponse.error?.includes('already')) {
                console.error(chalk.red(startResponse.error || 'Failed to start session'));
                return 1;
            }

            const execResponse = await sendIPCRequest({
                action: 'exec',
                server: serverName,
                command,
                timeout: options.timeout
            });

            if (!execResponse.success) {
                console.error(chalk.red(execResponse.error || 'Exec failed'));
                return 1;
            }

            const result = execResponse.data;
            printExecResult(result);
            return result.exitCode ?? 0;
        } catch {
            // Fall back to direct exec if daemon is unavailable
        }
    }

    return execDirect(serverName, command, options);
}
