# Quick Start Guide for Users

## Installation (3 Simple Steps - No Sudo Needed!)

### Step 1: Get the Code
```bash
git clone <repository-url>
cd sshbridge-cli
```

### Step 2: Install Dependencies
```bash
npm install
npm run build
```

### Step 3: Run the Installer
```bash
./install.sh
```

**That's it!** Restart your terminal and type `sshbridge` to start.

---

## Alternative: Run Without Installing

If you don't want to install globally:

```bash
git clone <repository-url>
cd sshbridge-cli
npm install
npm run build
npm start
```

---

## Troubleshooting

### "npm: command not found"
You need Node.js and npm installed. Download from: https://nodejs.org/

### "Permission denied" when running install.sh
Make it executable:
```bash
chmod +x install.sh
./install.sh
```

### "sshbridge: command not found" after installation
Restart your terminal or run:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

### Still not working?
Run manually from the project directory:
```bash
cd /path/to/sshbridge-cli
npm start
```

---

## What Does This Tool Do?

SSHBridge CLI is a terminal-based SSH connection manager that:
- 🔐 Securely manages your SSH connections
- 🎨 Provides a beautiful terminal interface
- 📋 Organizes servers by groups
- 🚀 Makes SSH connections quick and easy

---

## Need Help?

Contact the maintainer or open an issue on GitHub.
