// State Management
let currentConnectionId = null;
let currentSchema = null;
let chatHistory = [];
let connections = [];
let snippets = JSON.parse(localStorage.getItem('neurodb_snippets')) || [];
let variables = JSON.parse(localStorage.getItem('neurodb_variables')) || [];
let queryHistory = []; // Store query history for current session
let savedQueries = JSON.parse(localStorage.getItem('neurodb_saved_queries')) || [];
let currentMainTab = 'query';
let globalState = {
  lastExecutedQuery: '',
  lastQueryResults: []
};
let dbmlTables = [];
let dbmlRelationships = [];
// DBML zoom and pan state
let dbmlZoom = 1;
let dbmlPanX = 0;
let dbmlPanY = 0;
let dbmlIsPanning = false;
let dbmlLastPanX = 0;
let dbmlLastPanY = 0;
let currentTheme = 'vscode-dark'; // Will be loaded from config
let autocompleteSelectedIndex = -1;
let currentTablesAndViews = []; // Store current database tables and views
let selectedTableInfo = null; // Store currently selected table information
let currentQueryId = null; // Track current query for cancellation
let isQueryExecuting = false; // Track query execution state
let currentLimit = 100; // Track current query limit

// Connection tabs state
let connectionTabs = []; // Array of active connection tabs
let activeTabIndex = -1; // Index of currently active tab

// AI Assistant instances per tab
let aiInstances = new Map(); // Map of tab IDs to AI assistant instances

// PSQL Terminal state
let psqlCommandHistory = []; // Store PSQL command history
let psqlHistoryIndex = -1; // Current position in command history
let psqlCurrentCommand = ''; // Store current command when navigating history

// DOM Elements - will be initialized after DOM loads
let welcomeScreen, databaseView, connectionsList, connectionModal, connectionForm;
let queryEditor, resultsTableContainer, resultsInfo;
let aiPrompt, aiPanel, aiChatContainer, aiChatInput;
let dbTree, psqlOutput, psqlInput;
let whereClauseBuilder, selectedTableName, filterRowsContainer, addFilterBtn;
let executeWhereBtn, closeWhereBuilder;
let whereSortColumnSelect, whereSortOrderSelect;
let executeQueryBtn, executeSelectedBtn, stopQueryBtn, limitSelect;
let filterRowCounter = 0; // Counter for unique filter row IDs

// Initialize all DOM element references
function initializeDOMElements() {
  welcomeScreen = document.getElementById('welcomeScreen');
  databaseView = document.getElementById('databaseView');
  connectionsList = document.getElementById('connectionsList');
  connectionModal = document.getElementById('connectionModal');
  connectionForm = document.getElementById('connectionForm');
  queryEditor = document.getElementById('queryEditor');
  resultsTableContainer = document.getElementById('resultsTableContainer');
  resultsInfo = document.getElementById('resultsInfo');
  aiPrompt = document.getElementById('aiPrompt');
  aiPanel = document.getElementById('aiPanel');
  aiChatContainer = document.getElementById('aiChatContainer');
  aiChatInput = document.getElementById('aiChatInput');
  dbTree = document.getElementById('dbTree');
  psqlOutput = document.getElementById('psqlOutput');
  psqlInput = document.getElementById('psqlInput');
  whereClauseBuilder = document.getElementById('whereClauseBuilder');
  selectedTableName = document.getElementById('selectedTableName');
  filterRowsContainer = document.getElementById('filterRowsContainer');
  addFilterBtn = document.getElementById('addFilterBtn');
  executeWhereBtn = document.getElementById('executeWhereBtn');
  closeWhereBuilder = document.getElementById('closeWhereBuilder');
  whereSortColumnSelect = document.getElementById('whereSortColumnSelect');
  whereSortOrderSelect = document.getElementById('whereSortOrderSelect');
  executeQueryBtn = document.getElementById('executeQueryBtn');
  executeSelectedBtn = document.getElementById('executeSelectedBtn');
  stopQueryBtn = document.getElementById('stopQueryBtn');
  limitSelect = document.getElementById('limitSelect');
}

// Platform-specific setup
function setupPlatformSpecific() {
  // Detect platform and add class to body
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) {
    document.body.classList.add('platform-win32');
  } else if (platform.includes('linux')) {
    document.body.classList.add('platform-linux');
  } else {
    document.body.classList.add('platform-darwin');
  }
  
  // Set up window controls for Windows/Linux
  if (platform.includes('win') || platform.includes('linux')) {
    setupWindowControls();
  }
}

function setupWindowControls() {
  const minimizeBtn = document.getElementById('minimizeBtn');
  const maximizeBtn = document.getElementById('maximizeBtn');
  const closeBtn = document.getElementById('closeBtn');
  
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      window.api.minimizeWindow();
    });
  }
  
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      window.api.maximizeWindow();
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.api.closeWindow();
    });
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Set up platform-specific styles and controls
    setupPlatformSpecific();
    
    // Initialize DOM element references
    initializeDOMElements();
    
    await loadConnections();
    await loadTheme();
    await loadQueryHistory(); // Load persisted query history
    setupEventListeners();
    setupDatabaseBrowserResize();
    setupSidebarResize();
    applyTheme(currentTheme);
    updateLineNumbers();
    updateSyntaxHighlight();
    
    // Initialize connection tabs
    renderConnectionTabs();
    
    // Load saved snippets and variables
    loadSnippets();
    loadVariables();
    loadSavedQueries();
    
    // Initialize limit dropdown
    initializeLimitDropdown();
    
    // Initialize execute selected button state
    updateExecuteSelectedButtonState();
    
    // Restore last active tab if any
    const lastTab = localStorage.getItem('lastActiveTab') || 'query';
    switchMainTab(lastTab);
    
    // Check if there are any connections
    renderConnections(); // Make sure connections are displayed
    if (!connections || connections.length === 0) {
      welcomeScreen.classList.remove('hidden');
      databaseView.classList.add('hidden');
    } else {
      welcomeScreen.classList.add('hidden');
      databaseView.classList.remove('hidden');
    }
    
    // Initialize container heights after a short delay to ensure DOM is fully rendered
    setTimeout(() => {
      updateContainerHeights();
    }, 100);
    
    // Initialize AI prompt history
    setupAIHistory();
    
    // Initialize Add Row button
    initAddRowButton();
  } catch (error) {
    console.error('Error initializing app:', error);
    showNotification('Error initializing application', 'error');
  }
});

// Load Connections
async function loadConnections() {
  try {
    // Clear existing connections
    connections = [];
    
    // Load connections from backend
    const result = await window.api.getConnections();
    
    if (result.success) {
      const { servers = [], databases = [] } = result;
      // Convert to the format expected by the UI
      connections = servers.map(server => ({
        ...server,
        type: 'server',
        databases: databases.filter(db => db.serverId === server.id)
      }));
      console.log('Loaded connections:', {
        servers: servers.length,
        databases: databases.length
      });
    } else {
      console.error('Failed to load connections:', result.error);
    }
    
    // Update UI
    renderConnections();
    
    // Update visibility of welcome screen
    if (connections.length === 0) {
      welcomeScreen.classList.remove('hidden');
      databaseView.classList.add('hidden');
    } else {
      welcomeScreen.classList.add('hidden');
      databaseView.classList.remove('hidden');
    }
    
    return connections;
  } catch (error) {
    console.error('Error loading connections:', error);
    showNotification('Failed to load connections', 'error');
    return [];
  }
}

// Load Theme from Config
async function loadTheme() {
  try {
    const theme = await window.api.getTheme();
    currentTheme = theme || 'vscode-dark';
  } catch (error) {
    console.error('Error loading theme:', error);
    currentTheme = 'vscode-dark';
  }
}

// Load Query History from file
async function loadQueryHistory() {
  try {
    const result = await window.api.getQueryHistory();
    if (result.success && result.history) {
      queryHistory = result.history;
      console.log(`Loaded ${queryHistory.length} queries from history`);
    }
  } catch (error) {
    console.error('Error loading query history:', error);
    queryHistory = [];
  }
}

// Save Query History to file
async function saveQueryHistory() {
  try {
    await window.api.saveQueryHistory(queryHistory);
  } catch (error) {
    console.error('Error saving query history:', error);
  }
}

// Render Connections
function renderConnections() {
  if (!connectionsList) {
    console.error('Connections list element not found');
    return;
  }

  connectionsList.innerHTML = '';
  
  if (!connections || connections.length === 0) {
    connectionsList.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 12px;">No servers yet</div>';
    return;
  }
  
  connections.forEach(server => {
    // Create server container
    const serverItem = document.createElement('div');
    serverItem.className = 'server-item';
    serverItem.dataset.serverId = server.id;
    
    // Server header
    const serverHeader = document.createElement('div');
    serverHeader.className = 'server-header';
    serverHeader.innerHTML = `
      <div class="server-info" onclick="toggleServer('${server.id}')">
        <svg class="server-toggle-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin: 0 6px;">
          <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/>
          <path d="M2 6h12M2 9h12" stroke="var(--bg-primary)" stroke-width="1.5"/>
        </svg>
        <span class="server-name">${server.name}</span>
      </div>
      <div class="server-actions">
        <button class="btn-icon" onclick="editServer('${server.id}')" title="Edit Server">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z"/>
          </svg>
        </button>
        <button class="btn-icon" onclick="exportServerConnection('${server.id}')" title="Export Connection">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3"/>
            <polyline points="4 6 8 2 12 6"/>
            <line x1="8" y1="2" x2="8" y2="11"/>
          </svg>
        </button>
        <button class="btn-icon" onclick="openAddDatabaseModal('${server.id}')" title="Add Database">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
        <button class="btn-icon btn-danger" onclick="deleteServer('${server.id}')" title="Delete Server">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
    `;
    
    // Databases container
    const databasesContainer = document.createElement('div');
    databasesContainer.className = 'databases-container hidden';
    
    if (server.databases && server.databases.length > 0) {
      server.databases.forEach(db => {
        const dbItem = document.createElement('div');
        dbItem.className = 'database-item';
        if (db.id === currentConnectionId) {
          dbItem.classList.add('active');
        }
        
        dbItem.innerHTML = `
          <div class="database-info" onclick="connectToDatabase('${db.id}')">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
              <ellipse cx="8" cy="4" rx="6" ry="2" fill="currentColor"/>
              <path d="M2 4v8c0 1.1 2.7 2 6 2s6-.9 6-2V4" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 8c0 1.1 2.7 2 6 2s6-.9 6-2" fill="none" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span class="database-name">${db.name}</span>
            <span class="connection-status-dot ${db.connected ? 'connected' : ''}"></span>
          </div>
          <div class="database-actions">
            <button class="btn-icon" onclick="event.stopPropagation(); connectToDatabase('${db.id}')" title="Connect to Database">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 4 13 8 9 12"></polyline>
                <line x1="13" y1="8" x2="3" y2="8"></line>
              </svg>
            </button>
            <button class="btn-icon" onclick="event.stopPropagation(); downloadDatabaseBackup('${db.id}', '${db.name}')" title="Download Database Backup">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 15h10"></path>
                <path d="M8 3v9"></path>
                <polyline points="4 9 8 13 12 9"></polyline>
              </svg>
            </button>
            <button class="btn-icon btn-danger" onclick="event.stopPropagation(); deleteDatabase('${db.id}')" title="Remove Database">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>
        `;
        
        // Remove the event listener since we now handle it inline
        databasesContainer.appendChild(dbItem);
      });
    } else {
      databasesContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 12px 8px; font-size: 11px;">No databases added</div>';
    }
    
    serverItem.appendChild(serverHeader);
    serverItem.appendChild(databasesContainer);
    connectionsList.appendChild(serverItem);
  });
}

function toggleServer(serverId) {
  const serverItem = document.querySelector(`[data-server-id="${serverId}"]`);
  const container = serverItem.querySelector('.databases-container');
  const icon = serverItem.querySelector('.server-toggle-icon');
  
  container.classList.toggle('hidden');
  serverItem.classList.toggle('expanded');
  
  if (container.classList.contains('hidden')) {
    icon.style.transform = 'rotate(0deg)';
  } else {
    icon.style.transform = 'rotate(90deg)';
  }
}

// Table Selection Management
let selectedCells = new Set();
let selectedRows = new Set();
let selectedColumns = new Set();
let lastSelectedCell = null;
let isShiftSelecting = false;
let isDraggingSelection = false;
let dragStartCell = null;
let dragCurrentCell = null;

function clearAllSelections() {
  // Clear visual selections
  document.querySelectorAll('.results-table td.selected-cell').forEach(cell => {
    cell.classList.remove('selected-cell');
  });
  document.querySelectorAll('.results-table tr.selected-row').forEach(row => {
    row.classList.remove('selected-row');
  });
  document.querySelectorAll('.results-table th.selected-column, .results-table td.selected-column').forEach(element => {
    element.classList.remove('selected-column');
  });
  
  // Clear sets
  selectedCells.clear();
  selectedRows.clear();
  selectedColumns.clear();
  lastSelectedCell = null;
}

function getCellKey(rowIndex, colIndex) {
  return `${rowIndex}-${colIndex}`;
}

function selectCell(td, rowIndex, colIndex, addToSelection = false) {
  if (!addToSelection && !isShiftSelecting) {
    clearAllSelections();
  }
  
  const cellKey = getCellKey(rowIndex, colIndex);
  
  if (selectedCells.has(cellKey)) {
    // Deselect if already selected
    selectedCells.delete(cellKey);
    td.classList.remove('selected-cell');
  } else {
    // Select cell
    selectedCells.add(cellKey);
    td.classList.add('selected-cell');
    lastSelectedCell = { rowIndex, colIndex };
  }
}

function selectRow(rowIndex, addToSelection = false) {
  if (!addToSelection) {
    clearAllSelections();
  }
  
  const table = document.querySelector('.results-table');
  const row = table.querySelector(`tbody tr:nth-child(${rowIndex + 1})`);
  
  if (selectedRows.has(rowIndex)) {
    // Deselect row
    selectedRows.delete(rowIndex);
    row.classList.remove('selected-row');
  } else {
    // Select row
    selectedRows.add(rowIndex);
    row.classList.add('selected-row');
  }
}

function selectColumn(colIndex, addToSelection = false) {
  if (!addToSelection) {
    clearAllSelections();
  }
  
  const table = document.querySelector('.results-table');
  
  if (selectedColumns.has(colIndex)) {
    // Deselect column
    selectedColumns.delete(colIndex);
    
    // Remove header selection
    const header = table.querySelector(`thead th:nth-child(${colIndex + 2})`); // +2 because of row number column
    if (header) header.classList.remove('selected-column');
    
    // Remove cell selections
    const cells = table.querySelectorAll(`tbody td:nth-child(${colIndex + 2})`);
    cells.forEach(cell => cell.classList.remove('selected-column'));
  } else {
    // Select column
    selectedColumns.add(colIndex);
    
    // Add header selection
    const header = table.querySelector(`thead th:nth-child(${colIndex + 2})`);
    if (header) header.classList.add('selected-column');
    
    // Add cell selections
    const cells = table.querySelectorAll(`tbody td:nth-child(${colIndex + 2})`);
    cells.forEach(cell => cell.classList.add('selected-column'));
  }
}

function selectCellRange(startRow, startCol, endRow, endCol) {
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const td = document.querySelector(`.results-table tbody tr:nth-child(${row + 1}) td:nth-child(${col + 2})`);
      if (td) {
        const cellKey = getCellKey(row, col);
        selectedCells.add(cellKey);
        td.classList.add('selected-cell');
      }
    }
  }
}

// Setup Event Listeners
function handleDatabaseDisconnect() {
  // Hide backup and schema buttons
  const backupBtn = document.getElementById('backupDatabaseBtn');
  if (backupBtn) {
    backupBtn.classList.add('hidden');
  }
  const schemaBtn = document.getElementById('downloadSchemaBtn');
  if (schemaBtn) {
    schemaBtn.classList.add('hidden');
  }

  // Reset connection state
  currentConnectionId = null;
  currentSchema = null;
  
  // Clear all connection tabs and AI instances
  connectionTabs.forEach(tab => {
    destroyAIInstanceForTab(tab.id);
  });
  connectionTabs = [];
  activeTabIndex = -1;
  
  // Update UI
  document.getElementById('currentConnection').textContent = 'No connection selected';
  renderConnectionTabs(); // This will show the welcome message
  
  // Clear database tree
  if (dbTree) {
    dbTree.innerHTML = '';
  }
  
  // Clear query editor
  queryEditor.value = '';
  updateLineNumbers();
  updateSyntaxHighlight();
  
  // Show welcome screen if no connections
  if (!connections || connections.length === 0) {
    welcomeScreen.classList.remove('hidden');
    databaseView.classList.add('hidden');
  }
  
  renderConnections();
}

// Connection Tabs Management
function createConnectionTab(connectionId, serverName, databaseName) {
  const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const tab = {
    id: tabId,
    connectionId: connectionId,
    name: `${serverName} / ${databaseName}`,
    queryEditorContent: '',
    queryResults: null, // Store query results for this tab
    queryFields: null,  // Store query fields for this tab
    resultsInfoText: '', // Store results info text for this tab
    selectedTableInfo: null, // Store selected table info for this tab
    isActive: false,
    // AI Assistant specific data
    aiChatHistory: [], // Separate chat history for this connection
    aiContext: {       // Connection-specific AI context
      schema: null,
      connectionName: `${serverName} / ${databaseName}`,
      connectionId: connectionId,
      currentTable: null
    }
  };
  
  connectionTabs.push(tab);
  
  // Create AI assistant instance for this tab
  createAIInstanceForTab(tab);
  
  return tab;
}

// AI Assistant Management for Tabs
function createAIInstanceForTab(tab) {
  // Store the AI instance context for this tab
  aiInstances.set(tab.id, {
    tabId: tab.id,
    connectionId: tab.connectionId,
    chatHistory: tab.aiChatHistory,
    context: tab.aiContext,
    isInitialized: false
  });
  
  console.log(`Created AI instance for tab: ${tab.name} (${tab.id})`);
}

function getActiveAIInstance() {
  if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
    const activeTab = connectionTabs[activeTabIndex];
    return aiInstances.get(activeTab.id);
  }
  return null;
}

function updateAIInstanceSchema(tabId, schema) {
  const aiInstance = aiInstances.get(tabId);
  if (aiInstance) {
    aiInstance.context.schema = schema;
    // Update the corresponding tab's context as well
    const tab = connectionTabs.find(t => t.id === tabId);
    if (tab) {
      tab.aiContext.schema = schema;
    }
  }
}

function destroyAIInstanceForTab(tabId) {
  if (aiInstances.has(tabId)) {
    const aiInstance = aiInstances.get(tabId);
    console.log(`Destroying AI instance for tab: ${tabId}`);
    
    // Clear any pending operations or cleanup if needed
    aiInstance.chatHistory = [];
    aiInstance.context = null;
    
    // Remove from map
    aiInstances.delete(tabId);
  }
}

function switchAIChatToTab(tabId) {
  const aiInstance = aiInstances.get(tabId);
  if (!aiInstance) {
    console.warn(`No AI instance found for tab: ${tabId}`);
    return;
  }
  
  // Clear current chat display
  aiChatContainer.innerHTML = '';
  
  // Update AI prompt placeholder
  if (aiPrompt) {
    aiPrompt.placeholder = `🤖 Ask AI about ${aiInstance.context.connectionName}... (e.g., 'Show all users created this month')`;
  }
  if (aiChatInput) {
    aiChatInput.placeholder = `Ask me anything about ${aiInstance.context.connectionName}...`;
  }
  
  // Show welcome message if no chat history
  if (aiInstance.chatHistory.length === 0) {
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'ai-welcome';
    const schemaStatus = aiInstance.context.schema ? 'ready' : 'loading schema...';
    welcomeMessage.innerHTML = `
      👋 Hi! I'm your AI assistant for <strong>${aiInstance.context.connectionName}</strong>.<br>
      I understand this database's schema and can help you with SQL queries, explanations, and more!<br>
      <small>Status: ${schemaStatus}</small>
    `;
    aiChatContainer.appendChild(welcomeMessage);
  } else {
    // Restore chat history for this tab
    aiInstance.chatHistory.forEach(msg => {
      addAIMessage(msg.role, msg.content, false); // false = don't save to history again
    });
  }
  
  // Update global chat history reference to point to this tab's history
  chatHistory = aiInstance.chatHistory;
  
  // Update connection indicator in AI panel header
  const aiConnectionIndicator = document.getElementById('aiConnectionIndicator');
  if (aiConnectionIndicator) {
    aiConnectionIndicator.textContent = `Connected to: ${aiInstance.context.connectionName}`;
  }
  
  console.log(`Switched AI chat to tab: ${aiInstance.context.connectionName} (${tabId})`);
}

function renderConnectionTabs() {
  const connectionTabsContainer = document.getElementById('connectionTabsContainer');
  const noConnectionsMessage = document.getElementById('noConnectionsMessage');
  
  if (connectionTabs.length === 0) {
    // Show no connections message when no tabs
    noConnectionsMessage.style.display = 'block';
    
    // Clear any existing tabs
    const existingTabs = connectionTabsContainer.querySelectorAll('.connection-tab');
    existingTabs.forEach(tab => tab.remove());
    return;
  }
  
  // Hide the no connections message when tabs are present
  noConnectionsMessage.style.display = 'none';
  
  // Clear existing tabs
  const existingTabs = connectionTabsContainer.querySelectorAll('.connection-tab');
  existingTabs.forEach(tab => tab.remove());
  
  // Create tab elements
  connectionTabs.forEach((tab, index) => {
    const tabElement = document.createElement('div');
    tabElement.className = `connection-tab ${tab.isActive ? 'active' : ''}`;
    tabElement.dataset.tabId = tab.id;
    
    tabElement.innerHTML = `
      <span class="connection-tab-name" title="${tab.name}">${tab.name}</span>
      <button class="connection-tab-close" title="Close connection">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 6.293l2.146-2.147a.5.5 0 11.708.708L8.707 7l2.147 2.146a.5.5 0 01-.708.708L8 7.707l-2.146 2.147a.5.5 0 01-.708-.708L7.293 8 5.146 5.854a.5.5 0 11.708-.708L8 6.293z"/>
        </svg>
      </button>
    `;
    
    // Add click event to switch tabs
    tabElement.addEventListener('click', (e) => {
      if (!e.target.closest('.connection-tab-close')) {
        switchToTab(index);
      }
    });
    
    // Add close event
    const closeBtn = tabElement.querySelector('.connection-tab-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeConnectionTab(index);
    });
    
    connectionTabsContainer.appendChild(tabElement);
  });
}

function switchToTab(tabIndex) {
  if (tabIndex < 0 || tabIndex >= connectionTabs.length) return;
  
  // Save current tab state before switching away
  if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
    connectionTabs[activeTabIndex].queryEditorContent = queryEditor.value;
    connectionTabs[activeTabIndex].isActive = false;
    connectionTabs[activeTabIndex].resultsInfoText = resultsInfo ? resultsInfo.textContent : '';
    connectionTabs[activeTabIndex].selectedTableInfo = selectedTableInfo;
  }
  
  // Switch to new tab
  activeTabIndex = tabIndex;
  const tab = connectionTabs[tabIndex];
  tab.isActive = true;
  
  // Update connection state
  currentConnectionId = tab.connectionId;
  
  // Restore query editor content and strip any HTML that might have gotten in
  const content = tab.queryEditorContent || '';
  queryEditor.value = stripHTML(content);
  updateLineNumbers();
  updateSyntaxHighlight();
  
  // Restore selectedTableInfo for this tab
  selectedTableInfo = tab.selectedTableInfo || null;
  
  // Restore query results if they exist for this tab
  resultsTableContainer.innerHTML = ''; // Clear previous results first
  if (tab.queryResults && tab.queryFields) {
    renderResultsTable(tab.queryResults, tab.queryFields);
    enableExportButtons();
    // Restore the original results info text
    if (tab.resultsInfoText && resultsInfo) {
      resultsInfo.textContent = tab.resultsInfoText;
    } else {
      updateResultsInfo(tab.queryResults.length, tab.queryResults.length);
    }
  } else {
    // Clear results if no previous results for this tab
    resultsTableContainer.innerHTML = '<div class="no-results">Execute a query to see results</div>';
    hideSearchControls();
    hideAddRowButton();
    disableExportButtons();
    if (resultsInfo) resultsInfo.textContent = '';
  }
  
  // Restore or hide the where clause builder based on selectedTableInfo
  if (selectedTableInfo && selectedTableInfo.info && selectedTableInfo.info.columns) {
    showWhereClauseBuilder(selectedTableInfo.fullName, selectedTableInfo.info.columns);
  } else {
    hideWhereClauseBuilder();
  }
  
  // Update AI chat for this tab
  switchAIChatToTab(tab.id);
  
  // Update UI
  renderConnectionTabs();
  
  // Reload database schema for this connection
  loadDatabaseSchema();
  loadTablesAndViews();
}

async function closeConnectionTab(tabIndex) {
  if (tabIndex < 0 || tabIndex >= connectionTabs.length) return;
  
  const tab = connectionTabs[tabIndex];
  
  // Destroy AI instance for this tab
  destroyAIInstanceForTab(tab.id);
  
  // Disconnect from database
  try {
    await window.api.disconnectDB(tab.connectionId);
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
  
  // Remove tab from array
  connectionTabs.splice(tabIndex, 1);
  
  // Update active tab index
  if (activeTabIndex === tabIndex) {
    // If closing active tab, switch to previous tab or reset if no tabs left
    if (connectionTabs.length > 0) {
      const newActiveIndex = Math.max(0, Math.min(tabIndex - 1, connectionTabs.length - 1));
      switchToTab(newActiveIndex);
    } else {
      // No tabs left
      activeTabIndex = -1;
      currentConnectionId = null;
      currentSchema = null;
      queryEditor.value = '';
      updateLineNumbers();
      updateSyntaxHighlight();
      
      // Clear AI chat when no connections and reset placeholders
      aiChatContainer.innerHTML = '';
      const welcomeMessage = document.createElement('div');
      welcomeMessage.className = 'ai-welcome';
      welcomeMessage.innerHTML = '👋 Hi! I\'m your AI assistant. Connect to a database to get started!';
      aiChatContainer.appendChild(welcomeMessage);
      
      // Reset AI input placeholders
      if (aiPrompt) {
        aiPrompt.placeholder = '🤖 Ask AI to generate SQL... (e.g., \'Show all users created this month\')';
      }
      if (aiChatInput) {
        aiChatInput.placeholder = 'Ask me anything about your database...';
      }
      
      // Update connection indicator
      const aiConnectionIndicator = document.getElementById('aiConnectionIndicator');
      if (aiConnectionIndicator) {
        aiConnectionIndicator.textContent = 'No connection';
      }
      
      handleDatabaseDisconnect();
    }
  } else if (activeTabIndex > tabIndex) {
    // Adjust active tab index if it was after the closed tab
    activeTabIndex--;
  }
  
  renderConnectionTabs();
}

function setupEventListeners() {
  // Hide backup and schema buttons by default
  const backupBtn = document.getElementById('backupDatabaseBtn');
  if (backupBtn) {
    backupBtn.classList.add('hidden');
  }
  const schemaBtn = document.getElementById('downloadSchemaBtn');
  if (schemaBtn) {
    schemaBtn.classList.add('hidden');
  }

  // File Operations
  document.getElementById('openSqlFileBtn').addEventListener('click', async () => {
    try {
      const result = await window.api.openFile();
      if (result.success) {
        queryEditor.value = result.content;
        updateLineNumbers();
        updateSyntaxHighlight();
        showNotification('File loaded successfully', 'success');
      } else if (!result.canceled) {
        showNotification('Failed to load file: ' + result.error, 'error');
      }
    } catch (error) {
      showNotification('Error loading file: ' + error.message, 'error');
    }
  });

  document.getElementById('saveSqlFileBtn').addEventListener('click', async () => {
    try {
      const content = queryEditor.value;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      
      const result = await window.api.saveFile({
        content: content,
        defaultPath: `query_${timestamp}.sql`,
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.success) {
        showNotification('File saved successfully', 'success');
      } else if (!result.canceled) {
        showNotification('Failed to save file: ' + result.error, 'error');
      }
    } catch (error) {
      showNotification('Error saving file: ' + error.message, 'error');
    }
  });

  // Tab Navigation
  document.querySelectorAll('.header-tab').forEach(tab => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      const tabName = tab.dataset.tab;
      switchMainTab(tabName);
    });
  });

  // Connection Modal
  document.getElementById('addConnectionBtn')?.addEventListener('click', () => openConnectionModal());
  document.getElementById('welcomeAddConnection')?.addEventListener('click', () => openConnectionModal());
  document.getElementById('closeConnectionModal')?.addEventListener('click', () => closeConnectionModal());
  document.getElementById('cancelConnectionBtn')?.addEventListener('click', () => closeConnectionModal());

  // Export Connection Modal
  document.getElementById('closeExportConnectionModal')?.addEventListener('click', () => closeExportConnectionModal());
  document.getElementById('copyConnectionBtn')?.addEventListener('click', () => copyConnectionToClipboard());
  document.getElementById('exportConnectionFileBtn')?.addEventListener('click', () => exportConnectionToFile());

  // Connection URL toggle
  document.getElementById('useConnectionUrl')?.addEventListener('change', (e) => {
    const urlMode = e.target.checked;
    const urlFields = document.getElementById('urlModeFields');
    const individualFields = document.getElementById('individualModeFields');
    const connectionUrl = document.getElementById('connectionUrl');
    const connectionHost = document.getElementById('connectionHost');
    const connectionPort = document.getElementById('connectionPort');
    const connectionUser = document.getElementById('connectionUser');
    const connectionPassword = document.getElementById('connectionPassword');
    
    if (urlMode) {
      urlFields.classList.remove('hidden');
      individualFields.classList.add('hidden');
      
      // Make URL required, individual fields not required
      connectionUrl.required = true;
      connectionHost.required = false;
      connectionPort.required = false;
      connectionUser.required = false;
      connectionPassword.required = false;
    } else {
      urlFields.classList.add('hidden');
      individualFields.classList.remove('hidden');
      
      // Make individual fields required, URL not required
      connectionUrl.required = false;
      connectionHost.required = true;
      connectionPort.required = true;
      connectionUser.required = true;
      connectionPassword.required = true;
    }
  });

  // Backup Button
  document.getElementById('backupDatabaseBtn')?.addEventListener('click', () => {
    if (currentConnectionId) {
      const dbName = connections.find(c => c.id === currentConnectionId)?.name || 'database';
      downloadDatabaseBackup(currentConnectionId, dbName);
    }
  });

  // Schema Download Button
  document.getElementById('downloadSchemaBtn')?.addEventListener('click', () => {
    if (currentConnectionId) {
      const dbName = connections.find(c => c.id === currentConnectionId)?.name || 'database';
      downloadDatabaseSchema(currentConnectionId, dbName);
    }
  });
  document.getElementById('testConnectionBtn')?.addEventListener('click', testConnection);
  connectionForm?.addEventListener('submit', saveConnection);
  
  // Query Editor
  document.getElementById('executeQueryBtn')?.addEventListener('click', executeQuery);
  document.getElementById('executeSelectedBtn')?.addEventListener('click', executeSelectedQuery);
  document.getElementById('stopQueryBtn')?.addEventListener('click', stopQuery);
  document.getElementById('generateSQLBtn')?.addEventListener('click', generateSQL);
  document.getElementById('explainQueryBtn')?.addEventListener('click', explainQuery);
  document.getElementById('queryHistoryBtn')?.addEventListener('click', openQueryHistoryModal);
  document.getElementById('clearEditorBtn')?.addEventListener('click', () => {
    queryEditor.value = '';
    updateLineNumbers();
    updateSyntaxHighlight();
  });
  
  // Limit dropdown
  limitSelect?.addEventListener('change', handleLimitChange);
  
  // Line numbers and autocomplete
  queryEditor?.addEventListener('input', () => {
    updateLineNumbers();
    updateSyntaxHighlight();
    handleAutocomplete();
    
    // Save content to current active tab
    if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
      connectionTabs[activeTabIndex].queryEditorContent = queryEditor.value;
    }
  });
  
  // Update execute selected button state on selection change
  queryEditor?.addEventListener('selectionchange', updateExecuteSelectedButtonState);
  queryEditor?.addEventListener('keyup', updateExecuteSelectedButtonState);
  queryEditor?.addEventListener('mouseup', updateExecuteSelectedButtonState);
  
  queryEditor?.addEventListener('scroll', () => {
    const lineNumbers = document.getElementById('lineNumbers');
    const syntaxHighlight = document.getElementById('syntaxHighlight');
    lineNumbers.scrollTop = queryEditor.scrollTop;
    if (syntaxHighlight) {
      syntaxHighlight.scrollTop = queryEditor.scrollTop;
      syntaxHighlight.scrollLeft = queryEditor.scrollLeft;
    }
  });
  
  // Strip HTML tags on paste to prevent syntax highlighting markup from being pasted
  queryEditor?.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    const cleanText = stripHTML(text);
    
    // Insert cleaned text at cursor position
    const start = queryEditor.selectionStart;
    const end = queryEditor.selectionEnd;
    const currentValue = queryEditor.value;
    
    queryEditor.value = currentValue.substring(0, start) + cleanText + currentValue.substring(end);
    queryEditor.selectionStart = queryEditor.selectionEnd = start + cleanText.length;
    
    // Trigger input event to update line numbers and syntax highlighting
    queryEditor.dispatchEvent(new Event('input'));
  });
  
  // Keyboard shortcuts for query editor
  queryEditor?.addEventListener('keydown', (e) => {
    // Don't handle Ctrl+Enter here, let the global handler take care of it
    // Only handle autocomplete navigation here
    const popover = document.getElementById('autocompletePopover');
    if (!popover.classList.contains('hidden')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateAutocomplete(1);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateAutocomplete(-1);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectAutocompleteItem();
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
        return;
      }
    }
  });
  
  // Shortcut hover detection
  queryEditor?.addEventListener('mousemove', (e) => {
    handleShortcutHover(e);
  });
  
  queryEditor?.addEventListener('mouseleave', () => {
    hideShortcutTooltip();
  });
  
  aiPrompt?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateSQL();
    }
  });
  
  // AI Panel
  document.getElementById('toggleAIBtn')?.addEventListener('click', toggleAIPanel);
  document.getElementById('closeAIBtn')?.addEventListener('click', () => {
    aiPanel?.classList.add('hidden');
  });
  document.getElementById('sendAIChatBtn')?.addEventListener('click', sendChatMessage);
  
  aiChatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  
  // PSQL Terminal
  psqlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executePSQLCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigatePSQLHistory('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigatePSQLHistory('down');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearPSQLInput();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'End') {
      e.preventDefault();
      ensurePSQLOutputVisible();
    }
  });
  
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Header Tabs
  document.querySelectorAll('.header-tab').forEach(tab => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      const tabName = tab.dataset.tab;
      switchMainTab(tabName);
    });
  });
  
  // Sidebar and Database Browser toggles
  document.getElementById('toggleSidebarBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });
  document.getElementById('showSidebarBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });
  document.getElementById('toggleDBBrowserBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDBBrowser();
  });
  document.getElementById('showDBBrowserBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDBBrowser();
  });
  
  // Snippets
  document.getElementById('addSnippetBtn')?.addEventListener('click', () => openSnippetModal());
  document.getElementById('snippetsGeneralHelpBtn')?.addEventListener('click', showSnippetsGeneralHelp);
  document.getElementById('exportSnippetsBtn')?.addEventListener('click', exportSnippets);
  document.getElementById('importSnippetsBtn')?.addEventListener('click', importSnippets);
  document.getElementById('closeSnippetModal')?.addEventListener('click', () => {
    document.getElementById('snippetModal').classList.add('hidden');
  });
  document.getElementById('cancelSnippetBtn')?.addEventListener('click', () => {
    document.getElementById('snippetModal').classList.add('hidden');
  });
  document.getElementById('snippetForm')?.addEventListener('submit', saveSnippet);
  
  // Saved Queries
  document.getElementById('addSavedQueryBtn')?.addEventListener('click', () => openSavedQueryModal());
  document.getElementById('closeSavedQueryModal')?.addEventListener('click', () => {
    document.getElementById('savedQueryModal').classList.add('hidden');
  });
  document.getElementById('cancelSavedQueryBtn')?.addEventListener('click', () => {
    document.getElementById('savedQueryModal').classList.add('hidden');
  });
  document.getElementById('savedQueryForm')?.addEventListener('submit', handleSaveSavedQuery);
  document.getElementById('savedQueriesSearch')?.addEventListener('input', (e) => {
    renderSavedQueries(e.target.value.trim());
  });

  // Variables
  document.getElementById('addVariableBtn')?.addEventListener('click', () => openVariableModal());
  document.getElementById('closeVariableModal')?.addEventListener('click', () => {
    document.getElementById('variableModal').classList.add('hidden');
  });
  document.getElementById('cancelVariableBtn')?.addEventListener('click', () => {
    document.getElementById('variableModal').classList.add('hidden');
  });
  document.getElementById('variableForm')?.addEventListener('submit', saveVariable);
  
  // Snippet Help Modal
  document.getElementById('closeSnippetHelpModal')?.addEventListener('click', () => {
    document.getElementById('snippetHelpModal').classList.add('hidden');
  });
  
  // DBML
  document.getElementById('loadSchemaBtn')?.addEventListener('click', loadSchemaToDBML);
  document.getElementById('renderDBMLBtn')?.addEventListener('click', renderDBML);
  document.getElementById('clearDBMLBtn')?.addEventListener('click', () => {
    document.getElementById('dbmlEditor').value = '';
    const viewport = document.getElementById('dbmlViewport');
    if (viewport) {
      viewport.innerHTML = '<div class="no-results">Render your DBML script to see the diagram</div>';
    }
    resetDBMLZoom();
  });
  
  // Schema type selector
  document.getElementById('schemaTypeSelect')?.addEventListener('change', (e) => {
    const schemaType = e.target.value;
    const editor = document.getElementById('dbmlEditor');
    
    if (schemaType === 'sql') {
      editor.placeholder = `-- Enter your SQL DDL script here
-- Example:
-- CREATE TABLE users (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(100) NOT NULL,
--   email VARCHAR(100) UNIQUE
-- );
--
-- CREATE TABLE posts (
--   id SERIAL PRIMARY KEY,
--   user_id INTEGER REFERENCES users(id),
--   title VARCHAR(200) NOT NULL,
--   content TEXT
-- );`;
    } else {
      editor.placeholder = `// Enter your DBML script here
// Example:
// Table users {
//   id integer [primary key]
//   name varchar
//   email varchar
// }
//
// Table posts {
//   id integer [primary key]
//   user_id integer [ref: > users.id]
//   title varchar
// }`;
    }
  });

  // DBML Zoom and Pan
  document.getElementById('zoomInBtn')?.addEventListener('click', () => zoomDBML(1.2));
  document.getElementById('zoomOutBtn')?.addEventListener('click', () => zoomDBML(0.8));
  document.getElementById('resetZoomBtn')?.addEventListener('click', resetDBMLZoom);
  
  // Initialize DBML pan and zoom
  initializeDBMLPanZoom();
  
  // Override execute query button to use placeholder replacement
  document.getElementById('executeQueryBtn')?.addEventListener('click', executeQuery);
  
  // Refresh Schema
  document.getElementById('refreshSchemaBtn')?.addEventListener('click', loadDatabaseSchema);
  
  // Reset refresh button state on page load
  resetRefreshButton();
  
  // Create Table
  document.getElementById('createTableBtn')?.addEventListener('click', openCreateTableModal);
  document.getElementById('closeCreateTableModal')?.addEventListener('click', closeCreateTableModal);
  document.getElementById('cancelCreateTableBtn')?.addEventListener('click', closeCreateTableModal);
  document.getElementById('createTableForm')?.addEventListener('submit', handleCreateTable);
  document.getElementById('addColumnBtn')?.addEventListener('click', addColumnRow);
  
  // Table Schema Modal
  document.getElementById('closeTableSchemaModal')?.addEventListener('click', closeTableSchemaModal);
  
  // Create Table AI Generator (Inline)
  document.getElementById('showCreateTableAiBtn')?.addEventListener('click', showCreateTableAi);
  document.getElementById('closeCreateTableAi')?.addEventListener('click', hideCreateTableAi);
  document.getElementById('generateTableSQLBtn')?.addEventListener('click', generateCreateTableSQL);
  document.getElementById('createTableAiInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateCreateTableSQL();
    }
  });
  
  // Table Creation Tabs
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', switchCreateTableTab);
  });
  
  // Database Search
  document.getElementById('dbSearchInput')?.addEventListener('input', (e) => {
    filterDatabaseTree(e.target.value);
  });
  
  // Settings
  document.getElementById('settingsBtn')?.addEventListener('click', () => openSettingsModal());
  document.getElementById('closeSettingsModal')?.addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
  });
  document.getElementById('themeSelect')?.addEventListener('change', (e) => {
    changeTheme(e.target.value);
  });
  
  // API Key Management
  document.getElementById('saveApiKeyBtn')?.addEventListener('click', () => saveApiKey());
  document.getElementById('toggleApiKeyVisibility')?.addEventListener('click', () => toggleApiKeyVisibility());
  document.getElementById('toggleStoredKeyVisibility')?.addEventListener('click', () => toggleStoredKeyVisibility());
  document.getElementById('clearApiKeyBtn')?.addEventListener('click', () => clearApiKey());
  document.getElementById('apiKeyInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveApiKey();
    }
  });
  
  // Add Database Modal
  document.getElementById('closeAddDatabaseModal')?.addEventListener('click', () => {
    document.getElementById('addDatabaseModal').classList.add('hidden');
  });
  document.getElementById('cancelAddDatabaseBtn')?.addEventListener('click', () => {
    document.getElementById('addDatabaseModal').classList.add('hidden');
  });
  
  // Global click handler for hiding popovers
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('cellPopover');
    if (!popover.classList.contains('hidden') && !popover.contains(e.target)) {
      hideCellPopover();
    }
  });
  
  // Where Clause Builder
  executeWhereBtn.addEventListener('click', generateWhereQuery);
  closeWhereBuilder.addEventListener('click', hideWhereClauseBuilder);
  addFilterBtn.addEventListener('click', addFilterRow);
  if (whereClauseBuilder) {
    whereClauseBuilder.addEventListener('keydown', (e) => {
      const isEnter = e.key === 'Enter';
      const isInQuickFilter = whereClauseBuilder.contains(e.target);
      if (isEnter && isInQuickFilter) {
        e.preventDefault();
        generateWhereQuery();
      }
    }, true);
  }
  
  // Backup Database Button
  document.getElementById('backupDatabaseBtn')?.addEventListener('click', () => {
    if (currentConnectionId) {
      // Find the database name
      let databaseName = '';
      for (const server of connections) {
        const db = server.databases?.find(d => d.id === currentConnectionId);
        if (db) {
          databaseName = db.name;
          break;
        }
      }
      downloadDatabaseBackup(currentConnectionId, databaseName);
    }
  });
  
  // Setup resize functionality
  setupResultsResize();
  
  // Export Dropdown functionality
  setupExportDropdown();
}

// Setup Results Resize Functionality
function setupResultsResize() {
  const resizeHandle = document.getElementById('resizeHandle');
  const editorContainer = document.querySelector('.editor-container');
  const resultsContainer = document.querySelector('.results-container');
  const querySection = document.querySelector('.query-section');
  
  if (!resizeHandle || !editorContainer || !resultsContainer || !querySection) {
    console.warn('Resize elements not found');
    return;
  }
  
  // Remove existing event listeners to prevent duplicates
  resizeHandle.replaceWith(resizeHandle.cloneNode(true));
  const newResizeHandle = document.getElementById('resizeHandle');
  
  let isResizing = false;
  let startY = 0;
  let startEditorHeight = 0;
  let startResultsHeight = 0;
  
  // Initialize heights
  updateContainerHeights();
  
  // Mouse down on resize handle
  newResizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startEditorHeight = editorContainer.offsetHeight;
    startResultsHeight = resultsContainer.offsetHeight;
    
    // If results container doesn't have a fixed height, calculate it
    if (!resultsContainer.style.height || resultsContainer.style.height === '') {
      startResultsHeight = resultsContainer.offsetHeight;
    }
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    
    // Add mouse move and up listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
    
    e.preventDefault();
    e.stopPropagation();
  });
  
  // Mouse move for resizing
  const handleMouseMove = (e) => {
    if (!isResizing) return;
    
    const deltaY = e.clientY - startY;
    const minHeight = 150;
    const maxHeight = window.innerHeight - 300; // Leave space for other UI elements
    
    let newEditorHeight = startEditorHeight + deltaY;
    let newResultsHeight = startResultsHeight - deltaY;
    
    // Apply constraints
    newEditorHeight = Math.max(minHeight, Math.min(newEditorHeight, maxHeight));
    newResultsHeight = Math.max(minHeight, Math.min(newResultsHeight, maxHeight));
    
    // Apply the new heights
    editorContainer.style.height = newEditorHeight + 'px';
    resultsContainer.style.height = newResultsHeight + 'px';
    
    e.preventDefault();
  };
  
  // Mouse up handler (defined here for closure access)
  const handleMouseUp = () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      // Save heights to localStorage
      localStorage.setItem('neurodb_editor_height', editorContainer.offsetHeight);
      localStorage.setItem('neurodb_results_height', resultsContainer.offsetHeight);
      
      // Update scroll spacing after resize completes
      setTimeout(() => {
        const resultsTableContainer = document.getElementById('resultsTableContainer');
        if (resultsTableContainer && resultsTableContainer.querySelector('.results-table')) {
          addScrollSpacing(resultsTableContainer);
        }
      }, 100);
      
      // Clean up event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseleave', handleMouseUp);
    }
  };
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (!isResizing) {
      updateContainerHeights();
      
      // Update scroll spacing when window is resized
      const resultsTableContainer = document.getElementById('resultsTableContainer');
      if (resultsTableContainer && resultsTableContainer.querySelector('.results-table')) {
        addScrollSpacing(resultsTableContainer);
      }
    }
  });
  
  // Add keyboard escape to cancel resize if stuck
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isResizing) {
      handleMouseUp();
    }
  });
  
  // Force reset function for debugging (accessible via console)
  window.resetResize = () => {
    isResizing = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    console.log('Resize state reset');
  };
}

// Setup Export Dropdown functionality
function setupExportDropdown() {
  const dropdownBtn = document.getElementById('exportDropdownBtn');
  const dropdownMenu = document.getElementById('exportDropdownMenu');
  
  if (!dropdownBtn || !dropdownMenu) return;
  
  // Toggle dropdown on button click
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !dropdownMenu.classList.contains('hidden');
    
    if (isOpen) {
      dropdownMenu.classList.add('hidden');
      dropdownBtn.classList.remove('open');
    } else {
      dropdownMenu.classList.remove('hidden');
      dropdownBtn.classList.add('open');
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.add('hidden');
      dropdownBtn.classList.remove('open');
    }
  });
  
  // Close dropdown when clicking on menu items
  dropdownMenu.addEventListener('click', () => {
    dropdownMenu.classList.add('hidden');
    dropdownBtn.classList.remove('open');
  });
}

// Update container heights based on available space
function updateContainerHeights() {
  const editorContainer = document.querySelector('.editor-container');
  const resultsContainer = document.querySelector('.results-container');
  const querySection = document.querySelector('.query-section');
  
  if (!editorContainer || !resultsContainer || !querySection) return;
  
  // Check if user has manually resized (saved heights exist)
  const savedEditorHeight = localStorage.getItem('neurodb_editor_height');
  const savedResultsHeight = localStorage.getItem('neurodb_results_height');
  
  if (savedEditorHeight && savedResultsHeight) {
    // Use saved heights from manual resize
    editorContainer.style.height = savedEditorHeight + 'px';
    resultsContainer.style.height = savedResultsHeight + 'px';
  } else {
    // Default behavior: let results container flex to take remaining space
    const availableHeight = querySection.offsetHeight - 100; // Account for other UI elements
    const editorHeight = Math.max(200, Math.floor(availableHeight * 0.5)); // 50% for editor
    
    editorContainer.style.height = editorHeight + 'px';
    resultsContainer.style.height = ''; // Remove fixed height to allow flex
  }
  
  // Update scroll spacing for results table after height changes
  setTimeout(() => {
    const resultsTableContainer = document.getElementById('resultsTableContainer');
    if (resultsTableContainer && resultsTableContainer.querySelector('.results-table')) {
      addScrollSpacing(resultsTableContainer);
    }
  }, 100); // Small delay to ensure layout is complete
}

// Parse PostgreSQL connection URL
function parseConnectionUrl(urlString) {
  // Support both postgresql:// and postgres:// schemes
  const urlPattern = /^(postgres|postgresql):\/\/(?:([^:]+)(?::([^@]*))?@)?([^:\/]+)(?::(\d+))?(?:\/([^?]+))?(?:\?(.*))?$/;
  const match = urlString.match(urlPattern);
  
  if (!match) {
    throw new Error('Invalid PostgreSQL URL format. Expected: postgresql://user:password@host:port/database');
  }
  
  const [, , user, password, host, port, database, query] = match;
  
  const connection = {
    host: host || 'localhost',
    port: port ? parseInt(port) : 5432,
    user: user || 'postgres',
    password: password ? decodeURIComponent(password) : '',
    database: database || 'postgres'
  };
  
  // Default SSL to true for cloud providers (Render, Heroku, AWS, etc.)
  const cloudProviders = ['.render.com', 'amazonaws.com', 'heroku.com', 'digitalocean.com', 'azure.com'];
  const isCloudProvider = cloudProviders.some(provider => host.includes(provider));
  
  // Enable SSL by default for cloud providers
  if (isCloudProvider) {
    connection.ssl = true;
    connection.sslmode = 'require';
  }
  
  // Parse query parameters if any (e.g., sslmode, etc.)
  if (query) {
    const params = new URLSearchParams(query);
    for (const [key, value] of params) {
      if (key === 'sslmode' || key === 'ssl') {
        connection.ssl = value !== 'disable' && value !== 'false';
        connection.sslmode = value;
      } else {
        connection[key] = value;
      }
    }
  }
  
  return connection;
}

// Connection Management
function openConnectionModal(connection = null) {
  // Reset URL mode
  const useUrlCheckbox = document.getElementById('useConnectionUrl');
  const urlFields = document.getElementById('urlModeFields');
  const individualFields = document.getElementById('individualModeFields');
  
  useUrlCheckbox.checked = false;
  urlFields.classList.add('hidden');
  individualFields.classList.remove('hidden');
  
  // Reset required fields
  document.getElementById('connectionUrl').required = false;
  document.getElementById('connectionHost').required = true;
  document.getElementById('connectionPort').required = true;
  document.getElementById('connectionUser').required = true;
  document.getElementById('connectionPassword').required = true;
  
  if (connection) {
    document.getElementById('connectionModalTitle').textContent = 'Edit Connection';
    document.getElementById('connectionId').value = connection.id;
    document.getElementById('connectionName').value = connection.name;
    document.getElementById('connectionHost').value = connection.host;
    document.getElementById('connectionPort').value = connection.port;
    document.getElementById('connectionDatabase').value = connection.database || '';
    document.getElementById('connectionUser').value = connection.user;
    document.getElementById('connectionPassword').value = connection.password || '';
  } else {
    document.getElementById('connectionModalTitle').textContent = 'Add Connection';
    connectionForm.reset();
    document.getElementById('connectionId').value = '';
  }
  
  document.getElementById('connectionStatus').classList.remove('success', 'error');
  document.getElementById('connectionStatus').style.display = 'none';
  connectionModal.classList.remove('hidden');
}

function closeConnectionModal() {
  connectionModal.classList.add('hidden');
  connectionForm.reset();
}

async function testConnection(e) {
  e.preventDefault();
  
  const useUrl = document.getElementById('useConnectionUrl').checked;
  let connection;
  
  if (useUrl) {
    // Parse the connection URL
    const url = document.getElementById('connectionUrl').value;
    try {
      connection = parseConnectionUrl(url);
    } catch (error) {
      const statusEl = document.getElementById('connectionStatus');
      statusEl.textContent = '✗ Invalid URL format: ' + error.message;
      statusEl.className = 'connection-status error';
      statusEl.style.display = 'block';
      return;
    }
  } else {
    // Use individual fields
    connection = {
      host: document.getElementById('connectionHost').value,
      port: parseInt(document.getElementById('connectionPort').value),
      database: document.getElementById('connectionDatabase')?.value || 'postgres',
      user: document.getElementById('connectionUser').value,
      password: document.getElementById('connectionPassword').value,
    };
  }
  
  const statusEl = document.getElementById('connectionStatus');
  statusEl.textContent = 'Testing connection...';
  statusEl.className = 'connection-status';
  statusEl.style.display = 'block';
  
  try {
    const result = await window.api.testConnection(connection);
    
    if (result.success) {
      statusEl.textContent = '✓ ' + result.message;
      statusEl.classList.add('success');
    } else {
      statusEl.textContent = '✗ ' + result.error;
      statusEl.classList.add('error');
    }
  } catch (error) {
    statusEl.textContent = '✗ ' + error.message;
    statusEl.classList.add('error');
  }
}

async function saveConnection(e) {
  e.preventDefault();
  
  const useUrl = document.getElementById('useConnectionUrl').checked;
  let host, port, user, password, ssl, sslmode;
  
  if (useUrl) {
    // Parse the connection URL
    const url = document.getElementById('connectionUrl').value;
    try {
      const parsed = parseConnectionUrl(url);
      host = parsed.host;
      port = parsed.port;
      user = parsed.user;
      password = parsed.password;
      ssl = parsed.ssl;
      sslmode = parsed.sslmode;
    } catch (error) {
      showNotification('Invalid URL format: ' + error.message, 'error');
      return;
    }
  } else {
    // Use individual fields
    host = document.getElementById('connectionHost').value;
    port = parseInt(document.getElementById('connectionPort').value);
    user = document.getElementById('connectionUser').value;
    password = document.getElementById('connectionPassword').value;
  }
  
  const server = {
    id: document.getElementById('connectionId').value || undefined,
    name: document.getElementById('connectionName').value,
    host: host,
    port: port,
    user: user,
    password: password,
  };
  
  // Add SSL configuration if present
  if (ssl !== undefined) {
    server.ssl = ssl;
  }
  if (sslmode !== undefined) {
    server.sslmode = sslmode;
  }
  
  try {
    const result = await window.api.saveServer(server);
    
    if (result.success) {
      showNotification('Server saved successfully', 'success');
      closeConnectionModal();
      await loadConnections();
    } else {
      showNotification('Failed to save server: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Error saving server: ' + error.message, 'error');
  }
}

function editServer(serverId) {
  const server = connections.find(s => s.id === serverId);
  if (!server) {
    showNotification('Server not found', 'error');
    return;
  }
  openConnectionModal(server);
}

function exportServerConnection(serverId) {
  const server = connections.find(s => s.id === serverId);
  if (!server) {
    showNotification('Server not found', 'error');
    return;
  }
  
  const exportData = {
    name: server.name,
    host: server.host,
    port: server.port,
    user: server.user,
    password: server.password,
    ...(server.ssl !== undefined && { ssl: server.ssl }),
    ...(server.sslmode !== undefined && { sslmode: server.sslmode }),
    databases: (server.databases || []).map(db => db.name)
  };
  
  const jsonContent = JSON.stringify(exportData, null, 2);
  
  // Show modal with connection details
  const modal = document.getElementById('exportConnectionModal');
  document.getElementById('exportConnectionTitle').textContent = `${server.name} — Connection Details`;
  document.getElementById('exportConnectionData').textContent = jsonContent;
  modal.dataset.serverName = server.name;
  modal.dataset.jsonContent = jsonContent;
  modal.classList.remove('hidden');
}

function closeExportConnectionModal() {
  document.getElementById('exportConnectionModal').classList.add('hidden');
}

function copyConnectionToClipboard() {
  const modal = document.getElementById('exportConnectionModal');
  const jsonContent = modal.dataset.jsonContent;
  navigator.clipboard.writeText(jsonContent).then(() => {
    showNotification('Connection details copied to clipboard', 'success');
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = jsonContent;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showNotification('Connection details copied to clipboard', 'success');
  });
}

async function exportConnectionToFile() {
  const modal = document.getElementById('exportConnectionModal');
  const jsonContent = modal.dataset.jsonContent;
  const serverName = modal.dataset.serverName;
  
  try {
    const result = await window.api.saveFile({
      content: jsonContent,
      defaultPath: `${serverName.replace(/[^a-z0-9]/gi, '_')}_connection.json`,
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.success) {
      showNotification('Connection details exported successfully', 'success');
      closeExportConnectionModal();
    } else if (!result.canceled) {
      showNotification('Failed to export: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showNotification('Error exporting connection: ' + error.message, 'error');
  }
}

async function deleteServer(serverId) {
  if (!confirm('Are you sure you want to delete this server and all its database connections?')) {
    return;
  }
  
  try {
    const result = await window.api.deleteServer(serverId);
    
    if (result.success) {
      showNotification('Server deleted', 'success');
      await loadConnections();
    } else {
      showNotification('Failed to delete server', 'error');
    }
  } catch (error) {
    showNotification('Error deleting server: ' + error.message, 'error');
  }
}

async function deleteDatabase(databaseId) {
  if (!confirm('Are you sure you want to remove this database connection?')) {
    return;
  }
  
  try {
    const result = await window.api.deleteDatabase(databaseId);
    
    if (result.success) {
      showNotification('Database removed', 'success');
      
      if (databaseId === currentConnectionId) {
        handleDatabaseDisconnect();
        
        welcomeScreen.classList.remove('hidden');
        databaseView.classList.add('hidden');
      }
      
      await loadConnections();
    } else {
      showNotification('Failed to remove database', 'error');
    }
  } catch (error) {
    showNotification('Error removing database: ' + error.message, 'error');
  }
}

async function deleteConnection(id) {
  // Legacy support
  await deleteDatabase(id);
}

async function openAddDatabaseModal(serverId) {
  const modal = document.getElementById('addDatabaseModal');
  modal.dataset.serverId = serverId;
  modal.classList.remove('hidden');
  
  const listContainer = document.getElementById('availableDatabasesList');
  listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">Loading databases...</div>';
  
  try {
    const result = await window.api.listDatabasesOnServer(serverId);
    
    if (result.success) {
      const server = connections.find(s => s.id === serverId);
      const existingDbs = server?.databases?.map(db => db.name) || [];
      const availableDbs = result.databases.filter(dbName => !existingDbs.includes(dbName));
      
      listContainer.innerHTML = '';
      
      // Add "Create New Database" button with form at the top
      const createNewItem = document.createElement('div');
      createNewItem.className = 'database-item create-new';
      createNewItem.innerHTML = `
        <div class="database-item-content">
          <div id="createDatabaseButton">
            <button class="btn-primary" style="width: 100%; margin-bottom: 12px;" onclick="showCreateDatabaseForm('${serverId}')">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
                <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2"/>
              </svg>
              Create New Database
            </button>
          </div>
          <div id="createDatabaseForm" class="hidden" style="margin-bottom: 12px;">
            <div class="create-database-form">
              <input type="text" id="newDatabaseName" placeholder="Enter database name" class="new-db-input" style="width: 100%; margin-bottom: 8px;">
              <div class="form-actions" style="display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn-secondary btn-sm" onclick="hideCreateDatabaseForm()">Cancel</button>
                <button class="btn-primary btn-sm" onclick="createNewDatabase('${serverId}')">Create</button>
              </div>
            </div>
          </div>
        </div>
      `;
      listContainer.appendChild(createNewItem);
      
      if (availableDbs.length === 0) {
        const noDbsMsg = document.createElement('div');
        noDbsMsg.style.cssText = 'text-align: center; padding: 20px; color: var(--text-secondary);';
        noDbsMsg.textContent = 'All databases have been added';
        listContainer.appendChild(noDbsMsg);
      } else {
        availableDbs.forEach(dbName => {
          const dbOption = document.createElement('div');
          dbOption.className = 'database-option';
          dbOption.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <ellipse cx="8" cy="4" rx="6" ry="2" fill="currentColor"/>
                <path d="M2 4v8c0 1.1 2.7 2 6 2s6-.9 6-2V4" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <path d="M2 8c0 1.1 2.7 2 6 2s6-.9 6-2" fill="none" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <span>${dbName}</span>
            </div>
            <button class="btn-sm btn-primary" onclick="addDatabaseToServer('${serverId}', '${dbName}')">Add</button>
          `;
          listContainer.appendChild(dbOption);
        });
      }
    } else {
      listContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error: ${result.error}</div>`;
    }
  } catch (error) {
    listContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error: ${error.message}</div>`;
  }
}

async function addDatabaseToServer(serverId, databaseName) {
  try {
    const database = {
      serverId: serverId,
      name: databaseName,
      database: databaseName
    };
    
    const result = await window.api.saveDatabase(database);
    
    if (result.success) {
      showNotification(`Database ${databaseName} added`, 'success');
      await loadConnections();
      
      // Refresh the modal
      openAddDatabaseModal(serverId);
    } else {
      showNotification('Failed to add database: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Error adding database: ' + error.message, 'error');
  }
}

// Database Operations
async function connectToDatabase(connectionId) {
  try {
    // Check if this connection is already open in a tab
    const existingTabIndex = connectionTabs.findIndex(tab => tab.connectionId === connectionId);
    if (existingTabIndex >= 0) {
      // Switch to existing tab
      switchToTab(existingTabIndex);
      showNotification('Switched to existing connection', 'info');
      return;
    }
    
    showNotification('Connecting...', 'info');
    
    const result = await window.api.connectDB(connectionId);
    
    if (result.success) {
      // Find the database in the nested structure
      let serverName = '';
      let databaseName = '';
      for (const server of connections) {
        const db = server.databases?.find(d => d.id === connectionId);
        if (db) {
          serverName = server.name;
          databaseName = db.name;
          break;
        }
      }

      // Create new connection tab
      const newTab = createConnectionTab(connectionId, serverName, databaseName);
      
      // Switch to the new tab
      const newTabIndex = connectionTabs.length - 1;
      switchToTab(newTabIndex);
      
      // Show backup and schema buttons
      const backupBtn = document.getElementById('backupDatabaseBtn');
      if (backupBtn) {
        backupBtn.classList.remove('hidden');
      }
      const schemaBtn = document.getElementById('downloadSchemaBtn');
      if (schemaBtn) {
        schemaBtn.classList.remove('hidden');
      }
      
      welcomeScreen.classList.add('hidden');
      databaseView.classList.remove('hidden');
      
      renderConnections();
      showNotification('Connected successfully', 'success');
      
      await loadDatabaseSchema();
      await loadTablesAndViews();
    } else {
      showNotification('Connection failed: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Error connecting: ' + error.message, 'error');
  }
}

// Helper function to quote PostgreSQL identifiers when needed
function quoteIdentifier(identifier) {
  // Don't quote if already quoted
  if (identifier.startsWith('"') && identifier.endsWith('"')) {
    return identifier;
  }
  
  // Check if identifier needs quoting:
  // 1. Contains uppercase letters
  // 2. Contains special characters (except underscore)
  // 3. Is a PostgreSQL reserved word
  // 4. Starts with a number
  const needsQuoting = /[A-Z]/.test(identifier) || 
                       /[^a-z0-9_]/.test(identifier) ||
                       /^[0-9]/.test(identifier) ||
                       isPostgreSQLReservedWord(identifier.toLowerCase());
  
  if (needsQuoting) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
  
  return identifier;
}

// Check if a word is a PostgreSQL reserved word
function isPostgreSQLReservedWord(word) {
  const reservedWords = [
    'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop', 
    'alter', 'table', 'index', 'view', 'database', 'schema', 'user', 'group',
    'order', 'by', 'group', 'having', 'limit', 'offset', 'union', 'intersect',
    'except', 'join', 'inner', 'left', 'right', 'outer', 'on', 'as', 'and',
    'or', 'not', 'in', 'exists', 'between', 'like', 'ilike', 'similar',
    'primary', 'foreign', 'key', 'unique', 'check', 'constraint', 'references',
    'default', 'null', 'true', 'false', 'case', 'when', 'then', 'else', 'end'
  ];
  return reservedWords.includes(word.toLowerCase());
}

// Helper function to format table/column names for display and queries
function formatIdentifierForQuery(schemaName, tableName, columnName = null) {
  let result = '';
  
  if (schemaName && schemaName !== 'public') {
    result += quoteIdentifier(schemaName) + '.';
  }
  
  result += quoteIdentifier(tableName);
  
  if (columnName) {
    result += '.' + quoteIdentifier(columnName);
  }
  
  return result;
}

// Helper function to reset refresh button state
function resetRefreshButton() {
  const refreshBtn = document.getElementById('refreshSchemaBtn');
  if (!refreshBtn) {
    console.log('Refresh button not found');
    return;
  }
  
  const originalContent = refreshBtn.dataset.originalContent || `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M3 21v-5h5"/>
    </svg>
  `;
  
  console.log('Resetting refresh button state');
  refreshBtn.disabled = false;
  refreshBtn.innerHTML = originalContent;
  refreshBtn.title = 'Refresh Schema';
}

async function loadDatabaseSchema() {
  if (!currentConnectionId) return;
  
  const refreshBtn = document.getElementById('refreshSchemaBtn');
  if (!refreshBtn) return;
  
  // Store original content if not already stored
  if (!refreshBtn.dataset.originalContent) {
    refreshBtn.dataset.originalContent = refreshBtn.innerHTML;
  }
  const originalContent = refreshBtn.dataset.originalContent;
  
  // If already loading, don't start another request
  if (refreshBtn.disabled) return;
  
  try {
    // Show loading state
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<div class="loading"></div>';
    refreshBtn.title = 'Refreshing...';
    
    const result = await window.api.getDatabaseSchema(currentConnectionId);
    console.log('Database schema result:', result);
    
    if (result && result.success) {
      currentSchema = result.schema;
      console.log('Current schema:', currentSchema);
      
      // Update AI instance schema for the current active tab
      if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
        const activeTab = connectionTabs[activeTabIndex];
        updateAIInstanceSchema(activeTab.id, result.schema);
      }
      
      renderDatabaseTree(result.schema);
      
      showNotification('Database schema refreshed successfully', 'success');
    } else {
      const errorMsg = result ? result.error : 'Unknown error occurred';
      showNotification('Failed to load schema: ' + errorMsg, 'error');
    }
  } catch (error) {
    console.error('Error in loadDatabaseSchema:', error);
    showNotification('Error loading schema: ' + error.message, 'error');
  } finally {
    // Always restore button state
    setTimeout(() => {
      resetRefreshButton();
    }, 100); // Small delay to ensure UI updates properly
  }
}

// Update tables and views directly from schema data (more efficient)
function updateTablesAndViewsFromSchema(schema) {
  if (!schema) {
    currentTablesAndViews = [];
    return;
  }
  
  // Extract tables from schema
  const tables = Object.values(schema.tables || {}).map(table => ({
    name: table.name,
    schema: table.schema,
    fullName: `${table.schema}.${table.name}`,
    columns: table.columns,
    type: 'table'
  }));
  
  // Extract views from schema
  const views = Object.values(schema.views || {}).map(view => ({
    name: view.name,
    schema: view.schema,
    fullName: `${view.schema}.${view.name}`,
    definition: view.definition,
    type: 'view'
  }));
  
  // Combine tables and views
  currentTablesAndViews = [...tables, ...views];
  
  console.log('Updated tables and views from schema:', currentTablesAndViews.length, 'items');
}

async function loadTablesAndViews() {
  if (!currentConnectionId) return;
  
  try {
    const result = await window.api.getTablesAndViews(currentConnectionId);
    if (result.success) {
      // Combine tables and views into a single array with type property
      currentTablesAndViews = [
        ...result.tables.map(t => ({ ...t, type: 'table' })),
        ...result.views.map(v => ({ ...v, type: 'view' }))
      ];
      console.log('Loaded tables and views:', currentTablesAndViews);
    } else {
      console.error('Error loading tables and views:', result.error);
      currentTablesAndViews = [];
    }
  } catch (error) {
    console.error('Error loading tables and views:', error);
    currentTablesAndViews = [];
  }
}

function renderDatabaseTree(schema) {
  console.log('Rendering database tree with schema:', schema);
  
  // Update autocomplete data whenever the tree is rendered
  updateTablesAndViewsFromSchema(schema);
  
  dbTree.innerHTML = '';
  
  if (!schema || (Object.keys(schema.tables || {}).length === 0 && Object.keys(schema.views || {}).length === 0)) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'tree-empty';
    emptyEl.textContent = 'No tables or views found';
    dbTree.appendChild(emptyEl);
    return;
  }
  
  // Group tables and views by schema
  const schemaGroups = {};
  
  // Add tables
  if (schema.tables) {
    for (const [fullTableName, tableInfo] of Object.entries(schema.tables)) {
      const schemaName = tableInfo.schema;
      if (!schemaGroups[schemaName]) {
        schemaGroups[schemaName] = { tables: {}, views: {} };
      }
      schemaGroups[schemaName].tables[tableInfo.name] = tableInfo;
    }
  }
  
  // Add views
  if (schema.views) {
    for (const [fullViewName, viewInfo] of Object.entries(schema.views)) {
      const schemaName = viewInfo.schema;
      if (!schemaGroups[schemaName]) {
        schemaGroups[schemaName] = { tables: {}, views: {} };
      }
      schemaGroups[schemaName].views[viewInfo.name] = viewInfo;
    }
  }
  
  for (const [schemaName, schemaData] of Object.entries(schemaGroups)) {
    const schemaEl = document.createElement('div');
    schemaEl.className = 'tree-item';
    schemaEl.innerHTML = `📁 ${schemaName}`;
    schemaEl.style.fontWeight = 'bold';
    
    const schemaChildren = document.createElement('div');
    schemaChildren.className = 'tree-children';
    schemaChildren.style.display = 'block';
    
    // Create Tables folder
    if (Object.keys(schemaData.tables).length > 0) {
      const tablesFolder = document.createElement('div');
      tablesFolder.className = 'tree-item';
      tablesFolder.innerHTML = `� Tables (${Object.keys(schemaData.tables).length})`;
      tablesFolder.style.color = 'var(--text-secondary)';
      tablesFolder.style.cursor = 'pointer';
      
      const tablesChildren = document.createElement('div');
      tablesChildren.className = 'tree-children';
      tablesChildren.style.display = 'block';
      
      // Render tables
      for (const [tableName, tableInfo] of Object.entries(schemaData.tables)) {
        const tableEl = document.createElement('div');
        tableEl.className = 'tree-item';
        tableEl.dataset.type = 'table';
        tableEl.dataset.schemaName = schemaName;
        tableEl.dataset.itemName = tableName;
        
        const tableContent = document.createElement('div');
        tableContent.style.display = 'flex';
        tableContent.style.justifyContent = 'space-between';
        tableContent.style.alignItems = 'center';
        tableContent.style.flex = '1';
        
        const tableName_span = document.createElement('span');
        // Show the table name with quotes if it needs them
        const displayName = quoteIdentifierIfNeeded(tableName);
        tableName_span.innerHTML = `🗃️ ${displayName} <span style="color: var(--text-secondary); font-size: 11px;">(${tableInfo.columns.length})</span>`;
        tableName_span.style.flex = '1';
        tableName_span.style.cursor = 'pointer';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '2px';
        
        const schemaBtn = document.createElement('button');
        schemaBtn.className = 'btn-icon';
        // Change tooltip/description to 'Table Info' per request
        schemaBtn.title = 'Table Info';
        // Use a simple info-circle SVG icon
        schemaBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"></circle>
            <line x1="12" y1="8" x2="12" y2="8.01"></line>
            <line x1="12" y1="12" x2="12" y2="17"></line>
          </svg>
        `;
        schemaBtn.style.opacity = '0.6';
        schemaBtn.style.padding = '2px 4px';
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-icon';
        downloadBtn.title = 'Download Table Data';
        downloadBtn.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 15h10"></path>
            <path d="M8 3v9"></path>
            <polyline points="4 9 8 13 12 9"></polyline>
          </svg>
        `;
        downloadBtn.style.opacity = '0.6';
        downloadBtn.style.padding = '2px 4px';
        
        schemaBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showTableSchema(schemaName, tableName, tableInfo);
        });
        
        downloadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showDownloadFormatModal(schemaName, tableName);
        });
        
        tableName_span.addEventListener('click', () => {
          selectTable(schemaName, tableName, tableInfo);
        });
        
        buttonContainer.appendChild(schemaBtn);
        buttonContainer.appendChild(downloadBtn);
        
        tableContent.appendChild(tableName_span);
        tableContent.appendChild(buttonContainer);
        tableEl.appendChild(tableContent);
        
        tablesChildren.appendChild(tableEl);
      }
      
      tablesFolder.addEventListener('click', (e) => {
        if (e.target === tablesFolder) {
          tablesChildren.style.display = tablesChildren.style.display === 'none' ? 'block' : 'none';
        }
      });
      
      schemaChildren.appendChild(tablesFolder);
      schemaChildren.appendChild(tablesChildren);
    }
    
    // Create Views folder
    if (Object.keys(schemaData.views).length > 0) {
      const viewsFolder = document.createElement('div');
      viewsFolder.className = 'tree-item';
      viewsFolder.innerHTML = `👁️ Views (${Object.keys(schemaData.views).length})`;
      viewsFolder.style.color = 'var(--text-secondary)';
      viewsFolder.style.cursor = 'pointer';
      
      const viewsChildren = document.createElement('div');
      viewsChildren.className = 'tree-children';
      viewsChildren.style.display = 'block';
      
      // Render views
      for (const [viewName, viewInfo] of Object.entries(schemaData.views)) {
        const viewEl = document.createElement('div');
        viewEl.className = 'tree-item';
        viewEl.dataset.type = 'view';
        viewEl.dataset.schemaName = schemaName;
        viewEl.dataset.itemName = viewName;
        
        const viewContent = document.createElement('div');
        viewContent.style.display = 'flex';
        viewContent.style.justifyContent = 'space-between';
        viewContent.style.alignItems = 'center';
        viewContent.style.flex = '1';
        
        const viewName_span = document.createElement('span');
        // Show the view name with quotes if it needs them
        const displayViewName = quoteIdentifierIfNeeded(viewName);
        viewName_span.innerHTML = `👁️ ${displayViewName} <span style="color: var(--text-secondary); font-size: 11px;">(view)</span>`;
        viewName_span.style.flex = '1';
        viewName_span.style.cursor = 'pointer';
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-icon';
        downloadBtn.title = 'Download View Data';
        downloadBtn.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 15h10"></path>
            <path d="M8 3v9"></path>
            <polyline points="4 9 8 13 12 9"></polyline>
          </svg>
        `;
        downloadBtn.style.opacity = '0.6';
        downloadBtn.style.padding = '2px 4px';
        
        downloadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showDownloadFormatModal(schemaName, viewName);
        });
        
        viewName_span.addEventListener('click', () => {
          selectView(schemaName, viewName, viewInfo);
        });
        
        viewContent.appendChild(viewName_span);
        viewContent.appendChild(downloadBtn);
        viewEl.appendChild(viewContent);
        
        viewsChildren.appendChild(viewEl);
      }
      
      viewsFolder.addEventListener('click', (e) => {
        if (e.target === viewsFolder) {
          viewsChildren.style.display = viewsChildren.style.display === 'none' ? 'block' : 'none';
        }
      });
      
      schemaChildren.appendChild(viewsFolder);
      schemaChildren.appendChild(viewsChildren);
    }
    
    schemaEl.addEventListener('click', (e) => {
      if (e.target === schemaEl) {
        schemaChildren.style.display = schemaChildren.style.display === 'none' ? 'block' : 'none';
      }
    });
    
    dbTree.appendChild(schemaEl);
    dbTree.appendChild(schemaChildren);
  }
}

function selectTable(schemaName, tableName, tableInfo) {
  const fullTableName = `${schemaName}.${tableName}`;
  
  // Store selected table information
  selectedTableInfo = {
    schema: schemaName,
    name: tableName,
    fullName: fullTableName,
    info: tableInfo
  };
  
  // Generate query with all column names and properly formatted table name
  // Quote column names if they need it
  const columnNames = tableInfo.columns.map(c => quoteIdentifierIfNeeded(c.name)).join(',\n  ');
  
  // Handle table name formatting for PostgreSQL - use schema.table format with proper quoting
  const quotedSchema = quoteIdentifierIfNeeded(schemaName);
  const quotedTable = quoteIdentifierIfNeeded(tableName);
  const formattedTableName = `${quotedSchema}.${quotedTable}`;
  
  queryEditor.value = `SELECT\n  ${columnNames}\nFROM ${formattedTableName}${currentLimit === 'all' ? '' : `\nLIMIT ${currentLimit}`};`;
  
  // Update line numbers after setting the value
  updateLineNumbers();
  updateSyntaxHighlight();
  
  // Show and populate the where clause builder
  showWhereClauseBuilder(fullTableName, tableInfo.columns);
  
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');
}

function selectView(schemaName, viewName, viewInfo) {
  const fullViewName = `${schemaName}.${viewName}`;
  
  // Store selected view information
  selectedTableInfo = {
    schema: schemaName,
    name: viewName,
    fullName: fullViewName,
    info: viewInfo,
    type: 'view'
  };
  
  // Handle view name formatting for PostgreSQL - use schema.view format with proper quoting
  const quotedSchema = quoteIdentifierIfNeeded(schemaName);
  const quotedView = quoteIdentifierIfNeeded(viewName);
  const formattedViewName = `${quotedSchema}.${quotedView}`;
  
  queryEditor.value = `SELECT *\nFROM ${formattedViewName}${currentLimit === 'all' ? '' : `\nLIMIT ${currentLimit}`};`;
  
  // Update line numbers after setting the value
  updateLineNumbers();
  updateSyntaxHighlight();
  
  // Hide where clause builder for views (since we don't have column info)
  hideWhereClauseBuilder();
  
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');
}

// Where Clause Builder Functions
function showWhereClauseBuilder(tableName, columns) {
  // Update table name in header
  selectedTableName.textContent = tableName;
  
  // Store columns for use when creating filter rows
  selectedTableInfo.availableColumns = columns;

  // Refresh sort controls and listeners to match the current table
  if (whereSortColumnSelect) {
    whereSortColumnSelect.replaceWith(whereSortColumnSelect.cloneNode(true));
    whereSortColumnSelect = document.getElementById('whereSortColumnSelect');
  }
  if (whereSortOrderSelect) {
    whereSortOrderSelect.replaceWith(whereSortOrderSelect.cloneNode(true));
    whereSortOrderSelect = document.getElementById('whereSortOrderSelect');
  }

  if (whereSortColumnSelect) {
    whereSortColumnSelect.innerHTML = '<option value="">None</option>';
    columns.forEach(column => {
      const option = document.createElement('option');
      option.value = column.name;
      option.textContent = `${column.name} (${column.type})`;
      whereSortColumnSelect.appendChild(option);
    });
  }
  if (whereSortOrderSelect) {
    whereSortOrderSelect.value = 'asc';
  }

  const executeWhereFromSort = (e) => {
    if (e?.key && e.key !== 'Enter') {
      return;
    }
    e?.preventDefault();
    executeWhereBtn?.click();
  };

  if (whereSortColumnSelect) {
    whereSortColumnSelect.addEventListener('change', executeWhereFromSort);
    whereSortColumnSelect.addEventListener('keydown', executeWhereFromSort);
    whereSortColumnSelect.addEventListener('keyup', executeWhereFromSort);
  }
  if (whereSortOrderSelect) {
    whereSortOrderSelect.addEventListener('change', executeWhereFromSort);
    whereSortOrderSelect.addEventListener('keydown', executeWhereFromSort);
    whereSortOrderSelect.addEventListener('keyup', executeWhereFromSort);
  }
  
  // Clear existing filter rows
  filterRowsContainer.innerHTML = '';
  filterRowCounter = 0;
  
  // Add the first filter row by default
  addFilterRow();
  placeAddFilterInline();
  
  // Show the where clause builder
  whereClauseBuilder.classList.remove('hidden');
}

function placeAddFilterInline() {
  if (!addFilterBtn || !filterRowsContainer) {
    return;
  }

  const firstRow = filterRowsContainer.querySelector('.filter-row');
  if (!firstRow) {
    return;
  }

  const rowContent = firstRow.querySelector('.filter-row-content');
  if (!rowContent) {
    return;
  }

  addFilterBtn.classList.remove('hidden');
  rowContent.appendChild(addFilterBtn);
}

// Create a new filter row element
function createFilterRowElement(isFirst = false) {
  const rowId = filterRowCounter++;
  const columns = selectedTableInfo?.availableColumns || [];
  
  const filterRow = document.createElement('div');
  filterRow.className = 'filter-row';
  filterRow.dataset.rowId = rowId;
  
  // Logic selector (AND/OR) - only show for non-first rows
  let logicHtml = '';
  if (!isFirst) {
    logicHtml = `
      <select class="filter-logic-select" data-row-id="${rowId}">
        <option value="AND">AND</option>
        <option value="OR">OR</option>
      </select>
    `;
  }
  
  // Column options
  let columnOptions = '<option value="">Select Column</option>';
  columns.forEach(column => {
    columnOptions += `<option value="${column.name}">${column.name} (${column.type})</option>`;
  });
  
  filterRow.innerHTML = `
    ${logicHtml}
    <div class="filter-row-content">
      <select class="where-dropdown column-select" data-row-id="${rowId}">
        ${columnOptions}
      </select>
      <select class="where-dropdown operator-select" data-row-id="${rowId}">
        <option value="=">=</option>
        <option value="!=">!=</option>
        <option value="<">&lt;</option>
        <option value="<=">&lt;=</option>
        <option value=">">&gt;</option>
        <option value=">=">&gt;=</option>
        <option value="LIKE">LIKE</option>
        <option value="ILIKE">ILIKE</option>
        <option value="IN">IN</option>
        <option value="NOT IN">NOT IN</option>
        <option value="IS NULL">IS NULL</option>
        <option value="IS NOT NULL">IS NOT NULL</option>
      </select>
      <input type="text" class="where-input value-input" data-row-id="${rowId}" placeholder="Enter value...">
      ${!isFirst ? `
        <button class="btn-remove-filter" data-row-id="${rowId}" title="Remove filter">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      ` : ''}
    </div>
  `;
  
  // Add event listener to remove button if it exists
  const removeBtn = filterRow.querySelector('.btn-remove-filter');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => removeFilterRow(rowId));
  }
  
  // Add event listener to operator select to hide/show value input
  const operatorSelect = filterRow.querySelector('.operator-select');
  const valueInput = filterRow.querySelector('.value-input');
  operatorSelect.addEventListener('change', () => {
    const operator = operatorSelect.value;
    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      valueInput.style.display = 'none';
      valueInput.value = '';
    } else {
      valueInput.style.display = 'block';
      // Update placeholder based on operator
      const op = operatorSelect.value;
      if (op === 'IN' || op === 'NOT IN') {
        valueInput.placeholder = 'Enter comma-separated values...';
      } else if (op === 'LIKE' || op === 'ILIKE') {
        valueInput.placeholder = 'Enter pattern (use % for wildcard)...';
      } else {
        valueInput.placeholder = 'Enter value...';
      }
    }
  });
  
  // Handle Enter key to execute filter
  valueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateWhereQuery();
    }
  });
  
  return filterRow;
}

// Add a new filter row
function addFilterRow() {
  const isFirst = filterRowsContainer.children.length === 0;
  const filterRow = createFilterRowElement(isFirst);
  filterRowsContainer.appendChild(filterRow);
  placeAddFilterInline();
}

// Remove a filter row by ID
function removeFilterRow(rowId) {
  const filterRow = filterRowsContainer.querySelector(`.filter-row[data-row-id="${rowId}"]`);
  if (filterRow) {
    filterRow.remove();
    
    // If all rows are removed, add a new first row
    if (filterRowsContainer.children.length === 0) {
      addFilterRow();
    } else {
      // Update the first row to not have a logic selector
      const firstRow = filterRowsContainer.querySelector('.filter-row');
      if (firstRow) {
        const logicSelect = firstRow.querySelector('.filter-logic-select');
        if (logicSelect) {
          logicSelect.remove();
        }
      }
    }
    placeAddFilterInline();
  }
}

function hideWhereClauseBuilder() {
  whereClauseBuilder.classList.add('hidden');
  selectedTableInfo = null;
  if (whereSortColumnSelect) {
    whereSortColumnSelect.innerHTML = '<option value="">None</option>';
  }
  if (whereSortOrderSelect) {
    whereSortOrderSelect.value = 'asc';
  }
}

function filterDatabaseTree(searchTerm) {
  const dbTree = document.getElementById('dbTree');
  if (!dbTree) return;
  
  const allTreeItems = dbTree.querySelectorAll('.tree-item');
  const allTreeChildren = dbTree.querySelectorAll('.tree-children');
  
  if (!searchTerm.trim()) {
    // Show all items if search is empty
    allTreeItems.forEach(item => {
      item.style.display = 'flex';
    });
    allTreeChildren.forEach(container => {
      container.style.display = 'block';
    });
    return;
  }
  
  const searchLower = searchTerm.toLowerCase();
  
  // First hide all items and containers
  allTreeItems.forEach(item => {
    item.style.display = 'none';
  });
  allTreeChildren.forEach(container => {
    container.style.display = 'none';
  });
  
  // Find all matching table/view items (they have data-type attribute)
  const dataItems = dbTree.querySelectorAll('.tree-item[data-type]');
  
  dataItems.forEach(item => {
    const itemName = item.dataset.itemName || '';
    const schemaName = item.dataset.schemaName || '';
    const fullName = `${schemaName}.${itemName}`;
    
    if (itemName.toLowerCase().includes(searchLower) || 
        schemaName.toLowerCase().includes(searchLower) ||
        fullName.toLowerCase().includes(searchLower)) {
      // Show matching item
      item.style.display = 'flex';
      
      // Walk up the DOM tree and show all parent containers and folder headers
      let parent = item.parentElement;
      while (parent && parent !== dbTree) {
        if (parent.classList.contains('tree-children')) {
          parent.style.display = 'block';
          // Also show the sibling folder header (the tree-item right before this tree-children)
          const prevSibling = parent.previousElementSibling;
          if (prevSibling && prevSibling.classList.contains('tree-item')) {
            prevSibling.style.display = 'flex';
          }
        }
        parent = parent.parentElement;
      }
    }
  });
}

function generateWhereQuery() {
  if (!selectedTableInfo) {
    showNotification('No table selected', 'error');
    return;
  }
  
  // Collect all filter conditions from the filter rows
  const filterRows = filterRowsContainer.querySelectorAll('.filter-row');
  const conditions = [];
  let hasAnyFilterInput = false;
  
  for (const row of filterRows) {
    const columnSelect = row.querySelector('.column-select');
    const operatorSelect = row.querySelector('.operator-select');
    const valueInput = row.querySelector('.value-input');
    const logicSelect = row.querySelector('.filter-logic-select');
    
    const column = columnSelect?.value;
    const operator = operatorSelect?.value;
    const value = valueInput?.value.trim() || '';
    const logic = logicSelect?.value || 'AND';

    if (column || value) {
      hasAnyFilterInput = true;
    }
    
    if (!column) {
      if (hasAnyFilterInput) {
        showNotification('Please select a column for all filters', 'error');
        return;
      }
      continue;
    }
    
    // Quote column name if it contains capital letters or special characters
    const quotedColumn = quoteIdentifierIfNeeded(column);
    
    // Build the WHERE clause for this condition
    let condition = '';
    let formattedValue = value;
    
    // Handle different operators
    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      condition = `${quotedColumn} ${operator}`;
    } else if (operator === 'IN' || operator === 'NOT IN') {
      if (!value) {
        showNotification('Please enter values for IN/NOT IN (comma-separated)', 'error');
        return;
      }
      // Parse comma-separated values and format them
      const values = value.split(',').map(v => `'${v.trim()}'`).join(', ');
      condition = `${quotedColumn} ${operator} (${values})`;
    } else {
      if (!value) {
        showNotification('Please enter a value for all filters', 'error');
        return;
      }
      
      // Quote the value if it's not a number
      if (isNaN(value) && operator !== 'LIKE' && operator !== 'ILIKE') {
        formattedValue = `'${value}'`;
      } else if (operator === 'LIKE' || operator === 'ILIKE') {
        formattedValue = `'${value}'`;
      }
      
      condition = `${quotedColumn} ${operator} ${formattedValue}`;
    }
    
    conditions.push({ condition, logic });
  }
  
  if (conditions.length === 0 && hasAnyFilterInput) {
    showNotification('Please add at least one filter condition', 'error');
    return;
  }
  
  // Build the combined WHERE clause
  let whereClause = '';
  if (conditions.length > 0) {
    whereClause = conditions[0].condition;
    for (let i = 1; i < conditions.length; i++) {
      whereClause += `\n  ${conditions[i].logic} ${conditions[i].condition}`;
    }
  }
  
  // Generate the full query with properly formatted table name
  const columnNames = selectedTableInfo.info.columns.map(c => quoteIdentifierIfNeeded(c.name)).join(',\n  ');
  
  // Format table name using the same quoting logic as selectTable
  const quotedSchema = quoteIdentifierIfNeeded(selectedTableInfo.schema);
  const quotedTable = quoteIdentifierIfNeeded(selectedTableInfo.name);
  const tableName = `${quotedSchema}.${quotedTable}`;

  let orderByClause = '';
  if (whereSortColumnSelect && whereSortColumnSelect.value) {
    const sortColumn = quoteIdentifierIfNeeded(whereSortColumnSelect.value);
    const sortOrder = whereSortOrderSelect?.value || 'asc';
    orderByClause = `\nORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;
  }

  const limitClause = currentLimit === 'all' ? '' : `\nLIMIT ${currentLimit}`;
  const whereClauseSql = whereClause ? `\nWHERE ${whereClause}` : '';
  const query = `SELECT\n  ${columnNames}\nFROM ${tableName}${whereClauseSql}${orderByClause}${limitClause};`;
  
  // Set the query in the editor
  queryEditor.value = query;
  updateLineNumbers();
  updateSyntaxHighlight();
  
  // Execute the query
  executeQuery();
}

// Query Execution
async function executeQuery() {
  if (!currentConnectionId) {
    showNotification('Please connect to a database first', 'error');
    return;
  }
  
  let query = queryEditor.value.trim();
  
  if (!query) {
    showNotification('Please enter a query', 'error');
    return;
  }

  // Prevent multiple simultaneous queries
  if (isQueryExecuting) {
    showNotification('A query is already executing', 'warning');
    return;
  }
  
  // Replace placeholders
  query = replacePlaceholders(query);
  
  // Apply limit if it's a SELECT query and doesn't already have a LIMIT
  if (query.trim().toLowerCase().startsWith('select') && !/\blimit\s+\d+/i.test(query)) {
    query = applyLimitToQuery(query);
  }
  
  // Set execution state
  isQueryExecuting = true;
  currentQueryId = Date.now().toString();
  
  // Update UI for execution state
  updateQueryExecutionUI(true);
  
  resultsInfo.innerHTML = '<div class="loading"></div> Executing...';
  resultsTableContainer.innerHTML = '';
  hideSearchControls();
  
  // Disable export buttons initially
  disableExportButtons();
  
  try {
    const startTime = Date.now();
    const result = await window.api.executeQuery(currentConnectionId, query, currentQueryId);
    const totalTime = Date.now() - startTime;
    
    // Add to query history
    const historyItem = {
      id: Date.now().toString(),
      query: query,
      timestamp: new Date().toISOString(),
      executionTime: result.executionTime || totalTime,
      success: result.success,
      rowCount: result.rowCount || 0,
      error: result.error || null,
      connectionId: currentConnectionId
    };
    
    queryHistory.unshift(historyItem); // Add to beginning
    
    // Keep only last 25 queries
    if (queryHistory.length > 25) {
      queryHistory = queryHistory.slice(0, 25);
    }
    
    // Save query history to file
    saveQueryHistory();
    
    if (result.success) {
      resultsInfo.textContent = `${result.rowCount} rows in ${result.executionTime}ms`;
      
      // If this is a SELECT query with a LIMIT, fetch total count in the background
      const isSelectWithLimit = query.trim().toLowerCase().startsWith('select') && /\blimit\s+\d+/i.test(query);
      if (isSelectWithLimit && currentConnectionId) {
        fetchTotalCountForQuery(query, result.rowCount, result.executionTime);
      }
      
      // Update global state for cell editing
      globalState.lastExecutedQuery = query;
      globalState.lastQueryResults = result.rows || [];
      
      // Save query results to current tab
      if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
        connectionTabs[activeTabIndex].queryResults = result.rows || [];
        connectionTabs[activeTabIndex].queryFields = result.fields || [];
        connectionTabs[activeTabIndex].resultsInfoText = `${result.rowCount} rows in ${result.executionTime}ms`;
        connectionTabs[activeTabIndex].selectedTableInfo = selectedTableInfo;
      }
      
      if (result.rows && result.rows.length > 0) {
        renderResultsTable(result.rows, result.fields);
      } else {
        resultsTableContainer.innerHTML = `<div class="no-results">Query executed successfully. ${result.command} completed.</div>`;
        hideSearchControls();
        // Disable export buttons for non-SELECT queries
        disableExportButtons();
        
        // Clear results from current tab since no rows returned
        if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
          connectionTabs[activeTabIndex].queryResults = null;
          connectionTabs[activeTabIndex].queryFields = null;
        }
      }
      
      showNotification('Query executed successfully', 'success');
    } else {
      // Check if query was cancelled
      if (result.cancelled) {
        resultsInfo.textContent = 'Query cancelled';
        resultsTableContainer.innerHTML = '<div class="no-results">Query execution was cancelled.</div>';
        hideSearchControls();
        showNotification('Query cancelled', 'warning');
      } else {
        resultsInfo.textContent = 'Error';
        resultsTableContainer.innerHTML = `
          <div class="no-results" style="color: var(--error);">
            <strong>Error:</strong> ${result.error}
            ${result.hint ? `<br><br><strong>Hint:</strong> ${result.hint}` : ''}
          </div>
        `;
        // Disable export buttons on error
        disableExportButtons();
        
        // Clear results from current tab on error
        if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
          connectionTabs[activeTabIndex].queryResults = null;
          connectionTabs[activeTabIndex].queryFields = null;
        }
        
        showNotification('Query failed', 'error');
      }
      
      // Disable export buttons on error/cancellation
      disableExportButtons();
      
      // Clear results from current tab
      if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
        connectionTabs[activeTabIndex].queryResults = null;
        connectionTabs[activeTabIndex].queryFields = null;
      }
    }
  } catch (error) {
    // Check if this was a cancellation
    if (error.message && error.message.includes('cancel')) {
      resultsInfo.textContent = 'Query cancelled';
      resultsTableContainer.innerHTML = '<div class="no-results">Query execution was cancelled.</div>';
      hideSearchControls();
      showNotification('Query cancelled', 'info');
    } else {
      // Add failed query to history
      const historyItem = {
        id: Date.now().toString(),
        query: query,
        timestamp: new Date().toISOString(),
        executionTime: 0,
        success: false,
        rowCount: 0,
        error: error.message,
        connectionId: currentConnectionId
      };
      
      queryHistory.unshift(historyItem);
      
      // Keep only last 25 queries
      if (queryHistory.length > 25) {
        queryHistory = queryHistory.slice(0, 25);
      }
      
      // Save query history to file
      saveQueryHistory();
      
      resultsInfo.textContent = 'Error';
      resultsTableContainer.innerHTML = `<div class="no-results" style="color: var(--error);"><strong>Error:</strong> ${error.message}</div>`;
      hideSearchControls();
      showNotification('Query failed', 'error');
    }
  } finally {
    // Reset execution state
    isQueryExecuting = false;
    currentQueryId = null;
    updateQueryExecutionUI(false);
  }
}

// Execute Selected Query
async function executeSelectedQuery() {
  if (!currentConnectionId) {
    showNotification('Please connect to a database first', 'error');
    return;
  }
  
  // Get selected text from the query editor
  const selectedText = queryEditor.value.substring(queryEditor.selectionStart, queryEditor.selectionEnd).trim();
  
  if (!selectedText) {
    // If no text is selected, try to find the current line or statement
    const cursorPosition = queryEditor.selectionStart;
    const text = queryEditor.value;
    const lines = text.split('\n');
    
    let currentLine = 0;
    let characterCount = 0;
    
    // Find which line the cursor is on
    for (let i = 0; i < lines.length; i++) {
      if (characterCount + lines[i].length >= cursorPosition) {
        currentLine = i;
        break;
      }
      characterCount += lines[i].length + 1; // +1 for newline
    }
    
    // Get the current line
    const lineText = lines[currentLine].trim();
    
    if (!lineText || lineText.startsWith('--') || lineText.startsWith('/*')) {
      showNotification('Please select some SQL text to execute, or place cursor on a line with SQL code', 'warning');
      return;
    }
    
    // Ask user if they want to execute the current line
    if (confirm(`No text selected. Execute current line?\n\n"${lineText}"`)) {
      var query = lineText;
    } else {
      return;
    }
  } else {
    var query = selectedText;
  }

  // Prevent multiple simultaneous queries
  if (isQueryExecuting) {
    showNotification('A query is already executing', 'warning');
    return;
  }
  
  // Replace placeholders in selected text
  query = replacePlaceholders(query);
  
  // Check if the query looks complete (basic validation)
  const trimmedQuery = query.trim();
  if (!trimmedQuery.endsWith(';') && !trimmedQuery.toLowerCase().match(/^(select|insert|update|delete|create|drop|alter|grant|revoke|truncate|with)\b/i)) {
    const confirmIncomplete = confirm(`The selected text doesn't appear to be a complete SQL statement:\n\n"${query}"\n\nExecute anyway?`);
    if (!confirmIncomplete) {
      return;
    }
  }
  
  // Apply limit if it's a SELECT query and doesn't already have a LIMIT
  if (query.trim().toLowerCase().startsWith('select') && !/\blimit\s+\d+/i.test(query)) {
    query = applyLimitToQuery(query);
  }
  
  // Set execution state
  isQueryExecuting = true;
  currentQueryId = Date.now().toString();
  
  // Update UI for execution state
  updateQueryExecutionUI(true);
  
  resultsInfo.innerHTML = '<div class="loading"></div> Executing selected text...';
  resultsTableContainer.innerHTML = '';
  hideSearchControls();
  
  // Disable export buttons initially
  disableExportButtons();
  
  try {
    const startTime = Date.now();
    const result = await window.api.executeQuery(currentConnectionId, query, currentQueryId);
    const totalTime = Date.now() - startTime;
    
    // Add to query history
    const historyItem = {
      id: Date.now().toString(),
      query: query,
      timestamp: new Date().toISOString(),
      executionTime: result.executionTime || totalTime,
      success: result.success,
      rowCount: result.rowCount || 0,
      error: result.error || null,
      connectionId: currentConnectionId,
      isSelected: true // Mark as selected text execution
    };
    
    queryHistory.unshift(historyItem); // Add to beginning
    
    // Keep only last 25 queries
    if (queryHistory.length > 25) {
      queryHistory = queryHistory.slice(0, 25);
    }
    
    // Save query history to file
    saveQueryHistory();
    
    if (result.success) {
      resultsInfo.textContent = `${result.rowCount} rows in ${result.executionTime}ms (selected text)`;
      
      // If this is a SELECT query with a LIMIT, fetch total count in the background
      const isSelectWithLimit = query.trim().toLowerCase().startsWith('select') && /\blimit\s+\d+/i.test(query);
      if (isSelectWithLimit && currentConnectionId) {
        fetchTotalCountForQuery(query, result.rowCount, result.executionTime, ' (selected text)');
      }
      
      // Update global state for cell editing
      globalState.lastExecutedQuery = query;
      globalState.lastQueryResults = result.rows || [];
      
      // Save query results to current tab
      if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
        connectionTabs[activeTabIndex].queryResults = result.rows && result.rows.length > 0 ? result.rows : null;
        connectionTabs[activeTabIndex].queryFields = result.rows && result.rows.length > 0 ? (result.fields || null) : null;
        connectionTabs[activeTabIndex].resultsInfoText = `${result.rowCount} rows in ${result.executionTime}ms (selected text)`;
        connectionTabs[activeTabIndex].selectedTableInfo = selectedTableInfo;
      }
      
      if (result.rows && result.rows.length > 0) {
        renderResultsTable(result.rows, result.fields);
      } else {
        resultsTableContainer.innerHTML = `<div class="no-results">Selected query executed successfully. ${result.command} completed.</div>`;
        hideSearchControls();
        // Disable export buttons for non-SELECT queries
        disableExportButtons();
      }
      
      showNotification('Selected query executed successfully', 'success');
    } else {
      resultsInfo.textContent = 'Error';
      resultsTableContainer.innerHTML = `
        <div class="no-results" style="color: var(--error);">
          <strong>Error:</strong> ${result.error}
          ${result.hint ? `<br><br><strong>Hint:</strong> ${result.hint}` : ''}
        </div>
      `;
      // Disable export buttons on error
      disableExportButtons();
      
      // Clear results from current tab on error
      if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
        connectionTabs[activeTabIndex].queryResults = null;
        connectionTabs[activeTabIndex].queryFields = null;
      }
      
      showNotification('Selected query failed', 'error');
    }
  } catch (error) {
    // Check if this was a cancellation
    if (error.message && error.message.includes('cancel')) {
      resultsInfo.textContent = 'Query cancelled';
      resultsTableContainer.innerHTML = '<div class="no-results">Selected query execution was cancelled.</div>';
      hideSearchControls();
      showNotification('Selected query cancelled', 'info');
    } else {
      // Add failed query to history
      const historyItem = {
        id: Date.now().toString(),
        query: query,
        timestamp: new Date().toISOString(),
        executionTime: 0,
        success: false,
        rowCount: 0,
        error: error.message,
        connectionId: currentConnectionId,
        isSelected: true
      };
      
      queryHistory.unshift(historyItem);
      
      // Keep only last 25 queries
      if (queryHistory.length > 25) {
        queryHistory = queryHistory.slice(0, 25);
      }
      
      // Save query history to file
      saveQueryHistory();
      
      resultsInfo.textContent = 'Error';
      resultsTableContainer.innerHTML = `<div class="no-results" style="color: var(--error);"><strong>Error:</strong> ${error.message}</div>`;
      hideSearchControls();
      showNotification('Selected query failed', 'error');
    }
  } finally {
    // Reset execution state
    isQueryExecuting = false;
    currentQueryId = null;
    updateQueryExecutionUI(false);
  }
}

// Update Execute Selected button state based on text selection
function updateExecuteSelectedButtonState() {
  const hasSelection = queryEditor.selectionStart !== queryEditor.selectionEnd;
  const selectedText = queryEditor.value.substring(queryEditor.selectionStart, queryEditor.selectionEnd).trim();
  
  if (hasSelection && selectedText) {
    executeSelectedBtn.style.opacity = '1';
    executeSelectedBtn.title = `Execute Selected Text: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`;
  } else {
    executeSelectedBtn.style.opacity = '0.7';
    executeSelectedBtn.title = 'Execute Selected Text (Ctrl+Shift+Enter) - Select text first or place cursor on a line';
  }
}

// Update UI during query execution
function updateQueryExecutionUI(isExecuting) {
  if (isExecuting) {
    executeQueryBtn.disabled = true;
    executeQueryBtn.classList.add('hidden');
    stopQueryBtn.classList.remove('hidden');
    stopQueryBtn.disabled = false;
    stopQueryBtn.textContent = 'Stop';
  } else {
    executeQueryBtn.disabled = false;
    executeQueryBtn.classList.remove('hidden');
    stopQueryBtn.classList.add('hidden');
    stopQueryBtn.disabled = true;
    stopQueryBtn.textContent = 'Stop';
  }
}

// Cancel current query execution
async function stopQuery() {
  if (!currentQueryId || !isQueryExecuting) {
    showNotification('No query is currently executing', 'warning');
    return;
  }
  
  try {
    // Disable the stop button immediately to prevent multiple clicks
    stopQueryBtn.disabled = true;
    stopQueryBtn.textContent = 'Cancelling...';
    
    const result = await window.api.cancelQuery(currentQueryId);
    
    if (result.success) {
      showNotification('Query cancellation requested - waiting for query to abort...', 'info');
    } else {
      showNotification(`Failed to cancel query: ${result.error}`, 'error');
      // Re-enable the button if cancellation failed
      stopQueryBtn.disabled = false;
      stopQueryBtn.textContent = 'Stop';
    }
  } catch (error) {
    showNotification(`Error cancelling query: ${error.message}`, 'error');
    // Re-enable the button if there was an error
    stopQueryBtn.disabled = false;
    stopQueryBtn.textContent = 'Stop';
  }
}

function renderResultsTable(rows, fields) {
  // Clear previous results
  resultsTableContainer.innerHTML = '';
  
  const table = document.createElement('table');
  table.className = 'results-table';
  
  // Clear any existing selections
  clearAllSelections();
  
  // Store original data for search functionality
  window.currentQueryResults = rows;
  // Extract field names properly - fields might be objects with 'name' property
  if (fields && Array.isArray(fields)) {
    window.currentQueryFields = fields.map(field => 
      typeof field === 'string' ? field : (field.name || field)
    );
  } else {
    window.currentQueryFields = Object.keys(rows[0] || {});
  }
  
  // Show search controls and populate column dropdown
  setupSearchControls();
  
  // Show Add Row button if a table is selected
  showAddRowButton();
  
  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  // Add line number header
  const lineNumHeader = document.createElement('th');
  lineNumHeader.textContent = '#';
  headerRow.appendChild(lineNumHeader);
  
  Object.keys(rows[0]).forEach((key, colIndex) => {
    const th = document.createElement('th');
    th.textContent = key;
    th.dataset.columnIndex = colIndex;
    
    // Calculate column width based on column name length + padding
    // Base width of 60px + 8px per character in column name
    const baseWidth = 120; // Minimum width
    const charWidth = 8; // Approximate width per character
    const calculatedWidth = Math.max(baseWidth, key.length * charWidth + 60);
    th.style.width = `${calculatedWidth}px`;
    
    // Add resize handle (except for the last column)
    if (colIndex < Object.keys(rows[0]).length - 1) {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.addEventListener('mousedown', (e) => {
        startColumnResize(e, th, colIndex);
      });
      th.appendChild(resizeHandle);
    }
    
    // Add column selection handler
    th.addEventListener('click', (e) => {
      // Don't trigger column selection if clicking on resize handle
      if (e.target.classList.contains('resize-handle')) {
        return;
      }
      const isCtrlCmd = e.ctrlKey || e.metaKey;
      selectColumn(colIndex, isCtrlCmd);
      e.preventDefault();
    });
    
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Body
  const tbody = document.createElement('tbody');
  
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    tr.dataset.originalIndex = rowIndex; // Store original index for search
    
    // Add line number cell
    const lineNumCell = document.createElement('td');
    lineNumCell.textContent = rowIndex + 1;
    
    // Add row selection handler to line number cell
    lineNumCell.addEventListener('click', (e) => {
      const isCtrlCmd = e.ctrlKey || e.metaKey;
      selectRow(rowIndex, isCtrlCmd);
      e.preventDefault();
    });
    
    tr.appendChild(lineNumCell);
    
    Object.entries(row).forEach(([columnName, value], colIndex) => {
      const td = document.createElement('td');
      
      let displayValue = '';
      let fullValue = '';
      
      if (value === null) {
        displayValue = 'NULL';
        fullValue = 'NULL';
        td.style.color = 'var(--text-secondary)';
        td.style.fontStyle = 'italic';
      } else if (typeof value === 'object') {
        fullValue = JSON.stringify(value, null, 2);
        displayValue = JSON.stringify(value);
      } else {
        fullValue = String(value);
        displayValue = String(value);
      }
      
      // Truncate display value if too long
      if (displayValue.length > 50) {
        displayValue = displayValue.substring(0, 47) + '...';
      }
      
      td.textContent = displayValue;
      td.title = fullValue; // Basic tooltip
      
      // Store data for editing and popover
      td.dataset.rowIndex = rowIndex;
      td.dataset.columnIndex = colIndex;
      td.dataset.columnName = columnName;
      td.dataset.fullValue = fullValue;
      td.dataset.originalValue = fullValue;
      
      // Add event listeners
      td.addEventListener('dblclick', (e) => {
        showCellPopover(e, columnName, fullValue, rowIndex, td);
      });
      
      // Add selection event listeners
      td.addEventListener('mousedown', (e) => {
        // Don't interfere with text selection within the cell
        if (e.detail > 1) return; // Ignore double/triple clicks
        
        const isCtrlCmd = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;
        
        if (isShift && lastSelectedCell) {
          // Range selection
          isShiftSelecting = true;
          clearAllSelections();
          selectCellRange(lastSelectedCell.rowIndex, lastSelectedCell.colIndex, rowIndex, colIndex);
          isShiftSelecting = false;
        } else {
          // Start drag selection
          isDraggingSelection = true;
          dragStartCell = { rowIndex, colIndex, td };
          dragCurrentCell = { rowIndex, colIndex, td };
          
          if (!isCtrlCmd) {
            clearAllSelections();
          }
          
          // Single cell or multi-selection
          selectCell(td, rowIndex, colIndex, isCtrlCmd);
        }
        
        e.preventDefault();
      });
      
      td.addEventListener('mouseover', (e) => {
        if (isDraggingSelection && dragStartCell) {
          // Update drag selection
          dragCurrentCell = { rowIndex, colIndex, td };
          
          // Clear and redraw selection
          clearAllSelections();
          selectCellRange(
            dragStartCell.rowIndex,
            dragStartCell.colIndex,
            dragCurrentCell.rowIndex,
            dragCurrentCell.colIndex
          );
        }
      });
      
      td.addEventListener('mouseup', (e) => {
        if (isDraggingSelection) {
          isDraggingSelection = false;
          dragStartCell = null;
          dragCurrentCell = null;
        }
      });
      
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  resultsTableContainer.appendChild(table);
  
  // Enhance scrolling behavior for large datasets
  enhanceScrollingForLargeDatasets(rows.length, resultsTableContainer);
  
  // Add dynamic bottom spacing for better scroll-to-top capability
  addScrollSpacing(resultsTableContainer);
  
  // Enable export buttons when we have results
  enableExportButtons();
}

// Add dynamic bottom spacing to allow scrolling last row to header
function addScrollSpacing(container) {
  // Remove any existing spacing element
  const existingSpacing = container.querySelector('.scroll-spacing');
  if (existingSpacing) {
    existingSpacing.remove();
  }
  
  // No extra spacing needed - the container should fill available space naturally
  // Only add minimal spacing if the table content is shorter than the container
}

// Enhance scrolling behavior for large datasets
function enhanceScrollingForLargeDatasets(rowCount, container) {
  // Remove any existing large-dataset class
  container.classList.remove('large-dataset');
  
  // If we have more than 100 rows, optimize for scrolling
  if (rowCount > 100) {
    container.classList.add('large-dataset');
    
    // Ensure proper scrolling behavior
    container.style.overflowY = 'auto';
    container.style.overflowX = 'auto';
    
    // Add smooth scrolling
    container.style.scrollBehavior = 'smooth';
    
    console.log(`Enhanced scrolling for ${rowCount} rows`);
  }
  
  // Always ensure the container can scroll
  if (container.scrollHeight > container.clientHeight) {
    container.style.overflowY = 'auto';
  }
  
  // Ensure horizontal scrolling if table is wider than container
  const table = container.querySelector('.results-table');
  if (table && table.scrollWidth > container.clientWidth) {
    container.style.overflowX = 'auto';
  }
}

// Search and Sort functionality for results
function setupSearchControls() {
  const searchContainer = document.getElementById('resultsSearch');
  const columnSelect = document.getElementById('searchColumnSelect');
  const searchInput = document.getElementById('searchInput');
  
  // Sort controls
  const sortColumnSelect = document.getElementById('sortColumnSelect');
  const sortOrderSelect = document.getElementById('sortOrderSelect');
  
  // Show search controls
  searchContainer.style.display = 'flex';
  
  // Populate column dropdowns
  columnSelect.innerHTML = '<option value="">All Columns</option>';
  sortColumnSelect.innerHTML = '<option value="">Sort by...</option>';
  
  if (window.currentQueryFields && window.currentQueryFields.length > 0) {
    window.currentQueryFields.forEach(fieldName => {
      // Search dropdown
      const searchOption = document.createElement('option');
      searchOption.value = fieldName;
      searchOption.textContent = fieldName;
      columnSelect.appendChild(searchOption);
      
      // Sort dropdown
      const sortOption = document.createElement('option');
      sortOption.value = fieldName;
      sortOption.textContent = fieldName;
      sortColumnSelect.appendChild(sortOption);
    });
  }
  
  // Clear previous event listeners for search controls
  searchInput.replaceWith(searchInput.cloneNode(true));
  const newSearchInput = document.getElementById('searchInput');
  columnSelect.replaceWith(columnSelect.cloneNode(true));
  const newColumnSelect = document.getElementById('searchColumnSelect');
  
  // Clear previous event listeners for sort controls
  sortColumnSelect.replaceWith(sortColumnSelect.cloneNode(true));
  const newSortColumnSelect = document.getElementById('sortColumnSelect');
  sortOrderSelect.replaceWith(sortOrderSelect.cloneNode(true));
  const newSortOrderSelect = document.getElementById('sortOrderSelect');
  
  // Re-populate column dropdowns after cloning
  newColumnSelect.innerHTML = '<option value="">All Columns</option>';
  newSortColumnSelect.innerHTML = '<option value="">Sort by...</option>';
  
  if (window.currentQueryFields && window.currentQueryFields.length > 0) {
    window.currentQueryFields.forEach(fieldName => {
      // Search dropdown
      const searchOption = document.createElement('option');
      searchOption.value = fieldName;
      searchOption.textContent = fieldName;
      newColumnSelect.appendChild(searchOption);
      
      // Sort dropdown
      const sortOption = document.createElement('option');
      sortOption.value = fieldName;
      sortOption.textContent = fieldName;
      newSortColumnSelect.appendChild(sortOption);
    });
  }
  
  // Add search event listeners
  newSearchInput.addEventListener('input', performSearch);
  newColumnSelect.addEventListener('change', performSearch);
  
  // Add sort event listeners
  newSortColumnSelect.addEventListener('change', performSort);
  newSortOrderSelect.addEventListener('change', performSort);
  
  // Add highlight event listeners
  const highlightInput = document.getElementById('highlightInput');
  
  if (highlightInput) {
    // Clone to remove old listeners
    highlightInput.replaceWith(highlightInput.cloneNode(true));
    const newHighlightInput = document.getElementById('highlightInput');
    
    newHighlightInput.addEventListener('input', performHighlight);
    
    // If there's already a highlight term, apply it to the new results
    if (newHighlightInput.value.trim()) {
      performHighlight();
    }
  }
  
  // Setup column visibility dropdown
  setupColumnVisibility();
  
  // Setup cell selection
  setupCellSelection();
}

function performSearch() {
  const searchInput = document.getElementById('searchInput');
  const columnSelect = document.getElementById('searchColumnSelect');
  const searchTerm = searchInput.value.toLowerCase().trim();
  const selectedColumn = columnSelect.value;
  
  const table = document.querySelector('.results-table tbody');
  if (!table) return;
  
  const rows = table.querySelectorAll('tr');
  let visibleCount = 0;
  
  rows.forEach((row, index) => {
    // Skip the add-row input row
    if (row.classList.contains('new-row-input')) return;
    
    const cells = row.querySelectorAll('td');
    let shouldShow = false;
    
    if (!searchTerm) {
      // No search term - show all rows and clear all filter highlights
      shouldShow = true;
      // Clear filter highlights from all cells
      for (let i = 1; i < cells.length; i++) {
        removeHighlight(cells[i]);
      }
      
      // Reapply independent highlight search if it exists
      const highlightInput = document.getElementById('highlightInput');
      if (highlightInput && highlightInput.value.trim()) {
        for (let i = 1; i < cells.length; i++) {
          highlightSearchTerm(cells[i], highlightInput.value.trim());
        }
      }
    } else {
      // Skip the first cell (line number)
      for (let i = 1; i < cells.length; i++) {
        const cell = cells[i];
        const columnName = cell.dataset.columnName;
        const cellValue = cell.dataset.fullValue || cell.textContent;
        
        // Check if we should search this column
        if (!selectedColumn || columnName === selectedColumn) {
          if (cellValue.toLowerCase().includes(searchTerm)) {
            shouldShow = true;
            // Also highlight the match in the filter search
            highlightSearchTerm(cell, searchTerm);
          } else {
            // Remove highlights from non-matching cells in searched columns
            removeHighlight(cell);
          }
        } else {
          // Remove highlights from non-searched columns during filter
          removeHighlight(cell);
        }
      }
    }
    
    if (shouldShow) {
      row.classList.remove('filtered-out');
      visibleCount++;
      // Update line number for visible rows
      const lineNumCell = cells[0];
      lineNumCell.textContent = visibleCount;
    } else {
      row.classList.add('filtered-out');
      // Remove all highlights when row is hidden
      cells.forEach(cell => removeHighlight(cell));
    }
  });
  
  // Update results info
  updateResultsInfo(visibleCount, rows.length);
}

function highlightSearchTerm(cell, searchTerm) {
  // First, always remove existing highlights to start fresh
  removeHighlight(cell);
  
  const fullValue = cell.dataset.fullValue || cell.textContent;
  
  // Check if the search term actually exists in the full value (case-insensitive)
  if (!searchTerm || !fullValue.toLowerCase().includes(searchTerm.toLowerCase())) {
    return; // No match found, don't highlight anything
  }
  
  // Escape special regex characters and create pattern for exact match
  const escapedTerm = escapeRegExp(searchTerm);
  const regex = new RegExp(escapedTerm, 'gi'); // Global, case-insensitive
  
  // Replace all occurrences of the exact search term
  const highlightedText = fullValue.replace(regex, '<span class="search-highlight">$&</span>');
  
  // Only update if we're adding highlights
  if (highlightedText !== fullValue) {
    // Truncate for display if necessary
    let displayText = highlightedText;
    if (fullValue.length > 50) {
      // Find the position of the first highlight
      const highlightIndex = fullValue.toLowerCase().indexOf(searchTerm.toLowerCase());
      if (highlightIndex !== -1) {
        // Show context around the highlight
        const start = Math.max(0, highlightIndex - 20);
        const end = Math.min(fullValue.length, highlightIndex + searchTerm.length + 27);
        let truncated = fullValue.substring(start, end);
        if (start > 0) truncated = '...' + truncated;
        if (end < fullValue.length) truncated = truncated + '...';
        
        displayText = truncated.replace(regex, '<span class="search-highlight">$&</span>');
      }
    }
    
    cell.innerHTML = displayText;
  }
}

function removeHighlight(cell) {
  const highlights = cell.querySelectorAll('.search-highlight');
  if (highlights.length > 0) {
    const fullValue = cell.dataset.fullValue || cell.textContent;
    let displayValue = fullValue;
    
    // Truncate if necessary
    if (displayValue.length > 50) {
      displayValue = displayValue.substring(0, 47) + '...';
    }
    
    cell.textContent = displayValue;
  }
}

function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  const columnSelect = document.getElementById('searchColumnSelect');
  
  searchInput.value = '';
  columnSelect.value = '';
  
  // Show all rows and clear filter highlights (preserve independent highlights)
  const table = document.querySelector('.results-table tbody');
  if (table) {
    const rows = table.querySelectorAll('tr');
    rows.forEach((row, index) => {
      row.classList.remove('filtered-out');
      
      // Reset line numbers
      const lineNumCell = row.querySelector('td:first-child');
      if (lineNumCell) {
        lineNumCell.textContent = index + 1;
      }
      
      // Clear filter highlights, but reapply independent highlights if they exist
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => {
        removeHighlight(cell);
        
        // Reapply independent highlight search if it exists
        const highlightInput = document.getElementById('highlightInput');
        if (highlightInput && highlightInput.value.trim()) {
          highlightSearchTerm(cell, highlightInput.value.trim());
        }
      });
    });
    
    // Update results info
    updateResultsInfo(rows.length, rows.length);
  }
}

// Highlight functionality for results (separate from filter search)
function performHighlight() {
  const highlightInput = document.getElementById('highlightInput');
  const highlightTerm = highlightInput.value.trim();
  
  const table = document.querySelector('.results-table tbody');
  if (!table) return;
  
  const rows = table.querySelectorAll('tr');
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    
    // Skip the first cell (line number)
    for (let i = 1; i < cells.length; i++) {
      const cell = cells[i];
      
      if (!highlightTerm) {
        removeHighlight(cell);
      } else {
        highlightSearchTerm(cell, highlightTerm);
      }
    }
  });
}

function clearHighlight() {
  const highlightInput = document.getElementById('highlightInput');
  highlightInput.value = '';
  
  // Remove all highlights
  const table = document.querySelector('.results-table tbody');
  if (table) {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => removeHighlight(cell));
    });
  }
}

// Sort functionality for results
function performSort() {
  const sortColumnSelect = document.getElementById('sortColumnSelect');
  const sortOrderSelect = document.getElementById('sortOrderSelect');
  const sortColumn = sortColumnSelect.value;
  const sortOrder = sortOrderSelect.value;
  
  if (!sortColumn) {
    return; // No column selected
  }
  
  const table = document.querySelector('.results-table tbody');
  if (!table) return;
  
  const rows = Array.from(table.querySelectorAll('tr:not(.filtered-out)'));
  
  // Find the column index (add 1 for line number column)
  const columnIndex = window.currentQueryFields.indexOf(sortColumn) + 1;
  
  if (columnIndex === 0) return; // Column not found
  
  // Sort the rows
  rows.sort((a, b) => {
    const cellA = a.children[columnIndex];
    const cellB = b.children[columnIndex];
    
    if (!cellA || !cellB) return 0;
    
    let valueA = cellA.textContent.trim();
    let valueB = cellB.textContent.trim();
    
    // Try to parse as numbers for numeric sorting
    const numA = parseFloat(valueA);
    const numB = parseFloat(valueB);
    
    let comparison = 0;
    
    if (!isNaN(numA) && !isNaN(numB)) {
      // Numeric comparison
      comparison = numA - numB;
    } else {
      // String comparison (case-insensitive)
      comparison = valueA.toLowerCase().localeCompare(valueB.toLowerCase());
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  // Remove existing rows and add sorted rows
  rows.forEach(row => table.removeChild(row));
  rows.forEach((row, index) => {
    // Update line numbers after sorting
    const lineNumCell = row.querySelector('td:first-child');
    if (lineNumCell) {
      lineNumCell.textContent = index + 1;
    }
    table.appendChild(row);
  });
  
  // Add sort indicator to header
  updateSortIndicator(sortColumn, sortOrder);
}

function updateSortIndicator(sortColumn, sortOrder) {
  // Remove existing sort indicators
  const headers = document.querySelectorAll('.results-table th');
  headers.forEach(header => {
    const indicator = header.querySelector('.sort-indicator');
    if (indicator) {
      indicator.remove();
    }
  });
  
  // Add sort indicator to current column
  const columnIndex = window.currentQueryFields.indexOf(sortColumn);
  if (columnIndex >= 0) {
    const header = headers[columnIndex + 1]; // +1 for line number column
    if (header) {
      const indicator = document.createElement('span');
      indicator.className = 'sort-indicator';
      indicator.textContent = sortOrder === 'asc' ? ' ↑' : ' ↓';
      header.appendChild(indicator);
    }
  }
}

function clearSort() {
  const sortColumnSelect = document.getElementById('sortColumnSelect');
  const sortOrderSelect = document.getElementById('sortOrderSelect');
  
  sortColumnSelect.value = '';
  sortOrderSelect.value = 'asc';
  
  // Remove sort indicators
  const headers = document.querySelectorAll('.results-table th .sort-indicator');
  headers.forEach(indicator => indicator.remove());
  
  // Restore original order if we have the original data
  if (window.currentQueryResults) {
    // Re-render the table with original order
    const resultsTableContainer = document.getElementById('resultsTableContainer');
    resultsTableContainer.innerHTML = '';
    renderResultsTable(window.currentQueryResults, window.currentQueryFields);
  }
}

// Column Visibility Functions
let hiddenColumns = new Set();
let columnVisibilityInitialized = false;

function setupColumnVisibility() {
  const btn = document.getElementById('columnsVisibilityBtn');
  const menu = document.getElementById('columnsVisibilityMenu');
  const list = document.getElementById('columnsVisibilityList');
  
  if (!btn || !menu || !list) return;
  
  // Clear any existing content
  list.innerHTML = '';
  hiddenColumns.clear();
  
  // Populate with current columns
  if (window.currentQueryFields && window.currentQueryFields.length > 0) {
    window.currentQueryFields.forEach((fieldName, index) => {
      const item = document.createElement('div');
      item.className = 'column-visibility-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'column-visibility-checkbox';
      checkbox.id = `col-vis-${index}`;
      checkbox.checked = true;
      checkbox.dataset.columnIndex = index;
      checkbox.dataset.columnName = fieldName;
      
      const label = document.createElement('label');
      label.className = 'column-visibility-label';
      label.htmlFor = `col-vis-${index}`;
      label.textContent = fieldName;
      
      checkbox.addEventListener('change', () => {
        toggleColumnVisibility(index, checkbox.checked);
      });
      
      item.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          toggleColumnVisibility(index, checkbox.checked);
        }
      });
      
      item.appendChild(checkbox);
      item.appendChild(label);
      list.appendChild(item);
    });
  }
  
  // Only setup event listeners once
  if (!columnVisibilityInitialized) {
    columnVisibilityInitialized = true;
    
    // Toggle menu visibility
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
    
    // Prevent menu from closing when clicking inside
    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

function toggleColumnVisibility(columnIndex, isVisible) {
  const table = document.querySelector('.results-table');
  if (!table) return;
  
  // Column index + 1 to account for line number column
  const actualIndex = columnIndex + 1;
  
  if (isVisible) {
    hiddenColumns.delete(columnIndex);
  } else {
    hiddenColumns.add(columnIndex);
  }
  
  // Toggle header visibility
  const header = table.querySelector(`thead th:nth-child(${actualIndex + 1})`);
  if (header) {
    header.style.display = isVisible ? '' : 'none';
  }
  
  // Toggle cell visibility for all rows
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    const cell = row.querySelector(`td:nth-child(${actualIndex + 1})`);
    if (cell) {
      cell.style.display = isVisible ? '' : 'none';
    }
  });
}

// Cell Selection Functions
let selectionMode = null; // 'cell', 'row', 'column'
let isSelecting = false;
let selectionStart = null;
let copyHandlerAttached = false;
let mouseHandlersAttached = false;

function setupCellSelection() {
  console.log('setupCellSelection called');
  
  // Add keyboard copy handler only once
  if (!copyHandlerAttached) {
    console.log('Attaching copy handler');
    document.addEventListener('keydown', handleCopyShortcut, true); // Use capture phase
    
    // Also add a test listener to see if ANY keydown is detected
    document.addEventListener('keydown', (e) => {
      console.log('Keydown detected:', e.key, 'Ctrl:', e.ctrlKey, 'Meta:', e.metaKey);
    }, true);
    
    copyHandlerAttached = true;
  }
  
  // Add mouse handlers only once
  if (!mouseHandlersAttached) {
    console.log('Attaching mouse handlers');
    
    // Add global mouseup handler to end drag selection
    document.addEventListener('mouseup', (e) => {
      if (isDraggingSelection) {
        isDraggingSelection = false;
        dragStartCell = null;
        dragCurrentCell = null;
        
        // Re-enable text selection
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        document.body.style.mozUserSelect = '';
        document.body.style.msUserSelect = '';
      }
    });
    
    // Add global mousemove handler to prevent text selection during drag
    document.addEventListener('mousemove', (e) => {
      if (isDraggingSelection) {
        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.body.style.mozUserSelect = 'none';
        document.body.style.msUserSelect = 'none';
      }
    });
    
    mouseHandlersAttached = true;
  }
}

function handleCopyShortcut(e) {
  console.log('handleCopyShortcut called');
  
  // Check for Ctrl+C (Windows/Linux) or Cmd+C (Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    console.log('Ctrl+C detected!');
    
    // Don't interfere if user is in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      console.log('Ignoring - target is input field');
      return;
    }
    
    console.log('Copy shortcut detected');
    console.log('Selected cells:', selectedCells.size);
    console.log('Selected rows:', selectedRows.size);
    console.log('Selected columns:', selectedColumns.size);
    console.log('Cell keys:', Array.from(selectedCells));
    
    if (selectedCells.size > 0 || selectedRows.size > 0 || selectedColumns.size > 0) {
      e.preventDefault();
      copySelectedCells();
    } else {
      console.log('No cells selected');
    }
  }
}

function copySelectedCells() {
  const table = document.querySelector('.results-table');
  if (!table) {
    console.log('No table found');
    return;
  }
  
  console.log('Starting copy process...');
  console.log('Selected cells:', selectedCells);
  console.log('Selected rows:', selectedRows);
  console.log('Selected columns:', selectedColumns);
  
  let textToCopy = '';
  let copiedCount = 0;
  
  if (selectedRows.size > 0) {
    // Copy entire row(s)
    const rowsArray = Array.from(selectedRows).sort((a, b) => a - b);
    rowsArray.forEach((rowIndex, index) => {
      const row = table.querySelector(`tbody tr:nth-child(${rowIndex + 1})`);
      if (row) {
        const cells = Array.from(row.cells).slice(1); // Skip line number
        const rowText = cells.map(cell => {
          // Use dataset.fullValue if available, otherwise textContent
          return cell.dataset.fullValue || cell.textContent.trim();
        }).join('\t');
        textToCopy += rowText;
        if (index < rowsArray.length - 1) {
          textToCopy += '\n';
        }
      }
    });
    copiedCount = selectedRows.size;
    
  } else if (selectedColumns.size > 0) {
    // Copy entire column(s)
    const columnsArray = Array.from(selectedColumns).sort((a, b) => a - b);
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach((row, rowIndex) => {
      const rowText = columnsArray.map(colIndex => {
        const cell = row.cells[colIndex + 1]; // +1 for line number
        // Use dataset.fullValue if available, otherwise textContent
        return cell ? (cell.dataset.fullValue || cell.textContent.trim()) : '';
      }).join('\t');
      textToCopy += rowText;
      if (rowIndex < rows.length - 1) {
        textToCopy += '\n';
      }
    });
    copiedCount = selectedColumns.size;
    
  } else if (selectedCells.size > 0) {
    // Copy selected cells using dataset attributes for accurate cell lookup
    const cellsByRow = new Map();
    
    // Organize cells by row
    selectedCells.forEach(cellKey => {
      const [rowIndex, colIndex] = cellKey.split('-').map(Number);
      if (!cellsByRow.has(rowIndex)) {
        cellsByRow.set(rowIndex, []);
      }
      cellsByRow.get(rowIndex).push(colIndex);
    });
    
    // Sort rows and columns
    const sortedRows = Array.from(cellsByRow.keys()).sort((a, b) => a - b);
    sortedRows.forEach((rowIndex, index) => {
      const colIndices = cellsByRow.get(rowIndex).sort((a, b) => a - b);
      
      const rowText = colIndices.map(colIndex => {
        // Find the cell using dataset attributes instead of position
        const cell = table.querySelector(
          `tbody tr:nth-child(${rowIndex + 1}) td[data-row-index="${rowIndex}"][data-column-index="${colIndex}"]`
        );
        
        if (cell) {
          // Use dataset.fullValue for complete untruncated content
          return cell.dataset.fullValue || cell.textContent.trim();
        }
        return '';
      }).join('\t');
      
      textToCopy += rowText;
      if (index < sortedRows.length - 1) {
        textToCopy += '\n';
      }
    });
    copiedCount = selectedCells.size;
  }
  
  console.log('Text to copy:', textToCopy);
  console.log('Copied count:', copiedCount);
  
  // Copy to clipboard
  if (textToCopy) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      const type = selectedRows.size > 0 ? 'row' : selectedColumns.size > 0 ? 'column' : 'cell';
      const plural = copiedCount > 1 ? 's' : '';
      showNotification(`Copied ${copiedCount} ${type}${plural} to clipboard`, 'success');
    }).catch(err => {
      console.error('Failed to copy:', err);
      showNotification('Failed to copy to clipboard', 'error');
    });
  } else {
    console.log('Nothing to copy - textToCopy is empty');
  }
}

// Column Resizing Functions
let isResizing = false;
let currentColumn = null;
let startX = 0;
let startWidth = 0;

function startColumnResize(e, th, columnIndex) {
  e.preventDefault();
  e.stopPropagation();
  
  isResizing = true;
  currentColumn = th;
  startX = e.clientX;
  
  // Get the actual current width more accurately
  const rect = th.getBoundingClientRect();
  startWidth = rect.width;
  
  // Also check if there's a CSS width set and use that if it exists
  const computedStyle = window.getComputedStyle(th);
  const cssWidth = parseFloat(computedStyle.width);
  if (cssWidth && cssWidth > 0) {
    startWidth = cssWidth;
  }
  

  
  // Add visual feedback
  const table = th.closest('.results-table');
  table.classList.add('resizing');
  const handle = e.target;
  handle.classList.add('resizing');
  
  // Add global event listeners
  document.addEventListener('mousemove', handleColumnResize);
  document.addEventListener('mouseup', stopColumnResize);
  
  // Prevent text selection during resize
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
}

function handleColumnResize(e) {
  if (!isResizing || !currentColumn) return;
  
  e.preventDefault();
  
  const deltaX = e.clientX - startX;
  const newWidth = Math.max(50, startWidth + deltaX); // Minimum width of 50px
  
  // Set the width on the header with important to override any table auto-sizing
  currentColumn.style.setProperty('width', newWidth + 'px', 'important');
  currentColumn.style.setProperty('min-width', newWidth + 'px', 'important');
  currentColumn.style.setProperty('max-width', newWidth + 'px', 'important');
  
  // Find the column index and apply width to all cells in that column
  const columnIndex = parseInt(currentColumn.dataset.columnIndex);
  const table = currentColumn.closest('.results-table');
  
  // Apply width to all cells in this column
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    const cell = row.children[columnIndex + 1]; // +1 because of line number column
    if (cell) {
      cell.style.setProperty('width', newWidth + 'px', 'important');
      cell.style.setProperty('min-width', newWidth + 'px', 'important');
      cell.style.setProperty('max-width', newWidth + 'px', 'important');
    }
  });
  
  // Update the table layout to fixed to prevent auto-resizing
  table.style.tableLayout = 'fixed';
}

function stopColumnResize(e) {
  if (!isResizing) return;
  
  isResizing = false;
  
  // Remove visual feedback
  if (currentColumn) {
    const table = currentColumn.closest('.results-table');
    table.classList.remove('resizing');
    const handle = table.querySelector('.resize-handle.resizing');
    if (handle) {
      handle.classList.remove('resizing');
    }
  }
  
  currentColumn = null;
  
  // Remove global event listeners
  document.removeEventListener('mousemove', handleColumnResize);
  document.removeEventListener('mouseup', stopColumnResize);
  
  // Restore text selection and cursor
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
}

function updateResultsInfo(visibleCount, totalCount) {
  const resultsInfo = document.getElementById('resultsInfo');
  if (resultsInfo) {
    if (visibleCount === totalCount) {
      resultsInfo.textContent = `${totalCount} rows`;
    } else {
      resultsInfo.textContent = `${visibleCount} of ${totalCount} rows`;
    }
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hideSearchControls() {
  const searchContainer = document.getElementById('resultsSearch');
  if (searchContainer) {
    searchContainer.style.display = 'none';
  }
  // Hide add row button
  const addRowBtn = document.getElementById('addRowBtn');
  if (addRowBtn) {
    addRowBtn.classList.add('hidden');
  }
}

// ============ Add Row Feature ============

function showAddRowButton() {
  const addRowBtn = document.getElementById('addRowBtn');
  if (addRowBtn && selectedTableInfo && selectedTableInfo.type !== 'view') {
    addRowBtn.classList.remove('hidden');
  }
}

function hideAddRowButton() {
  const addRowBtn = document.getElementById('addRowBtn');
  if (addRowBtn) {
    addRowBtn.classList.add('hidden');
  }
}

function initAddRowButton() {
  const addRowBtn = document.getElementById('addRowBtn');
  if (addRowBtn) {
    addRowBtn.addEventListener('click', handleAddRow);
  }
}

function handleAddRow() {
  if (!selectedTableInfo || selectedTableInfo.type === 'view') {
    showNotification('Select a table first to add rows', 'warning');
    return;
  }

  const table = resultsTableContainer.querySelector('.results-table');
  if (!table) {
    showNotification('Execute a query first to see results', 'warning');
    return;
  }

  // Check if there's already a new-row-input row
  const existingNewRow = table.querySelector('tr.new-row-input');
  if (existingNewRow) {
    // Focus the first input in the existing row
    const firstInput = existingNewRow.querySelector('.new-row-cell-input');
    if (firstInput) firstInput.focus();
    return;
  }

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const columns = selectedTableInfo.info.columns || [];
  const fields = window.currentQueryFields || [];

  // Create new editable row
  const newRow = document.createElement('tr');
  newRow.className = 'new-row-input';

  // Line number cell with action buttons
  const lineNumCell = document.createElement('td');
  lineNumCell.className = 'new-row-actions';
  lineNumCell.innerHTML = `
    <button class="new-row-action-btn new-row-save-btn" title="Save row (Enter)">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
      </svg>
      Save
    </button>
    <button class="new-row-action-btn new-row-cancel-btn" title="Cancel (Escape)">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
      </svg>
      Cancel
    </button>
  `;
  newRow.appendChild(lineNumCell);

  // Create input cells for each column
  const inputCells = [];
  fields.forEach((fieldName, idx) => {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'new-row-cell-input';
    
    // Find column info for placeholder
    const colInfo = columns.find(c => c.name === fieldName);
    const colType = colInfo ? colInfo.type : '';
    const isNullable = colInfo ? colInfo.nullable !== false : true;
    const hasDefault = colInfo ? colInfo.defaultValue || colInfo.default_value : false;
    
    let placeholderText = fieldName;
    if (colType) placeholderText += ` (${colType})`;
    if (hasDefault) placeholderText += ' [has default]';
    if (isNullable) placeholderText += ' [nullable]';
    input.placeholder = placeholderText;
    
    input.dataset.columnName = fieldName;
    input.dataset.columnIndex = idx;
    
    // Tab to next input, Shift+Tab to previous
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveNewRow(newRow, fields);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelNewRow(newRow);
      } else if (e.key === 'Tab') {
        // Natural tab behavior will move to next input
        // If it's the last input and not shift, move to save button  
        if (!e.shiftKey && idx === fields.length - 1) {
          e.preventDefault();
          saveNewRow(newRow, fields);
        }
      }
    });
    
    td.appendChild(input);
    newRow.appendChild(td);
    inputCells.push(input);
  });

  // Add save/cancel handlers
  const saveBtn = lineNumCell.querySelector('.new-row-save-btn');
  const cancelBtn = lineNumCell.querySelector('.new-row-cancel-btn');
  
  saveBtn.addEventListener('click', () => saveNewRow(newRow, fields));
  cancelBtn.addEventListener('click', () => cancelNewRow(newRow));

  // Insert at the top of tbody
  tbody.insertBefore(newRow, tbody.firstChild);

  // Scroll to top of results to show the new row
  resultsTableContainer.scrollTop = 0;

  // Focus the first input
  if (inputCells.length > 0) {
    setTimeout(() => inputCells[0].focus(), 50);
  }
}

function cancelNewRow(row) {
  if (row && row.parentNode) {
    row.remove();
  }
}

async function saveNewRow(row, fields) {
  if (!selectedTableInfo) {
    showNotification('No table context available', 'error');
    return;
  }

  const inputs = row.querySelectorAll('.new-row-cell-input');
  const values = {};
  const columnsToInsert = [];
  const valuePlaceholders = [];
  const paramValues = [];

  let paramIndex = 1;
  inputs.forEach((input, idx) => {
    const val = input.value.trim();
    const colName = input.dataset.columnName;
    
    // Skip empty values - let database use defaults
    if (val === '') return;
    
    columnsToInsert.push(quoteIdentifierIfNeeded(colName));
    
    // Handle special values
    if (val.toUpperCase() === 'NULL') {
      valuePlaceholders.push('NULL');
    } else if (val.toUpperCase() === 'TRUE' || val.toUpperCase() === 'FALSE') {
      valuePlaceholders.push(val.toUpperCase());
    } else if (val.toUpperCase() === 'NOW()' || val.toUpperCase() === 'CURRENT_TIMESTAMP') {
      valuePlaceholders.push(val);
    } else if (!isNaN(val) && val !== '') {
      // Numeric value
      valuePlaceholders.push(val);
    } else {
      // String value - escape single quotes
      valuePlaceholders.push(`'${val.replace(/'/g, "''")}'`);
    }
  });

  if (columnsToInsert.length === 0) {
    showNotification('Please fill in at least one field', 'warning');
    return;
  }

  // Build INSERT query
  const quotedSchema = quoteIdentifierIfNeeded(selectedTableInfo.schema);
  const quotedTable = quoteIdentifierIfNeeded(selectedTableInfo.name);
  const tableName = `${quotedSchema}.${quotedTable}`;

  const insertQuery = `INSERT INTO ${tableName} (${columnsToInsert.join(', ')}) VALUES (${valuePlaceholders.join(', ')});`;

  try {
    // Disable save button to prevent double-click
    const saveBtn = row.querySelector('.new-row-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    const result = await window.api.executeQuery(currentConnectionId, insertQuery);

    if (result.success) {
      showNotification('Row inserted successfully!', 'success');
      // Remove the input row
      cancelNewRow(row);
      // Re-execute the current query to refresh results
      executeQuery();
    } else {
      showNotification(`Insert failed: ${result.error}`, 'error');
      // Re-enable save button
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
          </svg>
          Save
        `;
      }
    }
  } catch (error) {
    showNotification(`Insert failed: ${error.message}`, 'error');
    const saveBtn = row.querySelector('.new-row-save-btn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
        </svg>
        Save
      `;
    }
  }
}

// Export Functions
window.currentQueryResults = [];

function enableExportButtons() {
  const exportContainer = document.getElementById('exportButtons');
  const dropdownBtn = document.getElementById('exportDropdownBtn');
  const menuItems = exportContainer?.querySelectorAll('.export-dropdown-item');
  
  if (exportContainer) {
    exportContainer.classList.remove('disabled');
  }
  
  if (dropdownBtn) {
    dropdownBtn.disabled = false;
  }
  
  menuItems?.forEach(item => {
    item.disabled = false;
  });
}

function disableExportButtons() {
  const exportContainer = document.getElementById('exportButtons');
  const dropdownBtn = document.getElementById('exportDropdownBtn');
  const menuItems = exportContainer?.querySelectorAll('.export-dropdown-item');
  
  if (exportContainer) {
    exportContainer.classList.add('disabled');
  }
  
  if (dropdownBtn) {
    dropdownBtn.disabled = true;
  }
  
  menuItems?.forEach(item => {
    item.disabled = true;
  });
  
  // Clear stored results
  window.currentQueryResults = [];
}

async function exportResults(format) {
  if (!window.currentQueryResults || window.currentQueryResults.length === 0) {
    showNotification('No results to export', 'error');
    return;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  let defaultFilename = `query_results_${timestamp}`;
  let content;
  let extension;
  let filterName;
  
  switch (format) {
    case 'json':
      content = JSON.stringify(window.currentQueryResults, null, 2);
      extension = 'json';
      filterName = 'JSON Files';
      break;
      
    case 'csv':
      content = convertToCSV(window.currentQueryResults);
      extension = 'csv';
      filterName = 'CSV Files';
      break;
      
    case 'excel':
      // For Excel, we'll send data to main process to create XLSX file
      const excelResult = await window.api.exportToExcel(window.currentQueryResults, defaultFilename);
      if (excelResult.success) {
        showNotification('Exported as Excel', 'success');
      } else {
        showNotification('Failed to export: ' + excelResult.error, 'error');
      }
      return; // Return early for Excel as it's handled differently
  }
  
  // Use Electron's save dialog for JSON and CSV
  window.api.saveFile({
    content: content,
    defaultPath: `${defaultFilename}.${extension}`,
    filters: [
      { name: filterName, extensions: [extension] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (result.success) {
      showNotification(`Exported as ${format.toUpperCase()} successfully`, 'success');
    } else if (!result.canceled) {
      showNotification(`Failed to export: ${result.error}`, 'error');
    }
  }).catch(error => {
    showNotification(`Error exporting file: ${error.message}`, 'error');
  });
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.map(h => escapeCSV(h)).join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null) return 'NULL';
      if (typeof value === 'object') return escapeCSV(JSON.stringify(value));
      return escapeCSV(String(value));
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

function convertToSQL(data, tableName) {
  if (!data || data.length === 0) return '';
  
  const sqlStatements = [];
  const columns = Object.keys(data[0]);
  
  data.forEach(row => {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      if (val instanceof Date) return `'${val.toISOString()}'`;
      if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
      if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      return val;
    });
    
    sqlStatements.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
  });
  
  return sqlStatements.join('\n');
}

// Make export function global
window.exportResults = exportResults;

// Database and Table Backup/Download Functions
async function downloadDatabaseBackup(databaseId, databaseName) {
  const downloadPopover = document.getElementById('downloadPopover');
  const downloadTitle = document.getElementById('downloadTitle');
  const downloadSubtitle = document.getElementById('downloadSubtitle');
  
  try {
    // Show loading popover
    downloadTitle.textContent = 'Downloading Database Backup';
    downloadSubtitle.textContent = `Generating backup for ${databaseName}...`;
    downloadPopover.classList.remove('hidden');
    
    const result = await window.api.generateDatabaseBackup(databaseId);
    
    if (result.success) {
      downloadTitle.textContent = 'Saving Backup';
      downloadSubtitle.textContent = 'Choose where to save...';
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFilename = `${databaseName}_backup_${timestamp}.sql`;
      
      // Use save dialog
      const saveResult = await window.api.saveFile({
        content: result.backup,
        defaultPath: defaultFilename,
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      // Hide loading popover
      downloadPopover.classList.add('hidden');
      
      if (saveResult.success) {
        showNotification('Database backup saved successfully', 'success');
      } else if (!saveResult.canceled) {
        showNotification('Failed to save backup: ' + saveResult.error, 'error');
      }
    } else {
      // Hide loading popover
      downloadPopover.classList.add('hidden');
      showNotification('Failed to generate backup: ' + result.error, 'error');
    }
  } catch (error) {
    // Hide loading popover
    downloadPopover.classList.add('hidden');
    console.error('Error downloading database backup:', error);
    showNotification('Error downloading backup: ' + error.message, 'error');
  }
}

function showDownloadFormatModal(schemaName, tableName) {
  const modal = document.getElementById('downloadFormatModal');
  const closeBtn = document.getElementById('closeDownloadFormatModal');
  const csvBtn = document.getElementById('downloadAsCSV');
  const sqlBtn = document.getElementById('downloadAsSQL');
  
  // Remove any existing event listeners by cloning buttons
  const newCsvBtn = csvBtn.cloneNode(true);
  const newSqlBtn = sqlBtn.cloneNode(true);
  csvBtn.parentNode.replaceChild(newCsvBtn, csvBtn);
  sqlBtn.parentNode.replaceChild(newSqlBtn, sqlBtn);
  
  // Show modal
  modal.classList.remove('hidden');
  
  // Close modal function
  const closeModal = () => {
    modal.classList.add('hidden');
  };
  
  // Event listeners
  closeBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
  
  newCsvBtn.onclick = () => {
    closeModal();
    downloadTableData(schemaName, tableName, 'csv');
  };
  
  newSqlBtn.onclick = () => {
    closeModal();
    downloadTableData(schemaName, tableName, 'sql');
  };
}

async function downloadTableData(schemaName, tableName, format = 'csv') {
  const downloadPopover = document.getElementById('downloadPopover');
  const downloadTitle = document.getElementById('downloadTitle');
  const downloadSubtitle = document.getElementById('downloadSubtitle');
  
  try {
    // Show loading popover
    downloadTitle.textContent = 'Downloading Table Data';
    downloadSubtitle.textContent = `Fetching data from ${tableName}...`;
    downloadPopover.classList.remove('hidden');
    
    const fullTableName = `${schemaName}.${tableName}`;
    const query = `SELECT * FROM ${fullTableName}`;
    
    const result = await window.api.executeQuery(currentConnectionId, query);
    
    if (result.success && result.rows && result.rows.length > 0) {
      const formatName = format.toUpperCase();
      downloadTitle.textContent = `Converting to ${formatName}`;
      downloadSubtitle.textContent = `Processing ${result.rowCount} rows...`;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileExtension = format === 'csv' ? 'csv' : 'sql';
      const defaultFilename = `${tableName}_${timestamp}.${fileExtension}`;
      
      // Convert to selected format
      let fileContent;
      if (format === 'csv') {
        fileContent = convertToCSV(result.rows);
      } else {
        fileContent = convertToSQL(result.rows, fullTableName);
      }
      
      downloadTitle.textContent = 'Saving File';
      downloadSubtitle.textContent = 'Choose where to save...';
      
      // Use save dialog
      const filters = format === 'csv' 
        ? [
            { name: 'CSV Files', extensions: ['csv'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        : [
            { name: 'SQL Files', extensions: ['sql'] },
            { name: 'All Files', extensions: ['*'] }
          ];
      
      const saveResult = await window.api.saveFile({
        content: fileContent,
        defaultPath: defaultFilename,
        filters: filters
      });
      
      // Hide loading popover
      downloadPopover.classList.add('hidden');
      
      if (saveResult.success) {
        showNotification(`Table data saved: ${result.rowCount} rows (${formatName})`, 'success');
      } else if (!saveResult.canceled) {
        showNotification('Failed to save table data: ' + saveResult.error, 'error');
      }
    } else if (result.success && result.rowCount === 0) {
      // Hide loading popover
      downloadPopover.classList.add('hidden');
      showNotification('Table is empty, no data to download', 'error');
    } else {
      // Hide loading popover
      downloadPopover.classList.add('hidden');
      showNotification('Failed to download table data: ' + result.error, 'error');
    }
  } catch (error) {
    // Hide loading popover
    downloadPopover.classList.add('hidden');
    console.error('Error downloading table data:', error);
    showNotification('Error downloading table data: ' + error.message, 'error');
  }
}

// Make functions global
window.downloadDatabaseBackup = downloadDatabaseBackup;
window.downloadTableData = downloadTableData;
window.showDownloadFormatModal = showDownloadFormatModal;

async function downloadDatabaseSchema(databaseId, databaseName) {
  const downloadPopover = document.getElementById('downloadPopover');
  const downloadTitle = document.getElementById('downloadTitle');
  const downloadSubtitle = document.getElementById('downloadSubtitle');
  
  try {
    // Show loading popover
    downloadTitle.textContent = 'Downloading Database Schema';
    downloadSubtitle.textContent = `Generating schema for ${databaseName}...`;
    downloadPopover.classList.remove('hidden');
    
    const result = await window.api.generateDatabaseSchema(databaseId);
    
    if (result.success) {
      downloadTitle.textContent = 'Saving Schema';
      downloadSubtitle.textContent = 'Choose where to save...';
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFilename = `${databaseName}_schema_${timestamp}.sql`;
      
      // Use save dialog
      const saveResult = await window.api.saveFile({
        content: result.schema,
        defaultPath: defaultFilename,
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      // Hide loading popover
      downloadPopover.classList.add('hidden');
      
      if (saveResult.success) {
        showNotification('Database schema saved successfully', 'success');
      } else if (!saveResult.canceled) {
        showNotification('Failed to save schema: ' + saveResult.error, 'error');
      }
    } else {
      // Hide loading popover
      downloadPopover.classList.add('hidden');
      showNotification('Failed to generate schema: ' + result.error, 'error');
    }
  } catch (error) {
    // Hide loading popover
    downloadPopover.classList.add('hidden');
    console.error('Error downloading database schema:', error);
    showNotification('Error downloading schema: ' + error.message, 'error');
  }
}

window.downloadDatabaseSchema = downloadDatabaseSchema;

// AI Operations

// AI Prompt History Management
const AI_HISTORY_KEY = 'ai_prompt_history';
const MAX_HISTORY_ITEMS = 20;

function savePromptToHistory(prompt) {
  if (!prompt || !prompt.trim()) return;
  
  try {
    let history = JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]');
    
    // Check if prompt already exists, remove old instance
    history = history.filter(item => item.prompt !== prompt);
    
    // Add new prompt to the beginning
    history.unshift({
      prompt: prompt,
      timestamp: new Date().toISOString()
    });
    
    // Keep only max items
    history = history.slice(0, MAX_HISTORY_ITEMS);
    
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(history));
    updateAIHistoryDropdown();
  } catch (error) {
    console.error('Error saving prompt history:', error);
  }
}

function getPromptHistory() {
  try {
    return JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]');
  } catch (error) {
    console.error('Error loading prompt history:', error);
    return [];
  }
}

function clearPromptHistory() {
  localStorage.removeItem(AI_HISTORY_KEY);
  updateAIHistoryDropdown();
  showNotification('Prompt history cleared', 'success');
}

function updateAIHistoryDropdown() {
  const historyList = document.getElementById('aiHistoryList');
  if (!historyList) return;
  
  const history = getPromptHistory();
  
  if (history.length === 0) {
    historyList.innerHTML = '<div class="ai-history-empty">No prompt history yet</div>';
    return;
  }
  
  historyList.innerHTML = history.map((item, index) => {
    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
      <div class="ai-history-item" data-index="${index}">
        <div class="ai-history-prompt">${escapeHtml(item.prompt)}</div>
        <div class="ai-history-time">${timeStr}</div>
      </div>
    `;
  }).join('');
  
  // Add click listeners
  historyList.querySelectorAll('.ai-history-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      const history = getPromptHistory();
      if (history[index]) {
        document.getElementById('aiPrompt').value = history[index].prompt;
        document.getElementById('aiHistoryDropdown').classList.add('hidden');
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup AI History Dropdown
function setupAIHistory() {
  const aiHistoryBtn = document.getElementById('aiHistoryBtn');
  const aiHistoryDropdown = document.getElementById('aiHistoryDropdown');
  const clearHistoryBtn = document.getElementById('clearAiHistory');
  
  if (!aiHistoryBtn || !aiHistoryDropdown) return;
  
  // Toggle dropdown
  aiHistoryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = aiHistoryDropdown.classList.contains('hidden');
    if (isHidden) {
      updateAIHistoryDropdown();
      aiHistoryDropdown.classList.remove('hidden');
    } else {
      aiHistoryDropdown.classList.add('hidden');
    }
  });
  
  // Clear history button
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearPromptHistory();
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!aiHistoryDropdown.contains(e.target) && e.target !== aiHistoryBtn) {
      aiHistoryDropdown.classList.add('hidden');
    }
  });
  
  // Prevent dropdown from closing when clicking inside
  aiHistoryDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

async function generateSQL() {
  const prompt = aiPrompt.value.trim();
  
  if (!prompt) {
    showNotification('Please enter a prompt', 'error');
    return;
  }
  
  // Get tab-specific AI instance
  const activeAI = getActiveAIInstance();
  if (!activeAI || !activeAI.context.schema) {
    showNotification('Please connect to a database first', 'error');
    return;
  }
  
  // Save prompt to history
  savePromptToHistory(prompt);
  
  showNotification('Generating SQL...', 'info');
  queryEditor.value = '-- Generating...';
  updateLineNumbers();
  updateSyntaxHighlight();
  
  try {
    const result = await window.api.generateSQL(prompt, activeAI.context.schema, activeAI.connectionId);
    
    if (result.success) {
      queryEditor.value = result.query;
      updateLineNumbers();
      updateSyntaxHighlight();
      showNotification('SQL generated successfully', 'success');
      aiPrompt.value = '';
    } else {
      queryEditor.value = `-- Error: ${result.error}`;
      updateLineNumbers();
      updateSyntaxHighlight();
      showNotification('Failed to generate SQL', 'error');
    }
  } catch (error) {
    queryEditor.value = `-- Error: ${error.message}`;
    updateLineNumbers();
    updateSyntaxHighlight();
    showNotification('Error generating SQL', 'error');
  }
}

async function explainQuery() {
  const query = queryEditor.value.trim();
  
  if (!query) {
    showNotification('Please enter a query to explain', 'error');
    return;
  }
  
  // Get tab-specific AI instance
  const activeAI = getActiveAIInstance();
  if (!activeAI || !activeAI.context.schema) {
    showNotification('Please connect to a database first', 'error');
    return;
  }
  
  // Open AI panel immediately and show loading message
  aiPanel.classList.remove('hidden');
  addAIMessage('assistant', '🔍 Analyzing your query...');
  
  try {
    const result = await window.api.explainQuery(query, activeAI.context.schema);
    
    if (result.success) {
      // Remove the loading message and add the actual explanation
      const messages = aiChatContainer.querySelectorAll('.ai-message.assistant');
      const loadingMessage = messages[messages.length - 1];
      if (loadingMessage && loadingMessage.textContent.includes('Analyzing your query')) {
        loadingMessage.remove();
      }
      
      addAIMessage('assistant', result.explanation);
      showNotification('Query explained', 'success');
    } else {
      // Remove the loading message and show error
      const messages = aiChatContainer.querySelectorAll('.ai-message.assistant');
      const loadingMessage = messages[messages.length - 1];
      if (loadingMessage && loadingMessage.textContent.includes('Analyzing your query')) {
        loadingMessage.remove();
      }
      
      addAIMessage('assistant', '❌ Failed to explain query. Please try again.');
      showNotification('Failed to explain query', 'error');
    }
  } catch (error) {
    // Remove the loading message and show error
    const messages = aiChatContainer.querySelectorAll('.ai-message.assistant');
    const loadingMessage = messages[messages.length - 1];
    if (loadingMessage && loadingMessage.textContent.includes('Analyzing your query')) {
      loadingMessage.remove();
    }
    
    addAIMessage('assistant', '❌ Error explaining query. Please try again.');
    showNotification('Error explaining query', 'error');
  }
}

// AI Chat
function toggleAIPanel() {
  aiPanel.classList.toggle('hidden');
}

// Focus AI prompt input
function focusAIPrompt() {
  const aiPromptInput = document.getElementById('aiPrompt');
  if (aiPromptInput) {
    // Switch to query tab if not already active
    const activeTab = document.querySelector('.header-tab.active');
    if (!activeTab || activeTab.dataset.tab !== 'query') {
      switchMainTab('query');
    }
    // Focus the AI prompt input
    aiPromptInput.focus();
  }
}

// Save query file function for shortcut
async function saveQueryFile() {
  try {
    const content = queryEditor.value;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    const result = await window.api.saveFile({
      content: content,
      defaultPath: `query_${timestamp}.sql`,
      filters: [
        { name: 'SQL Files', extensions: ['sql'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.success) {
      showNotification('File saved successfully', 'success');
    } else if (!result.canceled) {
      showNotification('Failed to save file: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Error saving file: ' + error.message, 'error');
  }
}

async function sendChatMessage() {
  const message = aiChatInput.value.trim();
  
  if (!message) return;
  
  // Get tab-specific AI instance
  const activeAI = getActiveAIInstance();
  if (!activeAI) {
    showNotification('Please connect to a database first', 'error');
    return;
  }
  
  addAIMessage('user', message);
  aiChatInput.value = '';
  
  try {
    const result = await window.api.chatWithAI(message, activeAI.context, activeAI.chatHistory);
    
    if (result.success) {
      addAIMessage('assistant', result.response);
    } else {
      addAIMessage('assistant', 'Sorry, I encountered an error: ' + result.error);
    }
  } catch (error) {
    addAIMessage('assistant', 'Sorry, I encountered an error: ' + error.message);
  }
}

function addAIMessage(role, content, saveToHistory = true) {
  const messageEl = document.createElement('div');
  messageEl.className = `ai-message ${role}`;
  
  // Format code blocks
  const formattedContent = content.replace(/```sql\n([\s\S]*?)```/g, '<pre>$1</pre>');
  messageEl.innerHTML = formattedContent.replace(/\n/g, '<br>');
  
  aiChatContainer.appendChild(messageEl);
  aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
  
  // Save to current tab's chat history if requested
  if (saveToHistory) {
    const activeAI = getActiveAIInstance();
    if (activeAI) {
      activeAI.chatHistory.push({ role, content });
      
      // Also update the tab's chat history
      const activeTab = connectionTabs.find(t => t.id === activeAI.tabId);
      if (activeTab) {
        activeTab.aiChatHistory.push({ role, content });
      }
      
      // Keep only last 12 messages (6 conversations)
      if (activeAI.chatHistory.length > 12) {
        activeAI.chatHistory = activeAI.chatHistory.slice(-12);
        if (activeTab) {
          activeTab.aiChatHistory = activeTab.aiChatHistory.slice(-12);
        }
      }
    }
  }
}

// PSQL Terminal
async function executePSQLCommand() {
  const command = psqlInput.value.trim();
  
  if (!command) return;
  
  if (!currentConnectionId) {
    addPSQLOutput('error', 'Not connected to any database');
    return;
  }
  
  // Add command to history (avoid duplicates and empty commands)
  if (command && (psqlCommandHistory.length === 0 || psqlCommandHistory[psqlCommandHistory.length - 1] !== command)) {
    psqlCommandHistory.push(command);
    // Limit history to last 100 commands
    if (psqlCommandHistory.length > 100) {
      psqlCommandHistory.shift();
    }
  }
  
  // Reset history navigation
  psqlHistoryIndex = -1;
  psqlCurrentCommand = '';
  
  addPSQLOutput('command', command);
  psqlInput.value = '';
  
  try {
    // Handle PostgreSQL meta-commands
    const translatedQuery = translatePSQLCommand(command);
    
    if (translatedQuery === null) {
      // Command was handled internally or is invalid
      return;
    }
    
    const result = await window.api.executeQuery(currentConnectionId, translatedQuery);
    
    if (result.success) {
      if (result.rows && result.rows.length > 0) {
        // Format output based on the original command type
        if (command.startsWith('\\d') || command.startsWith('\\l') || command === 'show databases') {
          formatPSQLTableOutput(result.rows, command);
        } else {
          addPSQLOutput('result', JSON.stringify(result.rows, null, 2));
        }
      } else {
        addPSQLOutput('result', `${result.command} - ${result.rowCount} rows affected`);
      }
    } else {
      addPSQLOutput('error', result.error);
    }
  } catch (error) {
    addPSQLOutput('error', error.message);
  }
}

function addPSQLOutput(type, content) {
  const line = document.createElement('div');
  line.className = 'psql-command';
  
  if (type === 'command') {
    line.innerHTML = `<div class="psql-prompt-line">postgres=# ${content}</div>`;
  } else if (type === 'result') {
    line.innerHTML = `<div class="psql-result">${content}</div>`;
  } else if (type === 'error') {
    line.innerHTML = `<div class="psql-error">ERROR: ${content}</div>`;
  }
  
  psqlOutput.appendChild(line);
  ensurePSQLOutputVisible();
}

// Translate PostgreSQL meta-commands to SQL queries
function translatePSQLCommand(command) {
  const cmd = command.toLowerCase().trim();
  
  // Handle \l - list databases
  if (cmd === '\\l' || cmd === '\\list') {
    return `SELECT datname as "Name", 
                   pg_catalog.pg_get_userbyid(datdba) as "Owner",
                   pg_catalog.pg_encoding_to_char(encoding) as "Encoding",
                   datcollate as "Collate",
                   datctype as "Ctype",
                   pg_catalog.pg_size_pretty(pg_catalog.pg_database_size(datname)) as "Size"
            FROM pg_catalog.pg_database
            ORDER BY datname;`;
  }
  
  // Handle \d - list tables, views, sequences
  if (cmd === '\\d' || cmd === '\\dt' || cmd === '\\dv' || cmd === '\\ds') {
    let relkindFilter = '';
    if (cmd === '\\dt') {
      relkindFilter = "AND c.relkind = 'r'"; // tables only
    } else if (cmd === '\\dv') {
      relkindFilter = "AND c.relkind = 'v'"; // views only
    } else if (cmd === '\\ds') {
      relkindFilter = "AND c.relkind = 'S'"; // sequences only
    } else {
      relkindFilter = "AND c.relkind IN ('r', 'v', 'S')"; // tables, views, sequences
    }
    
    return `SELECT schemaname as "Schema", 
                   tablename as "Name", 
                   tableowner as "Owner",
                   CASE 
                     WHEN schemaname = 'public' THEN 'table'
                     ELSE 'table'
                   END as "Type"
            FROM pg_catalog.pg_tables
            WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
            UNION ALL
            SELECT schemaname as "Schema", 
                   viewname as "Name", 
                   viewowner as "Owner",
                   'view' as "Type"
            FROM pg_catalog.pg_views
            WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
            ORDER BY "Schema", "Name";`;
  }
  
  // Handle \d <table_name> - describe table
  if (cmd.startsWith('\\d ') && cmd.length > 3) {
    const tableName = cmd.substring(3).trim();
    return `SELECT 
                a.attname as "Column",
                pg_catalog.format_type(a.atttypid, a.atttypmod) as "Type",
                CASE WHEN a.attnotnull THEN 'not null' ELSE '' END as "Nullable",
                CASE WHEN a.atthasdef THEN pg_catalog.pg_get_expr(d.adbin, d.adrelid) ELSE '' END as "Default"
            FROM pg_catalog.pg_attribute a
            LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
            WHERE a.attrelid = '${tableName}'::regclass
            AND a.attnum > 0 
            AND NOT a.attisdropped
            ORDER BY a.attnum;`;
  }
  
  // Handle MySQL-style commands for PostgreSQL compatibility
  if (cmd === 'show databases') {
    return `SELECT datname as "Database" FROM pg_catalog.pg_database WHERE datistemplate = false ORDER BY datname;`;
  }
  
  if (cmd === 'show tables') {
    return `SELECT tablename as "Tables" FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename;`;
  }
  
  // Handle \q - quit (just show a message)
  if (cmd === '\\q' || cmd === '\\quit') {
    addPSQLOutput('result', 'Use the connection selector to disconnect');
    return null;
  }
  
  // Handle \h or \help
  if (cmd === '\\h' || cmd === '\\help' || cmd === '\\?') {
    const helpText = `Available commands:
\\l, \\list          list databases
\\d                  list tables, views, and sequences
\\dt                 list tables
\\dv                 list views
\\ds                 list sequences
\\d <table>          describe table
\\q, \\quit           quit
\\h, \\help, \\?       show this help
show databases      list databases (MySQL style)
show tables         list tables (MySQL style)

Keyboard Shortcuts:
↑ (Up Arrow)        previous command in history
↓ (Down Arrow)      next command in history
Escape              clear current input
Enter               execute command
Ctrl/Cmd + End      scroll to bottom of output

You can also execute regular SQL queries.`;
    addPSQLOutput('result', helpText);
    return null;
  }
  
  // If it's not a meta-command, return the original command
  return command;
}

// Format output for table listing commands
function formatPSQLTableOutput(rows, originalCommand) {
  if (!rows || rows.length === 0) {
    addPSQLOutput('result', 'No relations found.');
    return;
  }
  
  // Create a formatted table output
  const headers = Object.keys(rows[0]);
  
  // Calculate column widths
  const colWidths = headers.map(header => {
    const maxContentWidth = Math.max(...rows.map(row => String(row[header] || '').length));
    return Math.max(header.length, maxContentWidth);
  });
  
  // Create header row
  let output = '';
  const headerRow = headers.map((header, i) => header.padEnd(colWidths[i])).join(' | ');
  const separatorRow = colWidths.map(width => '-'.repeat(width)).join('-+-');
  
  output += headerRow + '\n';
  output += separatorRow + '\n';
  
  // Add data rows
  rows.forEach(row => {
    const dataRow = headers.map((header, i) => 
      String(row[header] || '').padEnd(colWidths[i])
    ).join(' | ');
    output += dataRow + '\n';
  });
  
  output += `\n(${rows.length} row${rows.length === 1 ? '' : 's'})`;
  
  // Use <pre> tag to preserve formatting
  const line = document.createElement('div');
  line.className = 'psql-command';
  line.innerHTML = `<div class="psql-result"><pre>${output}</pre></div>`;
  psqlOutput.appendChild(line);
  ensurePSQLOutputVisible();
}

// PSQL Command History Navigation
function navigatePSQLHistory(direction) {
  if (psqlCommandHistory.length === 0) return;
  
  // Save current command if we're starting navigation
  if (psqlHistoryIndex === -1) {
    psqlCurrentCommand = psqlInput.value;
  }
  
  if (direction === 'up') {
    if (psqlHistoryIndex === -1) {
      // Start from the most recent command
      psqlHistoryIndex = psqlCommandHistory.length - 1;
    } else if (psqlHistoryIndex > 0) {
      psqlHistoryIndex--;
    }
    psqlInput.value = psqlCommandHistory[psqlHistoryIndex];
  } else if (direction === 'down') {
    if (psqlHistoryIndex === -1) {
      // Already at current command, do nothing
      return;
    } else if (psqlHistoryIndex < psqlCommandHistory.length - 1) {
      psqlHistoryIndex++;
      psqlInput.value = psqlCommandHistory[psqlHistoryIndex];
    } else {
      // Return to current command
      psqlHistoryIndex = -1;
      psqlInput.value = psqlCurrentCommand;
    }
  }
  
  // Move cursor to end of input and ensure it's visible
  setTimeout(() => {
    psqlInput.setSelectionRange(psqlInput.value.length, psqlInput.value.length);
    psqlInput.focus();
    // Scroll input into view if needed
    psqlInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 0);
}

function clearPSQLInput() {
  psqlInput.value = '';
  psqlHistoryIndex = -1;
  psqlCurrentCommand = '';
}

// Enhanced PSQL output scrolling
function ensurePSQLOutputVisible() {
  // Smooth scroll to bottom
  psqlOutput.scrollTo({
    top: psqlOutput.scrollHeight,
    behavior: 'smooth'
  });
}

// Add keyboard shortcuts info to PSQL help
function showPSQLKeyboardShortcuts() {
  const shortcutsText = `Keyboard Shortcuts:
↑ (Up Arrow)     - Previous command in history
↓ (Down Arrow)   - Next command in history
Escape           - Clear current input
Enter            - Execute command

Command History:
- Last 100 commands are automatically saved
- Navigate with arrow keys
- Duplicate consecutive commands are filtered out`;
  
  addPSQLOutput('result', shortcutsText);
}

// Tab Switching
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.dataset.content === tabName);
  });
}

// Main Tab Switching (Header Tabs)
function switchMainTab(tabName) {
  if (!tabName) return;
  
  currentMainTab = tabName;
  
  // Update header tab states
  document.querySelectorAll('.header-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // Show/hide content sections
  document.querySelectorAll('.main-tab-content').forEach(content => {
    const isActive = content.dataset.mainContent === tabName;
    content.classList.toggle('active', isActive);
    content.style.display = isActive ? 'block' : 'none';
  });
  
  // Load tab-specific data
  switch (tabName) {
    case 'snippets':
      loadSnippets();
      break;
    case 'saved-queries':
      renderSavedQueries();
      break;
    case 'variables':
      loadVariables();
      break;
    case 'psql':
      // Reset PSQL input if needed
      const psqlInput = document.getElementById('psqlInput');
      if (psqlInput) psqlInput.focus();
      break;
    case 'dbml':
      // Auto-hide sidebar for better diagram viewing
      const sidebar = document.querySelector('.sidebar');
      const toggleBtn = document.getElementById('toggleSidebarBtn');
      const showBtn = document.getElementById('showSidebarBtn');
      const icon = toggleBtn?.querySelector('svg');
      
      if (sidebar && !sidebar.classList.contains('hidden')) {
        sidebar.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(-90deg)';
        if (showBtn) showBtn.classList.remove('hidden');
      }
      
      // Auto-load schema from connected database if editor is empty
      const dbmlEditor = document.getElementById('dbmlEditor');
      if (currentConnectionId && dbmlEditor && !dbmlEditor.value.trim()) {
        loadSchemaToDBML();
      } else if (!currentConnectionId) {
        // Show message if not connected
        const viewport = document.getElementById('dbmlViewport');
        if (viewport && !dbmlEditor?.value.trim()) {
          viewport.innerHTML = '<div class="no-results">Connect to a database or enter DBML script manually</div>';
        }
      }
      break;
  }
}

// Notifications
function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // You can implement a toast notification system here
}

// ===== NEW FEATURES =====

// Load Snippets and Variables from localStorage
async function loadSnippets() {
  try {
    // First, try to migrate from localStorage if it exists and file storage is empty
    const localStorageSnippets = localStorage.getItem('neurodb_snippets');
    
    const result = await window.api.getSnippets();
    if (result.success) {
      snippets = result.snippets || [];
      
      // If file storage is empty but localStorage has data, migrate it
      if (snippets.length === 0 && localStorageSnippets) {
        const localSnippets = JSON.parse(localStorageSnippets);
        if (localSnippets.length > 0) {
          console.log('Migrating snippets from localStorage to file storage...');
          const migrateResult = await window.api.migrateSnippetsFromLocalStorage(localSnippets);
          if (migrateResult.success) {
            snippets = localSnippets;
            // Clear localStorage after successful migration
            localStorage.removeItem('neurodb_snippets');
            showNotification('Snippets migrated to file storage', 'info');
          }
        }
      }
    } else {
      // Fallback to localStorage if file storage fails
      snippets = localStorageSnippets ? JSON.parse(localStorageSnippets) : [];
    }
    renderSnippets();
  } catch (error) {
    console.error('Error loading snippets:', error);
    showNotification('Error loading snippets', 'error');
    // Fallback to localStorage
    try {
      const saved = localStorage.getItem('neurodb_snippets');
      snippets = saved ? JSON.parse(saved) : [];
    } catch (e) {
      snippets = [];
    }
  }
}

function loadVariables() {
  try {
    const saved = localStorage.getItem('neurodb_variables');
    variables = saved ? JSON.parse(saved) : [];
    renderVariables();
  } catch (error) {
    console.error('Error loading variables:', error);
    showNotification('Error loading variables', 'error');
    variables = [];
  }
}

async function saveSnippets() {
  // This function is kept for backwards compatibility but is no longer needed
  // Individual snippets are now saved via IPC in saveSnippet() and deleteSnippet()
  // Just keep localStorage as a backup
  try {
    localStorage.setItem('neurodb_snippets', JSON.stringify(snippets));
  } catch (error) {
    console.error('Error backing up snippets to localStorage:', error);
  }
}

function saveVariables() {
  localStorage.setItem('neurodb_variables', JSON.stringify(variables));
}

// Initialize limit dropdown
function initializeLimitDropdown() {
  // Load saved limit preference
  const savedLimit = localStorage.getItem('neurodb_query_limit');
  if (savedLimit) {
    currentLimit = savedLimit === 'all' ? 'all' : parseInt(savedLimit);
    limitSelect.value = savedLimit;
  } else {
    currentLimit = 100;
    limitSelect.value = '100';
  }
}

// Handle limit dropdown change
function handleLimitChange() {
  const selectedValue = limitSelect.value;
  currentLimit = selectedValue === 'all' ? 'all' : parseInt(selectedValue);
  
  // Save preference
  localStorage.setItem('neurodb_query_limit', selectedValue);
  
  // Show notification about the change
  const limitText = currentLimit === 'all' ? 'no limit' : `${currentLimit} rows`;
  showNotification(`Query limit set to ${limitText}`, 'info');
}

// Fetch total count for a SELECT query with LIMIT (runs in background)
async function fetchTotalCountForQuery(originalQuery, displayedRowCount, executionTime, suffix = '') {
  try {
    // Remove the LIMIT clause to build a COUNT query
    let queryWithoutLimit = originalQuery.replace(/\s*LIMIT\s+\d+\s*;?\s*$/i, '');
    queryWithoutLimit = queryWithoutLimit.trim();
    if (queryWithoutLimit.endsWith(';')) {
      queryWithoutLimit = queryWithoutLimit.slice(0, -1).trim();
    }

    // Build a COUNT(*) query by wrapping the original query (without LIMIT) as a subquery
    const countQuery = `SELECT COUNT(*) AS total_count FROM (${queryWithoutLimit}) AS _count_subquery;`;

    const countResult = await window.api.executeQuery(currentConnectionId, countQuery);

    if (countResult.success && countResult.rows && countResult.rows.length > 0) {
      const totalCount = parseInt(countResult.rows[0].total_count, 10);

      // Only update if total count is greater than displayed rows (meaning LIMIT actually truncated results)
      if (totalCount > displayedRowCount) {
        const infoText = `${displayedRowCount} of ${totalCount.toLocaleString()} total rows in ${executionTime}ms${suffix}`;
        resultsInfo.textContent = infoText;

        // Also update the tab's stored results info
        if (activeTabIndex >= 0 && activeTabIndex < connectionTabs.length) {
          connectionTabs[activeTabIndex].resultsInfoText = infoText;
        }
      }
    }
  } catch (err) {
    // Silently ignore count query failures — the main query result is already shown
    console.warn('Failed to fetch total count:', err);
  }
}

// Apply limit to query string
function applyLimitToQuery(query) {
  if (currentLimit === 'all') {
    return query;
  }
  
  // Remove existing LIMIT clause if any
  const cleanedQuery = query.replace(/\s+LIMIT\s+\d+\s*;?\s*$/i, '');
  
  // Add new LIMIT clause
  const trimmedQuery = cleanedQuery.trim();
  const hasTrailingSemicolon = trimmedQuery.endsWith(';');
  
  if (hasTrailingSemicolon) {
    return trimmedQuery.slice(0, -1) + `\nLIMIT ${currentLimit};`;
  } else {
    return trimmedQuery + `\nLIMIT ${currentLimit}`;
  }
}

// Render Snippets
function renderSnippets() {
  const list = document.getElementById('snippetsList');
  
  if (snippets.length === 0) {
    list.innerHTML = '<div class="no-results">No saved queries yet. Create one to get started!</div>';
    return;
  }
  
  list.innerHTML = '';
  snippets.forEach(snippet => {
    const item = document.createElement('div');
    item.className = 'snippet-item';
    item.innerHTML = `
      <div class="snippet-header">
        <div>
          <div class="snippet-title">${snippet.name}</div>
          <span class="snippet-shortcut">{{${snippet.shortcut}}}</span>
        </div>
        <div class="snippet-actions">
          <button class="btn-icon snippet-help-btn" onclick="showSnippetHelp('${snippet.id}')" title="Show usage help">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <text x="8" y="11.5" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">i</text>
            </svg>
          </button>
          <button class="btn-secondary item-actions-btn" onclick="useSnippet('${snippet.id}')">Use</button>
          <button class="btn-secondary item-actions-btn" onclick="editSnippet('${snippet.id}')">Edit</button>
          <button class="btn-danger item-actions-btn" onclick="deleteSnippet('${snippet.id}')">Delete</button>
        </div>
      </div>
      ${snippet.description ? `<div class="snippet-description">${snippet.description}</div>` : ''}
      <div class="snippet-query">${snippet.query}</div>
    `;
    list.appendChild(item);
  });
}

// Render Variables
function renderVariables() {
  const list = document.getElementById('variablesList');
  
  if (variables.length === 0) {
    list.innerHTML = '<div class="no-results">No variables yet. Create one to get started!</div>';
    return;
  }
  
  list.innerHTML = '';
  variables.forEach(variable => {
    const item = document.createElement('div');
    item.className = 'variable-item';
    item.innerHTML = `
      <div class="variable-header">
        <div>
          <div class="variable-title">${variable.name}</div>
          <span class="variable-shortcut">{{${variable.shortcut}}}</span>
          <div class="variable-value">${variable.value}</div>
        </div>
        <div class="variable-actions">
          <button class="btn-secondary item-actions-btn" onclick="editVariable('${variable.id}')">Edit</button>
          <button class="btn-danger item-actions-btn" onclick="deleteVariable('${variable.id}')">Delete</button>
        </div>
      </div>
      ${variable.description ? `<div class="variable-description">${variable.description}</div>` : ''}
    `;
    list.appendChild(item);
  });
}

// Snippet Management
function openSnippetModal(snippet = null) {
  const modal = document.getElementById('snippetModal');
  const form = document.getElementById('snippetForm');
  
  if (snippet) {
    document.getElementById('snippetModalTitle').textContent = 'Edit Saved Query';
    document.getElementById('snippetId').value = snippet.id;
    document.getElementById('snippetName').value = snippet.name;
    document.getElementById('snippetShortcut').value = snippet.shortcut;
    document.getElementById('snippetQuery').value = snippet.query;
    document.getElementById('snippetDescription').value = snippet.description || '';
  } else {
    document.getElementById('snippetModalTitle').textContent = 'Add Saved Query';
    form.reset();
    document.getElementById('snippetId').value = '';
  }
  
  modal.classList.remove('hidden');
}

async function saveSnippet(event) {
  event.preventDefault();
  
  const id = document.getElementById('snippetId').value;
  const snippet = {
    name: document.getElementById('snippetName').value,
    shortcut: document.getElementById('snippetShortcut').value.toLowerCase().replace(/\s/g, ''),
    query: document.getElementById('snippetQuery').value,
    description: document.getElementById('snippetDescription').value
  };
  
  try {
    let result;
    if (id) {
      // Update existing snippet
      snippet.id = id;
      result = await window.api.updateSnippet(id, snippet);
      if (result.success) {
        const index = snippets.findIndex(s => s.id === id);
        if (index >= 0) {
          snippets[index] = result.snippet;
        }
      }
    } else {
      // Add new snippet
      result = await window.api.saveSnippet(snippet);
      if (result.success) {
        snippets.push(result.snippet);
      }
    }
    
    if (result.success) {
      renderSnippets();
      document.getElementById('snippetModal').classList.add('hidden');
      showNotification('Snippet saved successfully', 'success');
    } else {
      showNotification('Error saving snippet: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error saving snippet:', error);
    showNotification('Error saving snippet', 'error');
  }
}

function editSnippet(id) {
  const snippet = snippets.find(s => s.id === id);
  if (snippet) {
    openSnippetModal(snippet);
  }
}

async function deleteSnippet(id) {
  if (confirm('Are you sure you want to delete this snippet?')) {
    try {
      const result = await window.api.deleteSnippet(id);
      if (result.success) {
        snippets = snippets.filter(s => s.id !== id);
        renderSnippets();
        showNotification('Snippet deleted', 'success');
      } else {
        showNotification('Error deleting snippet: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error deleting snippet:', error);
      showNotification('Error deleting snippet', 'error');
    }
  }
}

function useSnippet(id) {
  const snippet = snippets.find(s => s.id === id);
  if (snippet) {
    switchMainTab('query');
    queryEditor.value = snippet.query;
    updateLineNumbers();
    updateSyntaxHighlight();
    showNotification('Snippet loaded into editor', 'success');
  }
}

function showSnippetHelp(id) {
  const snippet = snippets.find(s => s.id === id);
  if (!snippet) return;

  const modal = document.getElementById('snippetHelpModal');
  const title = document.getElementById('snippetHelpTitle');
  const content = document.getElementById('snippetHelpContent');

  title.textContent = `${snippet.name} - Usage Guide`;

  // Extract unique placeholders from the query
  const namedPlaceholders = [];
  const namedMatches = snippet.query.matchAll(/\{([^}]+)\}/g);
  const seenPlaceholders = new Set();
  for (const match of namedMatches) {
    // Only add unique placeholder names
    if (!seenPlaceholders.has(match[1])) {
      namedPlaceholders.push(match[1]);
      seenPlaceholders.add(match[1]);
    }
  }

  const questionPlaceholderCount = (snippet.query.match(/\?/g) || []).length;
  
  // Add generic names for ? placeholders
  const questionPlaceholders = [];
  for (let i = 0; i < questionPlaceholderCount; i++) {
    questionPlaceholders.push(`param_${i + 1}`);
  }

  const allPlaceholders = [...namedPlaceholders, ...questionPlaceholders];
  const hasPlaceholders = allPlaceholders.length > 0;

  // Build help content
  let html = `
    <div class="help-section">
      <h3 class="help-section-title">Query Details</h3>
      <div class="help-item">
        <label>Shortcut:</label>
        <code class="help-code">{{${snippet.shortcut}}}</code>
      </div>
      ${snippet.description ? `
        <div class="help-item">
          <label>Description:</label>
          <span>${snippet.description}</span>
        </div>
      ` : ''}
    </div>

    <div class="help-section">
      <h3 class="help-section-title">SQL Query</h3>
      <pre class="help-query">${snippet.query.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </div>
  `;

  if (hasPlaceholders) {
    html += `
      <div class="help-section">
        <h3 class="help-section-title">Placeholders</h3>
        <p class="help-description">This query contains <strong>${allPlaceholders.length}</strong> placeholder${allPlaceholders.length !== 1 ? 's' : ''} that need to be filled:</p>
        <ul class="help-placeholder-list">
          ${allPlaceholders.map((ph, idx) => `
            <li>
              <code class="help-placeholder-name">${ph}</code>
              ${namedPlaceholders.includes(ph) ? '<span class="help-placeholder-type">Named</span>' : '<span class="help-placeholder-type positional">Positional</span>'}
            </li>
          `).join('')}
        </ul>
      </div>

      <div class="help-section">
        <h3 class="help-section-title">Usage Examples</h3>
        
        <div class="help-example">
          <h4>1. Basic Usage (Without Arguments)</h4>
          <p class="help-description">Type the shortcut in your query editor:</p>
          <pre class="help-code-block">{{${snippet.shortcut}}}</pre>
          <p class="help-note">⚠️ A warning icon will appear indicating missing placeholders. Click on it to fill in values.</p>
        </div>

        <div class="help-example">
          <h4>2. Usage With Arguments</h4>
          <p class="help-description">Provide values directly in parentheses (comma-separated):</p>
          <pre class="help-code-block">{{${snippet.shortcut}(${allPlaceholders.map((ph, idx) => {
            if (ph.includes('date')) return 'YYYY-MM-DD';
            if (ph.includes('id')) return '123';
            if (ph.includes('name')) return "'John Doe'";
            if (ph.includes('status')) return "'active'";
            return `value${idx + 1}`;
          }).join(', ')})}}}</pre>
        </div>

        <div class="help-example">
          <h4>3. Interactive Method</h4>
          <ol class="help-steps">
            <li>Type <code>{{${snippet.shortcut}}}</code> in the query editor</li>
            <li>Click on the highlighted shortcut with the ⚠️ warning icon</li>
            <li>A popup will appear with input fields for each placeholder</li>
            <li>Fill in the values and click "Apply"</li>
            <li>The shortcut will update to include your values</li>
          </ol>
        </div>

        <div class="help-example">
          <h4>4. Sample Output</h4>
          <p class="help-description">After filling placeholders, the final query will look like:</p>
          <pre class="help-code-block sample-output">${generateSampleOutput(snippet.query, allPlaceholders)}</pre>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="help-section">
        <h3 class="help-section-title">Usage</h3>
        <p class="help-description">This query has no placeholders. Simply type the shortcut in your query editor:</p>
        <pre class="help-code-block">{{${snippet.shortcut}}}</pre>
        <p class="help-note">The shortcut will be replaced with the full query when executed.</p>
      </div>
    `;
  }

  html += `
    <div class="help-section">
      <h3 class="help-section-title">Quick Actions</h3>
      <div class="help-actions">
        <button class="btn-primary" onclick="useSnippet('${snippet.id}'); document.getElementById('snippetHelpModal').classList.add('hidden');">
          Use This Query
        </button>
        <button class="btn-secondary" onclick="editSnippet('${snippet.id}'); document.getElementById('snippetHelpModal').classList.add('hidden');">
          Edit Query
        </button>
      </div>
    </div>
  `;

  content.innerHTML = html;
  modal.classList.remove('hidden');
}

// Helper function to generate sample output for help
function generateSampleOutput(query, placeholders) {
  let output = query;
  let argIndex = 0;
  
  // Replace {key_name} placeholders
  output = output.replace(/\{([^}]+)\}/g, (match, keyName) => {
    if (argIndex < placeholders.length) {
      const placeholder = placeholders[argIndex];
      argIndex++;
      
      // Generate sample value based on placeholder name
      if (placeholder.includes('date')) return '2024-01-15';
      if (placeholder.includes('id')) return '123';
      if (placeholder.includes('name')) return "'John Doe'";
      if (placeholder.includes('email')) return "'user@example.com'";
      if (placeholder.includes('status')) return "'active'";
      if (placeholder.includes('limit')) return '100';
      if (placeholder.includes('offset')) return '0';
      return "'sample_value'";
    }
    return match;
  });
  
  // Replace ? placeholders
  output = output.replace(/\?/g, () => {
    if (argIndex < placeholders.length) {
      argIndex++;
      return "'value'";
    }
    return '?';
  });
  
  return output.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== SAVED QUERIES FEATURE =====

function loadSavedQueries() {
  try {
    const saved = localStorage.getItem('neurodb_saved_queries');
    savedQueries = saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error loading saved queries:', error);
    savedQueries = [];
  }
}

function persistSavedQueries() {
  try {
    localStorage.setItem('neurodb_saved_queries', JSON.stringify(savedQueries));
  } catch (error) {
    console.error('Error saving queries to localStorage:', error);
  }
}

function openSavedQueryModal(query = null) {
  const modal = document.getElementById('savedQueryModal');
  const form = document.getElementById('savedQueryForm');

  if (query) {
    document.getElementById('savedQueryModalTitle').textContent = 'Edit Saved Query';
    document.getElementById('savedQueryId').value = query.id;
    document.getElementById('savedQueryTitle').value = query.title;
    document.getElementById('savedQueryDescription').value = query.description || '';
    document.getElementById('savedQuerySQL').value = query.sql;
  } else {
    document.getElementById('savedQueryModalTitle').textContent = 'Save New Query';
    form.reset();
    document.getElementById('savedQueryId').value = '';
    // Pre-fill with current editor query if available
    const currentQuery = queryEditor?.value?.trim();
    if (currentQuery) {
      document.getElementById('savedQuerySQL').value = currentQuery;
    }
  }

  modal.classList.remove('hidden');
  document.getElementById('savedQueryTitle').focus();
}

function handleSaveSavedQuery(event) {
  event.preventDefault();

  const id = document.getElementById('savedQueryId').value;
  const title = document.getElementById('savedQueryTitle').value.trim();
  const description = document.getElementById('savedQueryDescription').value.trim();
  const sql = document.getElementById('savedQuerySQL').value.trim();

  if (!title || !sql) return;

  if (id) {
    // Update existing
    const index = savedQueries.findIndex(q => q.id === id);
    if (index >= 0) {
      savedQueries[index].title = title;
      savedQueries[index].description = description;
      savedQueries[index].sql = sql;
      savedQueries[index].updatedAt = new Date().toISOString();
    }
  } else {
    // Create new
    savedQueries.unshift({
      id: 'sq_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title,
      description,
      sql,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  persistSavedQueries();
  renderSavedQueries();
  document.getElementById('savedQueryModal').classList.add('hidden');
  showNotification(id ? 'Query updated' : 'Query saved', 'success');
}

function editSavedQuery(id) {
  const query = savedQueries.find(q => q.id === id);
  if (query) openSavedQueryModal(query);
}

function deleteSavedQuery(id) {
  if (confirm('Are you sure you want to delete this saved query?')) {
    savedQueries = savedQueries.filter(q => q.id !== id);
    persistSavedQueries();
    renderSavedQueries();
    showNotification('Query deleted', 'success');
  }
}

function copySavedQuery(id) {
  const query = savedQueries.find(q => q.id === id);
  if (!query) return;

  navigator.clipboard.writeText(query.sql).then(() => {
    // Visual feedback on button
    const btn = document.querySelector(`[data-copy-id="${id}"]`);
    if (btn) {
      btn.classList.add('copied');
      const origHTML = btn.innerHTML;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg> Copied!`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = origHTML;
      }, 1500);
    }
    showNotification('Query copied to clipboard', 'success');
  }).catch(() => {
    showNotification('Failed to copy query', 'error');
  });
}

function loadSavedQueryToEditor(id) {
  const query = savedQueries.find(q => q.id === id);
  if (!query) return;

  switchMainTab('query');
  queryEditor.value = query.sql;
  if (typeof updateLineNumbers === 'function') updateLineNumbers();
  if (typeof updateSyntaxHighlight === 'function') updateSyntaxHighlight();
  showNotification('Query loaded into editor', 'success');
}

function renderSavedQueries(searchFilter = '') {
  const list = document.getElementById('savedQueriesList');
  if (!list) return;

  let filtered = savedQueries;
  if (searchFilter) {
    const lower = searchFilter.toLowerCase();
    filtered = savedQueries.filter(q =>
      q.title.toLowerCase().includes(lower) ||
      (q.description && q.description.toLowerCase().includes(lower)) ||
      q.sql.toLowerCase().includes(lower)
    );
  }

  if (filtered.length === 0) {
    list.innerHTML = searchFilter
      ? '<div class="no-results">No queries match your search.</div>'
      : '<div class="no-results">No saved queries yet. Save your first query to get started!</div>';
    return;
  }

  list.innerHTML = '';
  filtered.forEach(q => {
    const date = new Date(q.updatedAt || q.createdAt);
    const dateStr = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const item = document.createElement('div');
    item.className = 'saved-query-item';
    item.innerHTML = `
      <div class="saved-query-top">
        <div>
          <div class="saved-query-title">${escapeHtml(q.title)}</div>
          <div class="saved-query-meta">Saved ${dateStr} at ${timeStr}</div>
          ${q.description ? `<div class="saved-query-description">${escapeHtml(q.description)}</div>` : ''}
        </div>
        <div class="saved-query-actions">
          <button class="btn-secondary item-actions-btn" onclick="loadSavedQueryToEditor('${q.id}')">Load</button>
          <button class="btn-secondary item-actions-btn" onclick="editSavedQuery('${q.id}')">Edit</button>
          <button class="btn-danger item-actions-btn" onclick="deleteSavedQuery('${q.id}')">Delete</button>
        </div>
      </div>
      <div class="saved-query-sql">${escapeHtml(q.sql)}</div>
      <div class="saved-query-sql-actions">
        <button class="btn-copy-query" data-copy-id="${q.id}" onclick="copySavedQuery('${q.id}')">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
          </svg>
          Copy
        </button>
        <button class="btn-load-query" onclick="loadSavedQueryToEditor('${q.id}')">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2l10 6-10 6V2z"/>
          </svg>
          Load in Editor
        </button>
      </div>
    `;
    list.appendChild(item);
  });
}

// Show general help for saved queries
function showSnippetsGeneralHelp() {
  const modal = document.getElementById('snippetHelpModal');
  const title = document.getElementById('snippetHelpTitle');
  const content = document.getElementById('snippetHelpContent');

  title.textContent = 'Saved Queries - User Guide';

  const html = `
    <div class="help-section">
      <h3 class="help-section-title">What are Saved Queries?</h3>
      <p class="help-description">
        Saved Queries (also called Snippets) are reusable SQL query templates that you can quickly insert into your query editor. 
        They're perfect for queries you use frequently, complex queries you don't want to retype, or standardized queries for your team.
      </p>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Creating a Saved Query</h3>
      <ol class="help-steps">
        <li>Click the <strong>"New Snippet"</strong> button at the top of this page</li>
        <li>Fill in the form:
          <ul style="margin-top: 8px; padding-left: 20px;">
            <li><strong>Name:</strong> A descriptive name for your query (e.g., "Get Active Users")</li>
            <li><strong>Shortcut:</strong> A short code to quickly insert it (e.g., "activeusers")</li>
            <li><strong>SQL Query:</strong> Your SQL query template</li>
            <li><strong>Description:</strong> Optional notes about what the query does</li>
          </ul>
        </li>
        <li>Click <strong>"Save"</strong> to save your query</li>
      </ol>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Using Saved Queries</h3>
      <p class="help-description">To use a saved query, type its shortcut in the query editor wrapped in double curly braces:</p>
      <pre class="help-code-block">{{yourshortcut}}</pre>
      <p class="help-description" style="margin-top: 12px;">The shortcut will be highlighted and will expand to the full query when executed.</p>
      
      <div class="help-example">
        <h4>Example:</h4>
        <p class="help-description">If you have a saved query with shortcut "activeusers", just type:</p>
        <pre class="help-code-block">{{activeusers}}</pre>
        <p class="help-description">And it will be replaced with your full query when executed!</p>
      </div>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Using Placeholders (Dynamic Values)</h3>
      <p class="help-description">
        Placeholders make your saved queries dynamic by allowing you to provide different values each time you use them.
        There are two types of placeholders you can use:
      </p>

      <div class="help-example">
        <h4>1. Named Placeholders: <code class="help-code">{placeholder_name}</code></h4>
        <p class="help-description">Use curly braces with a descriptive name. This is recommended for clarity.</p>
        <pre class="help-query">SELECT * FROM users 
WHERE created_at > {start_date} 
  AND status = {user_status}
LIMIT {row_limit}</pre>
        <p class="help-note">✨ Named placeholders can contain spaces and special characters: <code>{start date}</code>, <code>{user's name}</code></p>
      </div>

      <div class="help-example">
        <h4>2. Positional Placeholders: <code class="help-code">?</code></h4>
        <p class="help-description">Use question marks for simple, position-based placeholders.</p>
        <pre class="help-query">SELECT * FROM products 
WHERE category = ? 
  AND price > ?</pre>
      </div>

      <div class="help-example">
        <h4>3. Mixed Placeholders</h4>
        <p class="help-description">You can use both types together! They'll be filled in order.</p>
        <pre class="help-query">SELECT * FROM orders 
WHERE user_id = {user_id} 
  AND status = ?
  AND created_at > {start_date}</pre>
      </div>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Filling Placeholder Values</h3>
      <p class="help-description">There are three ways to provide values for placeholders:</p>

      <div class="help-example">
        <h4>Method 1: Direct Arguments</h4>
        <p class="help-description">Provide values in parentheses, separated by commas:</p>
        <pre class="help-code-block">{{activeusers(2024-01-01, active, 100)}}</pre>
        <p class="help-note">💡 Values are applied in order: {start_date} → 2024-01-01, {user_status} → active, {row_limit} → 100</p>
      </div>

      <div class="help-example">
        <h4>Method 2: Interactive Popup (Recommended)</h4>
        <ol class="help-steps">
          <li>Type your shortcut: <code>{{activeusers}}</code></li>
          <li>You'll see a warning icon <strong>⚠️</strong> indicating missing placeholders</li>
          <li>Click on the highlighted shortcut</li>
          <li>A popup appears with labeled input fields for each placeholder</li>
          <li>Fill in the values and see a live preview of your query</li>
          <li>Click <strong>"Apply"</strong> to insert the values</li>
        </ol>
        <p class="help-note">✨ This method shows placeholder names and provides a live preview!</p>
      </div>

      <div class="help-example">
        <h4>Method 3: Autocomplete</h4>
        <ol class="help-steps">
          <li>Start typing <code>{{</code> in the query editor</li>
          <li>A dropdown will show all your saved queries</li>
          <li>Select one with arrow keys or mouse</li>
          <li>Press Enter or Tab to insert it</li>
          <li>Use Method 1 or 2 to fill placeholders</li>
        </ol>
      </div>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Complete Example Workflow</h3>
      <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 6px; border-left: 3px solid var(--primary-color);">
        <p><strong>Step 1: Create a saved query</strong></p>
        <ul style="margin: 8px 0; padding-left: 20px;">
          <li><strong>Name:</strong> Get Users by Date Range</li>
          <li><strong>Shortcut:</strong> usersbydate</li>
          <li><strong>Query:</strong></li>
        </ul>
        <pre class="help-query" style="margin: 10px 0;">SELECT id, name, email, created_at 
FROM users 
WHERE created_at BETWEEN {start_date} AND {end_date}
  AND status = {status}
ORDER BY created_at DESC
LIMIT {limit}</pre>

        <p style="margin-top: 15px;"><strong>Step 2: Use it in the query editor</strong></p>
        <pre class="help-code-block">{{usersbydate}}</pre>

        <p style="margin-top: 15px;"><strong>Step 3: Click the shortcut (with ⚠️ icon)</strong></p>
        <p style="margin: 8px 0; color: var(--text-secondary); font-size: 13px;">A popup appears with 4 input fields:</p>
        <ul style="margin: 8px 0; padding-left: 20px; color: var(--text-secondary); font-size: 13px;">
          <li>start_date: <code>2024-01-01</code></li>
          <li>end_date: <code>2024-12-31</code></li>
          <li>status: <code>active</code></li>
          <li>limit: <code>50</code></li>
        </ul>

        <p style="margin-top: 15px;"><strong>Step 4: Final query after applying values</strong></p>
        <pre class="help-query" style="margin: 10px 0;">SELECT id, name, email, created_at 
FROM users 
WHERE created_at BETWEEN 2024-01-01 AND 2024-12-31
  AND status = active
ORDER BY created_at DESC
LIMIT 50</pre>
      </div>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Tips & Best Practices</h3>
      <ul class="help-placeholder-list" style="list-style-type: none; padding-left: 0;">
        <li style="margin-bottom: 12px;">
          <strong>💡 Use descriptive shortcut names</strong><br>
          <span style="color: var(--text-secondary); font-size: 13px;">Good: <code>usersbydate</code>, Bad: <code>ubd</code></span>
        </li>
        <li style="margin-bottom: 12px;">
          <strong>📝 Use named placeholders for clarity</strong><br>
          <span style="color: var(--text-secondary); font-size: 13px;"><code>{user_id}</code> is clearer than <code>?</code></span>
        </li>
        <li style="margin-bottom: 12px;">
          <strong>📋 Add descriptions to your queries</strong><br>
          <span style="color: var(--text-secondary); font-size: 13px;">Future you will thank present you!</span>
        </li>
        <li style="margin-bottom: 12px;">
          <strong>🔄 Export your snippets regularly</strong><br>
          <span style="color: var(--text-secondary); font-size: 13px;">Use the Export button to backup your saved queries</span>
        </li>
        <li style="margin-bottom: 12px;">
          <strong>ℹ️ Click the info icon on any saved query</strong><br>
          <span style="color: var(--text-secondary); font-size: 13px;">Get specific usage examples for that query</span>
        </li>
      </ul>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Keyboard Shortcuts</h3>
      <ul style="list-style-type: none; padding-left: 0;">
        <li style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>Start typing shortcut</span>
          <code class="help-code">{{</code>
        </li>
        <li style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>Apply placeholder values</span>
          <code class="help-code">Enter</code>
        </li>
        <li style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>Cancel placeholder popup</span>
          <code class="help-code">Esc</code>
        </li>
        <li style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span>Navigate autocomplete</span>
          <code class="help-code">↑ ↓</code>
        </li>
      </ul>
    </div>

    <div class="help-section">
      <h3 class="help-section-title">Need More Help?</h3>
      <p class="help-description">
        Click the <strong>info icon (ℹ️)</strong> next to any saved query in the list to see specific usage examples for that query.
      </p>
    </div>
  `;

  content.innerHTML = html;
  modal.classList.remove('hidden');
}

async function exportSnippets() {
  try {
    const result = await window.api.exportSnippets();
    if (result.success) {
      showNotification(`Successfully exported ${result.count} snippet${result.count !== 1 ? 's' : ''}`, 'success');
    } else if (!result.canceled) {
      showNotification('Error exporting snippets: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error exporting snippets:', error);
    showNotification('Error exporting snippets', 'error');
  }
}

async function importSnippets() {
  try {
    // Always merge (add new snippets to existing ones)
    const replaceExisting = false;
    
    const result = await window.api.importSnippets(replaceExisting);
    if (result.success) {
      // Reload snippets from the server
      await loadSnippets();
      const addedCount = result.imported - (result.count - snippets.length);
      showNotification(
        `Successfully added ${result.imported} new snippet${result.imported !== 1 ? 's' : ''}. ` +
        `Total: ${result.count}`,
        'success'
      );
    } else if (!result.canceled) {
      showNotification('Error importing snippets: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error importing snippets:', error);
    showNotification('Error importing snippets', 'error');
  }
}

// Variable Management
function openVariableModal(variable = null) {
  const modal = document.getElementById('variableModal');
  const form = document.getElementById('variableForm');
  
  if (variable) {
    document.getElementById('variableModalTitle').textContent = 'Edit Variable';
    document.getElementById('variableId').value = variable.id;
    document.getElementById('variableName').value = variable.name;
    document.getElementById('variableShortcut').value = variable.shortcut;
    document.getElementById('variableValue').value = variable.value;
    document.getElementById('variableDescription').value = variable.description || '';
  } else {
    document.getElementById('variableModalTitle').textContent = 'Add Variable';
    form.reset();
    document.getElementById('variableId').value = '';
  }
  
  modal.classList.remove('hidden');
}

function saveVariable(event) {
  event.preventDefault();
  
  const id = document.getElementById('variableId').value || Date.now().toString();
  const variable = {
    id,
    name: document.getElementById('variableName').value,
    shortcut: document.getElementById('variableShortcut').value.toLowerCase().replace(/\s/g, ''),
    value: document.getElementById('variableValue').value,
    description: document.getElementById('variableDescription').value
  };
  
  const index = variables.findIndex(v => v.id === id);
  if (index >= 0) {
    variables[index] = variable;
  } else {
    variables.push(variable);
  }
  
  saveVariables();
  renderVariables();
  document.getElementById('variableModal').classList.add('hidden');
  showNotification('Variable saved successfully', 'success');
}

function editVariable(id) {
  const variable = variables.find(v => v.id === id);
  if (variable) {
    openVariableModal(variable);
  }
}

function deleteVariable(id) {
  if (confirm('Are you sure you want to delete this variable?')) {
    variables = variables.filter(v => v.id !== id);
    saveVariables();
    renderVariables();
    showNotification('Variable deleted', 'success');
  }
}

// Replace placeholders in query
function replacePlaceholders(query) {
  let processedQuery = query;
  
  // Replace variables
  variables.forEach(v => {
    const regex = new RegExp(`\\{\\{${v.shortcut}\\}\\}`, 'g');
    processedQuery = processedQuery.replace(regex, v.value);
  });
  
  // Replace snippets
  // First handle snippet invocations with arguments: {{shortcut(arg1,arg2)}}
  processedQuery = processedQuery.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\(([^}]*)\)\s*\}\}/g, (match, shortcut, argsText) => {
    const snippet = snippets.find(s => s.shortcut === shortcut);
    if (!snippet) return match; // leave unchanged if not found

    // Split args by comma, but allow commas inside quotes by a simple split and trim
    const rawArgs = argsText.split(',').map(a => a.trim()).filter(a => a.length > 0);

    let result = snippet.query;

    // Replace both {key_name} and ? placeholders with provided args
    if (rawArgs.length > 0) {
      // First, collect unique named placeholders in order of first appearance
      const uniquePlaceholders = [];
      const seenPlaceholders = new Set();
      const namedMatches = snippet.query.matchAll(/\{([^}]+)\}/g);
      for (const match of namedMatches) {
        if (!seenPlaceholders.has(match[1])) {
          uniquePlaceholders.push(match[1]);
          seenPlaceholders.add(match[1]);
        }
      }
      
      // Count ? placeholders
      const questionPlaceholderCount = (snippet.query.match(/\?/g) || []).length;
      
      // Create a map of placeholder names to values
      const placeholderValues = {};
      let argIndex = 0;
      
      // Map unique named placeholders to provided args
      for (const placeholderName of uniquePlaceholders) {
        if (argIndex < rawArgs.length) {
          placeholderValues[placeholderName] = rawArgs[argIndex++];
        }
      }
      
      // Map ? placeholders to remaining args
      const questionPlaceholderValues = [];
      for (let i = 0; i < questionPlaceholderCount && argIndex < rawArgs.length; i++) {
        questionPlaceholderValues.push(rawArgs[argIndex++]);
      }
      
      // Replace {key_name} style placeholders with their mapped values
      result = result.replace(/\{([^}]+)\}/g, (match, placeholderName) => {
        return placeholderValues[placeholderName] || '?';
      });
      
      // Replace ? placeholders in order
      let questionIndex = 0;
      result = result.replace(/\?/g, () => {
        if (questionIndex < questionPlaceholderValues.length) {
          return questionPlaceholderValues[questionIndex++];
        }
        return '?';
      });
    }

    return result;
  });

  // Then handle simple snippet inclusions without args: {{shortcut}}
  snippets.forEach(s => {
    const regex = new RegExp(`\\{\\{${s.shortcut}\\}\\}`, 'g');
    processedQuery = processedQuery.replace(regex, s.query);
  });
  
  return processedQuery;
}

// Database List and Creation Functions
async function listDatabasesOnServer(serverId) {
  try {
    const result = await window.api.listDatabasesOnServer(serverId);
    
    if (result.success) {
      // Show databases in a modal or dropdown
      const databaseList = document.createElement('div');
      databaseList.className = 'database-list';
      
      // Add "Create New Database" button at the top
      const createNewItem = document.createElement('div');
      createNewItem.className = 'database-item create-new';
      createNewItem.innerHTML = `
        <div class="database-item-content">
          <div id="createDatabaseButton">
            <button class="btn-primary" onclick="showCreateDatabaseForm('${serverId}')">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
                <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2"/>
              </svg>
              Create New Database
            </button>
          </div>
          <div id="createDatabaseForm" class="hidden">
            <div class="create-database-form">
              <input type="text" id="newDatabaseName" placeholder="Enter database name" class="new-db-input">
              <div class="form-actions">
                <button class="btn-secondary btn-sm" onclick="hideCreateDatabaseForm()">Cancel</button>
                <button class="btn-primary btn-sm" onclick="createNewDatabase('${serverId}')">Create</button>
              </div>
            </div>
          </div>
        </div>
      `;
      databaseList.appendChild(createNewItem);
      
      // Add separator
      const separator = document.createElement('div');
      separator.className = 'database-list-separator';
      databaseList.appendChild(separator);
      
      // Get current server's databases that are already added
      const server = connections.find(s => s.id === serverId);
      const addedDatabases = new Set(server?.databases?.map(db => db.name) || []);

      // List available databases (not yet added)
      // result.databases is an array of strings (database names)
      const databases = result.databases || [];
      databases.forEach(dbName => {
        if (!dbName || typeof dbName !== 'string') return; // Skip invalid entries
        if (addedDatabases.has(dbName)) return; // Skip already added databases
        
        const item = document.createElement('div');
        item.className = 'database-item';
        item.innerHTML = `
          <div class="database-name">${dbName}</div>
          <button class="btn-secondary btn-sm" onclick="addDatabaseToConnections('${serverId}', '${dbName}')">
            Add
          </button>
        `;
        databaseList.appendChild(item);
      });
      
      showDatabaseListModal(databaseList);
    } else {
      showNotification(result.error || 'Failed to list databases', 'error');
    }
  } catch (error) {
    console.error('Error listing databases:', error);
    showNotification('Failed to list databases', 'error');
  }
}

async function createNewDatabase(serverId) {
  console.log('[DEBUG] createNewDatabase called with serverId:', serverId);
  const input = document.getElementById('newDatabaseName');
  console.log('[DEBUG] input element:', input);
  const databaseName = input.value.trim();
  console.log('[DEBUG] databaseName:', databaseName);
  
  if (!databaseName) {
    console.log('[DEBUG] No database name provided');
    showNotification('Please enter a database name', 'error');
    return;
  }
  
  // Get popover elements
  const downloadPopover = document.getElementById('downloadPopover');
  const downloadTitle = document.getElementById('downloadTitle');
  const downloadSubtitle = document.getElementById('downloadSubtitle');
  
  try {
    // Show loading popover
    downloadTitle.textContent = 'Creating Database';
    downloadSubtitle.textContent = `Creating ${databaseName}...`;
    downloadPopover.classList.remove('hidden');
    
    console.log('[DEBUG] Calling window.api.createDatabase with:', { serverId, databaseName });
    const result = await window.api.createDatabase(serverId, databaseName);
    console.log('[DEBUG] createDatabase result:', result);
    
    // Hide loading popover
    downloadPopover.classList.add('hidden');
    
    if (result.success) {
      showNotification('Database created successfully', 'success');
      // Clear the input
      input.value = '';
      // Hide the form
      hideCreateDatabaseForm();
      // Reload connections to reflect the new database
      await loadConnections();
      // Check if we're in the add database modal and refresh it
      const modal = document.getElementById('addDatabaseModal');
      if (modal && !modal.classList.contains('hidden')) {
        // Refresh the modal to show updated list
        await openAddDatabaseModal(serverId);
      }
    } else {
      showNotification(result.error || 'Failed to create database', 'error');
    }
  } catch (error) {
    // Hide loading popover
    downloadPopover.classList.add('hidden');
    console.error('Error creating database:', error);
    showNotification('Failed to create database', 'error');
  }
}

async function addDatabaseToConnections(serverId, databaseName) {
  try {
    const result = await window.api.addExistingDatabase(serverId, databaseName);
    
    if (result.success) {
      showNotification(`Database "${databaseName}" added successfully`, 'success');
      // Refresh the connections list
      loadConnections();
      // Close the modal
      const modal = document.querySelector('.modal');
      if (modal) {
        modal.remove();
      }
    } else {
      showNotification(result.error || 'Failed to add database', 'error');
    }
  } catch (error) {
    console.error('Error adding database to connections:', error);
    showNotification('Failed to add database', 'error');
  }
}

function showCreateDatabaseForm(serverId) {
  console.log('[DEBUG] showCreateDatabaseForm called with serverId:', serverId);
  const createButton = document.getElementById('createDatabaseButton');
  const createForm = document.getElementById('createDatabaseForm');
  console.log('[DEBUG] createButton:', createButton, 'createForm:', createForm);
  if (createButton && createForm) {
    createButton.classList.add('hidden');
    createForm.classList.remove('hidden');
    document.getElementById('newDatabaseName')?.focus();
    console.log('[DEBUG] Form should now be visible');
  } else {
    console.log('[DEBUG] ERROR: Button or form not found!');
  }
}

function hideCreateDatabaseForm() {
  console.log('[DEBUG] hideCreateDatabaseForm called');
  const createButton = document.getElementById('createDatabaseButton');
  const createForm = document.getElementById('createDatabaseForm');
  if (createButton && createForm) {
    createButton.classList.remove('hidden');
    createForm.classList.add('hidden');
    console.log('[DEBUG] Form hidden, button visible');
  }
}

function showDatabaseListModal(content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Available Databases</h2>
        <button class="btn-icon" onclick="hideCreateDatabaseForm(); this.closest('.modal').remove()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2"/>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        ${content.outerHTML}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus the new database input if it exists
  const newDbInput = modal.querySelector('#newDatabaseName');
  if (newDbInput) {
    newDbInput.focus();
  }
}

// DBML Rendering

// Convert database schema to DBML format
function convertSchemaToDBML() {
  if (!currentSchema) return null;
  
  let dbml = `// Database Schema - Auto-generated\n`;
  dbml += `// Generated at: ${new Date().toISOString()}\n\n`;
  
  const foreignKeys = [];
  
  // Process tables
  if (currentSchema.tables) {
    for (const [fullTableName, tableInfo] of Object.entries(currentSchema.tables)) {
      const tableName = tableInfo.name;
      dbml += `Table ${tableName} {\n`;
      
      // Add columns (columns is an array, not an object)
      if (tableInfo.columns && Array.isArray(tableInfo.columns)) {
        for (const colInfo of tableInfo.columns) {
          // Clean up type to extract only the base type
          let cleanType = colInfo.type || colInfo.data_type || 'unknown';
          if (typeof cleanType === 'string') {
            // Extract just the base data type, removing all constraints and modifiers
            // Remove everything after common keywords
            cleanType = cleanType.split(/\s+(NOT|DEFAULT|UNIQUE|CHECK|REFERENCES|CONSTRAINT|COLLATE)/i)[0];
            // Remove precision/length specifications but keep the type name
            cleanType = cleanType.replace(/\([^)]*\)/g, '');
            // Remove any remaining whitespace
            cleanType = cleanType.trim();
            // Extract just the first word (the actual type)
            cleanType = cleanType.split(/\s+/)[0];
            // Remove any special characters that might be left
            cleanType = cleanType.replace(/[^\w]/g, '');
          }
          
          let line = `  ${colInfo.name} ${cleanType}`;
          
          // Add attributes
          const attrs = [];
          if (colInfo.primary_key) attrs.push('pk');
          if (colInfo.unique) attrs.push('unique');
          if (colInfo.nullable === 'NO' || colInfo.nullable === false) attrs.push('not null');
          if (colInfo.default) {
            // Clean up default value
            let defaultVal = colInfo.default.toString();
            defaultVal = defaultVal.replace(/^'|'$/g, '').replace(/::[\w\s]+$/, '');
            if (defaultVal && defaultVal !== 'NULL') {
              attrs.push(`default: ${defaultVal}`);
            }
          }
          
          if (attrs.length > 0) {
            line += ` [${attrs.join(', ')}]`;
          }
          
          dbml += line + '\n';
        }
      }
      
      dbml += '}\n\n';
      
      // Collect foreign keys
      if (tableInfo.foreign_keys && Array.isArray(tableInfo.foreign_keys)) {
        for (const fk of tableInfo.foreign_keys) {
          foreignKeys.push({
            from: tableName,
            fromCol: fk.column_name,
            to: fk.foreign_table_name,
            toCol: fk.foreign_column_name
          });
        }
      }
    }
  }
  
  // Add foreign key relationships
  if (foreignKeys.length > 0) {
    dbml += '// Foreign Key Relationships\n';
    for (const fk of foreignKeys) {
      dbml += `Ref: ${fk.from}.${fk.fromCol} > ${fk.to}.${fk.toCol}\n`;
    }
  }
  
  return dbml;
}

function convertSchemaToSQL() {
  if (!currentSchema) return null;
  
  let sql = `-- Database Schema - Auto-generated\n`;
  sql += `-- Generated at: ${new Date().toISOString()}\n\n`;
  
  const foreignKeys = [];
  
  // Process tables
  if (currentSchema.tables) {
    for (const [fullTableName, tableInfo] of Object.entries(currentSchema.tables)) {
      const schema = tableInfo.schema || 'public';
      const tableName = tableInfo.name;
      const fullName = schema !== 'public' ? `"${schema}"."${tableName}"` : `"${tableName}"`;
      
      sql += `-- Table: ${fullName}\n`;
      sql += `CREATE TABLE ${fullName} (\n`;
      
      const columnDefs = [];
      const primaryKeys = [];
      
      // Add columns
      if (tableInfo.columns && Array.isArray(tableInfo.columns)) {
        for (const colInfo of tableInfo.columns) {
          let colDef = `  "${colInfo.name}" ${colInfo.type || colInfo.data_type || 'TEXT'}`;
          
          // Add NOT NULL constraint
          if (colInfo.nullable === 'NO' || colInfo.nullable === false || colInfo.not_null) {
            colDef += ' NOT NULL';
          }
          
          // Add DEFAULT
          if (colInfo.default && colInfo.default !== 'NULL') {
            colDef += ` DEFAULT ${colInfo.default}`;
          }
          
          // Add UNIQUE
          if (colInfo.unique) {
            colDef += ' UNIQUE';
          }
          
          // Track primary keys
          if (colInfo.primary_key) {
            primaryKeys.push(`"${colInfo.name}"`);
          }
          
          columnDefs.push(colDef);
          
          // Collect foreign keys for later
          if (colInfo.foreign_key) {
            const fk = colInfo.foreign_key;
            foreignKeys.push({
              from: fullName,
              fromCol: colInfo.name,
              to: fk.table,
              toCol: fk.column
            });
          }
        }
      }
      
      // Add column definitions
      sql += columnDefs.join(',\n');
      
      // Add primary key constraint
      if (primaryKeys.length > 0) {
        sql += `,\n  PRIMARY KEY (${primaryKeys.join(', ')})`;
      }
      
      sql += '\n);\n\n';
    }
  }
  
  // Add foreign key constraints
  if (foreignKeys.length > 0) {
    sql += '-- Foreign Key Constraints\n';
    for (const fk of foreignKeys) {
      sql += `ALTER TABLE ${fk.from}\n`;
      sql += `  ADD FOREIGN KEY ("${fk.fromCol}") REFERENCES ${fk.to}("${fk.toCol}");\n\n`;
    }
  }
  
  return sql;
}

// Load schema from connected database and render
async function loadSchemaToDBML() {
  if (!currentConnectionId) {
    showNotification('No database connected', 'warning');
    return;
  }
  
  try {
    // Load schema if not already loaded
    if (!currentSchema || Object.keys(currentSchema.tables || {}).length === 0) {
      const result = await window.api.getDatabaseSchema(currentConnectionId);
      if (result.success) {
        currentSchema = result.schema;
      } else {
        showNotification('Failed to load schema: ' + result.error, 'error');
        return;
      }
    }
    
    // Check which schema type is selected
    const schemaType = document.getElementById('schemaTypeSelect').value;
    
    // Convert schema to the selected format
    let schemaScript;
    if (schemaType === 'sql') {
      schemaScript = convertSchemaToSQL();
    } else {
      schemaScript = convertSchemaToDBML();
    }
    
    if (schemaScript) {
      // Set the editor content
      const editor = document.getElementById('dbmlEditor');
      if (editor) {
        editor.value = schemaScript;
      }
      
      // Auto-render the diagram
      renderDBML();
      showNotification('Schema loaded successfully', 'success');
    } else {
      showNotification('No schema data available', 'warning');
    }
  } catch (error) {
    console.error('Error loading schema:', error);
    showNotification('Error loading schema: ' + error.message, 'error');
  }
}

function renderDBML() {
  const dbmlScript = document.getElementById('dbmlEditor').value;
  const schemaType = document.getElementById('schemaTypeSelect').value;
  const canvas = document.getElementById('dbmlCanvas');
  const viewport = document.getElementById('dbmlViewport');
  
  if (!dbmlScript.trim()) {
    if (viewport) {
      const schemaName = schemaType === 'sql' ? 'SQL DDL' : 'DBML';
      viewport.innerHTML = `<div class="no-results">Enter ${schemaName} script and click Render</div>`;
    }
    return;
  }
  
  try {
    let parsed;
    
    if (schemaType === 'sql') {
      parsed = parseSQL(dbmlScript);
    } else {
      parsed = parseDBML(dbmlScript);
    }
    
    dbmlTables = parsed.tables;
    dbmlRelationships = parsed.relationships;
    
    renderDBMLDiagram();
    showNotification('Diagram rendered successfully', 'success');
  } catch (error) {
    console.error('Parse Error:', error);
    if (viewport) {
      const schemaName = schemaType === 'sql' ? 'SQL DDL' : 'DBML';
      viewport.innerHTML = `<div class="no-results" style="color: var(--error);">Error parsing ${schemaName}: ${error.message}</div>`;
    }
    showNotification(`Error parsing ${schemaType.toUpperCase()}`, 'error');
  }
}

function parseDBML(script) {
  const tables = [];
  const relationships = [];
  
  const lines = script.split('\n').map(l => l.trim());
  let currentTable = null;
  
  console.log('Parsing DBML with', lines.length, 'lines');
  
  for (let line of lines) {
    if (line.startsWith('//') || !line) continue;
    
    if (line.startsWith('Table ')) {
      const name = line.match(/Table\s+(\w+)/)?.[1];
      if (name) {
        currentTable = { name, columns: [], x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 };
        tables.push(currentTable);
        console.log('Found table:', name);
      }
    } else if (line.startsWith('Ref:')) {
      // Handle separate Ref: statements
      // Format: Ref: table1.column > table2.column or Ref: table1.column - table2.column
      const refMatch = line.match(/Ref:\s*([^.\s]+)\.([^>\s-]+)\s*([>-])\s*([^.\s]+)\.([^\s]+)/);
      if (refMatch) {
        const [, fromTable, fromCol, direction, toTable, toCol] = refMatch;
        relationships.push({
          from: fromTable,
          fromCol: fromCol,
          to: toTable,
          toCol: toCol,
          direction: direction
        });
        console.log('Found separate relationship:', fromTable, '->', toTable);
      }
    } else if (currentTable && line.match(/^\w+\s+\w+/)) {
      // Handle column definitions with complex attributes
      // Updated regex to handle types with spaces, parentheses, and special chars
      const match = line.match(/(\w+)\s+([\w()\[\],\s]+?)(\s+\[([^\]]*)\])?$/);
      if (match) {
        const [, name, rawType, , attrs] = match;
        // Clean the type: remove trailing spaces and extract base type only
        const type = rawType.trim().split(/\s+/)[0];
        const column = {
          name,
          type,
          isPK: attrs?.includes('pk') || attrs?.includes('primary key'),
          isFK: false,
          isUnique: attrs?.includes('unique'),
          notNull: attrs?.includes('not null'),
          defaultValue: attrs?.match(/default:\s*([^,\]]+)/)?.[1]
        };
        
        // Handle inline reference syntax: ref: > table.column or ref: > table.column, not null
        const refMatch = attrs?.match(/ref:\s*([><])\s*([^\s,\]]+)\.([^\s,\]]+)/);
        if (refMatch) {
          const [, dir, refTable, refCol] = refMatch;
          column.isFK = true;
          relationships.push({
            from: currentTable.name,
            fromCol: name,
            to: refTable,
            toCol: refCol,
            direction: dir
          });
          console.log('Found inline relationship:', currentTable.name, '->', refTable);
        }
        
        currentTable.columns.push(column);
      }
    } else if (line === '}') {
      currentTable = null;
    }
  }
  
  console.log('Parsed', tables.length, 'tables and', relationships.length, 'relationships');
  
  // Mark foreign key columns based on relationships
  relationships.forEach(rel => {
    const fromTable = tables.find(t => t.name === rel.from);
    if (fromTable) {
      const column = fromTable.columns.find(c => c.name === rel.fromCol);
      if (column) {
        column.isFK = true;
      }
    }
  });
  
  return { tables, relationships };
}

function parseSQL(script) {
  const tables = [];
  const relationships = [];
  
  // Remove comments (both -- and /* */ style)
  let cleanedScript = script.replace(/--[^\n]*/g, '');
  cleanedScript = cleanedScript.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Extract CREATE TABLE statements (case-insensitive, multiline)
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([\s\S]*?)\);/gi;
  const alterTableRegex = /ALTER\s+TABLE\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([^)]+)\)/gi;
  
  let match;
  
  // Parse CREATE TABLE statements
  while ((match = tableRegex.exec(cleanedScript)) !== null) {
    const schema = match[1];
    const tableName = match[2];
    const columnsText = match[3];
    
    const table = {
      name: tableName,
      columns: [],
      x: Math.random() * 400 + 50,
      y: Math.random() * 400 + 50
    };
    
    // Split columns by comma (but not inside parentheses)
    const columnLines = splitByComma(columnsText);
    
    for (let columnLine of columnLines) {
      columnLine = columnLine.trim();
      
      // Skip CONSTRAINT definitions at table level
      if (/^CONSTRAINT\s+/i.test(columnLine)) {
        // Handle FOREIGN KEY constraint
        const fkMatch = columnLine.match(/CONSTRAINT\s+\w+\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([^)]+)\)/i);
        if (fkMatch) {
          const fromCols = fkMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
          const toTable = fkMatch[3];
          const toCols = fkMatch[4].split(',').map(c => c.trim().replace(/"/g, ''));
          
          fromCols.forEach((fromCol, idx) => {
            relationships.push({
              from: tableName,
              fromCol: fromCol,
              to: toTable,
              toCol: toCols[idx] || toCols[0],
              direction: '>'
            });
          });
        }
        continue;
      }
      
      // Skip PRIMARY KEY, FOREIGN KEY, UNIQUE constraints at table level (without CONSTRAINT keyword)
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s*\()/i.test(columnLine)) {
        // Handle inline FOREIGN KEY
        const fkMatch = columnLine.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([^)]+)\)/i);
        if (fkMatch) {
          const fromCols = fkMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
          const toTable = fkMatch[3];
          const toCols = fkMatch[4].split(',').map(c => c.trim().replace(/"/g, ''));
          
          fromCols.forEach((fromCol, idx) => {
            relationships.push({
              from: tableName,
              fromCol: fromCol,
              to: toTable,
              toCol: toCols[idx] || toCols[0],
              direction: '>'
            });
          });
        }
        continue;
      }
      
      // Parse column definition
      // Match: column_name data_type[(precision)] [constraints...]
      const columnMatch = columnLine.match(/^"?(\w+)"?\s+([\w\s()]+?)(\s+.*)?$/i);
      if (columnMatch) {
        const colName = columnMatch[1];
        let dataType = columnMatch[2].trim();
        const constraints = columnMatch[3] || '';
        
        // Clean up data type - remove extra spaces
        dataType = dataType.replace(/\s+/g, ' ').trim();
        
        const column = {
          name: colName,
          type: dataType,
          isPK: /PRIMARY\s+KEY/i.test(constraints),
          isFK: false,
          isUnique: /UNIQUE/i.test(constraints),
          notNull: /NOT\s+NULL/i.test(constraints),
          defaultValue: constraints.match(/DEFAULT\s+([^,\s]+(?:\s+[^,\s]+)*)/i)?.[1]?.trim()
        };
        
        // Check for inline REFERENCES
        const refMatch = constraints.match(/REFERENCES\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([^)]+)\)/i);
        if (refMatch) {
          const toTable = refMatch[2];
          const toCol = refMatch[3].trim().replace(/"/g, '');
          
          column.isFK = true;
          relationships.push({
            from: tableName,
            fromCol: colName,
            to: toTable,
            toCol: toCol,
            direction: '>'
          });
        }
        
        table.columns.push(column);
      }
    }
    
    if (table.columns.length > 0) {
      tables.push(table);
      console.log(`Parsed table: ${tableName} with ${table.columns.length} columns`);
    }
  }
  
  // Parse ALTER TABLE ADD FOREIGN KEY statements
  while ((match = alterTableRegex.exec(cleanedScript)) !== null) {
    const fromSchema = match[1];
    const fromTable = match[2];
    const fromCols = match[3].split(',').map(c => c.trim().replace(/"/g, ''));
    const toSchema = match[4];
    const toTable = match[5];
    const toCols = match[6].split(',').map(c => c.trim().replace(/"/g, ''));
    
    fromCols.forEach((fromCol, idx) => {
      relationships.push({
        from: fromTable,
        fromCol: fromCol,
        to: toTable,
        toCol: toCols[idx] || toCols[0],
        direction: '>'
      });
      
      // Mark the column as FK
      const table = tables.find(t => t.name === fromTable);
      if (table) {
        const column = table.columns.find(c => c.name === fromCol);
        if (column) {
          column.isFK = true;
        }
      }
    });
  }
  
  // Mark FK columns based on relationships
  relationships.forEach(rel => {
    const table = tables.find(t => t.name === rel.from);
    if (table) {
      const column = table.columns.find(c => c.name === rel.fromCol);
      if (column) {
        column.isFK = true;
      }
    }
  });
  
  console.log('Parsed SQL:', tables.length, 'tables and', relationships.length, 'relationships');
  
  return { tables, relationships };
}

// Helper function to split by comma while respecting parentheses
function splitByComma(text) {
  const parts = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = null;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : null;
    
    // Handle string literals (both single and double quotes)
    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
      current += char;
    } else if (inString) {
      current += char;
    } else if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    parts.push(current.trim());
  }
  
  return parts;
}

function renderDBMLDiagram() {
  const canvas = document.getElementById('dbmlCanvas');
  const viewport = document.getElementById('dbmlViewport');
  
  if (!viewport) {
    console.error('DBML viewport not found');
    return;
  }
  
  // Clear viewport content
  viewport.innerHTML = '';
  viewport.style.position = 'relative';
  viewport.style.minHeight = '600px';
  
  // Create SVG for relationship lines
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '1';
  svg.style.overflow = 'visible';
  viewport.appendChild(svg);
  
  // Auto-arrange tables to avoid overlapping
  arrangeTablesGrid(dbmlTables);
  
  // Render tables
  dbmlTables.forEach(table => {
    const card = createTableCard(table);
    viewport.appendChild(card);
  });
  
  // Render relationships
  setTimeout(() => renderRelationships(svg), 100);
}

function arrangeTablesGrid(tables) {
  const tableWidth = 250;
  const tableHeight = 200;
  const padding = 50;
  const cols = Math.ceil(Math.sqrt(tables.length));
  
  tables.forEach((table, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    table.x = col * (tableWidth + padding) + padding;
    table.y = row * (tableHeight + padding) + padding;
  });
}

function createTableCard(table) {
  const card = document.createElement('div');
  card.className = 'db-table-card';
  card.style.left = table.x + 'px';
  card.style.top = table.y + 'px';
  card.dataset.tableName = table.name;
  
  let html = `<div class="db-table-header">📋 ${table.name}</div><div class="db-table-body">`;
  
  table.columns.forEach(col => {
    let key = '';
    if (col.isPK) {
      key = '<span class="column-key" data-key="PK">PK</span>';
    } else if (col.isFK) {
      key = '<span class="column-key" data-key="FK">FK</span>';
    }
    
    let attributes = '';
    if (col.notNull) attributes += ' NOT NULL';
    if (col.isUnique) attributes += ' UNIQUE';
    if (col.defaultValue) attributes += ` DEFAULT ${col.defaultValue}`;
    
    html += `
      <div class="db-table-column">
        <span class="column-name">${col.name}${key}</span>
        <span class="column-type">${col.type}${attributes}</span>
      </div>
    `;
  });
  
  html += '</div>';
  card.innerHTML = html;
  
  // Make draggable
  makeDraggable(card, table);
  
  return card;
}

function makeDraggable(element, table) {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  
  element.addEventListener('mousedown', (e) => {
    if (e.target.closest('.db-table-header')) {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(element.style.left);
      startTop = parseInt(element.style.top);
      element.classList.add('dragging');
      e.preventDefault();
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = (e.clientX - startX) / dbmlZoom;
      const dy = (e.clientY - startY) / dbmlZoom;
      const newLeft = startLeft + dx;
      const newTop = startTop + dy;
      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
      table.x = newLeft;
      table.y = newTop;
      
      // Update relationship lines
      const svg = document.querySelector('.dbml-viewport svg');
      if (svg) renderRelationships(svg);
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.classList.remove('dragging');
    }
  });
}

function renderRelationships(svg) {
  svg.innerHTML = '';
  
  dbmlRelationships.forEach(rel => {
    const fromCard = document.querySelector(`[data-table-name="${rel.from}"]`);
    const toCard = document.querySelector(`[data-table-name="${rel.to}"]`);
    
    if (fromCard && toCard) {
      // Use direct position from table data instead of getBoundingClientRect
      const fromTable = dbmlTables.find(t => t.name === rel.from);
      const toTable = dbmlTables.find(t => t.name === rel.to);
      
      if (!fromTable || !toTable) return;
      
      // Get actual card dimensions
      const fromWidth = fromCard.offsetWidth;
      const fromHeight = fromCard.offsetHeight;
      const toWidth = toCard.offsetWidth;
      const toHeight = toCard.offsetHeight;
      
      // Calculate edge connection points using table positions
      const fromEdge = getTableEdgePointFromPosition(
        fromTable.x, fromTable.y, fromWidth, fromHeight,
        toTable.x, toTable.y, toWidth, toHeight
      );
      const toEdge = getTableEdgePointFromPosition(
        toTable.x, toTable.y, toWidth, toHeight,
        fromTable.x, fromTable.y, fromWidth, fromHeight
      );
      
      // Create the line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', fromEdge.x);
      line.setAttribute('y1', fromEdge.y);
      line.setAttribute('x2', toEdge.x);
      line.setAttribute('y2', toEdge.y);
      line.setAttribute('stroke', '#007acc');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '0.7');
      line.setAttribute('stroke-dasharray', '5,3');
      
      svg.appendChild(line);
    }
  });
}

function getTableEdgePoint(fromRect, toRect, canvasRect) {
  const fromX = fromRect.left + fromRect.width / 2 - canvasRect.left;
  const fromY = fromRect.top + fromRect.height / 2 - canvasRect.top;
  const toX = toRect.left + toRect.width / 2 - canvasRect.left;
  const toY = toRect.top + toRect.height / 2 - canvasRect.top;
  
  const fromLeft = fromRect.left - canvasRect.left;
  const fromRight = fromRect.right - canvasRect.left;
  const fromTop = fromRect.top - canvasRect.top;
  const fromBottom = fromRect.bottom - canvasRect.top;
  
  // Calculate direction vector
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  // Determine which edge to connect to based on direction
  let x, y;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection preferred
    if (dx > 0) {
      // Connect to right edge
      x = fromRight;
      y = fromY;
    } else {
      // Connect to left edge
      x = fromLeft;
      y = fromY;
    }
  } else {
    // Vertical connection preferred
    if (dy > 0) {
      // Connect to bottom edge
      x = fromX;
      y = fromBottom;
    } else {
      // Connect to top edge
      x = fromX;
      y = fromTop;
    }
  }
  
  return { x, y };
}

function getTableEdgePointFromPosition(x, y, width, height, toX, toY, toWidth, toHeight) {
  // Calculate centers
  const fromCenterX = x + width / 2;
  const fromCenterY = y + height / 2;
  const toCenterX = toX + toWidth / 2;
  const toCenterY = toY + toHeight / 2;
  
  // Calculate direction vector
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  
  // Determine which edge to connect to based on direction
  let edgeX, edgeY;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection preferred
    if (dx > 0) {
      // Connect to right edge
      edgeX = x + width;
      edgeY = fromCenterY;
    } else {
      // Connect to left edge
      edgeX = x;
      edgeY = fromCenterY;
    }
  } else {
    // Vertical connection preferred
    if (dy > 0) {
      // Connect to bottom edge
      edgeX = fromCenterX;
      edgeY = y + height;
    } else {
      // Connect to top edge
      edgeX = fromCenterX;
      edgeY = y;
    }
  }
  
  return { x: edgeX, y: edgeY };
}

// Toggle Sidebar and Database Browser
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const showBtn = document.getElementById('showSidebarBtn');
  const icon = toggleBtn?.querySelector('svg');
  
  if (!sidebar) return;
  
  sidebar.classList.toggle('hidden');
  
  // Save collapsed state
  const isHidden = sidebar.classList.contains('hidden');
  localStorage.setItem('sidebarCollapsed', isHidden ? 'true' : 'false');
  
  // Show/hide the show button in the title bar
  if (isHidden) {
    if (icon) icon.style.transform = 'rotate(-90deg)';
    if (showBtn) showBtn.classList.remove('hidden');
  } else {
    if (icon) icon.style.transform = 'rotate(0deg)';
    if (showBtn) showBtn.classList.add('hidden');
  }
}

function toggleDBBrowser() {
  const dbBrowser = document.getElementById('dbBrowser');
  const toggleBtn = document.getElementById('toggleDBBrowserBtn');
  const showBtn = document.getElementById('showDBBrowserBtn');
  const icon = toggleBtn?.querySelector('svg');
  
  if (!dbBrowser) return;
  
  dbBrowser.classList.toggle('hidden');
  
  // Save collapsed state
  const isHidden = dbBrowser.classList.contains('hidden');
  localStorage.setItem('dbBrowserCollapsed', isHidden ? 'true' : 'false');
  
  // Show/hide the show button in the AI prompt bar
  if (isHidden) {
    if (icon) icon.style.transform = 'rotate(-90deg)';
    if (showBtn) showBtn.classList.remove('hidden');
  } else {
    if (icon) icon.style.transform = 'rotate(0deg)';
    if (showBtn) showBtn.classList.add('hidden');
  }
}

// Line Numbers
function updateLineNumbers() {
  const lineNumbers = document.getElementById('lineNumbers');
  if (!lineNumbers) return;
  
  const lines = queryEditor.value.split('\n').length;
  const lineNumbersArray = [];
  
  for (let i = 1; i <= lines; i++) {
    lineNumbersArray.push(i);
  }
  
  lineNumbers.innerHTML = lineNumbersArray.join('\n');
}

// Helper to strip HTML tags from text (safety measure)
function stripHTML(text) {
  if (!text) return '';
  // Create a temporary element and use textContent to strip HTML
  const temp = document.createElement('div');
  temp.innerHTML = text;
  return temp.textContent || temp.innerText || '';
}

// SQL Syntax Highlighting
function highlightSQL(sql) {
  if (!sql) return '';
  
  // Escape special HTML characters first
  let escaped = sql.replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;');
  
  // Highlight SQL comments (-- style) - must be done before other highlights
  // Match from -- to end of line
  escaped = escaped.replace(/(--[^\n]*)/g, '<span class="sql-comment">$1</span>');
  
  // Highlight shortcuts {{shortcut}} or {{shortcut(args)}} with placeholder detection
  escaped = escaped.replace(/\{\{([^}]+)\}\}/g, (match, content) => {
    // Check if it's a parameterized call: shortcut(args)
    const paramMatch = content.match(/^([A-Za-z0-9_]+)\s*\(([^)]*)\)$/);
    
    if (paramMatch) {
      const shortcut = paramMatch[1];
      const argsText = paramMatch[2];
      const snippet = snippets.find(s => s.shortcut === shortcut);
      
      if (snippet) {
        // Count unique {key_name} and ? placeholders in snippet query
        const namedMatches = snippet.query.matchAll(/\{[^}]+\}/g);
        const uniqueNamedPlaceholders = new Set();
        for (const match of namedMatches) {
          uniqueNamedPlaceholders.add(match[0]);
        }
        const namedPlaceholderCount = uniqueNamedPlaceholders.size;
        const questionPlaceholderCount = (snippet.query.match(/\?/g) || []).length;
        const totalPlaceholderCount = namedPlaceholderCount + questionPlaceholderCount;
        
        // Count provided args
        const args = argsText.split(',').map(a => a.trim()).filter(a => a.length > 0);
        const hasUnfilledPlaceholders = args.length < totalPlaceholderCount;
        
        const warningIcon = hasUnfilledPlaceholders ? 
          '<span class="placeholder-warning" title="Missing placeholder values">⚠️</span>' : '';
        
        return `<span class="sql-shortcut clickable-shortcut" data-shortcut="${shortcut}" data-args="${argsText.replace(/"/g, '&quot;')}" data-has-params="true">{{${content}}}${warningIcon}</span>`;
      }
    }
    
    // Check if it's a simple shortcut that has placeholders
    const snippet = snippets.find(s => s.shortcut === content);
    if (snippet) {
      const namedMatches = snippet.query.matchAll(/\{[^}]+\}/g);
      const uniqueNamedPlaceholders = new Set();
      for (const match of namedMatches) {
        uniqueNamedPlaceholders.add(match[0]);
      }
      const namedPlaceholderCount = uniqueNamedPlaceholders.size;
      const questionPlaceholderCount = (snippet.query.match(/\?/g) || []).length;
      const totalPlaceholderCount = namedPlaceholderCount + questionPlaceholderCount;
      
      if (totalPlaceholderCount > 0) {
        const warningIcon = '<span class="placeholder-warning" title="Missing placeholder values">⚠️</span>';
        
        return `<span class="sql-shortcut clickable-shortcut" data-shortcut="${content}" data-args="" data-has-params="true">{{${content}}}${warningIcon}</span>`;
      }
    }
    
    return `<span class="sql-shortcut">{{${content}}}</span>`;
  });
  
  // Highlight SQL keywords (but not if they're inside comment spans)
  escaped = escaped.replace(/\b(SELECT|FROM|WHERE|LIMIT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|VIEW|INDEX|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|AS|AND|OR|NOT|NULL|IS|IN|BETWEEN|LIKE|ORDER|BY|GROUP|HAVING|DISTINCT|UNION|ALL|CASE|WHEN|THEN|ELSE|END)\b/gi, (match) => {
    // Check if this match is inside a comment span
    return `<span class="sql-keyword">${match}</span>`;
  });
  
  return escaped;
}

function updateSyntaxHighlight() {
  const syntaxHighlight = document.getElementById('syntaxHighlight');
  if (!syntaxHighlight || !queryEditor) return;
  
  const sql = queryEditor.value;
  const highlighted = highlightSQL(sql);
  
  console.log('SQL to highlight:', sql.substring(0, 100));
  console.log('Highlighted HTML:', highlighted.substring(0, 200));
  
  syntaxHighlight.innerHTML = highlighted;
  
  // Add click handlers to clickable shortcuts
  const clickableShortcuts = syntaxHighlight.querySelectorAll('.clickable-shortcut');
  clickableShortcuts.forEach(element => {
    element.style.cursor = 'pointer';
    element.addEventListener('click', handleShortcutClick);
  });
  
  // Sync scroll position
  syntaxHighlight.scrollTop = queryEditor.scrollTop;
  syntaxHighlight.scrollLeft = queryEditor.scrollLeft;
}

// Handle click on shortcut with placeholders
function handleShortcutClick(event) {
  event.stopPropagation();
  const element = event.currentTarget;
  const shortcut = element.dataset.shortcut;
  const argsText = element.dataset.args || '';
  
  const snippet = snippets.find(s => s.shortcut === shortcut);
  if (!snippet) return;
  
  // Extract placeholder names from {key_name} and count ? placeholders (supports any characters)
  const namedPlaceholders = [];
  const namedMatches = snippet.query.matchAll(/\{([^}]+)\}/g);
  const seenPlaceholders = new Set();
  for (const match of namedMatches) {
    // Only add unique placeholder names
    if (!seenPlaceholders.has(match[1])) {
      namedPlaceholders.push(match[1]);
      seenPlaceholders.add(match[1]);
    }
  }
  
  const questionPlaceholderCount = (snippet.query.match(/\?/g) || []).length;
  
  // Add generic names for ? placeholders
  for (let i = 0; i < questionPlaceholderCount; i++) {
    namedPlaceholders.push(`param_${i + 1}`);
  }
  
  if (namedPlaceholders.length === 0) return;
  
  // Parse current args
  const currentArgs = argsText.split(',').map(a => a.trim());
  
  // Show popover
  showPlaceholderPopover(element, snippet, currentArgs, namedPlaceholders);
}

// Show popover for editing placeholder values
function showPlaceholderPopover(element, snippet, currentArgs, placeholderNames) {
  // Remove existing popover
  const existingPopover = document.getElementById('placeholderPopover');
  if (existingPopover) {
    existingPopover.remove();
  }
  
  // Create popover
  const popover = document.createElement('div');
  popover.id = 'placeholderPopover';
  popover.className = 'placeholder-popover';
  
  let html = `
    <div class="placeholder-popover-header">
      <div>
        <strong>${snippet.name}</strong>
        <div class="placeholder-popover-shortcut">{{${snippet.shortcut}}}</div>
      </div>
      <button class="btn-icon" onclick="document.getElementById('placeholderPopover').remove()">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </div>
    <div class="placeholder-popover-body">
      <div class="placeholder-section">
        <label class="placeholder-section-label">Query Preview:</label>
        <div class="placeholder-preview-query" id="placeholderPreview"></div>
      </div>
      <div class="placeholder-inputs">
  `;
  
  for (let i = 0; i < placeholderNames.length; i++) {
    const value = currentArgs[i] || '';
    const placeholderName = placeholderNames[i];
    html += `
      <div class="placeholder-input-row">
        <label>${placeholderName}:</label>
        <input type="text" class="placeholder-input" data-index="${i}" value="${value.replace(/"/g, '&quot;')}" placeholder="Enter value for ${placeholderName}">
      </div>
    `;
  }
  
  html += `
      </div>
      <div class="placeholder-popover-actions">
        <button class="btn-secondary" onclick="document.getElementById('placeholderPopover').remove()">Cancel</button>
        <button class="btn-primary" onclick="applyPlaceholderValues('${snippet.shortcut}')">Apply</button>
      </div>
    </div>
  `;
  
  popover.innerHTML = html;
  
  // Position popover fixed to viewport, near the clicked element
  const rect = element.getBoundingClientRect();
  
  popover.style.position = 'fixed';
  popover.style.left = `${rect.left + 20}px`;
  popover.style.top = `${rect.bottom + 5}px`;
  popover.style.zIndex = '10000';
  
  // Adjust position if it goes off screen
  document.body.appendChild(popover);
  
  // Check if popover goes off right edge
  setTimeout(() => {
    const popoverRect = popover.getBoundingClientRect();
    if (popoverRect.right > window.innerWidth) {
      popover.style.left = `${window.innerWidth - popoverRect.width - 20}px`;
    }
    // Check if popover goes off bottom edge
    if (popoverRect.bottom > window.innerHeight) {
      popover.style.top = `${rect.top - popoverRect.height - 5}px`;
    }
  }, 10);
  
  // Add event listeners to all inputs for live preview
  const inputs = popover.querySelectorAll('.placeholder-input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      updatePlaceholderPreview(snippet.query);
    });
    
    // Add Enter key handler to apply values
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyPlaceholderValues(snippet.shortcut);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        popover.remove();
      }
    });
  });
  
  // Initial preview update
  updatePlaceholderPreview(snippet.query);
  
  // Focus first input
  setTimeout(() => {
    const firstInput = popover.querySelector('.placeholder-input');
    if (firstInput) firstInput.focus();
  }, 50);
}

// Update the preview query as user types
function updatePlaceholderPreview(originalQuery) {
  const previewElement = document.getElementById('placeholderPreview');
  if (!previewElement) return;
  
  const inputs = document.querySelectorAll('.placeholder-input');
  const values = Array.from(inputs).map(input => input.value.trim());
  
  let preview = originalQuery;
  let argIndex = 0;
  
  // Replace {key_name} placeholders first (supports any characters including spaces)
  preview = preview.replace(/\{([^}]+)\}/g, (match, keyName) => {
    if (argIndex < values.length && values[argIndex]) {
      const value = values[argIndex];
      argIndex++;
      return `<span class="preview-value">${value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
    } else {
      argIndex++;
      return `<span class="preview-missing">{${keyName}}</span>`;
    }
  });
  
  // Then replace ? placeholders
  preview = preview.replace(/\?/g, () => {
    if (argIndex < values.length && values[argIndex]) {
      const value = values[argIndex];
      argIndex++;
      return `<span class="preview-value">${value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
    } else {
      argIndex++;
      return '<span class="preview-missing">?</span>';
    }
  });
  
  previewElement.innerHTML = preview;
}

// Apply placeholder values from popover
function applyPlaceholderValues(shortcut) {
  const popover = document.getElementById('placeholderPopover');
  if (!popover) return;
  
  const inputs = popover.querySelectorAll('.placeholder-input');
  const values = Array.from(inputs).map(input => input.value.trim());
  
  // Find the shortcut in the query editor and replace it
  const query = queryEditor.value;
  const pattern = new RegExp(`\\{\\{${shortcut}(?:\\([^)]*\\))?\\}\\}`, 'g');
  
  const newShortcut = values.length > 0 && values.some(v => v) ? 
    `{{${shortcut}(${values.join(', ')})}}` : 
    `{{${shortcut}}}`;
  
  const newQuery = query.replace(pattern, newShortcut);
  
  queryEditor.value = newQuery;
  updateLineNumbers();
  updateSyntaxHighlight();
  
  popover.remove();
  showNotification('Placeholder values updated', 'success');
}

// Autocomplete for Shortcuts and SQL Tables/Views
function handleAutocomplete() {
  const cursorPos = queryEditor.selectionStart;
  const textBeforeCursor = queryEditor.value.substring(0, cursorPos);
  
  // Check if we're typing a shortcut ({{)
  const shortcutMatch = textBeforeCursor.match(/\{\{([^}]*)$/);
  
  if (shortcutMatch) {
    const searchTerm = shortcutMatch[1].toLowerCase();
    showShortcutAutocomplete(searchTerm, cursorPos);
    return;
  }
  
  // Check if we're after SQL keywords that expect table/view names
  const sqlKeywords = /\b(FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|UPDATE|INTO|TABLE)\s+(\w*)$/i;
  const sqlMatch = textBeforeCursor.match(sqlKeywords);
  
  if (sqlMatch && currentTablesAndViews.length > 0) {
    const searchTerm = sqlMatch[2].toLowerCase();
    showTableAutocomplete(searchTerm, cursorPos);
    return;
  }
  
  hideAutocomplete();
}

function showShortcutAutocomplete(searchTerm, cursorPos) {
  const popover = document.getElementById('autocompletePopover');
  const list = document.getElementById('autocompleteList');
  
  // Get matching snippets and variables
  const matchingSnippets = snippets.filter(s => 
    s.shortcut.toLowerCase().includes(searchTerm)
  );
  const matchingVariables = variables.filter(v => 
    v.shortcut.toLowerCase().includes(searchTerm)
  );
  
  const allMatches = [
    ...matchingSnippets.map(s => ({ ...s, type: 'snippet' })),
    ...matchingVariables.map(v => ({ ...v, type: 'variable' }))
  ];
  
  if (allMatches.length === 0) {
    hideAutocomplete();
    return;
  }
  
  // Build autocomplete list
  list.innerHTML = '';
  allMatches.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    if (index === 0) div.classList.add('selected');
    div.dataset.index = index;
    div.dataset.shortcut = item.shortcut;
    
    const typeLabel = document.createElement('span');
    typeLabel.className = `autocomplete-item-type ${item.type}`;
    typeLabel.textContent = item.type === 'snippet' ? 'SNIP' : 'VAR';
    
    const name = document.createElement('span');
    name.className = 'autocomplete-item-name';
    name.textContent = item.shortcut;
    
    div.appendChild(typeLabel);
    div.appendChild(name);
    
    if (item.description) {
      const desc = document.createElement('span');
      desc.className = 'autocomplete-item-description';
      desc.textContent = item.description;
      div.appendChild(desc);
    }
    
    div.addEventListener('click', () => {
      autocompleteSelectedIndex = index;
      selectAutocompleteItem();
    });
    
    list.appendChild(div);
  });
  
  autocompleteSelectedIndex = 0;
  
  // Position popover
  positionAutocomplete(cursorPos);
  popover.classList.remove('hidden');
}

function showTableAutocomplete(searchTerm, cursorPos) {
  const popover = document.getElementById('autocompletePopover');
  const list = document.getElementById('autocompleteList');
  
  // Filter tables and views based on search term
  const matchingItems = currentTablesAndViews.filter(item => 
    searchTerm === '' || 
    item.name.toLowerCase().includes(searchTerm) ||
    item.fullName.toLowerCase().includes(searchTerm)
  );
  
  if (matchingItems.length === 0) {
    hideAutocomplete();
    return;
  }
  
  // Build autocomplete list
  list.innerHTML = '';
  matchingItems.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    if (index === 0) div.classList.add('selected');
    div.dataset.index = index;
    // For public schema, use just the table name, otherwise use fullName
    div.dataset.tableName = item.schema === 'public' ? item.name : item.fullName;
    
    const typeLabel = document.createElement('span');
    typeLabel.className = `autocomplete-item-type ${item.type}`;
    typeLabel.textContent = item.type === 'table' ? 'TBL' : 'VIEW';
    
    const name = document.createElement('span');
    name.className = 'autocomplete-item-name';
    // Show just the table name without schema prefix for public schema
    name.textContent = item.schema === 'public' ? item.name : item.fullName;
    
    div.appendChild(typeLabel);
    div.appendChild(name);
    
    // Add schema info if not public
    if (item.schema !== 'public') {
      const schema = document.createElement('span');
      schema.className = 'autocomplete-item-description';
      schema.textContent = `Schema: ${item.schema}`;
      div.appendChild(schema);
    }
    
    div.addEventListener('click', () => {
      autocompleteSelectedIndex = index;
      selectAutocompleteItem();
    });
    
    list.appendChild(div);
  });
  
  autocompleteSelectedIndex = 0;
  
  // Position popover
  positionAutocomplete(cursorPos);
  popover.classList.remove('hidden');
}

function positionAutocomplete(cursorPos) {
  const popover = document.getElementById('autocompletePopover');
  
  // Get cursor position in pixels (approximate)
  const lineHeight = 22.4; // 14px font-size * 1.6 line-height
  const lines = queryEditor.value.substring(0, cursorPos).split('\n');
  const lineNumber = lines.length;
  const col = lines[lines.length - 1].length;
  
  const top = (lineNumber * lineHeight) - queryEditor.scrollTop + 40;
  const left = (col * 8.4) + 60; // Approximate character width
  
  popover.style.top = `${Math.min(top, 400)}px`;
  popover.style.left = `${Math.min(left, 500)}px`;
}

function navigateAutocomplete(direction) {
  const items = document.querySelectorAll('.autocomplete-item');
  if (items.length === 0) return;
  
  items[autocompleteSelectedIndex]?.classList.remove('selected');
  
  autocompleteSelectedIndex += direction;
  if (autocompleteSelectedIndex < 0) autocompleteSelectedIndex = items.length - 1;
  if (autocompleteSelectedIndex >= items.length) autocompleteSelectedIndex = 0;
  
  items[autocompleteSelectedIndex]?.classList.add('selected');
  items[autocompleteSelectedIndex]?.scrollIntoView({ block: 'nearest' });
}

// Helper function to properly quote PostgreSQL identifiers if needed
function quoteIdentifierIfNeeded(identifier) {
  if (!identifier) return identifier;
  
  // Check if identifier needs quoting:
  // 1. Contains uppercase letters
  // 2. Contains special characters (except underscore)
  // 3. Starts with a number
  
  const needsQuoting = /[A-Z]/.test(identifier) || // Has uppercase
                       /[^a-z0-9_]/.test(identifier) || // Has special chars
                       /^\d/.test(identifier); // Starts with number
  
  // If it's already quoted, return as-is
  if (identifier.startsWith('"') && identifier.endsWith('"')) {
    return identifier;
  }
  
  return needsQuoting ? `"${identifier}"` : identifier;
}

function selectAutocompleteItem() {
  const items = document.querySelectorAll('.autocomplete-item');
  const selected = items[autocompleteSelectedIndex];
  
  if (!selected) return;
  
  const cursorPos = queryEditor.selectionStart;
  const textBeforeCursor = queryEditor.value.substring(0, cursorPos);
  const textAfterCursor = queryEditor.value.substring(cursorPos);
  
  // Check if this is a shortcut selection ({{)
  const shortcutMatch = textBeforeCursor.match(/\{\{([^}]*)$/);
  if (shortcutMatch) {
    const shortcut = selected.dataset.shortcut;
    const matchStart = textBeforeCursor.lastIndexOf('{{');
    // Check if user started typing a parenthesis after the shortcut (e.g. '{{snip(')
    const typedPart = textBeforeCursor.substring(matchStart + 2); // content after '{{'
    if (typedPart.endsWith('(')) {
      // Insert with empty parentheses and place cursor between them: {{shortcut()}}
      const insertText = `{{${shortcut}()}}`;
      const newText = textBeforeCursor.substring(0, matchStart) + insertText + textAfterCursor;
      queryEditor.value = newText;
      // Place cursor between the parentheses
      const caretPos = matchStart + (`{{${shortcut}(`).length;
      queryEditor.selectionStart = queryEditor.selectionEnd = caretPos;
    } else {
      const newText = textBeforeCursor.substring(0, matchStart) + 
                      `{{${shortcut}}}` + 
                      textAfterCursor;
      queryEditor.value = newText;
      queryEditor.selectionStart = queryEditor.selectionEnd = 
        matchStart + `{{${shortcut}}}`.length;
    }
    
    updateLineNumbers();
    updateSyntaxHighlight();
  } 
  // Check if this is a table/view selection
  else {
    const tableName = selected.dataset.tableName;
    
    // Find the SQL keyword and current word
    const sqlKeywords = /\b(FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|UPDATE|INTO|TABLE)\s+(\w*)$/i;
    const sqlMatch = textBeforeCursor.match(sqlKeywords);
    
    if (sqlMatch && tableName) {
      const keywordEnd = textBeforeCursor.lastIndexOf(sqlMatch[2]) || textBeforeCursor.length;
      
      // Properly quote the table name if it contains uppercase or special characters
      const quotedTableName = quoteIdentifierIfNeeded(tableName);
      
      const newText = textBeforeCursor.substring(0, keywordEnd) + 
                      quotedTableName + 
                      textAfterCursor;
      
      queryEditor.value = newText;
      queryEditor.selectionStart = queryEditor.selectionEnd = 
        keywordEnd + quotedTableName.length;
      
      updateLineNumbers();
      updateSyntaxHighlight();
    }
  }
  
  hideAutocomplete();
  queryEditor.focus();
}

function hideAutocomplete() {
  const popover = document.getElementById('autocompletePopover');
  popover.classList.add('hidden');
  autocompleteSelectedIndex = -1;
}

// Shortcut Hover and Tooltip
function handleShortcutHover(event) {
  const textarea = event.target;
  const text = textarea.value;
  
  // Get cursor position from mouse coordinates
  const rect = textarea.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Approximate character position based on mouse coordinates
  const lineHeight = 22.4; // 14px * 1.6 line-height
  const charWidth = 8.4; // Approximate monospace character width
  
  const lineIndex = Math.floor((y + textarea.scrollTop) / lineHeight);
  const colIndex = Math.floor((x - 15) / charWidth); // 15px is padding
  
  const lines = text.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) {
    hideShortcutTooltip();
    return;
  }
  
  const line = lines[lineIndex];
  
  // Find shortcut at this position
  const shortcutRegex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = shortcutRegex.exec(line)) !== null) {
    const startCol = match.index;
    const endCol = match.index + match[0].length;
    
    if (colIndex >= startCol && colIndex < endCol) {
      const shortcutName = match[1];
      showShortcutTooltip(shortcutName, event.clientX, event.clientY);
      return;
    }
  }
  
  hideShortcutTooltip();
}

function showShortcutTooltip(shortcutName, x, y) {
  const tooltip = document.getElementById('shortcutTooltip');
  
  // Find the shortcut in snippets or variables
  const snippet = snippets.find(s => s.shortcut === shortcutName);
  const variable = variables.find(v => v.shortcut === shortcutName);
  
  const item = snippet || variable;
  
  if (!item) {
    hideShortcutTooltip();
    return;
  }
  
  // Show tooltip with content
  let content = `<strong>${item.shortcut}</strong>`;
  if (item.description) {
    content += `<br><span style="color: var(--text-secondary); font-size: 11px;">${item.description}</span>`;
  }
  
  // Snippets have 'query' field, variables have 'content' field
  const displayContent = item.query || item.content || '';
  content += `<br><br><code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 3px; display: block; margin-top: 4px; max-height: 150px; overflow-y: auto;">${displayContent}</code>`;
  
  tooltip.innerHTML = content;
  tooltip.classList.remove('hidden');
  
  // Position tooltip
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y + 20}px`;
  
  // Adjust if tooltip goes off screen
  const rect = tooltip.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    tooltip.style.left = `${window.innerWidth - rect.width - 10}px`;
  }
  if (rect.bottom > window.innerHeight) {
    tooltip.style.top = `${y - rect.height - 10}px`;
  }
}

function hideShortcutTooltip() {
  const tooltip = document.getElementById('shortcutTooltip');
  tooltip.classList.add('hidden');
}

// Cell Content Management
function showCellPopover(event, columnName, fullValue, rowIndex, td) {
  const popover = document.getElementById('cellPopover');
  const header = document.getElementById('cellPopoverHeader');
  const content = document.getElementById('cellPopoverContent');
  
  header.textContent = `Column: ${columnName}`;
  
  // Create editable content area
  const escapedValue = String(fullValue || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/`/g, '\\`');
  const displayValue = String(fullValue || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  content.innerHTML = `
    <div class="cell-popover-view">
      <pre class="cell-content-display">${displayValue}</pre>
      <div class="cell-popover-actions">
        <button class="btn-secondary btn-sm" onclick="copyCellValue(\`${escapedValue}\`, event)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="10" height="10" rx="1"/>
            <path d="M5 1h8a2 2 0 0 1 2 2v8"/>
          </svg>
          Copy
        </button>
        <button class="btn-secondary btn-sm" onclick="startPopoverEdit('${columnName}', ${rowIndex}, \`${escapedValue}\`)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l2 2-8 8-4 1 1-4 8-8z"/>
          </svg>
          Edit
        </button>
        <button class="btn-secondary btn-sm" onclick="hideCellPopover()">Close</button>
      </div>
    </div>
  `;
  
  // Store reference to the cell for editing
  popover.dataset.rowIndex = rowIndex;
  popover.dataset.columnName = columnName;
  popover.dataset.cellElement = td;
  
  popover.classList.remove('hidden');
  
  // Position popover
  const x = event.clientX;
  const y = event.clientY;
  
  popover.style.left = `${x + 10}px`;
  popover.style.top = `${y + 10}px`;
  
  // Adjust if popover goes off screen
  const rect = popover.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    popover.style.left = `${window.innerWidth - rect.width - 10}px`;
  }
  if (rect.bottom > window.innerHeight) {
    popover.style.top = `${y - rect.height - 10}px`;
  }
  
  // Prevent click events inside popover from closing it
  popover.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Hide popover when clicking elsewhere
  setTimeout(() => {
    const handleOutsideClick = (e) => {
      if (!popover.contains(e.target)) {
        hideCellPopover();
      }
    };
    document.addEventListener('click', handleOutsideClick);
    
    // Store the handler so we can remove it later
    popover._handleOutsideClick = handleOutsideClick;
  }, 0);
}

function hideCellPopover() {
  const popover = document.getElementById('cellPopover');
  if (!popover) return;
  
  console.log('Hiding cell popover');
  popover.classList.add('hidden');
  
  // Clear the popover dataset
  popover.dataset.columnName = '';
  popover.dataset.rowIndex = '';
  
  // Remove the outside click listener
  if (popover._handleOutsideClick) {
    document.removeEventListener('click', popover._handleOutsideClick);
    popover._handleOutsideClick = null;
  }
}

// Copy cell value to clipboard
function copyCellValue(value, event) {
  // Unescape the value for proper copying
  const unescapedValue = String(value || '').replace(/\\'/g, "'").replace(/\\`/g, '`');
  
  // Get the button element
  const button = event ? event.currentTarget : null;
  
  navigator.clipboard.writeText(unescapedValue)
    .then(() => {
      showNotification('Cell value copied to clipboard!', 'success');
      
      // Change button text to "Copied"
      if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 8l4 4 8-8"/>
          </svg>
          Copied
        `;
        
        // Reset button text after 2 seconds
        setTimeout(() => {
          button.innerHTML = originalHTML;
        }, 2000);
      }
    })
    .catch(err => {
      console.error('Failed to copy cell value:', err);
      showNotification('Failed to copy to clipboard', 'error');
    });
}

// Start editing in the popover
function startPopoverEdit(columnName, rowIndex, currentValue) {
  console.log('Starting popover edit:', { columnName, rowIndex, currentValue });
  const content = document.getElementById('cellPopoverContent');
  const popover = document.getElementById('cellPopover');
  
  // Update popover dataset
  if (popover) {
    popover.dataset.columnName = columnName;
    popover.dataset.rowIndex = rowIndex;
    console.log('Updated popover dataset:', popover.dataset);
  } else {
    console.error('Popover element not found');
    return;
  }

  const escapedForHTML = String(currentValue || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Create button event handler content and use data attributes instead of inline onclick
  const editContent = `
    <div class="cell-popover-edit">
      <label class="cell-edit-label">Editing: ${columnName}</label>
      <textarea class="cell-edit-textarea" rows="4" cols="40">${escapedForHTML}</textarea>
      <div class="cell-popover-actions">
        <button class="btn-primary btn-sm save-edit-btn" 
                data-column="${columnName}" 
                data-row="${rowIndex}">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 2l-1 1-8 8-4-4 1-1 3 3 7-7z"/>
          </svg>
          Save
        </button>
        <button class="btn-secondary btn-sm cancel-edit-btn" 
                data-column="${columnName}" 
                data-row="${rowIndex}">
          Cancel
        </button>
      </div>
    </div>
  `;

  content.innerHTML = editContent;
  
  // Store original value as a data attribute on the popover itself for easy access
  popover.dataset.originalValue = String(currentValue || '');

  // Add event listeners to the buttons after they're created
  const saveBtn = content.querySelector('.save-edit-btn');
  const cancelBtn = content.querySelector('.cancel-edit-btn');

  if (saveBtn) {
    saveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('Save button clicked');
      try {
        await saveCellEdit();
      } catch (error) {
        console.error('Error in saveCellEdit:', error);
        showNotification('Error saving changes: ' + error.message, 'error');
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('Cancel button clicked');
      cancelCellEdit(columnName, rowIndex, currentValue);
    });
  }

  // Focus the textarea
  const editTextarea = content.querySelector('.cell-edit-textarea');
  if (editTextarea) {
    editTextarea.focus();
    editTextarea.select();
    
    // Handle keyboard shortcuts
    editTextarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        saveCellEdit();
      } else if (e.key === 'Escape') {
        cancelCellEdit(columnName, rowIndex, currentValue);
      }
    });
  }

  console.log('Edit popover created with event listeners');
}

// Make cell popover functions globally accessible
window.showCellPopover = showCellPopover;
window.hideCellPopover = hideCellPopover;
window.startPopoverEdit = startPopoverEdit;
window.cancelCellEdit = cancelCellEdit;
window.saveCellEdit = saveCellEdit;

// Cancel editing and return to view mode
function cancelCellEdit(columnName, rowIndex, originalValue) {
  console.log('cancelCellEdit function called with:', { columnName, rowIndex, originalValue });
  const content = document.getElementById('cellPopoverContent');
  const escapedValue = String(originalValue || '').replace(/'/g, "\\'").replace(/`/g, '\\`');
  const displayValue = String(originalValue || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  content.innerHTML = `
    <div class="cell-popover-view">
      <pre class="cell-content-display">${displayValue}</pre>
      <div class="cell-popover-actions">
        <button class="btn-secondary btn-sm" onclick="startPopoverEdit('${columnName}', ${rowIndex}, \`${escapedValue}\`)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l2 2-8 8-4 1 1-4 8-8z"/>
          </svg>
          Edit
        </button>
        <button class="btn-secondary btn-sm" onclick="hideCellPopover()">Close</button>
      </div>
    </div>
  `;
}

// Save cell edit
async function saveCellEdit() {
    try {
        console.log('=== Starting saveCellEdit ===');
        
        // 1. Get all required elements and data
        const popover = document.getElementById('cellPopover');
        const textarea = document.querySelector('.cell-edit-textarea');
        
        // Log what we found
        console.log('Found elements:', {
            popover: !!popover,
            textarea: !!textarea,
            popoverData: popover ? popover.dataset : null,
            textareaValue: textarea ? textarea.value : null
        });

        // 2. Validate all required elements and data
        if (!popover || !textarea) {
            throw new Error('Required elements not found');
        }

        if (!popover.dataset.rowIndex || !popover.dataset.columnName) {
            throw new Error('Missing row or column information');
        }

        if (!currentConnectionId) {
            throw new Error('No active database connection');
        }

        if (!globalState?.lastQueryResults?.length) {
            throw new Error('No query results available');
        }

        // 3. Get the data we need
        const rowIndex = parseInt(popover.dataset.rowIndex);
        const columnName = popover.dataset.columnName;
        const newValue = textarea.value;

        console.log('Preparing to save:', { rowIndex, columnName, newValue });

        // 4. Get the current row data
        const currentRow = globalState.lastQueryResults[rowIndex];
        if (!currentRow) {
            throw new Error('Row data not found');
        }

        // 5. Extract table name from last executed query
        const lastQuery = globalState.lastExecutedQuery;
        const tableMatch = lastQuery.match(/FROM\s+([^\s]+)/i);
        if (!tableMatch) {
            throw new Error('Could not determine table name from last query');
        }
        const tableName = tableMatch[1];

        // 6. Build the UPDATE query with smarter WHERE clause
        // Try to use primary key or unique identifier instead of all columns
        const whereConditions = [];
        
        // First, try to find a primary key column (usually 'id')
        const primaryKeyColumns = ['id', 'ID', 'Id', '_id', 'pk', 'primary_key'];
        let usedPrimaryKey = false;
        
        for (const pkCol of primaryKeyColumns) {
            if (currentRow.hasOwnProperty(pkCol) && currentRow[pkCol] !== null && currentRow[pkCol] !== undefined) {
                const pkValue = String(currentRow[pkCol]).replace(/'/g, "''");
                whereConditions.push(`${pkCol} = '${pkValue}'`);
                usedPrimaryKey = true;
                console.log(`Using primary key ${pkCol} = '${pkValue}' for WHERE clause`);
                break;
            }
        }
        
        // If no primary key found, use a combination of key columns (but not all)
        if (!usedPrimaryKey) {
            console.log('No primary key found, using multiple columns for WHERE clause');
            const keyColumns = ['id', 'uid', 'call_uid', 'name', 'email', 'username'];
            let addedConditions = 0;
            
            for (const [key, value] of Object.entries(currentRow)) {
                if (key !== columnName && (keyColumns.includes(key.toLowerCase()) || addedConditions < 3)) {
                    let sqlValue;
                    if (value === null || value === undefined) {
                        sqlValue = 'NULL';
                        whereConditions.push(`${key} IS NULL`);
                    } else {
                        const stringValue = String(value);
                        
                        // Handle dates
                        if (stringValue.includes('GMT') || stringValue.includes('UTC')) {
                            try {
                                const dateObj = new Date(stringValue);
                                if (!isNaN(dateObj.getTime())) {
                                    sqlValue = `'${dateObj.toISOString()}'`;
                                } else {
                                    sqlValue = `'${stringValue.replace(/'/g, "''")}'`;
                                }
                            } catch (e) {
                                sqlValue = `'${stringValue.replace(/'/g, "''")}'`;
                            }
                        } else {
                            sqlValue = `'${stringValue.replace(/'/g, "''")}'`;
                        }
                        whereConditions.push(`${key} = ${sqlValue}`);
                    }
                    addedConditions++;
                    
                    // Limit to avoid overly complex WHERE clauses
                    if (addedConditions >= 3) break;
                }
            }
        }

        const updateValue = newValue.trim() === '' ? 'NULL' : `'${newValue.replace(/'/g, "''")}'`;
        const updateQuery = `UPDATE ${tableName} 
                           SET ${columnName} = ${updateValue} 
                           WHERE ${whereConditions.join(' AND ')}`;

        console.log('Executing update query:', updateQuery);

        // 7. Execute the update
        const result = await window.api.executeQuery(currentConnectionId, updateQuery);
        
        console.log('Query result:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Update failed');
        }

        // Check if any rows were affected
        if (result.rowsAffected !== undefined) {
            console.log(`Rows affected: ${result.rowsAffected}`);
            if (result.rowsAffected === 0) {
                throw new Error('No rows were updated. The WHERE clause may not have matched any records.');
            }
        }

        console.log('Update successful');

        // 8. Update the UI
        const cell = document.querySelector(`.results-table tbody tr:nth-child(${rowIndex + 1}) td[data-column-name="${columnName}"]`);
        if (cell) {
            // Update cell display
            const displayValue = newValue.length > 50 ? newValue.substring(0, 47) + '...' : newValue;
            cell.textContent = displayValue;
            cell.title = newValue;
            cell.dataset.fullValue = newValue;
            cell.dataset.originalValue = newValue;

            // Update global state
            globalState.lastQueryResults[rowIndex][columnName] = newValue;
            
            // Visual feedback for successful update
            cell.style.backgroundColor = 'var(--success)';
            cell.style.color = 'white';
            setTimeout(() => {
                cell.style.backgroundColor = '';
                cell.style.color = '';
            }, 1000);
        } else {
            console.warn('Could not find cell to update in UI');
        }

        // 9. Show success and hide popover
        showNotification('Value updated successfully', 'success');
        hideCellPopover();

    } catch (error) {
        console.error('Error in saveCellEdit:', error);
        showNotification(error.message, 'error');
    }
}

let currentEditingCell = null;

function startCellEdit(td, rowIndex, columnName, currentValue) {
  // Prevent editing if already editing another cell
  if (currentEditingCell) {
    cancelCellEdit();
  }
  
  currentEditingCell = td;
  
  // Create input element
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentValue;
  input.className = 'cell-edit-input';
  
  // Style the cell as editing
  td.classList.add('editing');
  td.innerHTML = '';
  td.appendChild(input);
  
  // Focus and select all text
  input.focus();
  input.select();
  
  // Handle save/cancel
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCellEdit(td, rowIndex, columnName, input.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelCellEdit();
    }
  });
  
  input.addEventListener('blur', () => {
    saveCellEdit(td, rowIndex, columnName, input.value);
  });
}

// Theme Management
async function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  currentTheme = theme;
  
  // Save to config service
  try {
    await window.api.setTheme(theme);
  } catch (error) {
    console.error('Error saving theme:', error);
  }
  
  // Update the select dropdown if it exists
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = theme;
  }
}

async function changeTheme(theme) {
  await applyTheme(theme);
  showNotification(`Theme changed to ${getThemeName(theme)}`, 'success');
}

function getThemeName(theme) {
  const names = {
    'vscode-dark': 'VS Code Dark',
    'dark': 'Dark (ProjectNest)',
    'light': 'Light',
    'solarized-light': 'Solarized Light'
  };
  return names[theme] || theme;
}

function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  modal.classList.remove('hidden');
  
  // Set current theme in dropdown
  document.getElementById('themeSelect').value = currentTheme;
  
  // Load API key status
  loadApiKeyStatus();
}

async function loadApiKeyStatus() {
  try {
    const status = await window.api.getApiKeyStatus();
    const statusElement = document.getElementById('apiKeyStatus');
    
    // Load and display stored API key if exists
    const storedKeySection = document.getElementById('storedApiKeySection');
    const storedKeyDisplay = document.getElementById('storedApiKeyDisplay');
    
    if (status.hasUserApiKey) {
      // Fetch the actual stored API key
      const keyResult = await window.api.getApiKey();
      if (keyResult.success && keyResult.apiKey) {
        storedKeySection.style.display = 'block';
        storedKeyDisplay.value = keyResult.apiKey;
        statusElement.textContent = '✓ Using your custom API key';
        statusElement.style.color = 'var(--success-color)';
      } else {
        storedKeySection.style.display = 'none';
        statusElement.textContent = '✓ Using your custom API key';
        statusElement.style.color = 'var(--success-color)';
      }
    } else if (status.usingDefaultKey) {
      storedKeySection.style.display = 'none';
      statusElement.textContent = '✓ Using default API key (you can optionally set your own)';
      statusElement.style.color = 'var(--info-color, #4a9eff)';
    } else {
      storedKeySection.style.display = 'none';
      statusElement.textContent = '⚠ No API key configured';
      statusElement.style.color = 'var(--warning-color)';
    }
  } catch (error) {
    console.error('Error loading API key status:', error);
  }
}

async function saveApiKey() {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const apiKey = apiKeyInput.value.trim();
  
  if (!apiKey) {
    showNotification('Please enter an API key', 'error');
    return;
  }
  
  try {
    const result = await window.api.setApiKey(apiKey);
    if (result.success) {
      showNotification('API key saved successfully', 'success');
      apiKeyInput.value = '';
      loadApiKeyStatus();
    } else {
      showNotification(result.error || 'Failed to save API key', 'error');
    }
  } catch (error) {
    console.error('Error saving API key:', error);
    showNotification('Failed to save API key', 'error');
  }
}

function toggleApiKeyVisibility() {
  const apiKeyInput = document.getElementById('apiKeyInput');
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
  } else {
    apiKeyInput.type = 'password';
  }
}

function toggleStoredKeyVisibility() {
  const storedKeyDisplay = document.getElementById('storedApiKeyDisplay');
  if (storedKeyDisplay.type === 'password') {
    storedKeyDisplay.type = 'text';
  } else {
    storedKeyDisplay.type = 'password';
  }
}

async function clearApiKey() {
  if (!confirm('Are you sure you want to clear your custom API key? The app will revert to using the default API key.')) {
    return;
  }
  
  try {
    const result = await window.api.clearApiKey();
    if (result.success) {
      showNotification('API key cleared successfully', 'success');
      loadApiKeyStatus();
    } else {
      showNotification(result.error || 'Failed to clear API key', 'error');
    }
  } catch (error) {
    console.error('Error clearing API key:', error);
    showNotification('Failed to clear API key', 'error');
  }
}

// Query History Functions
function openQueryHistoryModal() {
  const modal = document.getElementById('queryHistoryModal');
  modal.classList.remove('hidden');
  renderQueryHistory();
}

function closeQueryHistoryModal() {
  const modal = document.getElementById('queryHistoryModal');
  modal.classList.add('hidden');
  document.getElementById('historySearchInput').value = '';
}

function renderQueryHistory(searchTerm = '') {
  const list = document.getElementById('queryHistoryList');
  
  let filteredHistory = queryHistory;
  if (searchTerm) {
    filteredHistory = queryHistory.filter(item => 
      item.query.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  if (filteredHistory.length === 0) {
    list.innerHTML = `
      <div class="no-results" style="text-align: center; padding: 40px; color: var(--text-secondary);">
        ${searchTerm ? 'No queries found matching your search' : 'No queries executed yet in this session'}
      </div>
    `;
    return;
  }
  
  list.innerHTML = '';
  filteredHistory.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.query = item.query;
    
    const timestamp = new Date(item.timestamp).toLocaleString();
    const statusClass = item.success ? 'history-result-success' : 'history-result-error';
    const statusText = item.success 
      ? `${item.rowCount} rows` 
      : `Error: ${item.error}`;
    
    historyItem.innerHTML = `
      <div class="history-header">
        <span class="history-timestamp">${timestamp}</span>
        <span class="history-execution-time">${item.executionTime}ms</span>
      </div>
      <div class="history-query">${item.query}</div>
      <div class="history-result-info ${statusClass}">${statusText}</div>
    `;
    
    historyItem.addEventListener('click', () => {
      selectHistoryQuery(item.query);
    });
    
    list.appendChild(historyItem);
  });
}

function selectHistoryQuery(query) {
  queryEditor.value = query;
  updateLineNumbers();
  updateSyntaxHighlight();
  closeQueryHistoryModal();
  showNotification('Query loaded from history', 'success');
}

function clearQueryHistory() {
  if (confirm('Are you sure you want to clear all query history?')) {
    queryHistory = [];
    renderQueryHistory();
    // Clear from file
    saveQueryHistory();
    showNotification('Query history cleared', 'success');
  }
}

// Make functions globally accessible for inline onclick handlers
window.connectToDatabase = connectToDatabase;
window.deleteServer = deleteServer;
window.deleteDatabase = deleteDatabase;
window.toggleServer = toggleServer;
window.openAddDatabaseModal = openAddDatabaseModal;
window.addDatabaseToServer = addDatabaseToServer;
window.listDatabasesOnServer = listDatabasesOnServer;
window.addDatabaseToConnections = addDatabaseToConnections;
window.showCreateDatabaseForm = showCreateDatabaseForm;
window.hideCreateDatabaseForm = hideCreateDatabaseForm;
window.createNewDatabase = createNewDatabase;

// DBML Zoom and Pan Functions
function initializeDBMLPanZoom() {
  const canvas = document.getElementById('dbmlCanvas');
  
  // Mouse wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomDBMLAtPoint(zoomFactor, mouseX, mouseY);
  });
  
  // Mouse pan
  canvas.addEventListener('mousedown', (e) => {
    if (e.target === canvas || e.target.classList.contains('dbml-viewport')) {
      dbmlIsPanning = true;
      dbmlLastPanX = e.clientX;
      dbmlLastPanY = e.clientY;
      canvas.classList.add('panning');
      e.preventDefault();
    }
  });
  
  document.addEventListener('mousemove', (e) => {
    if (dbmlIsPanning) {
      const deltaX = e.clientX - dbmlLastPanX;
      const deltaY = e.clientY - dbmlLastPanY;
      
      dbmlPanX += deltaX;
      dbmlPanY += deltaY;
      
      dbmlLastPanX = e.clientX;
      dbmlLastPanY = e.clientY;
      
      updateDBMLTransform();
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (dbmlIsPanning) {
      dbmlIsPanning = false;
      document.getElementById('dbmlCanvas').classList.remove('panning');
    }
  });

  // Global Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Handle DBML zoom shortcuts when DBML tab is active
    const activeTab = document.querySelector('.header-tab.active');
    if (activeTab && activeTab.dataset.tab === 'dbml') {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomDBML(1.2);
          return;
        } else if (e.key === '-') {
          e.preventDefault();
          zoomDBML(0.8);
          return;
        } else if (e.key === '0') {
          e.preventDefault();
          resetDBMLZoom();
          return;
        }
      }
    }

    // Global shortcuts
    if (e.ctrlKey || e.metaKey) {
      // Tab navigation: Ctrl+1 through Ctrl+6
      if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const tabMapping = {
          '1': 'query',
          '2': 'psql', 
          '3': 'dbml',
          '4': 'snippets',
          '5': 'saved-queries',
          '6': 'variables'
        };
        switchMainTab(tabMapping[e.key]);
        return;
      }

      // Ctrl+I: Toggle AI panel
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        toggleAIPanel();
        return;
      }

      // Ctrl+G: Focus AI prompt input
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        focusAIPrompt();
        return;
      }

      // Query execution shortcuts (only when query tab is active or query editor is focused)
      if (activeTab && activeTab.dataset.tab === 'query' || document.activeElement === queryEditor) {
        // Ctrl+Enter: Execute entire query
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          executeQuery();
          return;
        }

        // Ctrl+Shift+Enter: Execute selected query
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          executeSelectedQuery();
          return;
        }

        // Ctrl+S: Save query file
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          saveQueryFile();
          return;
        }
      }
    }
  });
}

function zoomDBML(factor) {
  const canvas = document.getElementById('dbmlCanvas');
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  zoomDBMLAtPoint(factor, centerX, centerY);
}

function zoomDBMLAtPoint(factor, mouseX, mouseY) {
  const newZoom = Math.max(0.1, Math.min(5, dbmlZoom * factor));
  
  if (newZoom !== dbmlZoom) {
    // Adjust pan to zoom towards mouse position
    dbmlPanX = mouseX - (mouseX - dbmlPanX) * (newZoom / dbmlZoom);
    dbmlPanY = mouseY - (mouseY - dbmlPanY) * (newZoom / dbmlZoom);
    
    dbmlZoom = newZoom;
    updateDBMLTransform();
  }
}

function resetDBMLZoom() {
  dbmlZoom = 1;
  dbmlPanX = 0;
  dbmlPanY = 0;
  updateDBMLTransform();
}

function updateDBMLTransform() {
  const viewport = document.getElementById('dbmlViewport');
  const zoomLevel = document.getElementById('zoomLevel');
  
  if (viewport) {
    viewport.style.transform = `translate(${dbmlPanX}px, ${dbmlPanY}px) scale(${dbmlZoom})`;
    
    // Add smooth transition for button-triggered zooms (not mouse wheel)
    if (!dbmlIsPanning) {
      viewport.style.transition = 'transform 0.2s ease-out';
      setTimeout(() => {
        viewport.style.transition = '';
      }, 200);
    }
  }
  
  if (zoomLevel) {
    zoomLevel.textContent = `${Math.round(dbmlZoom * 100)}%`;
  }
}
window.closeQueryHistoryModal = closeQueryHistoryModal;
window.clearQueryHistory = clearQueryHistory;

// Initialize on load
loadSnippets();
loadVariables();

// Table Creation Functions
let columnCounter = 0;

// PostgreSQL data types for dropdown
const postgresDataTypes = [
  // Numeric types
  'INTEGER', 'BIGINT', 'SMALLINT', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
  'SERIAL', 'BIGSERIAL', 'SMALLSERIAL',
  // Character types
  'VARCHAR', 'CHAR', 'TEXT', 'CHARACTER VARYING', 'CHARACTER',
  // Binary types
  'BYTEA',
  // Date/Time types
  'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME', 'TIMETZ', 'INTERVAL',
  // Boolean type
  'BOOLEAN',
  // Geometric types
  'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE',
  // Network types
  'INET', 'CIDR', 'MACADDR', 'MACADDR8',
  // JSON types
  'JSON', 'JSONB',
  // UUID type
  'UUID',
  // Array types
  'INTEGER[]', 'TEXT[]', 'VARCHAR[]', 'NUMERIC[]',
  // Other types
  'MONEY', 'XML'
];

function openCreateTableModal() {
  if (!currentConnectionId) {
    showNotification('Please connect to a database first', 'warning');
    return;
  }
  
  const modal = document.getElementById('createTableModal');
  const columnsContainer = document.getElementById('columnsContainer');
  const tableNameInput = document.getElementById('tableName');
  const sqlQueryTextarea = document.getElementById('sqlQuery');
  
  // Reset form
  tableNameInput.value = '';
  columnsContainer.innerHTML = '';
  sqlQueryTextarea.value = '';
  columnCounter = 0;
  
  // Reset to visual tab
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector('.tab-button[data-tab="visual"]').classList.add('active');
  document.getElementById('visualTab').classList.add('active');
  
  // Add first column by default
  addColumnRow();
  
  modal.classList.remove('hidden');
  tableNameInput.focus();
}

function closeCreateTableModal() {
  const modal = document.getElementById('createTableModal');
  modal.classList.add('hidden');
}

// Create Table AI Generator Functions (Inline Approach)
function showCreateTableAi() {
  const promptBar = document.getElementById('createTableAiPrompt');
  const promptInput = document.getElementById('createTableAiInput');
  
  promptBar.classList.remove('hidden');
  promptInput.focus();
}

function hideCreateTableAi() {
  const promptBar = document.getElementById('createTableAiPrompt');
  const promptInput = document.getElementById('createTableAiInput');
  
  promptBar.classList.add('hidden');
  promptInput.value = '';
}

async function generateCreateTableSQL() {
  const prompt = document.getElementById('createTableAiInput').value.trim();
  
  if (!prompt) {
    showNotification('Please describe the table you want to create', 'error');
    return;
  }
  
  const generateBtn = document.getElementById('generateTableSQLBtn');
  const originalText = generateBtn.textContent;
  
  try {
    // Show loading state
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    // Call AI service to generate SQL
    const result = await generateTableSQL(prompt);
    
    if (result.success) {
      // Populate the SQL textarea
      const sqlTextarea = document.getElementById('sqlQuery');
      if (sqlTextarea) {
        sqlTextarea.value = result.sql;
      }
      
      // Hide AI prompt
      hideCreateTableAi();
      
      showNotification('SQL query generated successfully!', 'success');
    } else {
      showNotification(`Failed to generate SQL: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error generating AI table:', error);
    showNotification(`Error generating table: ${error.message}`, 'error');
  } finally {
    // Reset button state
    generateBtn.disabled = false;
    generateBtn.textContent = originalText;
  }
}

async function generateTableSQL(prompt) {
  try {
    // Enhanced prompt for better SQL generation
    const enhancedPrompt = `Generate a PostgreSQL CREATE TABLE statement based on this description: ${prompt}

Please follow these guidelines:
1. Use appropriate PostgreSQL data types (SERIAL, INTEGER, VARCHAR, TEXT, TIMESTAMP, BOOLEAN, etc.)
2. Include PRIMARY KEY constraints where appropriate
3. Add UNIQUE constraints for unique fields like email
4. Use NOT NULL for required fields
5. Add DEFAULT values where it makes sense (e.g., CURRENT_TIMESTAMP for created dates)
6. Use descriptive column names in snake_case
7. Only return the SQL statement, no explanation

Example format:
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

    const result = await window.api.generateSQL(enhancedPrompt, activeAI?.context?.schema || {}, activeAI?.connectionId);
    
    if (result.success) {
      // Clean up the response to extract just the SQL
      let sql = result.response.trim();
      
      // Remove any markdown code blocks
      sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '');
      
      // Remove any explanatory text before or after the SQL
      const createTableMatch = sql.match(/CREATE TABLE[\s\S]*?;/i);
      if (createTableMatch) {
        sql = createTableMatch[0];
      }
      
      return {
        success: true,
        sql: sql
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to generate SQL'
      };
    }
  } catch (error) {
    console.error('Error in generateTableSQL:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function showTableSchema(schemaName, tableName, tableInfo) {
  const modal = document.getElementById('tableSchemaModal');
  const title = document.getElementById('tableSchemaTitle');
  const content = document.getElementById('tableSchemaContent');

  // Set title
  const displayTableName = formatIdentifierForQuery(schemaName, tableName);
  title.textContent = `Schema: ${displayTableName}`;

  // Build schema content and include a placeholder for total entries (will be filled asynchronously)
  let schemaHTML = `
    <div class="schema-info">
      <div class="schema-header">
        <h4>Table Information</h4>
        <div class="schema-details">
          <div class="schema-detail-item">
            <span class="detail-label">Schema:</span> 
            <span class="detail-value">${schemaName}</span>
          </div>
          <div class="schema-detail-item">
            <span class="detail-label">Table:</span> 
            <span class="detail-value">${tableName}</span>
          </div>
          <div class="schema-detail-item">
            <span class="detail-label">Columns:</span> 
            <span class="detail-value">${tableInfo.columns.length}</span>
          </div>
          <div class="schema-detail-item">
            <span class="detail-label">Total Entries:</span>
            <span class="detail-value" id="tableRowCount">Loading...</span>
          </div>
        </div>
      </div>
      
      <div class="schema-columns">
        <h4>Columns</h4>
        <div class="columns-table">
          <div class="column-header">
            <div class="col-name">Name</div>
            <div class="col-type">Type</div>
            <div class="col-nullable">Nullable</div>
            <div class="col-default">Default</div>
            <div class="col-constraints">Constraints</div>
          </div>
  `;
  
  // Sort columns by position
  const sortedColumns = [...tableInfo.columns].sort((a, b) => a.position - b.position);
  
  for (const column of sortedColumns) {
    const isPrimaryKey = column.primary_key || false;
    const hasForeignKey = column.foreign_key || false;
    const hasIndexes = column.indexes && column.indexes.length > 0;
    const nullable = column.nullable ? 'Yes' : 'No';
    const defaultValue = column.default || '-';
    
    let constraintsInfo = '';
    if (isPrimaryKey) {
      constraintsInfo += '<span class="key-badge primary" title="Primary Key">PK</span>';
    }
    if (hasForeignKey) {
      constraintsInfo += '<span class="key-badge foreign" title="Foreign Key">FK</span>';
    }
    if (hasIndexes) {
      const uniqueIndexes = column.indexes.filter(idx => idx.unique).length;
      const regularIndexes = column.indexes.filter(idx => !idx.unique).length;
      if (uniqueIndexes > 0) {
        constraintsInfo += `<span class="key-badge unique" title="${uniqueIndexes} Unique Index${uniqueIndexes > 1 ? 'es' : ''}">U</span>`;
      }
      if (regularIndexes > 0) {
        constraintsInfo += `<span class="key-badge index" title="${regularIndexes} Index${regularIndexes > 1 ? 'es' : ''}">I</span>`;
      }
    }
    if (!constraintsInfo) {
      constraintsInfo = '-';
    }
    
    schemaHTML += `
      <div class="column-row">
        <div class="col-name">${quoteIdentifier(column.name)}</div>
        <div class="col-type">${column.type}</div>
        <div class="col-nullable">${nullable}</div>
        <div class="col-default">${defaultValue}</div>
        <div class="col-constraints">${constraintsInfo}</div>
      </div>
    `;
  }
  
  schemaHTML += `
        </div>
      </div>
    </div>
  `;
  
  // Add foreign key relationships if any
  const foreignKeys = tableInfo.columns.filter(col => col.foreign_key);
  if (foreignKeys.length > 0) {
    schemaHTML += `
      <div class="schema-relationships">
        <h4>Foreign Key Relationships</h4>
        <div class="relationships-list">
    `;
    
    for (const fkColumn of foreignKeys) {
      schemaHTML += `
        <div class="relationship-item">
          <span class="relationship-column">${quoteIdentifier(fkColumn.name)}</span>
          <span class="relationship-arrow">→</span>
          <span class="foreign-ref">${fkColumn.foreign_key.table}.${fkColumn.foreign_key.column}</span>
        </div>
      `;
    }
    
    schemaHTML += `
        </div>
      </div>
    `;
  }
  
  // Note: Index information is already displayed in the constraints column
  // No need for a separate indexes section
  
  content.innerHTML = schemaHTML;
  // After rendering the modal content, attempt to fetch the total row count
  modal.classList.remove('hidden');

  // Build a safe COUNT query using the formatted identifier
  try {
    if (currentConnectionId) {
      const countQuery = `SELECT COUNT(*) AS count FROM ${displayTableName};`;
      const countResult = await window.api.executeQuery(currentConnectionId, countQuery);
      const countEl = document.getElementById('tableRowCount');
      if (countEl) {
        if (countResult && countResult.success && Array.isArray(countResult.rows) && countResult.rows[0]) {
          // PostgreSQL returns numeric counts as strings for bigints sometimes; coerce to string
          const cnt = countResult.rows[0].count;
          countEl.textContent = (cnt === null || cnt === undefined) ? '0' : String(cnt);
        } else {
          countEl.textContent = 'N/A';
        }
      }
    }
  } catch (err) {
    const countEl = document.getElementById('tableRowCount');
    if (countEl) countEl.textContent = 'N/A';
    console.error('Failed to fetch table row count:', err);
  }
}

function closeTableSchemaModal() {
  const modal = document.getElementById('tableSchemaModal');
  modal.classList.add('hidden');
}

function switchCreateTableTab(event) {
  const selectedTab = event.currentTarget.dataset.tab;
  
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  event.currentTarget.classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  if (selectedTab === 'visual') {
    document.getElementById('visualTab').classList.add('active');
  } else if (selectedTab === 'sql') {
    document.getElementById('sqlTab').classList.add('active');
  }
}

function addColumnRow() {
  const columnsContainer = document.getElementById('columnsContainer');
  const columnId = ++columnCounter;
  
  const columnRow = document.createElement('div');
  columnRow.className = 'column-row';
  columnRow.dataset.columnId = columnId;
  
  columnRow.innerHTML = `
    <input 
      type="text" 
      placeholder="Column name" 
      class="column-input column-name" 
      name="columnName_${columnId}"
      required
    />
    <div class="datatype-dropdown">
      <div class="datatype-search">
        <input 
          type="text" 
          placeholder="Select data type" 
          class="datatype-search-input" 
          name="dataType_${columnId}"
          readonly
          required
        />
        <div class="datatype-dropdown-list">
          ${postgresDataTypes.map(type => `
            <div class="datatype-option" data-value="${type}">${type}</div>
          `).join('')}
        </div>
      </div>
    </div>
    <div class="column-controls">
      <label class="pk-checkbox">
        <input type="radio" name="primaryKey" value="${columnId}" />
        <span>PK</span>
      </label>
      <button type="button" class="index-toggle" data-column="${columnId}">
        IDX
      </button>
      <button type="button" class="remove-column-btn" onclick="removeColumnRow(${columnId})">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </div>
  `;
  
  columnsContainer.appendChild(columnRow);
  
  // Set up datatype dropdown functionality
  setupDatatypeDropdown(columnRow);
  
  // Set up index toggle
  setupIndexToggle(columnRow);
}

function removeColumnRow(columnId) {
  const columnRow = document.querySelector(`[data-column-id="${columnId}"]`);
  if (columnRow) {
    // Check if this is the last column
    const allRows = document.querySelectorAll('.column-row');
    if (allRows.length === 1) {
      showNotification('Table must have at least one column', 'warning');
      return;
    }
    columnRow.remove();
  }
}

function setupDatatypeDropdown(columnRow) {
  const searchInput = columnRow.querySelector('.datatype-search-input');
  const dropdownList = columnRow.querySelector('.datatype-dropdown-list');
  const options = dropdownList.querySelectorAll('.datatype-option');
  
  // Show dropdown when input is clicked
  searchInput.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close other dropdowns
    document.querySelectorAll('.datatype-dropdown-list.show').forEach(list => {
      if (list !== dropdownList) {
        list.classList.remove('show');
      }
    });
    
    if (!dropdownList.classList.contains('show')) {
      // Position the dropdown relative to the input
      const rect = searchInput.getBoundingClientRect();
      dropdownList.style.left = rect.left + 'px';
      dropdownList.style.top = (rect.bottom + 2) + 'px';
      dropdownList.style.width = rect.width + 'px';
    }
    
    dropdownList.classList.toggle('show');
  });
  
  // Search functionality
  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    options.forEach(option => {
      const optionText = option.textContent.toLowerCase();
      const matches = optionText.includes(searchTerm);
      option.style.display = matches ? 'block' : 'none';
    });
    if (!dropdownList.classList.contains('show')) {
      // Position the dropdown relative to the input
      const rect = searchInput.getBoundingClientRect();
      dropdownList.style.left = rect.left + 'px';
      dropdownList.style.top = (rect.bottom + 2) + 'px';
      dropdownList.style.width = rect.width + 'px';
      dropdownList.classList.add('show');
    }
  });
  
  // Handle option selection
  options.forEach(option => {
    option.addEventListener('click', () => {
      const selectedValue = option.dataset.value;
      searchInput.value = selectedValue;
      dropdownList.classList.remove('show');
      
      // Remove readonly to trigger validation
      searchInput.removeAttribute('readonly');
      setTimeout(() => {
        searchInput.setAttribute('readonly', true);
      }, 10);
    });
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!columnRow.contains(e.target)) {
      dropdownList.classList.remove('show');
    }
  });
  
  // Reposition dropdown on window events
  const repositionDropdown = () => {
    if (dropdownList.classList.contains('show')) {
      const rect = searchInput.getBoundingClientRect();
      dropdownList.style.left = rect.left + 'px';
      dropdownList.style.top = (rect.bottom + 2) + 'px';
      dropdownList.style.width = rect.width + 'px';
    }
  };
  
  window.addEventListener('scroll', repositionDropdown);
  window.addEventListener('resize', repositionDropdown);
}

function setupIndexToggle(columnRow) {
  const indexToggle = columnRow.querySelector('.index-toggle');
  
  indexToggle.addEventListener('click', () => {
    indexToggle.classList.toggle('active');
  });
}

async function handleCreateTable(e) {
  e.preventDefault();
  
  // Determine which tab is active
  const activeTab = document.querySelector('.tab-content.active').id;
  
  if (activeTab === 'visualTab') {
    await handleVisualTableCreation();
  } else if (activeTab === 'sqlTab') {
    await handleSQLTableCreation();
  }
}

async function handleVisualTableCreation() {
  const tableName = document.getElementById('tableName').value.trim();
  if (!tableName) {
    showNotification('Table name is required', 'error');
    return;
  }
  
  // Validate table name (allow mixed case and more flexible naming)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    showNotification('Table name must start with a letter or underscore and contain only letters, numbers, and underscores', 'error');
    return;
  }
  
  const columnRows = document.querySelectorAll('.column-row');
  if (columnRows.length === 0) {
    showNotification('Table must have at least one column', 'error');
    return;
  }
  
  const columns = [];
  const indexes = [];
  let primaryKeyColumn = null;
  
  // Get primary key selection
  const primaryKeyRadio = document.querySelector('input[name="primaryKey"]:checked');
  if (primaryKeyRadio) {
    primaryKeyColumn = primaryKeyRadio.value;
  }
  
  // Collect column data
  for (const columnRow of columnRows) {
    const columnId = columnRow.dataset.columnId;
    const nameInput = columnRow.querySelector('.column-name');
    const datatypeInput = columnRow.querySelector('.datatype-search-input');
    const indexToggle = columnRow.querySelector('.index-toggle');
    
    const columnName = nameInput.value.trim();
    const dataType = datatypeInput.value.trim();
    
    if (!columnName) {
      showNotification('All columns must have a name', 'error');
      return;
    }
    
    if (!dataType) {
      showNotification('All columns must have a data type', 'error');
      return;
    }
    
    // Validate column name (allow mixed case)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
      showNotification(`Column name "${columnName}" is invalid. Must start with a letter or underscore and contain only letters, numbers, and underscores`, 'error');
      return;
    }
    
    const column = {
      name: columnName,
      dataType: dataType,
      isPrimaryKey: primaryKeyColumn === columnId,
      hasIndex: indexToggle.classList.contains('active')
    };
    
    columns.push(column);
    
    // Add index if requested (and not primary key, since PK automatically creates index)
    if (column.hasIndex && !column.isPrimaryKey) {
      indexes.push(columnName);
    }
  }
  
  // Check for duplicate column names
  const columnNames = columns.map(col => col.name.toLowerCase());
  const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    showNotification(`Duplicate column names found: ${duplicates.join(', ')}`, 'error');
    return;
  }
  
  try {
    const result = await window.api.createTable(currentConnectionId, {
      tableName,
      columns,
      indexes
    });
    
    if (result.success) {
      showNotification(`Table "${tableName}" created successfully`, 'success');
      closeCreateTableModal();
      
      // Refresh schema
      await loadDatabaseSchema();
    } else {
      showNotification(`Failed to create table: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error creating table:', error);
    showNotification(`Error creating table: ${error.message}`, 'error');
  }
}

async function handleSQLTableCreation() {
  const sqlQuery = document.getElementById('sqlQuery').value.trim();
  
  if (!sqlQuery) {
    showNotification('SQL query is required', 'error');
    return;
  }
  
  // Basic validation to ensure it's a CREATE TABLE statement
  if (!validateCreateTableSQL(sqlQuery)) {
    showNotification('Please provide a valid CREATE TABLE statement', 'error');
    return;
  }
  
  try {
    const result = await window.api.executeCreateTableSQL(currentConnectionId, sqlQuery);
    
    if (result.success) {
      showNotification('Table created successfully', 'success');
      closeCreateTableModal();
      
      // Refresh schema
      await loadDatabaseSchema();
    } else {
      showNotification(`Failed to create table: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error executing SQL:', error);
    showNotification(`Error executing SQL: ${error.message}`, 'error');
  }
}

function validateCreateTableSQL(sql) {
  // Remove comments and normalize whitespace
  const normalizedSQL = sql
    .replace(/--[^\n\r]*/g, '') // Remove single line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toUpperCase();
  
  // Check if it starts with CREATE TABLE
  if (!normalizedSQL.startsWith('CREATE TABLE')) {
    return false;
  }
  
  // Basic structure check: should contain parentheses for column definitions
  const hasParentheses = normalizedSQL.includes('(') && normalizedSQL.includes(')');
  if (!hasParentheses) {
    return false;
  }
  
  return true;
}

// Database Browser Resize Functionality
function setupDatabaseBrowserResize() {
  const dbBrowser = document.getElementById('dbBrowser');
  const resizeHandle = document.getElementById('dbResizeHandle');
  const databaseView = document.querySelector('.database-view');
  
  if (!dbBrowser || !resizeHandle || !databaseView) {
    return;
  }
  
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  const collapseThreshold = 80; // Width below which to auto-collapse
  
  // Load saved width from localStorage
  const savedWidth = localStorage.getItem('dbBrowserWidth');
  if (savedWidth) {
    const width = Math.max(200, Math.min(600, parseInt(savedWidth)));
    dbBrowser.style.width = width + 'px';
  }
  
  // Check if database browser was collapsed
  const wasCollapsed = localStorage.getItem('dbBrowserCollapsed') === 'true';
  if (wasCollapsed) {
    dbBrowser.classList.add('hidden');
    const showBtn = document.getElementById('showDBBrowserBtn');
    if (showBtn) {
      showBtn.classList.remove('hidden');
    }
    const toggleBtn = document.getElementById('toggleDBBrowserBtn');
    const icon = toggleBtn?.querySelector('svg');
    if (icon) icon.style.transform = 'rotate(-90deg)';
  }
  
  // Mouse down on resize handle
  resizeHandle.addEventListener('mousedown', (e) => {
    // Don't allow resizing if database browser is hidden
    if (dbBrowser.classList.contains('hidden')) {
      return;
    }
    
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(document.defaultView.getComputedStyle(dbBrowser).width, 10);
    
    // Add visual feedback
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    resizeHandle.classList.add('active');
    
    // Prevent text selection during drag
    e.preventDefault();
  });
  
  // Mouse move - resize the panel
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const width = startWidth + e.clientX - startX;
    const minWidth = 200;  // Minimum width
    const maxWidth = 600;  // Maximum width
    
    // Allow dragging below minimum for collapse detection
    if (width >= minWidth && width <= maxWidth) {
      dbBrowser.style.width = width + 'px';
    } else if (width < minWidth) {
      // Show visual feedback when approaching collapse threshold
      dbBrowser.style.width = Math.max(0, width) + 'px';
    }
  });
  
  // Mouse up - stop resizing
  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    
    isResizing = false;
    
    // Remove visual feedback
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    resizeHandle.classList.remove('active');
    
    // Check if user dragged to collapse threshold
    const currentWidth = parseInt(document.defaultView.getComputedStyle(dbBrowser).width, 10);
    
    if (currentWidth < collapseThreshold) {
      // Collapse the panel
      dbBrowser.classList.add('hidden');
      dbBrowser.style.width = '250px'; // Reset to default for next open
      localStorage.setItem('dbBrowserCollapsed', 'true');
      
      // Show the "Show Database Browser" button
      const showBtn = document.getElementById('showDBBrowserBtn');
      if (showBtn) {
        showBtn.classList.remove('hidden');
      }
    } else {
      // Save width to localStorage
      localStorage.setItem('dbBrowserWidth', currentWidth);
    }
  });
  
  // Double-click to reset to default width
  resizeHandle.addEventListener('dblclick', () => {
    dbBrowser.style.width = '250px';
    localStorage.setItem('dbBrowserWidth', '250');
  });
}

// Sidebar Resize Functionality
function setupSidebarResize() {
  const sidebar = document.querySelector('.sidebar');
  const resizeHandle = document.getElementById('sidebarResizeHandle');
  
  if (!sidebar || !resizeHandle) {
    return;
  }
  
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  const collapseThreshold = 80; // Width below which to auto-collapse
  
  // Load saved width from localStorage
  const savedWidth = localStorage.getItem('sidebarWidth');
  if (savedWidth) {
    const width = Math.max(150, Math.min(500, parseInt(savedWidth)));
    sidebar.style.width = width + 'px';
  }
  
  // Check if sidebar was collapsed
  const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (wasCollapsed) {
    sidebar.classList.add('hidden');
    const showBtn = document.getElementById('showSidebarBtn');
    if (showBtn) {
      showBtn.classList.remove('hidden');
    }
  }
  
  // Mouse down on resize handle
  resizeHandle.addEventListener('mousedown', (e) => {
    // Don't allow resizing if sidebar is hidden
    if (sidebar.classList.contains('hidden')) {
      return;
    }
    
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
    
    // Add visual feedback
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    resizeHandle.classList.add('active');
    
    // Prevent text selection during drag
    e.preventDefault();
  });
  
  // Mouse move - resize the panel
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const width = startWidth + e.clientX - startX;
    const minWidth = 150;  // Minimum width
    const maxWidth = 500;  // Maximum width
    
    // Allow dragging below minimum for collapse detection
    if (width >= minWidth && width <= maxWidth) {
      sidebar.style.width = width + 'px';
    } else if (width < minWidth) {
      // Show visual feedback when approaching collapse threshold
      sidebar.style.width = Math.max(0, width) + 'px';
    }
  });
  
  // Mouse up - stop resizing
  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    
    isResizing = false;
    
    // Remove visual feedback
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    resizeHandle.classList.remove('active');
    
    // Check if user dragged to collapse threshold
    const currentWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
    
    if (currentWidth < collapseThreshold) {
      // Collapse the panel
      sidebar.classList.add('hidden');
      sidebar.style.width = '250px'; // Reset to default for next open
      localStorage.setItem('sidebarCollapsed', 'true');
      
      // Show the "Show Sidebar" button
      const showBtn = document.getElementById('showSidebarBtn');
      if (showBtn) {
        showBtn.classList.remove('hidden');
      }
    } else {
      // Save width to localStorage
      localStorage.setItem('sidebarWidth', currentWidth);
      localStorage.setItem('sidebarCollapsed', 'false');
    }
  });
  
  // Double-click to reset to default width
  resizeHandle.addEventListener('dblclick', () => {
    sidebar.style.width = '250px';
    localStorage.setItem('sidebarWidth', '250');
  });
}

// Make functions global so they can be called from HTML onclick handlers
window.removeColumnRow = removeColumnRow;
