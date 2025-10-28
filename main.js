const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import database and AI services
const DatabaseService = require('./services/DatabaseService');
const AIService = require('./services/AIService');
const ConfigService = require('./services/ConfigService');

let mainWindow;
const dbService = new DatabaseService();
const aiService = new AIService();
const configService = new ConfigService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
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

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--inspect')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
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

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});
