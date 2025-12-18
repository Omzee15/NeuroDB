# 🪟 Windows Installation Instructions

## Step 1: Open PowerShell

Press `Windows + X` → Select "Windows PowerShell" or "Terminal"

*(No need for Administrator mode)*

## Step 2: Navigate to Scripts Folder

```powershell
cd C:\path\to\NeuroDB\shortcut_creations\windows
```

**Example:**
```powershell
cd C:\Users\pikachu\Desktop\NeuroDB\shortcut_creations\windows
```

## Step 3: Enable Script Execution (First Time Only)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Press `Y` and Enter when prompted

## Step 4: Run the Installer

```powershell
.\install-all.ps1
```

## Step 5: Follow the Prompts

1. Press `Y` when asked to continue
2. Confirm the project path (press `Y` if correct)
3. Wait for installation to complete
4. Press any key to exit

## Step 6: Done! ✅

You now have:
- ✅ Desktop shortcut with icon
- ✅ Start Menu entry
- ✅ PowerShell launcher script

---

## How to Use

### Option 1: Desktop
Double-click `NeuroDB` shortcut on Desktop

### Option 2: Start Menu
Press `Windows` key → Type "NeuroDB" → Click icon

### Option 3: PowerShell
```powershell
cd C:\path\to\NeuroDB
.\shortcut_creations\windows\run-neurodb.ps1
```

### Option 4: Taskbar (Recommended)
Right-click Desktop shortcut → "Pin to Taskbar"

---

## Uninstall

```powershell
cd C:\path\to\NeuroDB\shortcut_creations\windows
.\uninstall.ps1
```

---

## Troubleshooting

**"Scripts are disabled":**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Wrong project path:**
```powershell
notepad run-neurodb.ps1
```
Change line:
```powershell
$ProjectDir = "C:\your\actual\path\to\NeuroDB"
```
Then save and run `.\install-all.ps1` again

**npm not found:**
Install Node.js from https://nodejs.org/

**Icon not showing:**
Re-run `.\create-shortcuts.ps1`
