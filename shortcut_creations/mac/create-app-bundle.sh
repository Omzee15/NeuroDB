#!/bin/bash

# ===========================
# NeuroDB App Bundle Creator
# ===========================
# This script creates a macOS .app bundle that launches NeuroDB
# by executing the run-neurodb command in a Terminal window.
#
# Usage:
#   ./create-app-bundle.sh
#
# Output:
#   Creates NeuroDB.app on your Desktop (or custom location)

# ====================
# CONFIGURATION
# ====================

APP_NAME="NeuroDB"
# Where to create the app (change this if you want it elsewhere)
APP_PATH_DESKTOP="$HOME/Desktop/$APP_NAME.app"
APP_PATH_APPLICATIONS="/Applications/$APP_NAME.app"

# Path to your NeuroDB project (for finding the icon)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ICON_SOURCE="$PROJECT_DIR/build/icons/icon.icns"

# ====================
# SCRIPT START
# ====================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎨 Creating $APP_NAME.app (Desktop & Applications)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Function to create app at a specific path
create_app() {
    local APP_PATH="$1"
    local LOCATION_NAME="$2"
    
    echo ""
    echo "📍 Creating app in $LOCATION_NAME..."
    
    # Remove existing app if present
    if [ -d "$APP_PATH" ]; then
        echo "🗑️  Removing existing app..."
        rm -rf "$APP_PATH"
    fi
    
    # Create directory structure
    echo "📁 Creating app bundle structure..."
    mkdir -p "$APP_PATH/Contents/MacOS"
    mkdir -p "$APP_PATH/Contents/Resources"

    # Create the executable script
    echo "📝 Creating launcher script..."
    cat > "$APP_PATH/Contents/MacOS/$APP_NAME" << 'EOF'
#!/bin/bash

# Launch NeuroDB using the existing run-neurodb script
# Open a new Terminal window to show the process

osascript <<APPLESCRIPT
tell application "Terminal"
    activate
    do script "/usr/local/bin/run-neurodb"
end tell
APPLESCRIPT
EOF

    # Make it executable
    chmod +x "$APP_PATH/Contents/MacOS/$APP_NAME"
    echo "✅ Launcher script created and made executable"
    
    # Create Info.plist
    echo "📋 Creating Info.plist..."
    cat > "$APP_PATH/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>NeuroDB</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>CFBundleIdentifier</key>
    <string>com.neurodb.launcher</string>
    <key>CFBundleName</key>
    <string>NeuroDB</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.12</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF
    echo "✅ Info.plist created"
    
    # Copy icon
    if [ -f "$ICON_SOURCE" ]; then
        echo "🎨 Copying icon..."
        cp "$ICON_SOURCE" "$APP_PATH/Contents/Resources/icon.icns"
        echo "✅ Icon copied"
    else
        echo "⚠️  Warning: Icon not found at $ICON_SOURCE"
        echo "   App will use default macOS icon"
    fi
    
    # Refresh macOS to recognize the new app
    touch "$APP_PATH"
    
    echo "✅ App created in $LOCATION_NAME"
}

# Create app in both locations
create_app "$APP_PATH_DESKTOP" "Desktop"
create_app "$APP_PATH_APPLICATIONS" "Applications"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Success! $APP_NAME.app created in both locations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Locations:"
echo "   • $APP_PATH_DESKTOP"
echo "   • $APP_PATH_APPLICATIONS"
echo ""
echo "🎯 Next steps:"
echo "   • Double-click either app to launch NeuroDB"
echo "   • Drag to your Dock for quick access"
echo "   • Find in Launchpad under 'N'"
echo ""
