#!/bin/bash

# ===========================
# NeuroDB Complete Installer (Linux)
# ===========================
# This script performs a complete installation of NeuroDB launcher shortcuts.
# It will:
#   1. Install the run-neurodb command to /usr/local/bin/
#   2. Create desktop shortcut
#   3. Create application menu entry
#   4. Set up all necessary permissions
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

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# ====================
# PRE-FLIGHT CHECKS
# ====================

print_header "🐧 NeuroDB Launcher Installation (Linux)"

echo "This installer will set up NeuroDB launcher shortcuts on your system."
echo ""
echo "Installation includes:"
echo "  • Terminal command: run-neurodb"
echo "  • Desktop shortcut"
echo "  • Application menu entry"
echo ""

read -p "Continue with installation? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Installation cancelled."
    exit 0
fi

# Check if we're in the right directory
if [ ! -f "$SCRIPT_DIR/run-neurodb.sh" ]; then
    print_error "Installation files not found!"
    print_warning "Please run this script from the shortcut_creations/linux directory."
    exit 1
fi

# ====================
# CHECK PREREQUISITES
# ====================

print_header "🔍 Checking Prerequisites"

# Check Node.js
if check_command node; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js is not installed"
    print_info "Install with: sudo apt update && sudo apt install nodejs npm -y"
    exit 1
fi

# Check npm or pnpm
if check_command npm; then
    NPM_VERSION=$(npm --version)
    print_success "npm installed: $NPM_VERSION"
elif check_command pnpm; then
    PNPM_VERSION=$(pnpm --version)
    print_success "pnpm installed: $PNPM_VERSION"
else
    print_error "Neither npm nor pnpm is installed"
    print_info "Install with: sudo apt update && sudo apt install npm -y"
    exit 1
fi

# Check if package.json exists in project
if [ -f "$PROJECT_DIR/package.json" ]; then
    print_success "NeuroDB project found: $PROJECT_DIR"
else
    print_error "package.json not found in: $PROJECT_DIR"
    exit 1
fi

# ====================
# CONFIRM PROJECT PATH
# ====================

print_header "📂 Project Path Configuration"

echo "Detected project directory:"
echo "  $PROJECT_DIR"
echo ""
read -p "Is this correct? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Installation cancelled."
    echo ""
    echo "To use a different path, run this script from the correct location or"
    echo "manually edit the PROJECT_DIR in the scripts after installation."
    exit 0
fi

# ====================
# INSTALL TERMINAL COMMAND
# ====================

print_header "📦 Installing Terminal Command"

# Create temporary file with updated PROJECT_DIR
TMP_RUNNER=$(mktemp)
sed "s|PROJECT_DIR=.*|PROJECT_DIR=\"$PROJECT_DIR\"|" "$SCRIPT_DIR/run-neurodb.sh" > "$TMP_RUNNER"

# Copy to /usr/local/bin (requires sudo)
print_info "Installing run-neurodb to /usr/local/bin/ (requires sudo)"
if sudo cp "$TMP_RUNNER" /usr/local/bin/run-neurodb; then
    sudo chmod +x /usr/local/bin/run-neurodb
    print_success "Terminal command installed"
    rm "$TMP_RUNNER"
else
    print_error "Failed to install terminal command"
    rm "$TMP_RUNNER"
    exit 1
fi

# ====================
# CREATE DESKTOP ENTRIES
# ====================

print_header "🖥️  Creating Desktop Shortcuts"

# Run the desktop entry creation script
if bash "$SCRIPT_DIR/create-desktop-entry.sh" "$PROJECT_DIR"; then
    print_success "Desktop shortcuts created"
else
    print_warning "Desktop shortcuts creation had issues (non-critical)"
fi

# ====================
# VERIFY INSTALLATION
# ====================

print_header "✅ Installation Complete!"

echo "Installation successful! You can now use NeuroDB in the following ways:"
echo ""
echo "1. Terminal Command:"
echo "   ${GREEN}run-neurodb${NC}"
echo ""
echo "2. Desktop Shortcut:"
echo "   Double-click the NeuroDB icon on your desktop"
echo ""
echo "3. Application Launcher:"
echo "   Search for 'NeuroDB' in your applications menu"
echo ""

print_info "If the terminal command doesn't work immediately, try:"
echo "   source ~/.bashrc"
echo "   or restart your terminal"
echo ""

# Test if command is available
if check_command run-neurodb; then
    print_success "run-neurodb command is ready to use!"
else
    print_warning "run-neurodb command not found in PATH yet"
    print_info "Restart your terminal or run: source ~/.bashrc"
fi

echo ""
print_success "All done! Enjoy using NeuroDB! 🎉"
echo ""
