import inquirer from 'inquirer';
import chalk from 'chalk';
import { api, appConfig } from '../api';
import axios from 'axios';

export async function login(): Promise<boolean> {
    console.log(chalk.blue('SSHBridge Authentication'));

    const credentials = await inquirer.prompt([
        {
            type: 'input',
            name: 'username',
            message: 'Username:'
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:'
        }
    ]);

    try {
        // Initial Login Attempt
        let response;
        try {
            response = await api.post('/api/auth/login', credentials);
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 401 && error.response.data.mfaRequired) {
                console.log(chalk.yellow('MFA Required'));
                const mfa = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'code',
                        message: 'Enter MFA Code:'
                    }
                ]);

                // Retry with MFA Token
                response = await api.post('/api/auth/login', {
                    ...credentials,
                    mfaToken: mfa.code
                });
            } else {
                throw error;
            }
        }
        
        const token = response.data.token;

        if (token) {
            appConfig.set('token', token);
            appConfig.set('username', credentials.username);
            console.log(chalk.green('Login Successful!'));
            return true;
        } else {
            console.log(chalk.red('Login Failed: No token received.'));
            return false;
        }

    } catch (error: any) {
        if (axios.isAxiosError(error)) {
             console.error(chalk.red(`Login Failed: ${error.response?.data?.message || error.message}`));
        } else {
             console.error(chalk.red('An unexpected error occurred during login.'));
        }
        return false;
    }
}

export function logout() {
    appConfig.delete('token');
    console.log(chalk.green('Logged out successfully.'));
}

export async function changePassword() {
    if (!appConfig.get('token')) {
        console.log(chalk.yellow('Not authenticated.'));
        const success = await login();
        if (!success) return;
    }

    console.log(chalk.blue('SSHBridge Change Password'));

    const answers = await inquirer.prompt([
        {
            type: 'password',
            name: 'oldPassword',
            message: 'Current Password:',
            mask: '*'
        },
        {
            type: 'password',
            name: 'newPassword',
            message: 'New Password:',
            mask: '*'
        },
        {
            type: 'password',
            name: 'confirmPassword',
            message: 'Confirm New Password:',
            mask: '*',
            validate: (input, answers) => {
                if (input !== answers.newPassword) {
                    return 'Passwords do not match';
                }
                return true;
            }
        }
    ]);

    try {
        await api.post('/api/auth/change-password', {
            oldPassword: answers.oldPassword,
            newPassword: answers.newPassword
        });
        console.log(chalk.green('Password changed successfully!'));
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await login();
            if (success) {
                return changePassword();
            }
        } else if (axios.isAxiosError(error)) {
            console.error(chalk.red(`Failed to change password: ${error.response?.data?.message || error.message}`));
        } else {
            console.error(chalk.red('An unexpected error occurred.'));
        }
    }
}

export async function fetchCurrentUser() {
    try {
        const response = await api.get('/api/auth/me');
        return response.data;
    } catch (error) {
        return null;
    }
}

export async function verifyPassword(): Promise<boolean> {
    const username = appConfig.get('username');
    if (!username) {
        console.log(chalk.red('User session not found. Please login.'));
        return await login();
    }

    const { password } = await inquirer.prompt([
        {
            type: 'password',
            name: 'password',
            message: chalk.red.bold(`PRODUCTION ACCESS: Enter password for ${username}:`),
            mask: '*'
        }
    ]);

    try {
        let response;
        try {
            response = await api.post('/api/auth/login', { username, password });
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response?.status === 401 && error.response.data.mfaRequired) {
                const mfa = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'code',
                        message: 'Enter MFA Code:'
                    }
                ]);

                response = await api.post('/api/auth/login', {
                    username,
                    password,
                    mfaToken: mfa.code
                });
            } else {
                throw error;
            }
        }

        if (response.data.token) {
            appConfig.set('token', response.data.token);
            return true;
        }
        return false;
    } catch (error) {
        console.log(chalk.red('Authentication failed. Access denied.'));
        return false;
    }
}
