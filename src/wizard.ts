import inquirer from 'inquirer';
import autocomplete from 'inquirer-autocomplete-prompt';
import chalk from 'chalk';
import axios from 'axios';
import { appConfig } from './api';
import { login } from './commands/auth';
import { fetchServers } from './commands/list';
import { connectToServer } from './commands/connect';

// Register autocomplete prompt
inquirer.registerPrompt('autocomplete', autocomplete);

export async function startWizard() {
    console.clear();
    console.log(chalk.bold.magenta(`
   _____ _____ _    _ ____  _____  _____ _____   _____ ______ 
  / ____/ ____| |  | |  _ \\|  __ \\|_   _|  __ \\ / ____|  ____|
 | (___| (___ | |__| | |_) | |__) | | | | |  | | |  __| |__   
  \\___ \\\\___ \\|  __  |  _ <|  _  /  | | | |  | | | |_ |  __|  
  ____) |___) | |  | | |_) | | \\ \\ _| |_| |__| | |__| | |____ 
 |_____/_____/|_|  |_|____/|_|  \\_\\_____|_____/ \\_____|______|
                                                              
    `));
    console.log(chalk.gray('CLI Mode\n'));

    // 1. Check Auth
    let token = appConfig.get('token');
    if (!token) {
        console.log(chalk.yellow('You are not logged in.'));
        const success = await login();
        if (!success) return;
    }

    // 2. Fetch Servers
    let servers;
    try {
        servers = await fetchServers();
        if (!servers || servers.length === 0) {
            console.log(chalk.yellow('No servers available.'));
            return;
        }

        // Sort servers by environment
        servers.sort((a: any, b: any) => {
            const getRank = (name: string) => {
                const upper = name.toUpperCase();
                if (upper.startsWith('PROD')) return 1;
                if (upper.startsWith('UAT')) return 2;
                if (upper.startsWith('DEV')) return 3;
                return 4;
            };
            return getRank(a.name) - getRank(b.name) || a.name.localeCompare(b.name);
        });

        // Create formatted choices for the autocomplete list
        const serverChoices = servers.map((s: any, index: number) => {
            const name = s.name.toUpperCase();
            let coloredName;
            
            if (name.startsWith('PROD')) {
                coloredName = chalk.red.bold(`${s.name}`);
            } else if (name.startsWith('UAT')) {
                coloredName = chalk.yellow.bold(`${s.name}`);
            } else if (name.startsWith('DEV')) {
                coloredName = chalk.blue.bold(`${s.name}`);
            } else {
                coloredName = chalk.cyan.bold(`${s.name}`);
            }
            
            return {
                name: `${coloredName} ${chalk.gray(`(${s.ip})`)}`,
                value: s,
                short: s.name
            };
        });

        // 3. Select server with arrow keys and search
        const { server } = await inquirer.prompt([
            {
                type: 'autocomplete',
                name: 'server',
                message: chalk.cyan('Select a server (type to search, use arrow keys):'),
                source: async (_answersSoFar: any, input: string) => {
                    input = input || '';
                    
                    // Filter choices based on search input
                    return serverChoices.filter((choice: any) => {
                        const searchText = `${choice.value.name} ${choice.value.ip}`.toLowerCase();
                        return searchText.includes(input.toLowerCase());
                    });
                },
                pageSize: 12,
                loop: false
            }
        ]);

        // 4. Select Role
        const { role } = await inquirer.prompt([
            {
                type: 'list',
                name: 'role',
                message: `Connect to ${server.name} as:`,
                choices: [
                    { name: chalk.blue('User'), value: 'user' },
                    { name: chalk.red('Admin'), value: 'admin' }
                ]
            }
        ]);

        // 5. Connect
        await connectToServer(server, role);

    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await login();
            if (success) {
                // Restart wizard on success
                return startWizard();
            }
        } else {
            console.error(chalk.red(`Wizard Error: ${error.message}`));
        }
    }
}
