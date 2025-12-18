# ===========================
# NeuroDB Complete Installer (Windows)
# ===========================
# This script performs a complete installation of NeuroDB launcher shortcuts.
# It will:
#   1. Check prerequisites (Node.js, npm, PowerShell)
#   2. Update the project path in run-neurodb.ps1
#   3. Create Desktop and Start Menu shortcuts
#
# Usage:
#   .\install-all.ps1
#
# Note: Run PowerShell as regular user (admin not required)

# ====================
# CONFIGURATION
# ====================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)

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
        "Header"  { Write-Host $Message -ForegroundColor Cyan }
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
# PRE-FLIGHT CHECKS
# ====================

Write-Header "🚀 NeuroDB Launcher Installation (Windows)"

Write-Host "This installer will set up NeuroDB launcher shortcuts on your system."
Write-Host ""
Write-Host "Installation includes:"
Write-Host "  • PowerShell launcher script"
Write-Host "  • Desktop shortcut"
Write-Host "  • Start Menu shortcut"
Write-Host ""

$continue = Read-Host "Continue with installation? (Y/N)"
if ($continue -notmatch "^[Yy]") {
    Write-ColorMessage "Installation cancelled." "Warning"
    exit 0
}

# Check if we're in the right directory
if (-not (Test-Path (Join-Path $ScriptDir "run-neurodb.ps1"))) {
    Write-ColorMessage "❌ Installation files not found!" "Error"
    Write-ColorMessage "   Please run this script from the shortcut_creations\windows directory." "Warning"
    exit 1
}

# ====================
# CHECK PREREQUISITES
# ====================

Write-Header "🔍 Checking Prerequisites"

# Check PowerShell version
$psVersion = $PSVersionTable.PSVersion.Major
if ($psVersion -lt 5) {
    Write-ColorMessage "❌ PowerShell 5.0 or later is required" "Error"
    Write-ColorMessage "   Current version: $psVersion" "Error"
    exit 1
}
Write-ColorMessage "✅ PowerShell version: $($PSVersionTable.PSVersion)" "Success"

# Check Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-ColorMessage "❌ Node.js is not installed" "Error"
    Write-ColorMessage "   Please install Node.js from: https://nodejs.org/" "Warning"
    exit 1
}
$nodeVersion = node --version
Write-ColorMessage "✅ Node.js found: $nodeVersion" "Success"

# Check npm
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-ColorMessage "❌ npm is not installed" "Error"
    Write-ColorMessage "   Please install Node.js (includes npm) from: https://nodejs.org/" "Warning"
    exit 1
}
$npmVersion = npm --version
Write-ColorMessage "✅ npm found: $npmVersion" "Success"

# ====================
# PROJECT PATH SETUP
# ====================

Write-Header "📁 Configuring Project Path"

Write-Host "Current NeuroDB project location:"
Write-Host "  $ProjectDir"
Write-Host ""

$pathCorrect = Read-Host "Is this correct? (Y/N)"

if ($pathCorrect -notmatch "^[Yy]") {
    Write-Host ""
    Write-Host "Please enter the full path to your NeuroDB project:"
    $customPath = Read-Host "Path"
    
    if (-not (Test-Path $customPath)) {
        Write-ColorMessage "❌ Directory does not exist: $customPath" "Error"
        exit 1
    }
    
    $ProjectDir = $customPath
}

# Update the project path in run-neurodb.ps1
Write-ColorMessage "ℹ️  Updating project path in run-neurodb.ps1..." "Info"

$runScriptPath = Join-Path $ScriptDir "run-neurodb.ps1"
$runScriptContent = Get-Content $runScriptPath -Raw

# Replace the ProjectDir path (handle Windows path escaping)
$escapedPath = $ProjectDir -replace '\\', '\\'
$runScriptContent = $runScriptContent -replace '\$ProjectDir = ".*"', "`$ProjectDir = `"$ProjectDir`""

Set-Content -Path $runScriptPath -Value $runScriptContent -NoNewline

Write-ColorMessage "✅ Project path configured" "Success"

# Verify package.json exists
if (-not (Test-Path (Join-Path $ProjectDir "package.json"))) {
    Write-ColorMessage "⚠️  Warning: package.json not found in project directory" "Warning"
    Write-ColorMessage "   Make sure the path is correct" "Warning"
    $continue = Read-Host "Continue anyway? (Y/N)"
    if ($continue -notmatch "^[Yy]") {
        exit 1
    }
}

# ====================
# CREATE SHORTCUTS
# ====================

Write-Header "🎨 Creating Shortcuts"

Write-ColorMessage "ℹ️  Running create-shortcuts.ps1..." "Info"

# Run the shortcut creator
& (Join-Path $ScriptDir "create-shortcuts.ps1")

if ($LASTEXITCODE -eq 0) {
    Write-ColorMessage "✅ Shortcuts created successfully" "Success"
} else {
    Write-ColorMessage "❌ Failed to create shortcuts" "Error"
    Write-ColorMessage "   You can try running create-shortcuts.ps1 manually later" "Warning"
}

# ====================
# SUMMARY
# ====================

Write-Header "✅ Installation Complete!"

Write-Host "NeuroDB launcher has been successfully installed!"
Write-Host ""
Write-Host "🎯 How to use:"
Write-Host ""
Write-Host "  1. From Desktop:" -ForegroundColor White
Write-Host "     Double-click " -NoNewline
Write-Host "NeuroDB" -ForegroundColor Green -NoNewline
Write-Host " shortcut on your Desktop"
Write-Host ""
Write-Host "  2. From Start Menu:" -ForegroundColor White
Write-Host "     • Press Windows key" -ForegroundColor White
Write-Host "     • Type '" -NoNewline
Write-Host "NeuroDB" -ForegroundColor Green -NoNewline
Write-Host "'"
Write-Host "     • Click the icon" -ForegroundColor White
Write-Host ""
Write-Host "  3. From PowerShell:" -ForegroundColor White
Write-Host "     cd $ProjectDir" -ForegroundColor Blue
Write-Host "     .\shortcut_creations\windows\run-neurodb.ps1" -ForegroundColor Blue
Write-Host ""
Write-Host "  4. Pin to Taskbar:" -ForegroundColor White
Write-Host "     Right-click Desktop shortcut → Pin to Taskbar"
Write-Host ""

$desktopPath = [Environment]::GetFolderPath("Desktop")
$startMenuPath = [Environment]::GetFolderPath("StartMenu")

Write-Host "📍 Files installed:" -ForegroundColor White
Write-Host "   • $ScriptDir\run-neurodb.ps1"
Write-Host "   • $desktopPath\NeuroDB.lnk"
Write-Host "   • $startMenuPath\Programs\NeuroDB.lnk"
Write-Host ""

Write-Host "📚 For help and troubleshooting, see:" -ForegroundColor White
Write-Host "   $ScriptDir\README.md"
Write-Host ""

Write-Host "🗑️  To uninstall, run:" -ForegroundColor White
Write-Host "   .\uninstall.ps1" -ForegroundColor Blue
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
