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
PROJECT_DIR="/Users/pikachu/Desktop/J/Create/NeuroDB"

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
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the electron development server
echo "⚡ Starting Electron development server..."
echo ""

npm run electron:dev

# Keep script running to keep process alive
wait
