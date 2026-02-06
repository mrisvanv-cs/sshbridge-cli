#!/bin/bash
# Test script to verify the tarball installation works

set -e

echo "🧪 Testing SSHBridge CLI Installation..."
echo ""

# Create a temporary test directory
TEST_DIR=$(mktemp -d)
TEST_PREFIX="$TEST_DIR/test-install"

echo "📁 Test directory: $TEST_DIR"
echo ""

# Copy tarball to test directory
cp sshbridge-cli-1.0.0.tgz "$TEST_DIR/"
cd "$TEST_DIR"

echo "📦 Installing package to test prefix..."
npm install -g sshbridge-cli-1.0.0.tgz --prefix "$TEST_PREFIX"

echo ""
echo "✅ Installation successful!"
echo ""

# Check if binary exists
if [ -f "$TEST_PREFIX/bin/sshbridge" ]; then
    echo "✅ Binary found at: $TEST_PREFIX/bin/sshbridge"
else
    echo "❌ Binary not found!"
    exit 1
fi

# Check if it's executable
if [ -x "$TEST_PREFIX/bin/sshbridge" ]; then
    echo "✅ Binary is executable"
else
    echo "❌ Binary is not executable!"
    exit 1
fi

echo ""
echo "🎉 All tests passed!"
echo ""
echo "Cleaning up test directory..."
rm -rf "$TEST_DIR"

echo "✅ Test complete!"
