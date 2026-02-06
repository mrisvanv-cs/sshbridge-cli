import axios from 'axios';
import chalk from 'chalk';
import { api, appConfig } from '../api';
import { login } from './auth';

export async function fetchServers() {
    console.log(chalk.gray('Fetching servers...'));
    const response = await api.get('/api/servers');
    // The API returns { servers: [...] } based on debug info
    if (response.data && Array.isArray(response.data.servers)) {
        return response.data.servers;
    }
    // Fallback if it is an array (just in case)
    if (Array.isArray(response.data)) {
        return response.data;
    }
    console.error(chalk.red('Unexpected API response structure:', JSON.stringify(response.data)));
    return [];
}

export async function fetchGroups() {
    console.log(chalk.gray('Fetching groups...'));
    try {
        const response = await api.get('/api/servers/groups');
        if (Array.isArray(response.data)) {
            return response.data;
        }
        if (response.data && Array.isArray(response.data.groups)) {
            return response.data.groups;
        }
        console.warn(chalk.yellow('Unexpected groups format, defaulting to empty list.'));
        return [];
    } catch (error: any) {
        // console.error(chalk.red(`Failed to fetch groups: ${error.message}`));
        // Silently fail for groups to allow dashboard to load
        return [];
    }
}

export async function list() {
    const token = appConfig.get('token');
    if (!token) {
        console.log(chalk.yellow('Not authenticated.'));
        const success = await login();
        if (!success) return;
    }

    try {
        const servers = await fetchServers();

        if (servers.length === 0) {
            console.log(chalk.yellow('No servers found.'));
            return;
        }

        console.log(chalk.cyan(`Found ${servers.length} servers:`));
        console.table(servers.map((s: any) => ({
            ID: s._id || s.id || 'N/A',
            Name: s.name,
            Hostname: s.ip,
            Status: s.status || s.connectionStatus || 'Available'
        })));
        

    } catch (error: any) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            console.log(chalk.red('\nSession expired or invalid token.'));
            const success = await login();
            if (success) {
                // Retry list
                return list();
            }
        } else {
            console.error(chalk.red(`Failed to list servers: ${error.message}`));
        }
    }
}
