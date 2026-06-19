import { execSync } from 'child_process';
import chalk from 'chalk';
import { compareVersions, fetchLatestVersion } from '../utils/updateChecker';
const pkg = require('../../package.json');

export async function update() {
    console.log(chalk.cyan('Checking for updates...'));

    try {
        const latestVersion = await fetchLatestVersion();
        const currentVersion = pkg.version;

        if (compareVersions(latestVersion, currentVersion) <= 0) {
            console.log(chalk.green(`You are already on the latest version (${currentVersion}).`));
            return;
        }

        console.log(chalk.yellow(`\nUpdating from ${currentVersion} to ${chalk.green(latestVersion)}...`));
        console.log(chalk.gray('Running update script...'));

        const updateCommand =
            'curl -fsSL https://raw.githubusercontent.com/mrisvanv-cs/sshbridge-cli/main/install.sh | bash';

        execSync(updateCommand, { stdio: 'inherit' });

        console.log(chalk.bold.green(`\nSSHBridge CLI has been updated to ${latestVersion}!`));
        console.log(chalk.gray('Please restart your terminal if the new version is not reflected immediately.'));
    } catch (error: any) {
        console.error(chalk.red(`\nUpdate failed: ${error.message}`));
        console.log(chalk.yellow('Please try manual update:'));
        console.log(
            chalk.cyan('curl -fsSL https://raw.githubusercontent.com/mrisvanv-cs/sshbridge-cli/main/install.sh | bash')
        );
    }
}
