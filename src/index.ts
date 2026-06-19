#!/usr/bin/env node

import { Command } from 'commander';
import { startWizard } from './wizard';
import { startDashboard } from './dashboard';
import { login, logout, changePassword } from './commands/auth';
import { connect } from './commands/connect';
import { list } from './commands/list';
import { downloadFile, uploadFile } from './commands/scp';
import { update } from './commands/update';
import { uninstall } from './commands/uninstall';
import { execCommand } from './commands/exec';
import { start } from './commands/start';
import { stop } from './commands/stop';
import { sessions } from './commands/sessions';
import { status } from './commands/status';
import { attach } from './commands/attach';
import { checkForUpdate, showUpdateMessage } from './utils/updateChecker';
const pkg = require('../package.json');

(async () => {
    let updateInfo: { latestVersion: string; currentVersion: string } | null = null;
    try {
        updateInfo = await checkForUpdate(pkg.version);
    } catch {
        // ignore update check errors
    }

    const program = new Command();

    program
        .name('sshbridge')
        .description('CLI to connect to SSHBridge servers')
        .version(pkg.version, '-v, --version')
        .option('-u, --ui', 'Launch TUI dashboard mode')
        .option('--with-prod', 'Include production servers')
        .action(async (options) => {
            if (options.ui) {
                await startDashboard(updateInfo);
            } else {
                await startWizard(options, updateInfo);
            }
        });

    program.command('login')
        .description('Login to SSHBridge')
        .action(async () => { await login(); });

    program.command('logout')
        .description('Logout and clear stored credentials')
        .action(logout);

    program.command('change-password')
        .description('Change your password')
        .action(async () => { await changePassword(); });

    program.command('update')
        .description('Update SSHBridge CLI to the latest version')
        .action(async () => { await update(); });

    program.command('uninstall')
        .description('Completely remove SSHBridge CLI')
        .action(async () => { await uninstall(); });

    program.command('list')
        .description('List available servers')
        .option('--with-prod', 'Include production servers')
        .action((options, command) => {
            if (updateInfo) showUpdateMessage(updateInfo.latestVersion, updateInfo.currentVersion);
            const mergedOptions = { ...command.parent.opts(), ...options };
            return list(mergedOptions);
        });

    program.command('connect <serverName>')
        .description('Connect to a server by name or ID')
        .action((serverName) => {
            if (updateInfo) showUpdateMessage(updateInfo.latestVersion, updateInfo.currentVersion);
            return connect(serverName);
        });

    program.command('start <serverName>')
        .description('Start a persistent background session')
        .action((serverName) => start(serverName));

    program.command('stop <serverName>')
        .description('Stop a background session')
        .action((serverName) => stop(serverName));

    program.command('sessions')
        .description('List active background sessions')
        .action(() => sessions());

    program.command('status <serverName>')
        .description('Show status of a background session')
        .action((serverName) => status(serverName));

    program.command('attach <serverName>')
        .description('Attach to a background session interactively')
        .action((serverName) => attach(serverName));

    program.command('exec <serverName> [command...]')
        .description('Execute a command on the server')
        .option('--direct', 'Run without daemon (reconnect each time)')
        .option('--timeout <ms>', 'Command timeout in milliseconds', '30000')
        .action(async (serverName, commandParts, options) => {
            const command = commandParts.join(' ');
            if (!command) {
                console.error('No command provided.');
                process.exit(1);
            }
            const exitCode = await execCommand(serverName, command, {
                useDaemon: !options.direct,
                timeout: parseInt(options.timeout, 10)
            });
            process.exit(exitCode);
        });

    program.command('download <serverName> <remotePath> [localPath]')
        .description('Download a file from the server')
        .action((serverName, remotePath, localPath) => {
            downloadFile(serverName, remotePath, localPath);
        });

    program.command('upload <serverName> <localPath> [remotePath]')
        .description('Upload a file to the server')
        .action((serverName, localPath, remotePath) => {
            uploadFile(serverName, localPath, remotePath);
        });

    await program.parseAsync(process.argv);
})();
