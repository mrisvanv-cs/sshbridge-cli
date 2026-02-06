import axios from 'axios';
import chalk from 'chalk';
import Conf from 'conf';

const config = new Conf({ projectName: 'sshbridge-cli' });
const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour

export async function checkForUpdate(currentVersion: string) {
  const lastCheck = config.get('lastUpdateCheck') as number;
  const now = Date.now();

  // If we checked recently, skip (unless debug/force?) 
  // For now, adhering to user request "if i run sshbridge", but adding a small throttle 
  // so it doesn't lag *too* much if they spam commands.
 /* if (lastCheck && now - lastCheck < UPDATE_CHECK_INTERVAL) {
    return;
  }*/ 
  // Actually, user wants to see it. I'll make it always check but with a short timeout so it doesn't hang.
  
  try {
    const { data } = await axios.get(`https://raw.githubusercontent.com/mrisvanv-cs/sshbridge-cli/main/package.json?t=${Date.now()}`, {
      timeout: 1500 // Don't wait too long
    });

    const latestVersion = data.version;

    if (compareVersions(latestVersion, currentVersion) > 0) {
      console.log();
      console.log(chalk.yellow('************************************************'));
      console.log(chalk.yellow(`*  New version available: ${chalk.green(latestVersion)} (current: ${currentVersion})  *`));
      console.log(chalk.yellow(`*  Run the install script again to update:     *`));
      console.log(chalk.yellow(`*  ${chalk.cyan('curl ... | bash')}                         *`));
      console.log(chalk.yellow('************************************************'));
      console.log();
    }
    
    config.set('lastUpdateCheck', now);
  } catch (error) {
    // Silently fail if offline or git is down
  }
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
