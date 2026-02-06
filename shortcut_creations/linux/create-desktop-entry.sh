#!/bin/bash

# ===========================
# NeuroDB Desktop Entry Creator
# ===========================
# Creates .desktop files for NeuroDB application
# - Desktop shortcut
# - Applications menu entry
#
# Usage:
#   ./create-desktop-entry.sh [PROJECT_DIR]

# ====================
# CONFIGURATION
# ====================

PROJECT_DIR="${1:-$HOME/Desktop/NeuroDB}"
ICON_PATH="$PROJECT_DIR/build/icons/icon.png"

# If icon doesn't exist, use generic icon
if [ ! -f "$ICON_PATH" ]; then
    ICON_NAME="database"
else
    ICON_NAME="$ICON_PATH"
fi

# ====================
# CREATE DESKTOP FILE
# ====================

cat > "$HOME/Desktop/NeuroDB.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=NeuroDB
Comment=PostgreSQL Database Management Tool
Exec=/usr/local/bin/run-neurodb
Icon=$ICON_NAME
Terminal=false
Categories=Development;Database;
Keywords=database;postgresql;sql;neurodb;
StartupNotify=true
StartupWMClass=NeuroDB
EOF

# Make desktop file executable
chmod +x "$HOME/Desktop/NeuroDB.desktop"

# Allow launching (required for some desktop environments)
gio set "$HOME/Desktop/NeuroDB.desktop" metadata::trusted true 2>/dev/null || true

echo "✅ Desktop shortcut created: $HOME/Desktop/NeuroDB.desktop"

# ====================
# CREATE APPLICATIONS MENU ENTRY
# ====================

# Create .local/share/applications directory if it doesn't exist
mkdir -p "$HOME/.local/share/applications"

cat > "$HOME/.local/share/applications/neurodb.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=NeuroDB
Comment=PostgreSQL Database Management Tool
Exec=/usr/local/bin/run-neurodb
Icon=$ICON_NAME
Terminal=false
Categories=Development;Database;
Keywords=database;postgresql;sql;neurodb;
StartupNotify=true
StartupWMClass=NeuroDB
EOF

chmod +x "$HOME/.local/share/applications/neurodb.desktop"

echo "✅ Application menu entry created"

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null
    echo "✅ Desktop database updated"
fi

echo ""
echo "Desktop entries created successfully!"
echo "You can now:"
echo "  • Double-click the icon on your desktop"
echo "  • Search for 'NeuroDB' in your application launcher"
