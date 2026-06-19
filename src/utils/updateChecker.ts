import axios from 'axios';
import chalk from 'chalk';
import Conf from 'conf';

const config = new Conf({ projectName: 'sshbridge-cli' });

const GITHUB_API_PACKAGE_URL =
    'https://api.github.com/repos/mrisvanv-cs/sshbridge-cli/contents/package.json?ref=main';

export async function fetchLatestVersion(): Promise<string> {
    const { data } = await axios.get(GITHUB_API_PACKAGE_URL, {
        timeout: 5000,
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'sshbridge-cli',
        },
    });

    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const pkg = JSON.parse(content);
    return pkg.version as string;
}

export async function checkForUpdate(currentVersion: string): Promise<{ latestVersion: string; currentVersion: string } | null> {
    const now = Date.now();

    try {
        const latestVersion = await fetchLatestVersion();
        config.set('lastUpdateCheck', now);

        if (compareVersions(latestVersion, currentVersion) > 0) {
            return { latestVersion, currentVersion };
        }

        return null;
    } catch {
        return null;
    }
}

export function showUpdateMessage(latestVersion: string, currentVersion: string) {
    console.log();
    console.log(chalk.yellow('************************************************'));
    console.log(chalk.yellow(`*  New version available: ${chalk.green(latestVersion)} (current: ${currentVersion})  *`));
    console.log(chalk.yellow('*  Run the command below to update:            *'));
    console.log(chalk.yellow(`*  ${chalk.cyan('sshbridge update')}                         *`));
    console.log(chalk.yellow('************************************************'));
    console.log();
}

export function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}
