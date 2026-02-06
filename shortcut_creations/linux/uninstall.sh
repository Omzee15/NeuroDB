#!/bin/bash

# ===========================
# NeuroDB Uninstaller (Linux)
# ===========================
# Removes all NeuroDB launcher shortcuts and commands
#
# Usage:
#   ./uninstall.sh

# ====================
# CONFIGURATION
# ====================

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
# CONFIRMATION
# ====================

print_header "🗑️  NeuroDB Uninstaller"

echo "This will remove all NeuroDB launcher shortcuts from your system:"
echo "  • Terminal command: /usr/local/bin/run-neurodb"
echo "  • Desktop shortcut"
echo "  • Application menu entry"
echo ""
print_warning "This will NOT delete your project files or databases."
echo ""

read -p "Continue with uninstallation? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Uninstallation cancelled."
    exit 0
fi

# ====================
# REMOVE FILES
# ====================

print_header "🧹 Removing NeuroDB Shortcuts"

REMOVED_COUNT=0
FAILED_COUNT=0

# Remove terminal command
if [ -f "/usr/local/bin/run-neurodb" ]; then
    print_info "Removing terminal command (requires sudo)"
    if sudo rm /usr/local/bin/run-neurodb; then
        print_success "Terminal command removed"
        ((REMOVED_COUNT++))
    else
        print_error "Failed to remove terminal command"
        ((FAILED_COUNT++))
    fi
else
    print_info "Terminal command not found (already removed)"
fi

# Remove desktop shortcut
if [ -f "$HOME/Desktop/NeuroDB.desktop" ]; then
    if rm "$HOME/Desktop/NeuroDB.desktop"; then
        print_success "Desktop shortcut removed"
        ((REMOVED_COUNT++))
    else
        print_error "Failed to remove desktop shortcut"
        ((FAILED_COUNT++))
    fi
else
    print_info "Desktop shortcut not found (already removed)"
fi

# Remove application menu entry
if [ -f "$HOME/.local/share/applications/neurodb.desktop" ]; then
    if rm "$HOME/.local/share/applications/neurodb.desktop"; then
        print_success "Application menu entry removed"
        ((REMOVED_COUNT++))
    else
        print_error "Failed to remove application menu entry"
        ((FAILED_COUNT++))
    fi
else
    print_info "Application menu entry not found (already removed)"
fi

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null
    print_success "Desktop database updated"
fi

# ====================
# SUMMARY
# ====================

print_header "📊 Uninstallation Summary"

if [ $REMOVED_COUNT -gt 0 ]; then
    print_success "Removed $REMOVED_COUNT item(s)"
fi

if [ $FAILED_COUNT -gt 0 ]; then
    print_error "Failed to remove $FAILED_COUNT item(s)"
fi

if [ $REMOVED_COUNT -eq 0 ] && [ $FAILED_COUNT -eq 0 ]; then
    print_info "No NeuroDB shortcuts were found"
fi

echo ""
print_success "Uninstallation complete!"
echo ""
print_info "Your NeuroDB project files remain untouched."
print_info "To reinstall shortcuts, run: ./install-all.sh"
echo ""
