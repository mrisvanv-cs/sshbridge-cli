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

import { checkForUpdate, showUpdateMessage } from './utils/updateChecker';
const pkg = require('../package.json'); // Using require for reliability with structure

(async () => {
    // Check for updates before any command
    let updateInfo: {latestVersion: string, currentVersion: string} | null = null;
    try {
        updateInfo = await checkForUpdate(pkg.version);
    } catch (e) {
        // Silently ignore update check errors
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
