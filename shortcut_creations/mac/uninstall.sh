#!/bin/bash

# ===========================
# NeuroDB Uninstaller
# ===========================
# This script removes all NeuroDB launcher components from your system.
#
# Usage:
#   ./uninstall.sh

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
# UNINSTALL START
# ====================

print_header "🗑️  NeuroDB Launcher Uninstaller"

echo "This will remove the following components:"
echo "  • /usr/local/bin/run-neurodb"
echo "  • ~/Desktop/NeuroDB.app"
echo "  • /Applications/NeuroDB.app"
echo ""
print_warning "This action cannot be undone!"
echo ""
read -p "Continue with uninstallation? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

# ====================
# REMOVE TERMINAL COMMAND
# ====================

print_header "⚡ Removing Terminal Command"

if [ -f "/usr/local/bin/run-neurodb" ]; then
    print_info "Removing /usr/local/bin/run-neurodb..."
    echo "This requires administrator privileges (you may be prompted for your password)."
    
    if sudo rm /usr/local/bin/run-neurodb; then
        print_success "Terminal command removed"
    else
        print_error "Failed to remove terminal command"
        echo "You may need to remove it manually:"
        echo "  sudo rm /usr/local/bin/run-neurodb"
    fi
else
    print_info "Terminal command not found (already removed or not installed)"
fi

# ====================
# REMOVE DESKTOP APP
# ====================

print_header "🎨 Removing Desktop App"

if [ -d "$HOME/Desktop/NeuroDB.app" ]; then
    print_info "Removing ~/Desktop/NeuroDB.app..."
    
    if rm -rf "$HOME/Desktop/NeuroDB.app"; then
        print_success "Desktop app removed"
    else
        print_error "Failed to remove desktop app"
        echo "You may need to remove it manually:"
        echo "  rm -rf ~/Desktop/NeuroDB.app"
    fi
else
    print_info "Desktop app not found (already removed or not installed)"
fi

# ====================
# REMOVE APPLICATIONS APP
# ====================

print_header "🗂️  Removing App from Applications Folder"

if [ -d "/Applications/NeuroDB.app" ]; then
    print_info "Removing /Applications/NeuroDB.app..."
    
    if rm -rf "/Applications/NeuroDB.app"; then
        print_success "Applications app removed"
    else
        print_error "Failed to remove Applications app"
        echo "You may need to remove it manually:"
        echo "  rm -rf /Applications/NeuroDB.app"
    fi
else
    print_info "Applications app not found (already removed or not installed)"
fi

# ====================
# SUMMARY
# ====================

print_header "✅ Uninstallation Complete"

echo "NeuroDB launcher components have been removed from your system."
echo ""
echo "📝 Note: Your NeuroDB project files were NOT removed."
echo "   They remain in their original location."
echo ""
echo "🔄 To reinstall later, run:"
echo "   ${GREEN}./install-all.sh${NC}"
echo ""
