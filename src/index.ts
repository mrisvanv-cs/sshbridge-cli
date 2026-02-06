#!/usr/bin/env node

import { Command } from 'commander';
import { startWizard } from './wizard';
import { startDashboard } from './dashboard';
import { login, logout, changePassword } from './commands/auth';
import { connect } from './commands/connect';
import { list } from './commands/list';

import { downloadFile, uploadFile } from './commands/scp';

import { checkForUpdate } from './utils/updateChecker';
const pkg = require('../package.json'); // Using require for reliability with structure

// Check for updates before any command
(async () => {
    try {
        await checkForUpdate(pkg.version);
    } catch (e) {
        // Silently ignore update check errors
    }

    const program = new Command();

    program
      .name('sshbridge')
      .description('CLI to connect to SSHBridge servers')
      .version('1.0.0', '-v, --version')
      .option('-u, --ui', 'Launch TUI dashboard mode')
      .option('--with-prod', 'Include production servers')
      .action(async (options) => {
           if (options.ui) {
               await startDashboard();
           } else {
               await startWizard(options);
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

    program.command('list')
      .description('List available servers')
      .option('--with-prod', 'Include production servers')
      .action((options) => list(options));

    program.command('connect <serverName>')
      .description('Connect to a server by name or ID')
      .action((serverName) => connect(serverName));

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
