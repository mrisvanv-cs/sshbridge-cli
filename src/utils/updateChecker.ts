import axios from 'axios';
import chalk from 'chalk';
import Conf from 'conf';

const config = new Conf({ projectName: 'sshbridge-cli' });
const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour

export async function checkForUpdate(currentVersion: string): Promise<{latestVersion: string, currentVersion: string} | null> {
  const lastCheck = config.get('lastUpdateCheck') as number;
  const now = Date.now();

  try {
    const { data } = await axios.get(`https://raw.githubusercontent.com/mrisvanv-cs/sshbridge-cli/main/package.json?t=${Date.now()}`, {
      timeout: 3000,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

    const latestVersion = data.version;

    config.set('lastUpdateCheck', now);

    if (compareVersions(latestVersion, currentVersion) > 0) {
      return { latestVersion, currentVersion };
    }
    
    return null;
  } catch (error) {
    // Silently fail if offline or git is down
    return null;
  }
}

export function showUpdateMessage(latestVersion: string, currentVersion: string) {
  console.log();
  console.log(chalk.yellow('************************************************'));
  console.log(chalk.yellow(`*  New version available: ${chalk.green(latestVersion)} (current: ${currentVersion})  *`));
  console.log(chalk.yellow(`*  Run the command below to update:            *`));
  console.log(chalk.yellow(`*  ${chalk.cyan('sshbridge update')}                         *`));
  console.log(chalk.yellow('************************************************'));
  console.log();
}

function compareVersions(v1: string, v2: string): number {
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
