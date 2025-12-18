# 🍎 macOS Installation Instructions

## Step 1: Open Terminal

Press `⌘ + Space` → Type "Terminal" → Press Enter

## Step 2: Navigate to Scripts Folder

```bash
cd /path/to/NeuroDB/shortcut_creations/mac
```

**Example:**
```bash
cd /Users/pikachu/Desktop/J/Create/NeuroDB/shortcut_creations/mac
```

## Step 3: Run the Installer

```bash
./install-all.sh
```

## Step 4: Follow the Prompts

1. Press `y` when asked to continue
2. Confirm the project path (press `y` if correct)
3. Enter your password when prompted (for sudo)
4. Wait for installation to complete

## Step 5: Done! ✅

You now have:
- ✅ Terminal command: Type `run-neurodb` anywhere
- ✅ Desktop app: Double-click `NeuroDB.app` on Desktop
- ✅ Applications app: Find in Spotlight or Launchpad

---

## How to Use

### Option 1: Terminal
```bash
run-neurodb
```

### Option 2: Desktop
Double-click `NeuroDB.app` on your Desktop

### Option 3: Spotlight
Press `⌘ + Space` → Type "NeuroDB" → Press Enter

### Option 4: Dock
Drag `NeuroDB.app` to your Dock for quick access

---

## Uninstall

```bash
cd /path/to/NeuroDB/shortcut_creations/mac
./uninstall.sh
```

---

## Troubleshooting

**Permission denied:**
```bash
sudo chmod 755 /usr/local/bin/run-neurodb
```

**Wrong project path:**
```bash
nano run-neurodb.sh
# Change line 21 to your actual path
```

**App won't open:**
```bash
chmod +x ~/Desktop/NeuroDB.app/Contents/MacOS/NeuroDB
```
