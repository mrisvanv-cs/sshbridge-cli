import os from 'os';
import path from 'path';

const dataDir = path.join(os.homedir(), '.local', 'share', 'sshbridge');

export const SOCKET_IO_URL = 'https://api.sshbridge.csiq.io';
export const SOCKET_IO_ORIGIN = 'https://sshbridge.csiq.io';

export const daemonConfig = {
    dataDir,
    socketPath: process.env.SSHBRIDGE_DAEMON_SOCKET || path.join(dataDir, 'daemon.sock'),
    pidPath: path.join(dataDir, 'daemon.pid'),
    logPath: path.join(dataDir, 'daemon.log'),
    registryPath: path.join(dataDir, 'sessions.json'),
    keepaliveInterval: 60 * 1000,
    execTimeout: parseInt(process.env.SSHBRIDGE_EXEC_TIMEOUT || '30000', 10),
    reconnectBackoff: [1000, 2000, 5000, 10000],
    maxReconnects: 10,
    ipcTimeout: 30000,
};

export const EXIT_MARKER = '__SSHBRIDGE_EXIT__';
