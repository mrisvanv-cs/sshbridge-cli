#!/usr/bin/env node

import { Command } from 'commander';
import { startWizard } from './wizard';
import { startDashboard } from './dashboard';
import { login, logout, changePassword } from './commands/auth';
import { connect } from './commands/connect';
import { list } from './commands/list';

import { downloadFile, uploadFile } from './commands/scp';

const program = new Command();

program
  .name('sshbridge')
  .description('CLI to connect to SSHBridge servers')
  .version('1.0.0', '-v, --version')
  .option('-u, --ui', 'Launch TUI dashboard mode')
  .action(async (options) => {
       if (options.ui) {
           await startDashboard();
       } else {
           await startWizard();
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
  .action(list);

program.command('connect <serverName>')
  .description('Connect to a server by name or ID')
  .action(connect);

program.command('download <serverName> <remotePath> [localPath]')
  .description('Download a file from the server')
  .action(async (serverName, remotePath, localPath) => {
      await downloadFile(serverName, remotePath, localPath);
  });

program.command('upload <serverName> <localPath> [remotePath]')
  .description('Upload a file to the server')
  .action(async (serverName, localPath, remotePath) => {
      await uploadFile(serverName, localPath, remotePath);
  });

program.parse(process.argv);
