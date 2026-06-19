# SSHBridge CLI

A terminal-based SSH connection manager with a beautiful TUI interface and persistent background sessions for fast automation.

## Installation (No Sudo Required)

### Option 1: Quick Install (Recommended)

```bash
git clone <your-repo-url>
cd sshbridge-cli
npm install
npm run build
./install.sh
```

After installation, restart your terminal or run:

```bash
source ~/.bashrc  # or source ~/.zshrc
sshbridge login
```

### Option 2: Manual Installation

```bash
git clone <your-repo-url>
cd sshbridge-cli
npm install
npm run build
npm install -g . --prefix ~/.local
export PATH="$HOME/.local/bin:$PATH"
```

## Usage

### Interactive

```bash
sshbridge                    # Wizard mode
sshbridge --ui               # TUI dashboard
sshbridge connect DEV-CRM-1  # Direct interactive SSH
```

### Background sessions (recommended for agents/scripts)

```bash
# Start a persistent background session (connect once)
sshbridge start DEV-CRM-1

# Run commands without reconnecting
sshbridge exec DEV-CRM-1 -- docker ps
sshbridge exec DEV-CRM-1 -- uptime

# List active sessions
sshbridge sessions

# Attach interactively to background session
sshbridge attach DEV-CRM-1
# Press Ctrl+] to detach

# Check session health
sshbridge status DEV-CRM-1

# Stop when done
sshbridge stop DEV-CRM-1
```

### One-shot exec (no daemon)

```bash
sshbridge exec DEV-CRM-1 --direct -- docker ps
```

### File transfer

```bash
sshbridge download DEV-CRM-1 /remote/path/file.txt
sshbridge upload DEV-CRM-1 ./local-file.txt /remote/path/
```

### Server management

```bash
sshbridge login
sshbridge list
sshbridge list --with-prod
```

## Features

- Beautiful terminal UI (wizard + dashboard)
- Secure authentication with MFA support
- Server list with group filtering
- **Persistent background sessions** - connect once, run many commands
- **`exec` command** - run remote commands with exit codes
- **`attach`** - interactive shell on background sessions
- File upload/download over the bridge
- Auto-reconnect and keepalive for background sessions

## How background sessions work

1. `sshbridge start` launches a local daemon (if not running) and opens a Socket.IO connection to the server
2. `sshbridge exec` sends commands over the existing connection (fast, no reconnect)
3. `sshbridge attach` opens an interactive terminal via a local TCP proxy
4. `sshbridge stop` closes the session; the daemon stays running for other sessions

See [ARCHITECTURE.md](ARCHITECTURE.md) and [PROTOCOL.md](PROTOCOL.md) for details.

## Development

```bash
npm install
npm run build
npm test
npm start
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
