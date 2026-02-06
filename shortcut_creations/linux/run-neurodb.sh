#!/bin/bash

# ===========================
# NeuroDB Project Runner
# ===========================
# This script launches the NeuroDB Electron application in development mode.
# Install this script to /usr/local/bin/run-neurodb for easy terminal access.
#
# Installation:
#   sudo cp run-neurodb.sh /usr/local/bin/run-neurodb
#   sudo chmod +x /usr/local/bin/run-neurodb
#
# Usage:
#   run-neurodb

# ====================
# CONFIGURATION
# ====================
# ⚠️ IMPORTANT: Update this path to your actual NeuroDB project location
PROJECT_DIR="$HOME/Desktop/NeuroDB"

# ====================
# SCRIPT START
# ====================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting NeuroDB..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Navigate to project directory
if cd "$PROJECT_DIR"; then
    echo "✅ Project directory: $PROJECT_DIR"
else
    echo "❌ Error: Failed to navigate to project directory"
    echo "   Path: $PROJECT_DIR"
    echo ""
    echo "Please update the PROJECT_DIR variable in this script."
    echo "Edit with: sudo nano /usr/local/bin/run-neurodb"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "   Are you sure this is the correct NeuroDB directory?"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  Warning: node_modules not found"
    echo "   Installing dependencies..."
    echo ""
    npm install || pnpm install
    echo ""
fi

# Check if npm command exists
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    echo "   Please install Node.js and npm first:"
    echo "   sudo apt update && sudo apt install nodejs npm -y"
    exit 1
fi

echo ""
echo "🏃 Running: npm start"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the application
npm start
