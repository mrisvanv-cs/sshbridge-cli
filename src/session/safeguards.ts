import chalk from 'chalk';
import inquirer from 'inquirer';
import { verifyPassword } from '../commands/auth';
import { ServerRecord } from './types';

export function isProductionServer(server: ServerRecord): boolean {
    return (server.name || '').toUpperCase().includes('PROD');
}

export async function enforceProductionSafeguards(server: ServerRecord): Promise<boolean> {
    if (!isProductionServer(server)) {
        return true;
    }

    const verified = await verifyPassword();
    if (!verified) {
        return false;
    }

    console.log(chalk.red.bold('\nCRITICAL WARNING: YOU ARE CONNECTING TO A PRODUCTION SERVER'));
    console.log(chalk.red(`Server: ${server.name} (${server.ip})`));
    console.log(chalk.yellow(`To confirm, please type "confirm ${server.name}" exactly:`));

    const { confirmation } = await inquirer.prompt([{
        type: 'input',
        name: 'confirmation',
        message: 'Confirmation:'
    }]);

    if (confirmation !== `confirm ${server.name}`) {
        console.log(chalk.red('Confirmation failed. Connection aborted.'));
        return false;
    }

    return true;
}
