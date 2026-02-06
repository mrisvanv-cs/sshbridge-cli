# Distribution Guide for SSHBridge CLI (No Sudo Required)

This guide explains how to share the SSHBridge CLI tool with users who **don't have sudo access**.

---

## **Method 1: NPM Package (Recommended)**

### Step 1: Prepare for Publishing
1. Update `package.json` with proper metadata:
   - Add a unique name (if `sshbridge-cli` is taken, use `@yourusername/sshbridge-cli`)
   - Add description, repository, and author info
   - Ensure version is correct

2. Create an npm account at https://www.npmjs.com/signup

3. Login to npm:
   ```bash
   npm login
   ```

4. Publish the package:
   ```bash
   npm publish
   ```

### Step 2: Users Install Without Sudo
Users can install to their home directory:

```bash
# Install to ~/.local
npm install -g sshbridge-cli --prefix ~/.local

# Add to PATH (add this to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# Reload shell
source ~/.bashrc  # or source ~/.zshrc
```

Now they can run:
```bash
sshbridge
```

---

## **Method 2: Standalone Executable (No Node.js Required)**

Create a single executable file that bundles Node.js and all dependencies.

### Step 1: Install pkg
```bash
npm install -g pkg
```

### Step 2: Update package.json
Add this to your `package.json`:
```json
{
  "pkg": {
    "scripts": "dist/**/*.js",
    "targets": [ "node18-linux-x64", "node18-macos-x64", "node18-win-x64" ],
    "outputPath": "build"
  }
}
```

### Step 3: Build Executables
```bash
npm run build  # Compile TypeScript first
pkg .
```

This creates standalone executables in the `build/` folder:
- `sshbridge-linux` (for Linux)
- `sshbridge-macos` (for macOS)
- `sshbridge-win.exe` (for Windows)

### Step 4: Share the Executable
Users just download the file and run:
```bash
chmod +x sshbridge-linux
./sshbridge-linux
```

Or add to their PATH:
```bash
mkdir -p ~/.local/bin
mv sshbridge-linux ~/.local/bin/sshbridge
export PATH="$HOME/.local/bin:$PATH"  # Add to ~/.bashrc
```

---

## **Method 3: Direct Installation from Git**

Users can install directly from your GitHub repository:

```bash
# Clone the repo
git clone https://github.com/yourusername/sshbridge-cli.git
cd sshbridge-cli

# Install dependencies
npm install

# Build
npm run build

# Create symlink in user's local bin
mkdir -p ~/.local/bin
ln -s $(pwd)/dist/index.js ~/.local/bin/sshbridge
chmod +x dist/index.js

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"  # Add to ~/.bashrc
```

---

## **Method 4: Tarball Distribution**

Create a distributable package:

### Step 1: Build and Package
```bash
npm run build
npm pack
```

This creates `sshbridge-cli-1.0.0.tgz`

### Step 2: Users Install from Tarball
```bash
# Install from tarball
npm install -g sshbridge-cli-1.0.0.tgz --prefix ~/.local

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"  # Add to ~/.bashrc
```

---

## **Recommended Approach**

For **easiest distribution**: Use **Method 2 (Standalone Executable)**
- ✅ No Node.js installation required
- ✅ No npm required
- ✅ Single file to share
- ✅ Works immediately

For **professional distribution**: Use **Method 1 (NPM Package)**
- ✅ Easy updates (`npm update`)
- ✅ Version management
- ✅ Standard Node.js workflow

---

## **Quick Setup Script for Users**

Create this script for users to easily set up their PATH:

```bash
#!/bin/bash
# setup.sh

# Create local bin directory
mkdir -p ~/.local/bin

# Add to PATH if not already there
if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' ~/.bashrc; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    echo "✅ Added ~/.local/bin to PATH in ~/.bashrc"
fi

# Reload
source ~/.bashrc
echo "✅ Setup complete! You can now install tools to ~/.local/bin"
```

Users run:
```bash
chmod +x setup.sh
./setup.sh
```
