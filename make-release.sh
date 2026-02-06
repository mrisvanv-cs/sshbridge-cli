#!/bin/bash
# SSHBridge CLI Release Automation Script

set -e

# 1. Clean and Build
echo "🧹 Cleaning and building..."
rm -rf dist/
npm run build

# 2. Get version from package.json
VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME="sshbridge-cli-$VERSION.tgz"

# 3. Create Package
echo "📦 Packaging $PACKAGE_NAME..."
# Remove old tgz files to avoid confusion
rm -f sshbridge-cli-*.tgz
npm pack

# 4. Run Test Installation
echo "🧪 Running test installation..."
chmod +x test-install.sh
./test-install.sh

echo ""
echo "===================================================="
echo "🎉 RELEASE READY: $PACKAGE_NAME"
echo "===================================================="
echo "1. Share $PACKAGE_NAME with your users."
echo "2. Share INSTALL_INSTRUCTIONS.md with them."
echo "Done!"
