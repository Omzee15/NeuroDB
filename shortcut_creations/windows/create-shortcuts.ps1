# ===========================
# NeuroDB Shortcut Creator
# ===========================
# This script creates Windows shortcuts for NeuroDB on Desktop and Start Menu
#
# Usage:
#   .\create-shortcuts.ps1

# ====================
# CONFIGURATION
# ====================

$ShortcutName = "NeuroDB"
$Description = "AI-powered PostgreSQL database management tool"

# Get paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$ScriptPath = Join-Path $ScriptDir "run-neurodb.ps1"
$IconPath = Join-Path $ProjectDir "build\icons\icon.ico"

# Shortcut locations
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

function Create-Shortcut {
    param(
        [string]$ShortcutPath,
        [string]$LocationName
    )
    
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        
        # Set target to PowerShell
        $Shortcut.TargetPath = "powershell.exe"
        
        # Set arguments to run our script
        $Shortcut.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$ScriptPath`""
        
        # Set working directory
        $Shortcut.WorkingDirectory = $ProjectDir
        
        # Set description
        $Shortcut.Description = $Description
        
        # Set icon if exists
        if (Test-Path $IconPath) {
            $Shortcut.IconLocation = $IconPath
            Write-ColorMessage "  ✅ Icon set from: $IconPath" "Success"
        } else {
            Write-ColorMessage "  ⚠️  Icon not found at: $IconPath" "Warning"
            Write-ColorMessage "     Using default icon" "Warning"
        }
        
        # Save shortcut
        $Shortcut.Save()
        
        Write-ColorMessage "✅ Shortcut created in $LocationName" "Success"
        return $true
    }
    catch {
        Write-ColorMessage "❌ Failed to create shortcut in $LocationName" "Error"
        Write-ColorMessage "   Error: $($_.Exception.Message)" "Error"
        return $false
    }
}

# ====================
# SCRIPT START
# ====================

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎨 Creating NeuroDB Shortcuts" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Verify script exists
if (-not (Test-Path $ScriptPath)) {
    Write-ColorMessage "❌ Error: run-neurodb.ps1 not found at: $ScriptPath" "Error"
    Write-ColorMessage "   Make sure you're running this from the correct directory" "Warning"
    exit 1
}

Write-ColorMessage "📁 Project directory: $ProjectDir" "Info"
Write-ColorMessage "📜 Script path: $ScriptPath" "Info"
Write-Host ""

# Remove existing shortcuts if present
Write-ColorMessage "🗑️  Removing existing shortcuts..." "Info"
if (Test-Path $DesktopShortcut) {
    Remove-Item $DesktopShortcut -Force
    Write-ColorMessage "  Removed old Desktop shortcut" "Info"
}
if (Test-Path $StartMenuShortcut) {
    Remove-Item $StartMenuShortcut -Force
    Write-ColorMessage "  Removed old Start Menu shortcut" "Info"
}
Write-Host ""

# Create Desktop shortcut
Write-ColorMessage "📍 Creating Desktop shortcut..." "Info"
$desktopSuccess = Create-Shortcut -ShortcutPath $DesktopShortcut -LocationName "Desktop"
Write-Host ""

# Create Start Menu shortcut
Write-ColorMessage "📍 Creating Start Menu shortcut..." "Info"
$startMenuSuccess = Create-Shortcut -ShortcutPath $StartMenuShortcut -LocationName "Start Menu"
Write-Host ""

# Summary
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

if ($desktopSuccess -and $startMenuSuccess) {
    Write-ColorMessage "✅ Success! All shortcuts created" "Success"
    Write-Host ""
    Write-ColorMessage "📍 Shortcut locations:" "Info"
    Write-Host "   • Desktop: $DesktopShortcut"
    Write-Host "   • Start Menu: $StartMenuShortcut"
    Write-Host ""
    Write-ColorMessage "🎯 Next steps:" "Info"
    Write-Host "   • Double-click Desktop shortcut to launch NeuroDB"
    Write-Host "   • Press Windows key and search 'NeuroDB'"
    Write-Host "   • Right-click Desktop shortcut → Pin to Taskbar"
} else {
    Write-ColorMessage "⚠️  Some shortcuts failed to create" "Warning"
    Write-ColorMessage "   Check the errors above and try again" "Warning"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
