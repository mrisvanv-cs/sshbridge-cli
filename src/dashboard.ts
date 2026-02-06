import blessed from 'blessed';
import chalk from 'chalk';
import axios from 'axios';
import { fetchServers, fetchGroups } from './commands/list';
import { fetchCurrentUser } from './commands/auth';
import { connectToServer } from './commands/connect';
import { appConfig } from './api';
import { showLoginForm } from './loginForm';

export async function startDashboard(updateInfo: any = null) {
    // 1. Auth Check
    let token = appConfig.get('token');
    if (!token) {
        const success = await showLoginForm();
        if (!success) {
            console.log(chalk.yellow('Login cancelled.'));
            return;
        }
        token = appConfig.get('token');
        if (!token) return;
    }

    // 2. Fetch Data
    let servers, groups, user;
    try {
        [servers, groups, user] = await Promise.all([
            fetchServers(),
            fetchGroups(),
            fetchCurrentUser()
        ]);
    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await showLoginForm();
            if (success) {
                return startDashboard();
            }
            return;
        }
        console.log(chalk.red(`Failed to load data: ${error.message}`));
        return;
    }

    if (!servers || !groups) {
        console.log('Failed to load data.');
        return;
    }

    if (!Array.isArray(groups)) {
        console.error('Groups data is not an array.');
        return;
    }
    
    if (!Array.isArray(servers)) {
        console.error('Servers data is not an array.');
        return;
    }

    // 3. Init Screen
    const screen = blessed.screen({
        smartCSR: true,
        title: 'SSHBridge Dashboard',
        fullUnicode: true
    });

    // 4. Layout
    // Left: Development Groups
    // Center: Servers
    // Right: Production Groups

    const devGroups = groups.filter((g: any) => g.type === 'development' || !g.type || g.type === 'dev' || g.name.toLowerCase().includes('dev'));
    const prodGroups = groups.filter((g: any) => g.type === 'production' || g.type === 'prod' || g.name.toLowerCase().includes('prod'));

    // Header
    const header = blessed.box({
        parent: screen,
        top: 0,
        left: 0,
        width: '100%',
        height: 1,
        content: ` SSHBridge CLI | MFA: ${user && user.mfaEnabled ? 'Enabled' : 'Disabled'} | Arrow Keys: Navigate | Enter: Select | o: Logout | p: Password | q: Exit`,
        style: {
            bg: 'blue',
            fg: 'white',
            bold: true
        }
    });

    if (updateInfo) {
        blessed.box({
            parent: screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 1,
            content: ` 🚀 NEW VERSION AVAILABLE: ${updateInfo.latestVersion} (Current: ${updateInfo.currentVersion}) | Run 'sshbridge update' to install! `,
            style: {
                bg: 'yellow',
                fg: 'black',
                bold: true
            }
        });
    }

    // Styles - blue border by default, green when focused
    const listStyle = {
        selected: {
            bg: 'green',
            fg: 'white',
            bold: true
        },
        item: {
            fg: 'white'
        },
        border: {
            fg: 'blue'
        }
    };

    const colHeight = updateInfo ? '100%-2' : '100%-1';

    // Columns
    const leftCol = blessed.list({
        parent: screen,
        top: 1,
        left: 0,
        width: '25%',
        height: colHeight,
        label: ' Dev Groups ',
        border: { type: 'line' },
        style: listStyle,
        keys: true,
        vi: true,
        tags: true,
        items: ['All Servers', ...devGroups.map((g: any) => g.name)]
    });

    const midCol = blessed.list({
        parent: screen,
        top: 1,
        left: '25%',
        width: '50%',
        height: colHeight,
        label: ' Servers ',
        border: { type: 'line' },
        style: listStyle,
        keys: true,
        vi: true,
        tags: true,
        items: servers.map((s: any) => s.name)
    });

    const rightCol = blessed.list({
        parent: screen,
        top: 1,
        left: '75%',
        width: '25%',
        height: colHeight,
        label: ' Prod Groups ',
        border: { type: 'line' },
        style: listStyle,
        keys: true,
        vi: true,
        tags: true,
        items: ['All Servers', ...prodGroups.map((g: any) => g.name)]
    });

    // Logic
    let currentServerList = [...servers];
    let selectedServerIndex = 0;

    const updateServerList = (group: any | null = null) => {
        if (group && group.servers && Array.isArray(group.servers)) {
            // Use the servers array from the group object (this is the correct way)
            const groupServerIds = group.servers.map((s: any) => s._id);
            currentServerList = servers.filter((s: any) => groupServerIds.includes(s._id));
        } else {
            currentServerList = [...servers];
        }
        
        midCol.setItems(currentServerList.map((s: any) => {
             return s.name + (s.ip ? ` (${s.ip})` : '');
        }));
        midCol.select(0);
        selectedServerIndex = 0;
        screen.render();
    };
    
    // Initial Render
    updateServerList();

    // Event Handlers
    
    // Focus handlers to change border color and label
    const updateBorders = () => {
        const focused = (screen as any).focused;
        
        // Update each column's border color and label
        if (focused === leftCol) {
            leftCol.style.border = { fg: 'green' };
            leftCol.setLabel(' Dev Groups {green-fg}[FOCUSED]{/green-fg} ');
            leftCol.setFront();
        } else {
            leftCol.style.border = { fg: 'blue' };
            leftCol.setLabel(' Dev Groups ');
        }
        
        if (focused === midCol) {
            midCol.style.border = { fg: 'green' };
            midCol.setLabel(' Servers {green-fg}[FOCUSED]{/green-fg} ');
            midCol.setFront();
        } else {
            midCol.style.border = { fg: 'blue' };
            midCol.setLabel(' Servers ');
        }
        
        if (focused === rightCol) {
            rightCol.style.border = { fg: 'red' };
            rightCol.setLabel(' Prod Groups {red-fg}[FOCUSED]{/red-fg} ');
            rightCol.setFront();
        } else {
            rightCol.style.border = { fg: 'blue' };
            rightCol.setLabel(' Prod Groups ');
        }
        
        screen.render();
    };

    leftCol.on('focus', updateBorders);
    midCol.on('focus', updateBorders);
    rightCol.on('focus', updateBorders);
    
    // Initial Focus
    midCol.focus();
    updateBorders();

    // Track server selection
    midCol.on('select item', (_item: any, index: number) => {
        selectedServerIndex = index;
    });

    // Navigation Left/Right
    screen.key(['left'], () => {
        const focused = (screen as any).focused;
        if (focused === midCol) leftCol.focus();
        else if (focused === rightCol) midCol.focus();
        else if (focused === leftCol) rightCol.focus(); // wrap around
    });

    screen.key(['right'], () => {
        const focused = (screen as any).focused;
        if (focused === leftCol) midCol.focus();
        else if (focused === midCol) rightCol.focus();
        else if (focused === rightCol) leftCol.focus(); // wrap around
    });

    // Group Selection
    leftCol.on('select', (_item: any, index: number) => {
        if (index === 0) {
            // "All Servers" selected
            updateServerList(null);
        } else {
            const group = devGroups[index - 1]; // -1 because "All Servers" is at index 0
            updateServerList(group);
        }
        midCol.focus();
    });

    rightCol.on('select', (_item: any, index: number) => {
        if (index === 0) {
            // "All Servers" selected
            updateServerList(null);
        } else {
            const group = prodGroups[index - 1]; // -1 because "All Servers" is at index 0
            updateServerList(group);
        }
        midCol.focus();
    });

    // Server Selection -> Show Role Popup
    midCol.on('select', async (_item: any, index: number) => {
        selectedServerIndex = index;
        const server = currentServerList[selectedServerIndex];
        
        if (!server) {
            return;
        }

        // Create role selection popup
        const popup = blessed.list({
            parent: screen,
            top: 'center',
            left: 'center',
            width: 40,
            height: 8,
            label: ` Connect to ${server.name} `,
            border: { type: 'line' },
            style: {
                selected: {
                    bg: 'green',
                    fg: 'white',
                    bold: true
                },
                border: {
                    fg: 'green'
                }
            },
            keys: true,
            vi: true,
            items: ['User', 'Admin']
        });

        popup.focus();
        screen.render();

        // Handle role selection
        popup.on('select', async (_item: any, roleIndex: number) => {
            const role = roleIndex === 0 ? 'user' : 'admin';
            
            screen.destroy();
            
            console.log(chalk.green(`Connecting to ${server.name} as ${role}...`));
            
            try {
                await connectToServer(server, role);
            } catch (e: any) {
                console.error(e);
                process.exit(1);
            }
        });

        // Handle escape to close popup
        popup.key(['escape', 'q'], () => {
            popup.destroy();
            midCol.focus();
            screen.render();
        });
    });

    // Logout
    screen.key(['o', 'O'], () => {
        // Create logout confirmation popup with list
        const logoutPopup = blessed.list({
            parent: screen,
            top: 'center',
            left: 'center',
            width: 50,
            height: 9,
            label: ' Logout Confirmation ',
            border: { type: 'line' },
            style: {
                selected: {
                    bg: 'yellow',
                    fg: 'black',
                    bold: true
                },
                border: {
                    fg: 'yellow'
                }
            },
            keys: true,
            vi: true,
            items: ['Yes, logout', 'No, cancel']
        });

        logoutPopup.focus();
        screen.render();

        logoutPopup.on('select', async (_item: any, index: number) => {
            logoutPopup.destroy();
            
            if (index === 0) {
                // Yes, logout
                screen.destroy();
                const { logout } = await import('./commands/auth');
                logout();
                console.log(chalk.yellow('Logged out successfully.'));
                process.exit(0);
            } else {
                // No, cancel
                midCol.focus();
                screen.render();
            }
        });

        // Handle escape to close popup
        logoutPopup.key(['escape', 'q'], () => {
            logoutPopup.destroy();
            midCol.focus();
            screen.render();
        });
    });

    // Change Password
    screen.key(['p', 'P'], async () => {
        screen.destroy();
        const { changePassword } = await import('./commands/auth');
        await changePassword();
        console.log(chalk.cyan('\nReturning to dashboard in 3 seconds...'));
        setTimeout(() => {
            startDashboard();
        }, 3000);
    });

    // Quit
    screen.key(['q', 'C-c'], () => {
        screen.destroy();
        process.exit(0);
    });

    screen.render();
}
