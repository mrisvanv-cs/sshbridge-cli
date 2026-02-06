const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const localBin = path.join(homeDir, '.local', 'bin');
const pathConfig = `export PATH="${localBin}:$PATH"`;

function updateShellConfig() {
    // List of possible shell config files
    const configs = [
        path.join(homeDir, '.zshrc'),
        path.join(homeDir, '.bashrc'),
        path.join(homeDir, '.profile'),
        path.join(homeDir, '.bash_profile')
    ];

    let updated = false;

    for (const config of configs) {
        if (fs.existsSync(config)) {
            try {
                const content = fs.readFileSync(config, 'utf8');
                
                // Check if already present
                if (!content.includes(localBin)) {
                    console.log(`\n🚀 Configuring PATH in ${config}...`);
                    fs.appendFileSync(config, `\n# Added by SSHBridge CLI\n${pathConfig}\n`);
                    updated = true;
                } else {
                    console.log(`\n✅ PATH already configured in ${config}`);
                    updated = true; // Mark as done if found in any
                }
            } catch (err) {
                console.error(`Could not update ${config}: ${err.message}`);
            }
        }
    }

    if (updated) {
        console.log('\n✨ Installation complete! Please RESTART your terminal or run:');
        console.log('   source ~/.bashrc (or your relevant shell config)\n');
    } else {
        console.log('\n⚠️ Could not find a shell config file to update.');
        console.log(`   Please manually add ${localBin} to your PATH:\n`);
        console.log(`   ${pathConfig}\n`);
    }
}

// Only run if we are installing globally (usually where --prefix is used)
// or if the user explicitly wants this setup.
if (process.env.npm_config_global || process.env.npm_lifecycle_event === 'postinstall') {
    updateShellConfig();
}
