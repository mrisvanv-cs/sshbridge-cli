import axios from 'axios';
import chalk from 'chalk';
import { appConfig } from '../api';
import { login } from './auth';
import { attachInteractiveHandlers, createSession } from '../session/connection';
import { resolveServerOrThrow } from '../session/resolver';
import { enforceProductionSafeguards } from '../session/safeguards';
import { ServerRecord } from '../session/types';

export async function connectToServer(server: ServerRecord, role: string = 'user') {
    const token = appConfig.get('token');
    if (!token) {
        console.log(chalk.yellow('Not authenticated.'));
        const success = await login();
        if (!success) return;
    }

    const allowed = await enforceProductionSafeguards(server);
    if (!allowed) return;

    try {
        const { socket } = await createSession({ server, quiet: false });
        attachInteractiveHandlers(socket);
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await login();
            if (success) {
                return connectToServer(server, role);
            }
        } else {
            console.error(chalk.red(`Connection Failed: ${error.message}`));
            if (error.response) {
                console.error(chalk.dim(JSON.stringify(error.response.data)));
            }
        }
    }
}

export async function connect(serverName: string) {
    const token = appConfig.get('token');
    if (!token) {
        const success = await login();
        if (!success) return;
    }

    console.log(chalk.cyan(`Initiating connection to ${serverName}...`));

    try {
        console.log(chalk.gray('Resolving server...'));
        const server = await resolveServerOrThrow(serverName);
        await connectToServer(server, 'user');
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await login();
            if (success) {
                return connect(serverName);
            }
        } else {
            console.error(chalk.red(`Connection Failed: ${error.message}`));
        }
    }
}
