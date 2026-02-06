# 🐧 Linux (Ubuntu) Installation Instructions

## Step 1: Open Terminal

Press `Ctrl + Alt + T` or search for "Terminal" in your applications

## Step 2: Navigate to Scripts Folder

```bash
cd /path/to/NeuroDB/shortcut_creations/linux
```

**Example:**
```bash
cd ~/Desktop/NeuroDB/shortcut_creations/linux
```

## Step 3: Make Scripts Executable

```bash
chmod +x install-all.sh
```

## Step 4: Run the Installer

```bash
./install-all.sh
```

## Step 5: Follow the Prompts

1. Press `y` when asked to continue
2. Confirm the project path (press `y` if correct)
3. Enter your password when prompted (for sudo)
4. Wait for installation to complete

## Step 6: Done! ✅

You now have:
- ✅ Terminal command: Type `run-neurodb` anywhere
- ✅ Desktop shortcut with icon
- ✅ Applications menu entry (searchable in launcher)

---

## How to Use

### Option 1: Terminal
```bash
run-neurodb
```

### Option 2: Desktop
Double-click `NeuroDB.desktop` on your Desktop

### Option 3: Application Launcher
Press `Super` (Windows key) → Type "NeuroDB" → Click icon

---

## Uninstall

```bash
cd /path/to/NeuroDB/shortcut_creations/linux
./uninstall.sh
```

---

## Troubleshooting

**Command not found after install:**
```bash
# Restart terminal or run:
source ~/.bashrc
```

**Desktop shortcut not showing icon:**
```bash
# Make sure icon was created:
ls -la ~/Desktop/NeuroDB.desktop
# If permission issue:
chmod +x ~/Desktop/NeuroDB.desktop
```

**Wrong project path:**
Edit the run-neurodb script:
```bash
sudo nano /usr/local/bin/run-neurodb
```
Change the PROJECT_DIR line to your actual path, then save (Ctrl+O, Enter, Ctrl+X)

**npm not found:**
Install Node.js:
```bash
sudo apt update
sudo apt install nodejs npm -y
```

**Permission denied:**
Run with proper permissions:
```bash
chmod +x install-all.sh
./install-all.sh
```

---

## Note for Other Distributions

This script is designed for Ubuntu/Debian-based systems. For other distributions:
- Fedora/RHEL: Replace `apt` with `dnf` or `yum`
- Arch: Replace `apt` with `pacman`
- Desktop shortcut location may vary by desktop environment
