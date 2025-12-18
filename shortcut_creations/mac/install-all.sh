#!/bin/bash

# ===========================
# NeuroDB Complete Installer
# ===========================
# This script performs a complete installation of NeuroDB launcher shortcuts.
# It will:
#   1. Install the run-neurodb command to /usr/local/bin/
#   2. Create the NeuroDB.app launcher on your Desktop
#   3. Set up all necessary permissions
#
# Usage:
#   ./install-all.sh

# ====================
# CONFIGURATION
# ====================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ====================
# HELPER FUNCTIONS
# ====================

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ====================
# PRE-FLIGHT CHECKS
# ====================

print_header "🚀 NeuroDB Launcher Installation"

echo "This installer will set up NeuroDB launcher shortcuts on your system."
echo ""
echo "Installation includes:"
echo "  • Terminal command: run-neurodb"
echo "  • Desktop app launcher: NeuroDB.app"
echo ""
read -p "Continue with installation? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 0
fi

# Check if we're in the right directory
if [ ! -f "$SCRIPT_DIR/run-neurodb.sh" ]; then
    print_error "Installation files not found!"
    echo "Please run this script from the shortcut_creations/mac directory."
    exit 1
fi

# Check for required tools
print_header "🔍 Checking Prerequisites"

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    echo "Please install Node.js and npm first: https://nodejs.org/"
    exit 1
fi
print_success "npm found: $(npm --version)"

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    echo "Please install Node.js first: https://nodejs.org/"
    exit 1
fi
print_success "Node.js found: $(node --version)"

# ====================
# PROJECT PATH SETUP
# ====================

print_header "📁 Configuring Project Path"

echo "Current NeuroDB project location:"
echo "  $PROJECT_DIR"
echo ""
read -p "Is this correct? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please enter the full path to your NeuroDB project:"
    read -r CUSTOM_PROJECT_DIR
    
    if [ ! -d "$CUSTOM_PROJECT_DIR" ]; then
        print_error "Directory does not exist: $CUSTOM_PROJECT_DIR"
        exit 1
    fi
    
    PROJECT_DIR="$CUSTOM_PROJECT_DIR"
fi

# Update the project path in run-neurodb.sh
print_info "Updating project path in run-neurodb.sh..."
TEMP_SCRIPT=$(mktemp)
sed "s|PROJECT_DIR=\"/Users/pikachu/Desktop/J/Create/NeuroDB\"|PROJECT_DIR=\"$PROJECT_DIR\"|g" \
    "$SCRIPT_DIR/run-neurodb.sh" > "$TEMP_SCRIPT"
print_success "Project path configured"

# ====================
# INSTALL RUNNER SCRIPT
# ====================

print_header "⚡ Installing Terminal Command"

print_info "Installing run-neurodb to /usr/local/bin/"
echo "This requires administrator privileges (you may be prompted for your password)."
echo ""

if sudo cp "$TEMP_SCRIPT" /usr/local/bin/run-neurodb; then
    sudo chmod 755 /usr/local/bin/run-neurodb
    print_success "run-neurodb command installed successfully"
else
    print_error "Failed to install run-neurodb command"
    rm "$TEMP_SCRIPT"
    exit 1
fi

# Clean up temp file
rm "$TEMP_SCRIPT"

# Verify installation
if command -v run-neurodb &> /dev/null; then
    print_success "Command verified: run-neurodb is ready to use"
else
    print_warning "Command installed but not found in PATH"
    echo "You may need to restart your terminal or add /usr/local/bin to your PATH"
fi

# ====================
# CREATE APP BUNDLE
# ====================

print_header "🎨 Creating App Launchers"

print_info "Running create-app-bundle.sh..."
cd "$SCRIPT_DIR"

if bash create-app-bundle.sh; then
    print_success "NeuroDB.app created in Desktop and Applications"
else
    print_error "Failed to create app bundle"
    echo "You can try running create-app-bundle.sh manually later"
fi

# ====================
# SUMMARY
# ====================

print_header "✅ Installation Complete!"

echo "NeuroDB launcher has been successfully installed!"
echo ""
echo "🎯 How to use:"
echo ""
echo "  1. From Terminal:"
echo "     ${GREEN}run-neurodb${NC}"
echo ""
echo "  2. From Desktop:"
echo "     Double-click ${GREEN}NeuroDB.app${NC} on your Desktop"
echo ""
echo "  3. From Applications:"
echo "     • Search for ${GREEN}NeuroDB${NC} in Spotlight (⌘ + Space)"
echo "     • Find it in Launchpad"
echo "     • Look in /Applications folder"
echo ""
echo "  4. Add to Dock:"
echo "     Drag ${GREEN}NeuroDB.app${NC} to your Dock for quick access"
echo ""
echo "📍 Files installed:"
echo "   • /usr/local/bin/run-neurodb"
echo "   • ~/Desktop/NeuroDB.app"
echo "   • /Applications/NeuroDB.app"
echo ""
echo "📚 For help and troubleshooting, see:"
echo "   $SCRIPT_DIR/README.md"
echo ""
echo "🗑️  To uninstall, run:"
echo "   ${BLUE}./uninstall.sh${NC}"
echo ""
