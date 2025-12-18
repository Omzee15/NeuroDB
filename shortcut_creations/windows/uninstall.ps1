# ===========================
# NeuroDB Uninstaller (Windows)
# ===========================
# This script removes all NeuroDB launcher components from your system.
#
# Usage:
#   .\uninstall.ps1

# ====================
# CONFIGURATION
# ====================

$ShortcutName = "NeuroDB"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$StartMenuPath = [Environment]::GetFolderPath("StartMenu")
$DesktopShortcut = Join-Path $DesktopPath "$ShortcutName.lnk"
$StartMenuShortcut = Join-Path $StartMenuPath "Programs\$ShortcutName.lnk"

# ====================
# HELPER FUNCTIONS
# ====================

function Write-ColorMessage {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    
    switch ($Type) {
        "Success" { Write-Host $Message -ForegroundColor Green }
        "Error"   { Write-Host $Message -ForegroundColor Red }
        "Warning" { Write-Host $Message -ForegroundColor Yellow }
        "Info"    { Write-Host $Message -ForegroundColor Cyan }
        default   { Write-Host $Message }
    }
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
}

# ====================
# UNINSTALL START
# ====================

Write-Header "🗑️  NeuroDB Launcher Uninstaller"

Write-Host "This will remove the following components:"
Write-Host "  • Desktop shortcut"
Write-Host "  • Start Menu shortcut"
Write-Host ""
Write-ColorMessage "⚠️  This action cannot be undone!" "Warning"
Write-Host ""

$continue = Read-Host "Continue with uninstallation? (Y/N)"
if ($continue -notmatch "^[Yy]") {
    Write-ColorMessage "Uninstallation cancelled." "Info"
    exit 0
}

# ====================
# REMOVE DESKTOP SHORTCUT
# ====================

Write-Header "🖥️  Removing Desktop Shortcut"

if (Test-Path $DesktopShortcut) {
    try {
        Remove-Item $DesktopShortcut -Force
        Write-ColorMessage "✅ Desktop shortcut removed" "Success"
    }
    catch {
        Write-ColorMessage "❌ Failed to remove Desktop shortcut" "Error"
        Write-ColorMessage "   Error: $($_.Exception.Message)" "Error"
        Write-ColorMessage "   You may need to remove it manually:" "Warning"
        Write-Host "   $DesktopShortcut"
    }
}
else {
    Write-ColorMessage "ℹ️  Desktop shortcut not found (already removed or not installed)" "Info"
}

# ====================
# REMOVE START MENU SHORTCUT
# ====================

Write-Header "📋 Removing Start Menu Shortcut"

if (Test-Path $StartMenuShortcut) {
    try {
        Remove-Item $StartMenuShortcut -Force
        Write-ColorMessage "✅ Start Menu shortcut removed" "Success"
    }
    catch {
        Write-ColorMessage "❌ Failed to remove Start Menu shortcut" "Error"
        Write-ColorMessage "   Error: $($_.Exception.Message)" "Error"
        Write-ColorMessage "   You may need to remove it manually:" "Warning"
        Write-Host "   $StartMenuShortcut"
    }
}
else {
    Write-ColorMessage "ℹ️  Start Menu shortcut not found (already removed or not installed)" "Info"
}

# ====================
# SUMMARY
# ====================

Write-Header "✅ Uninstallation Complete"

Write-Host "NeuroDB launcher components have been removed from your system."
Write-Host ""
Write-Host "📝 Note: Your NeuroDB project files were NOT removed." -ForegroundColor White
Write-Host "   They remain in their original location."
Write-Host ""
Write-Host "🔄 To reinstall later, run:" -ForegroundColor White
Write-Host "   .\install-all.ps1" -ForegroundColor Green
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
