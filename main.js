const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Set the application name
app.setName('NeuroDB');

// Import database and AI services
const DatabaseService = require('./services/DatabaseService');
const AIService = require('./services/AIService');
const ConfigService = require('./services/ConfigService');

let mainWindow;
const dbService = new DatabaseService();
const configService = new ConfigService();
const aiService = new AIService(configService);

function createWindow() {
  // Get the appropriate icon based on platform
  let iconPath;
  if (process.platform === 'darwin') {
    // For development, use PNG instead of .icns to avoid loading issues
    iconPath = path.join(__dirname, 'build/icons/512x512.png');
  } else if (process.platform === 'win32') {
    // Windows uses .ico files
    iconPath = path.join(__dirname, 'build/icons/icon.ico');
  } else {
    // Linux and others use PNG
    iconPath = path.join(__dirname, 'build/icons/512x512.png');
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'NeuroDB',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    frame: false
  });

  // Set dock icon on macOS with error handling
  if (process.platform === 'darwin') {
    try {
      // Use PNG for development as it's more reliable
      const iconPath = path.join(__dirname, 'build/icons/512x512.png');
      app.dock.setIcon(iconPath);
    } catch (error) {
      console.log('Failed to set dock icon:', error.message);
    }
  }

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--inspect')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Ensure the app name is set for dock/taskbar
  app.setName('NeuroDB');
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Server Management
ipcMain.handle('save-server', async (event, server) => {
  return dbService.saveServer(server);
});

ipcMain.handle('delete-server', async (event, serverId) => {
  return dbService.deleteServer(serverId);
});

ipcMain.handle('list-databases-on-server', async (event, serverId) => {
  return dbService.listDatabasesOnServer(serverId);
});

// Database Management
ipcMain.handle('save-database', async (event, database) => {
  return dbService.saveDatabase(database);
});

ipcMain.handle('delete-database', async (event, databaseId) => {
  return dbService.deleteDatabase(databaseId);
});

ipcMain.handle('add-existing-database', async (event, serverId, databaseName) => {
  return dbService.addExistingDatabase(serverId, databaseName);
});

// Connection Management (Legacy support + new structure)
ipcMain.handle('save-connection', async (event, connection) => {
  return dbService.saveConnection(connection);
});

ipcMain.handle('get-connections', async () => {
  return dbService.getConnections();
});

ipcMain.handle('delete-connection', async (event, id) => {
  return dbService.deleteConnection(id);
});

ipcMain.handle('test-connection', async (event, connection) => {
  return dbService.testConnection(connection);
});

// Database Operations
// Database Operations
ipcMain.handle('connect-db', async (event, connectionId) => {
  try {
    const result = await dbService.connect(connectionId);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error connecting to database:', error);
    return { success: false, error: error.message };
  }
});

// Create Database
ipcMain.handle('create-database', async (event, { serverId, databaseName }) => {
  try {
    const result = await dbService.createDatabase(serverId, databaseName);
    return { success: true, database: result };
  } catch (error) {
    console.error('Error creating database:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-db', async (event, connectionId) => {
  return dbService.disconnect(connectionId);
});

ipcMain.handle('execute-query', async (event, { connectionId, query, queryId }) => {
  return dbService.executeQuery(connectionId, query, queryId);
});

ipcMain.handle('cancel-query', async (event, queryId) => {
  return dbService.cancelQuery(queryId);
});

ipcMain.handle('get-database-schema', async (event, connectionId) => {
  return dbService.getDatabaseSchema(connectionId);
});

ipcMain.handle('get-tables-and-views', async (event, connectionId) => {
  return dbService.getTablesAndViews(connectionId);
});


ipcMain.handle('get-tables', async (event, connectionId) => {
  return dbService.getTables(connectionId);
});

ipcMain.handle('get-table-schema', async (event, { connectionId, tableName }) => {
  return dbService.getTableSchema(connectionId, tableName);
});

ipcMain.handle('generate-database-backup', async (event, databaseId) => {
  return dbService.generateDatabaseBackup(databaseId);
});

ipcMain.handle('create-table', async (event, connectionId, tableData) => {
  try {
    const result = await dbService.createTable(connectionId, tableData);
    return result;
  } catch (error) {
    console.error('Error creating table:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('execute-create-table-sql', async (event, connectionId, sql) => {
  try {
    const result = await dbService.executeCreateTableSQL(connectionId, sql);
    return result;
  } catch (error) {
    console.error('Error executing CREATE TABLE SQL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-to-excel', async (event, { data, filename }) => {
  const XLSX = require('xlsx');
  const { dialog } = require('electron');
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    
    // Show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${filename}.xlsx`,
      filters: [
        { name: 'Excel Files', extensions: ['xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      // Write file
      XLSX.writeFile(wb, result.filePath);
      return { success: true };
    } else {
      return { success: false, error: 'Save cancelled' };
    }
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { success: false, error: error.message };
  }
});

// AI Operations
ipcMain.handle('generate-sql', async (event, { prompt, schema, connectionId }) => {
  return aiService.generateSQL(prompt, schema);
});

ipcMain.handle('explain-query', async (event, { query, schema }) => {
  return aiService.explainQuery(query, schema);
});

ipcMain.handle('chat-with-ai', async (event, { message, context, history }) => {
  return aiService.chat(message, context, history);
});

// Config Management
ipcMain.handle('get-config', async (event, key) => {
  if (key) {
    return configService.get(key);
  }
  return configService.getAll();
});

ipcMain.handle('set-config', async (event, { key, value }) => {
  return configService.set(key, value);
});

ipcMain.handle('get-theme', async () => {
  return configService.getTheme();
});

ipcMain.handle('set-theme', async (event, theme) => {
  return configService.setTheme(theme);
});

// Handle errors

// File Operations
ipcMain.handle('open-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'SQL Files', extensions: ['sql'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const content = fs.readFileSync(result.filePaths[0], 'utf8');
    return {
      success: true,
      content,
      filePath: result.filePaths[0]
    };
  } catch (error) {
    console.error('Error opening file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('save-file', async (event, { content, defaultPath, filters }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultPath,
      filters: filters || [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(result.filePath, content, 'utf8');
    
    return {
      success: true,
      filePath: result.filePath
    };
  } catch (error) {
    console.error('Error saving file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Config/API Key Operations
ipcMain.handle('get-api-key-status', async () => {
  return {
    hasApiKey: configService.hasApiKey(),
    hasUserApiKey: configService.hasUserApiKey(),
    isAiAvailable: aiService.isAvailable(),
    usingDefaultKey: !configService.hasUserApiKey()
  };
});

ipcMain.handle('set-api-key', async (event, apiKey) => {
  try {
    const result = configService.setApiKey(apiKey);
    if (result.success) {
      // Reinitialize AI service with new API key
      const AIService = require('./services/AIService');
      Object.assign(aiService, new AIService(configService));
      return { success: true, message: 'API key saved successfully' };
    }
    return result;
  } catch (error) {
    console.error('Error setting API key:', error);
    return { success: false, error: error.message };
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});
