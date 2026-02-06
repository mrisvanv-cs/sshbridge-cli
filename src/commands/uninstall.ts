import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

export async function uninstall() {
    console.log(chalk.red.bold('\n⚠️  UNINSTALL SSHBRIDGE CLI ⚠️'));
    
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to uninstall SSHBridge CLI?',
            default: false
        }
    ]);

    if (!confirm) {
        console.log(chalk.cyan('Uninstall aborted.'));
        return;
    }

    try {
        console.log(chalk.gray('Uninstalling package...'));
        
        // Use the same prefix as installation
        execSync('npm uninstall -g sshbridge-cli --prefix ~/.local', { stdio: 'inherit' });

        console.log(chalk.bold.green('\n✅ SSHBridge CLI has been uninstalled.'));
        console.log(chalk.gray('Note: Your PATH configurations in ~/.bashrc or ~/.zshrc were not modified.'));
        console.log(chalk.gray('You can manually remove them if you wish to completely clean up.'));

    } catch (error: any) {
        console.error(chalk.red(`\nUninstall failed: ${error.message}`));
        console.log(chalk.yellow('Please try manual uninstall:'));
        console.log(chalk.cyan('npm uninstall -g sshbridge-cli --prefix ~/.local'));
    }
}
