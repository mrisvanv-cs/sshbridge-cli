# SSHBridge CLI

A terminal-based SSH connection manager with a beautiful TUI interface.

## 🚀 Installation (No Sudo Required)

### Option 1: Quick Install (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd sshbridge-cli

# Install dependencies and build
npm install
npm run build

# Run the installer
./install.sh
```

After installation, restart your terminal or run:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

Then use:
```bash
sshbridge
```

### Option 2: Manual Installation

```bash
# Clone and build
git clone <your-repo-url>
cd sshbridge-cli
npm install
npm run build

# Install to local directory
npm install -g . --prefix ~/.local

# Add to PATH (add this line to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# Reload shell
source ~/.bashrc
```

### Option 3: Run Without Installing

```bash
git clone <your-repo-url>
cd sshbridge-cli
npm install
npm run build
npm start
```

## 📦 For Distributors

If you want to share this tool with others:

1. **Share the repository**: Users can clone and run `./install.sh`
2. **Create a tarball**: Run `npm pack` and share the `.tgz` file
3. **Build standalone executable**: See `DISTRIBUTION.md` for details

## 🔧 Usage

```bash
# Launch the TUI dashboard
sshbridge

# Or use specific commands
sshbridge login
sshbridge list
```

## 📝 Features

- 🎨 Beautiful terminal UI
- 🔐 Secure authentication with MFA support
- 📋 Server list with group filtering
- 🚀 Quick SSH connection management
- 💾 Persistent session storage

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
npm start
```

## 📄 License

ISC

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
