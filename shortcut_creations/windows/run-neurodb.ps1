# ===========================
# NeuroDB Project Runner
# ===========================
# This PowerShell script launches the NeuroDB Electron application in development mode.
#
# Usage:
#   .\run-neurodb.ps1
#   Or double-click from Windows Explorer

# ====================
# CONFIGURATION
# ====================
# ⚠️ IMPORTANT: Update this path to your actual NeuroDB project location
$ProjectDir = "C:\Users\pikachu\Desktop\J\Create\NeuroDB"

# ====================
# SCRIPT START
# ====================

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🚀 Starting NeuroDB..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Navigate to project directory
if (Test-Path $ProjectDir) {
    Set-Location $ProjectDir
    Write-Host "✅ Project directory: $ProjectDir" -ForegroundColor Green
} else {
    Write-Host "❌ Error: Failed to navigate to project directory" -ForegroundColor Red
    Write-Host "   Path: $ProjectDir" -ForegroundColor Red
    Write-Host "" 
    Write-Host "Please update the `$ProjectDir variable in this script." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found" -ForegroundColor Red
    Write-Host "   Are you sure this is the correct NeuroDB directory?" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  Warning: node_modules not found" -ForegroundColor Yellow
    Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
    npm install
}

# Check if npm is available
$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmPath) {
    Write-Host "❌ Error: npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "   Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Run the electron development server
Write-Host "⚡ Starting Electron development server..." -ForegroundColor Cyan
Write-Host ""

# Run npm command and keep window open
npm run electron:dev

# Keep window open if there was an error
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
