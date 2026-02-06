# 🚀 Installing SSHBridge CLI

SSHBridge CLI is a powerful, terminal-based SSH connection manager designed for speed and ease of use. This guide will help you get it set up on your machine **without requiring root (sudo) privileges**.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: Version 16 or higher
- **NPM**: Usually bundled with Node.js

To check if they are installed, run:
```bash
node -v
npm -v
```


## 📦 Manual Installation (From Package)

If you have the `sshbridge-cli-1.0.0.tgz` file, you can install it manually using NPM:

### 1. Run the Install Command
This command installs the tool into your user directory (~/.local) so you don't need sudo. **It will also automatically attempt to configure your PATH.**

```bash
npm install -g sshbridge-cli-1.0.0.tgz --prefix ~/.local
```

### 2. Manual PATH Verification (If needed)
The installer automatically adds `~/.local/bin` to your shell config. If `sshbridge` is still not found after restarting your terminal, ensure the following line is in your `.bashrc` or `.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

---

## 🚀 Getting Started

Once installed, you can start using SSHBridge immediately:

| Command | Action |
| :--- | :--- |
| `sshbridge` | |
| `sshbridge -u` | Launch the full TUI (Dashboard) |
| `sshbridge -h` | View all available options |

---

## 🛠 Troubleshooting

### `sshbridge: command not found`
This usually means your shell doesn't know where the executable is. 
1. Ensure `~/.local/bin` is in your PATH (see step above).
2. Run `source ~/.bashrc` (or your relevant config file).

### Permission Denied
Ensure you are using the `--prefix ~/.local` flag during installation to avoid needing `sudo`.

---

## 🗑 Uninstallation

To completely remove SSHBridge CLI from your system:

```bash
npm uninstall -g sshbridge-cli --prefix ~/.local
```

---

*Enjoy using SSHBridge CLI! 🛰️*
