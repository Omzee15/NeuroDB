const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Server Management
  saveServer: (server) => ipcRenderer.invoke('save-server', server),
  deleteServer: (serverId) => ipcRenderer.invoke('delete-server', serverId),
  listDatabasesOnServer: (serverId) => ipcRenderer.invoke('list-databases-on-server', serverId),
  
  // Database Management
  saveDatabase: (database) => ipcRenderer.invoke('save-database', database),
  deleteDatabase: (databaseId) => ipcRenderer.invoke('delete-database', databaseId),
  addExistingDatabase: (serverId, databaseName) => ipcRenderer.invoke('add-existing-database', serverId, databaseName),
  
  // Connection Management (Legacy + new)
  saveConnection: (connection) => ipcRenderer.invoke('save-connection', connection),
  getConnections: () => ipcRenderer.invoke('get-connections'),
  deleteConnection: (id) => ipcRenderer.invoke('delete-connection', id),
  testConnection: (connection) => ipcRenderer.invoke('test-connection', connection),

  // Database Operations
  connectDB: (connectionId) => ipcRenderer.invoke('connect-db', connectionId),
  disconnectDB: (connectionId) => ipcRenderer.invoke('disconnect-db', connectionId),
  executeQuery: (connectionId, query, queryId) => ipcRenderer.invoke('execute-query', { connectionId, query, queryId }),
  cancelQuery: (queryId) => ipcRenderer.invoke('cancel-query', queryId),

  getDatabaseSchema: (connectionId) => ipcRenderer.invoke('get-database-schema', connectionId),
  getTablesAndViews: (connectionId) => ipcRenderer.invoke('get-tables-and-views', connectionId),
  getTables: (connectionId) => ipcRenderer.invoke('get-tables', connectionId),
  createDatabase: (serverId, databaseName) => ipcRenderer.invoke('create-database', { serverId, databaseName }),
  getTableSchema: (connectionId, tableName) => ipcRenderer.invoke('get-table-schema', { connectionId, tableName }),
  generateDatabaseBackup: (databaseId) => ipcRenderer.invoke('generate-database-backup', databaseId),
  exportToExcel: (data, filename) => ipcRenderer.invoke('export-to-excel', { data, filename }),
  createTable: (connectionId, tableData) => ipcRenderer.invoke('create-table', connectionId, tableData),
  executeCreateTableSQL: (connectionId, sql) => ipcRenderer.invoke('execute-create-table-sql', connectionId, sql),

    // AI Operations
  generateSQL: (prompt, schema, connectionId) => ipcRenderer.invoke('generate-sql', { prompt, schema, connectionId }),
  explainQuery: (query, schema) => ipcRenderer.invoke('explain-query', { query, schema }),
  chatWithAI: (message, context, history) => ipcRenderer.invoke('chat-with-ai', { message, context, history }),

  // Config Management
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  
  // API Key Management
  getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
  setApiKey: (apiKey) => ipcRenderer.invoke('set-api-key', apiKey),

  // File Operations
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),

  // File Operations
  saveFile: (options) => ipcRenderer.invoke('save-file', options)
});
