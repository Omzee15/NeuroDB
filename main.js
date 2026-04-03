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
const SnippetService = require('./services/SnippetService');

let mainWindow;
const dbService = new DatabaseService();
const configService = new ConfigService();
const aiService = new AIService(configService);
const snippetService = new SnippetService();

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

  // Handle window close event to gracefully disconnect database connections
  mainWindow.on('close', async (event) => {
    // Prevent immediate close
    event.preventDefault();
    
    try {
      console.log('Window closing, disconnecting database connections...');
      
      // Disconnect all database connections
      await dbService.disconnectAll();
      
      console.log('All connections closed, quitting app...');
      
      // Now actually close the window and quit
      mainWindow.destroy();
      app.quit();
    } catch (error) {
      console.error('Error during cleanup:', error);
      // Even if there's an error, close the app
      mainWindow.destroy();
      app.quit();
    }
  });
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

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    // Disconnect all database connections before quitting
    try {
      await dbService.disconnectAll();
    } catch (error) {
      console.error('Error disconnecting on quit:', error);
    }
    app.quit();
  }
});

// Handle app quit event (e.g., Cmd+Q on macOS)
app.on('before-quit', async (event) => {
  // Prevent immediate quit
  event.preventDefault();
  
  try {
    console.log('App quitting, disconnecting database connections...');
    await dbService.disconnectAll();
    console.log('All connections closed');
  } catch (error) {
    console.error('Error during cleanup on quit:', error);
  }
  
  // Now allow the app to quit
  app.exit(0);
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

// Drop Database
ipcMain.handle('drop-database', async (event, { serverId, databaseName }) => {
  try {
    const result = await dbService.dropDatabase(serverId, databaseName);
    return result;
  } catch (error) {
    console.error('Error dropping database:', error);
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

ipcMain.handle('generate-database-schema', async (event, databaseId) => {
  return dbService.generateDatabaseSchema(databaseId);
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

ipcMain.handle('get-api-key', async () => {
  try {
    return { 
      success: true, 
      apiKey: configService.getStoredApiKey() 
    };
  } catch (error) {
    console.error('Error getting API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-api-key', async () => {
  try {
    const result = configService.clearApiKey();
    if (result.success) {
      // Reinitialize AI service with default API key
      const AIService = require('./services/AIService');
      Object.assign(aiService, new AIService(configService));
      return { success: true, message: 'API key cleared successfully' };
    }
    return result;
  } catch (error) {
    console.error('Error clearing API key:', error);
    return { success: false, error: error.message };
  }
});

// Query History Management
ipcMain.handle('get-query-history', async () => {
  try {
    const history = configService.getQueryHistory();
    return { success: true, history };
  } catch (error) {
    console.error('Error getting query history:', error);
    return { success: false, error: error.message, history: [] };
  }
});

ipcMain.handle('save-query-history', async (event, history) => {
  try {
    const result = configService.saveQueryHistory(history);
    return result;
  } catch (error) {
    console.error('Error saving query history:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-query-to-history', async (event, queryItem) => {
  try {
    const result = configService.addQueryToHistory(queryItem);
    return result;
  } catch (error) {
    console.error('Error adding query to history:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-query-history', async () => {
  try {
    const result = configService.clearQueryHistory();
    return result;
  } catch (error) {
    console.error('Error clearing query history:', error);
    return { success: false, error: error.message };
  }
});

// Snippet Management
ipcMain.handle('get-snippets', async () => {
  try {
    const snippets = snippetService.getSnippets();
    return { success: true, snippets };
  } catch (error) {
    console.error('Error getting snippets:', error);
    return { success: false, error: error.message, snippets: [] };
  }
});

ipcMain.handle('save-snippet', async (event, snippet) => {
  try {
    const result = snippetService.addSnippet(snippet);
    return result;
  } catch (error) {
    console.error('Error saving snippet:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-snippet', async (event, { id, snippet }) => {
  try {
    const result = snippetService.updateSnippet(id, snippet);
    return result;
  } catch (error) {
    console.error('Error updating snippet:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-snippet', async (event, snippetId) => {
  try {
    const result = snippetService.deleteSnippet(snippetId);
    return result;
  } catch (error) {
    console.error('Error deleting snippet:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-snippets', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Snippets',
      defaultPath: 'snippets.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const exportResult = snippetService.exportSnippets(result.filePath);
    return exportResult;
  } catch (error) {
    console.error('Error exporting snippets:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-snippets', async (event, replaceExisting = false) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Snippets',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const importResult = snippetService.importSnippets(result.filePaths[0], replaceExisting);
    return importResult;
  } catch (error) {
    console.error('Error importing snippets:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('migrate-snippets-from-localstorage', async (event, localStorageData) => {
  try {
    const result = snippetService.migrateFromLocalStorage(localStorageData);
    return result;
  } catch (error) {
    console.error('Error migrating snippets:', error);
    return { success: false, error: error.message };
  }
});

// Window Controls
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', async () => {
  if (mainWindow) {
    // The close event handler will take care of disconnecting
    mainWindow.close();
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});
