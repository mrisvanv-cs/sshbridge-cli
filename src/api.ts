import axios from 'axios';
const Conf = require('conf');

// Define interface for Config
interface ConfigSchema {
    token: string;
}

// Initialize configuration
const config = new Conf({
    projectName: 'sshbridge-cli',
    schema: {
        token: {
            type: 'string',
            default: ''
        }
    }
});

// Create Axios Instance
export const api = axios.create({
    baseURL: 'https://api.sshbridge.csiq.io',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add Token
api.interceptors.request.use((req) => {
    const token = config.get('token');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

// Export Config for other modules to use (e.g., save token)
export const appConfig = config;
