#!/bin/bash

set -e

echo "🚀 Installing SSHBridge CLI..."

# Define installation variables
REPO_URL="https://github.com/mrisvanv-cs/sshbridge-cli/archive/refs/heads/main.tar.gz"
INSTALL_DIR="$HOME/.local/bin"
TEMP_DIR=$(mktemp -d)

# Ensure ~/.local/bin exists
mkdir -p "$INSTALL_DIR"

echo "📦 Downloading source code..."
curl -L "$REPO_URL" -o "$TEMP_DIR/sshbridge.tar.gz"

echo "📂 Extracting..."
tar -xzf "$TEMP_DIR/sshbridge.tar.gz" -C "$TEMP_DIR"

# The directory name inside the tarball is generally repo-branch
EXTRACTED_DIR="$TEMP_DIR/sshbridge-cli-main"

if [ ! -d "$EXTRACTED_DIR" ]; then
  echo "Error: Directory $EXTRACTED_DIR not found. listing temp dir:"
  ls -R "$TEMP_DIR"
  exit 1
fi

echo "⚙️ Installing dependencies and building..."
cd "$EXTRACTED_DIR"
npm install
npm run build

echo "🔗 Installing globally to ~/.local..."
# We use npm pack + install to ensure a copy is made, not a symlink to the temp folder
VERSION=$(node -e "console.log(require('./package.json').version)")
TARBALL="sshbridge-cli-${VERSION}.tgz"
npm pack
npm install -g "$TARBALL" --prefix ~/.local

# Cleanup
echo "🧹 Cleaning up..."
rm -rf "$TEMP_DIR"

echo "✅ SSHBridge CLI installed successfully!"
echo ""
echo "Please ensure $INSTALL_DIR is in your PATH."
echo "You can verify installation by running: sshbridge --help"
