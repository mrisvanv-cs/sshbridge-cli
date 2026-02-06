import blessed from 'blessed';
import chalk from 'chalk';
import { api, appConfig } from './api';

export async function showLoginForm(): Promise<boolean> {
    return new Promise((resolve) => {
        const screen = blessed.screen({
            smartCSR: true,
            title: 'SSHBridge Login'
        });

        // Create form container
        const form = blessed.form({
            parent: screen,
            top: 'center',
            left: 'center',
            width: 60,
            height: 18,
            label: ' SSHBridge Authentication ',
            border: { type: 'line' },
            style: {
                border: {
                    fg: 'cyan'
                }
            },
            keys: true
        });

        // Username label
        blessed.text({
            parent: form,
            top: 1,
            left: 2,
            content: 'Username:'
        });

        // Username input
        const usernameInput = blessed.textbox({
            parent: form,
            name: 'username',
            top: 2,
            left: 2,
            height: 1,
            width: 54,
            inputOnFocus: true,
            mouse: true,
            style: {
                fg: 'white',
                bg: 'black',
                focus: {
                    bg: 'blue',
                    fg: 'white'
                }
            }
        });

        // Password label
        blessed.text({
            parent: form,
            top: 4,
            left: 2,
            content: 'Password:'
        });

        // Password input
        const passwordInput = blessed.textbox({
            parent: form,
            name: 'password',
            top: 5,
            left: 2,
            height: 1,
            width: 54,
            inputOnFocus: true,
            censor: true,
            mouse: true,
            style: {
                fg: 'white',
                bg: 'black',
                focus: {
                    bg: 'blue',
                    fg: 'white'
                }
            }
        });

        // MFA label
        blessed.text({
            parent: form,
            top: 7,
            left: 2,
            content: 'MFA Code (if required):'
        });

        // MFA input
        const mfaInput = blessed.textbox({
            parent: form,
            name: 'mfa',
            top: 8,
            left: 2,
            height: 1,
            width: 54,
            inputOnFocus: true,
            mouse: true,
            style: {
                fg: 'white',
                bg: 'black',
                focus: {
                    bg: 'blue',
                    fg: 'white'
                }
            }
        });

        // Status message
        const statusMsg = blessed.text({
            parent: form,
            top: 10,
            left: 2,
            width: 54,
            content: '',
            style: {
                fg: 'yellow'
            }
        });

        // Login button
        const loginButton = blessed.button({
            parent: form,
            top: 12,
            left: 2,
            width: 25,
            height: 3,
            content: 'Login',
            align: 'center',
            style: {
                bg: 'green',
                fg: 'white',
                focus: {
                    bg: 'white',
                    fg: 'green'
                }
            },
            keys: true
        });

        // Cancel button
        const cancelButton = blessed.button({
            parent: form,
            top: 12,
            left: 29,
            width: 25,
            height: 3,
            content: 'Cancel',
            align: 'center',
            style: {
                bg: 'red',
                fg: 'white',
                focus: {
                    bg: 'white',
                    fg: 'red'
                }
            },
            keys: true
        });

        // Handle login
        const handleLogin = async () => {
            const username = usernameInput.getValue() || '';
            const password = passwordInput.getValue() || '';
            let mfaCode = mfaInput.getValue() || '';

            if (!username || !password) {
                statusMsg.setContent(chalk.red('Username and password are required'));
                screen.render();
                return;
            }

            statusMsg.setContent(chalk.yellow('Authenticating...'));
            screen.render();

            try {
                // Initial login attempt
                let response;
                try {
                    response = await api.post('/api/auth/login', {
                        username: username.trim(),
                        password: password.trim()
                    });
                } catch (error: any) {
                    // Check if MFA is required
                    if (error.response?.status === 401 && error.response?.data?.mfaRequired) {
                        // If MFA code was already entered, use it
                        if (mfaCode.trim()) {
                            response = await api.post('/api/auth/login', {
                                username: username.trim(),
                                password: password.trim(),
                                mfaToken: mfaCode.trim()
                            });
                        } else {
                            // Prompt for MFA
                            statusMsg.setContent(chalk.yellow('MFA Required - Please enter MFA code above'));
                            screen.render();
                            mfaInput.focus();
                            return;
                        }
                    } else {
                        throw error;
                    }
                }

                if (response.data && response.data.token) {
                    appConfig.set('token', response.data.token);
                    appConfig.set('username', username.trim());
                    screen.destroy();
                    resolve(true);
                } else {
                    statusMsg.setContent(chalk.red('Login failed: Invalid response'));
                    screen.render();
                }
            } catch (error: any) {
                const errorMsg = error.response?.data?.message || error.message || 'Login failed';
                statusMsg.setContent(chalk.red(`Error: ${errorMsg}`));
                screen.render();
            }
        };

        // Handle cancel
        const handleCancel = () => {
            screen.destroy();
            resolve(false);
        };

        // Tab navigation and input activation
        usernameInput.on('focus', () => {
            usernameInput.readInput();
        });

        usernameInput.on('submit', () => {
            passwordInput.focus();
        });

        passwordInput.on('focus', () => {
            passwordInput.readInput();
        });

        passwordInput.on('submit', () => {
            mfaInput.focus();
        });

        mfaInput.on('focus', () => {
            mfaInput.readInput();
        });

        mfaInput.on('submit', () => {
            handleLogin();
        });

        // Button events
        loginButton.on('press', handleLogin);
        cancelButton.on('press', handleCancel);

        // Escape to cancel
        screen.key(['escape', 'C-c'], handleCancel);

        // Focus first input and activate it
        usernameInput.focus();
        screen.render();
    });
}
