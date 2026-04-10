#!/bin/bash
# CineLink Bridge — macOS launcher
# Double-click this file to start the bridge.
# Requires Node.js 18+ installed: https://nodejs.org

# Change to the folder containing this script
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║       CineLink Bridge  Beta 3          ║"
echo "║   Sony PTP/IP ↔ ATEM Camera Control   ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found."
  echo "Install it from https://nodejs.org (LTS version recommended)"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

NODE_VERSION=$(node -e "process.stdout.write(process.version)")
echo "Node.js: $NODE_VERSION"

# Install dependencies if needed
if [ ! -d "node_modules/atem-connection" ]; then
  echo ""
  echo "Installing dependencies (first run only)..."
  npm install --production --no-audit --no-fund 2>&1
  if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: npm install failed. Check your internet connection."
    read -p "Press Enter to exit..."
    exit 1
  fi
fi

echo ""
echo "Starting server..."
echo "Open http://localhost:7777 in your browser"
echo "Press Ctrl+C to stop"
echo ""

node dist/bridge.cjs

echo ""
read -p "Bridge stopped. Press Enter to close..."
