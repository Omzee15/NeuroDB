#!/bin/bash

# ===========================
# NeuroDB Icon Generator
# ===========================
# This script converts PNG icons to macOS .icns format
# Required for creating the app bundle with a custom icon.
#
# Requirements:
#   - PNG files in build/icons/ directory
#   - iconutil (comes with macOS)
#
# Usage:
#   ./create-icon.sh

# ====================
# CONFIGURATION
# ====================

# Path to your NeuroDB project
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ICONS_DIR="$PROJECT_DIR/build/icons"
ICONSET_DIR="$ICONS_DIR/icon.iconset"
OUTPUT_ICNS="$ICONS_DIR/icon.icns"

# ====================
# SCRIPT START
# ====================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎨 Creating icon.icns for NeuroDB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if icons directory exists
if [ ! -d "$ICONS_DIR" ]; then
    echo "❌ Error: Icons directory not found at $ICONS_DIR"
    exit 1
fi

# Check if icon.icns already exists
if [ -f "$OUTPUT_ICNS" ]; then
    echo "ℹ️  icon.icns already exists"
    read -p "   Overwrite? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏭️  Skipping icon creation"
        exit 0
    fi
    rm "$OUTPUT_ICNS"
fi

# Create iconset directory
echo "📁 Creating iconset directory..."
mkdir -p "$ICONSET_DIR"

# Function to copy icon with fallback
copy_icon() {
    local source_file="$1"
    local dest_file="$2"
    
    if [ -f "$ICONS_DIR/$source_file" ]; then
        cp "$ICONS_DIR/$source_file" "$ICONSET_DIR/$dest_file"
        echo "   ✓ $dest_file"
        return 0
    fi
    return 1
}

echo "📋 Copying PNG files to iconset..."

# Standard icon sizes for macOS
copy_icon "16x16.png" "icon_16x16.png"
copy_icon "32x32.png" "icon_16x16@2x.png" || copy_icon "32x32.png" "icon_32x32.png"
copy_icon "32x32.png" "icon_32x32.png"
copy_icon "64x64.png" "icon_32x32@2x.png" || copy_icon "64x64.png" "icon_64x64.png"
copy_icon "128x128.png" "icon_128x128.png"
copy_icon "256x256.png" "icon_128x128@2x.png" || copy_icon "256x256.png" "icon_256x256.png"
copy_icon "256x256.png" "icon_256x256.png"
copy_icon "512x512.png" "icon_256x256@2x.png" || copy_icon "512x512.png" "icon_512x512.png"
copy_icon "512x512.png" "icon_512x512.png"
copy_icon "1024x1024.png" "icon_512x512@2x.png"

# Count files in iconset
ICON_COUNT=$(ls -1 "$ICONSET_DIR" 2>/dev/null | wc -l)

if [ "$ICON_COUNT" -eq 0 ]; then
    echo ""
    echo "❌ Error: No icon files were copied"
    echo "   Make sure you have PNG files in: $ICONS_DIR"
    echo ""
    echo "   Required files:"
    echo "   - 16x16.png"
    echo "   - 32x32.png"
    echo "   - 64x64.png"
    echo "   - 128x128.png"
    echo "   - 256x256.png"
    echo "   - 512x512.png"
    echo "   - 1024x1024.png"
    rm -rf "$ICONSET_DIR"
    exit 1
fi

echo ""
echo "🔨 Converting to .icns format..."

# Convert iconset to icns using iconutil
if iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"; then
    echo "✅ Successfully created icon.icns"
    
    # Get file size
    FILE_SIZE=$(du -h "$OUTPUT_ICNS" | cut -f1)
    
    echo ""
    echo "📊 Icon details:"
    echo "   Location: $OUTPUT_ICNS"
    echo "   Size: $FILE_SIZE"
    echo "   Icons: $ICON_COUNT variations"
else
    echo "❌ Error: Failed to create .icns file"
    echo "   Make sure iconutil is available (comes with Xcode Command Line Tools)"
    rm -rf "$ICONSET_DIR"
    exit 1
fi

# Clean up iconset directory
echo ""
echo "🧹 Cleaning up temporary files..."
rm -rf "$ICONSET_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Icon creation complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Next steps:"
echo "   • Run ./create-app-bundle.sh to create the app with this icon"
echo "   • Or manually copy to existing app:"
echo "     cp '$OUTPUT_ICNS' ~/Desktop/NeuroDB.app/Contents/Resources/"
echo ""
