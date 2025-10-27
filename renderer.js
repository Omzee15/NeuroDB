// State Management
let currentConnectionId = null;
let currentSchema = null;
let chatHistory = [];
let connections = [];
let snippets = JSON.parse(localStorage.getItem('neurodb_snippets')) || [];
let variables = JSON.parse(localStorage.getItem('neurodb_variables')) || [];
let queryHistory = []; // Store query history for current session
let currentMainTab = 'query';
let globalState = {
  lastExecutedQuery: '',
  lastQueryResults: []
};
let dbmlTables = [];
let dbmlRelationships = [];
let currentTheme = 'vscode-dark'; // Will be loaded from config
let autocompleteSelectedIndex = -1;
let currentTablesAndViews = []; // Store current database tables and views

// DOM Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const databaseView = document.getElementById('databaseView');
const connectionsList = document.getElementById('connectionsList');
const connectionModal = document.getElementById('connectionModal');
const connectionForm = document.getElementById('connectionForm');
const queryEditor = document.getElementById('queryEditor');
const resultsTableContainer = document.getElementById('resultsTableContainer');
const resultsInfo = document.getElementById('resultsInfo');
const aiPrompt = document.getElementById('aiPrompt');
const aiPanel = document.getElementById('aiPanel');
const aiChatContainer = document.getElementById('aiChatContainer');
const aiChatInput = document.getElementById('aiChatInput');
const dbTree = document.getElementById('dbTree');
const psqlOutput = document.getElementById('psqlOutput');
const psqlInput = document.getElementById('psqlInput');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadConnections();
    await loadTheme();
    setupEventListeners();
    applyTheme(currentTheme);
    updateLineNumbers();
    
    // Load saved snippets and variables
    loadSnippets();
    loadVariables();
    
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
    const loadedConnections = await window.api.getConnections();
    
    if (loadedConnections && Array.isArray(loadedConnections)) {
      connections = loadedConnections;
      console.log('Loaded connections:', connections.length);
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
        <button class="btn-icon" onclick="listDatabasesOnServer('${server.id}')" title="Add Database">
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
function setupEventListeners() {
  // Tab Navigation
  document.querySelectorAll('.header-tab').forEach(tab => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      const tabName = tab.dataset.tab;
      switchMainTab(tabName);
    });
  });

  // Connection Modal
  document.getElementById('addConnectionBtn').addEventListener('click', () => openConnectionModal());
  document.getElementById('welcomeAddConnection').addEventListener('click', () => openConnectionModal());
  document.getElementById('closeConnectionModal').addEventListener('click', () => closeConnectionModal());
  document.getElementById('cancelConnectionBtn').addEventListener('click', () => closeConnectionModal());
  document.getElementById('testConnectionBtn').addEventListener('click', testConnection);
  connectionForm.addEventListener('submit', saveConnection);
  
  // Query Editor
  document.getElementById('executeQueryBtn').addEventListener('click', executeQuery);
  document.getElementById('generateSQLBtn').addEventListener('click', generateSQL);
  document.getElementById('explainQueryBtn').addEventListener('click', explainQuery);
  document.getElementById('queryHistoryBtn').addEventListener('click', openQueryHistoryModal);
  document.getElementById('clearEditorBtn').addEventListener('click', () => {
    queryEditor.value = '';
    updateLineNumbers();
  });
  
  // Line numbers and autocomplete
  queryEditor.addEventListener('input', () => {
    updateLineNumbers();
    handleAutocomplete();
  });
  
  queryEditor.addEventListener('scroll', () => {
    const lineNumbers = document.getElementById('lineNumbers');
    lineNumbers.scrollTop = queryEditor.scrollTop;
  });
  
  // Keyboard shortcuts
  queryEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
      return;
    }
    
    // Handle autocomplete navigation
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
  queryEditor.addEventListener('mousemove', (e) => {
    handleShortcutHover(e);
  });
  
  queryEditor.addEventListener('mouseleave', () => {
    hideShortcutTooltip();
  });
  
  aiPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateSQL();
    }
  });
  
  // AI Panel
  document.getElementById('toggleAIBtn').addEventListener('click', toggleAIPanel);
  document.getElementById('closeAIBtn').addEventListener('click', () => {
    aiPanel.classList.add('hidden');
  });
  document.getElementById('sendAIChatBtn').addEventListener('click', sendChatMessage);
  
  aiChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  
  // PSQL Terminal
  psqlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executePSQLCommand();
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
  document.getElementById('toggleSidebarBtn')?.addEventListener('click', toggleSidebar);
  document.getElementById('toggleDBBrowserBtn')?.addEventListener('click', toggleDBBrowser);
  document.getElementById('showDBBrowserBtn')?.addEventListener('click', toggleDBBrowser);
  
  // Snippets
  document.getElementById('addSnippetBtn').addEventListener('click', () => openSnippetModal());
  document.getElementById('closeSnippetModal').addEventListener('click', () => {
    document.getElementById('snippetModal').classList.add('hidden');
  });
  document.getElementById('cancelSnippetBtn').addEventListener('click', () => {
    document.getElementById('snippetModal').classList.add('hidden');
  });
  document.getElementById('snippetForm').addEventListener('submit', saveSnippet);
  
  // Variables
  document.getElementById('addVariableBtn').addEventListener('click', () => openVariableModal());
  document.getElementById('closeVariableModal').addEventListener('click', () => {
    document.getElementById('variableModal').classList.add('hidden');
  });
  document.getElementById('cancelVariableBtn').addEventListener('click', () => {
    document.getElementById('variableModal').classList.add('hidden');
  });
  document.getElementById('variableForm').addEventListener('submit', saveVariable);
  
  // DBML
  document.getElementById('renderDBMLBtn').addEventListener('click', renderDBML);
  document.getElementById('clearDBMLBtn').addEventListener('click', () => {
    document.getElementById('dbmlEditor').value = '';
    document.getElementById('dbmlCanvas').innerHTML = '<div class="no-results">Render your DBML script to see the diagram</div>';
  });
  
  // Override execute query button to use placeholder replacement
  document.getElementById('executeQueryBtn').addEventListener('click', executeQuery);
  
  // Refresh Schema
  document.getElementById('refreshSchemaBtn').addEventListener('click', loadDatabaseSchema);
  
  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => openSettingsModal());
  document.getElementById('closeSettingsModal').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
  });
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    changeTheme(e.target.value);
  });
  
  // Add Database Modal
  document.getElementById('closeAddDatabaseModal').addEventListener('click', () => {
    document.getElementById('addDatabaseModal').classList.add('hidden');
  });
  document.getElementById('cancelAddDatabaseBtn').addEventListener('click', () => {
    document.getElementById('addDatabaseModal').classList.add('hidden');
  });
  
  // Global click handler for hiding popovers
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('cellPopover');
    if (!popover.classList.contains('hidden') && !popover.contains(e.target)) {
      hideCellPopover();
    }
  });
  
  // Setup resize functionality
  setupResultsResize();
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
  
  let isResizing = false;
  let startY = 0;
  let startEditorHeight = 0;
  let startResultsHeight = 0;
  
  // Load saved heights from localStorage
  const savedEditorHeight = localStorage.getItem('neurodb_editor_height');
  const savedResultsHeight = localStorage.getItem('neurodb_results_height');
  
  if (savedEditorHeight && savedResultsHeight) {
    editorContainer.style.height = savedEditorHeight + 'px';
    resultsContainer.style.height = savedResultsHeight + 'px';
  } else {
    // Set default heights
    updateContainerHeights();
  }
  
  // Mouse down on resize handle
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startEditorHeight = editorContainer.offsetHeight;
    startResultsHeight = resultsContainer.offsetHeight;
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
    
    e.preventDefault();
  });
  
  // Mouse move for resizing
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaY = e.clientY - startY;
    const newEditorHeight = Math.max(150, Math.min(startEditorHeight + deltaY, window.innerHeight - 400));
    const newResultsHeight = Math.max(150, Math.min(startResultsHeight - deltaY, window.innerHeight - 400));
    
    // Ensure total height doesn't exceed available space
    const totalAvailableHeight = querySection.offsetHeight - 100; // Account for other elements
    if (newEditorHeight + newResultsHeight <= totalAvailableHeight) {
      editorContainer.style.height = newEditorHeight + 'px';
      resultsContainer.style.height = newResultsHeight + 'px';
    }
  });
  
  // Mouse up to stop resizing
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      
      // Save heights to localStorage
      localStorage.setItem('neurodb_editor_height', editorContainer.offsetHeight);
      localStorage.setItem('neurodb_results_height', resultsContainer.offsetHeight);
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', () => {
    if (!isResizing) {
      updateContainerHeights();
    }
  });
}

// Update container heights based on available space
function updateContainerHeights() {
  const editorContainer = document.querySelector('.editor-container');
  const resultsContainer = document.querySelector('.results-container');
  const querySection = document.querySelector('.query-section');
  
  if (!editorContainer || !resultsContainer || !querySection) return;
  
  const availableHeight = querySection.offsetHeight - 100; // Account for other UI elements
  const editorHeight = Math.max(150, Math.floor(availableHeight * 0.4)); // 40% for editor
  const resultsHeight = Math.max(150, availableHeight - editorHeight); // Remaining for results
  
  editorContainer.style.height = editorHeight + 'px';
  resultsContainer.style.height = resultsHeight + 'px';
}

// Connection Management
function openConnectionModal(connection = null) {
  if (connection) {
    document.getElementById('connectionModalTitle').textContent = 'Edit Connection';
    document.getElementById('connectionId').value = connection.id;
    document.getElementById('connectionName').value = connection.name;
    document.getElementById('connectionHost').value = connection.host;
    document.getElementById('connectionPort').value = connection.port;
    document.getElementById('connectionDatabase').value = connection.database;
    document.getElementById('connectionUser').value = connection.user;
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
  
  const connection = {
    host: document.getElementById('connectionHost').value,
    port: parseInt(document.getElementById('connectionPort').value),
    database: document.getElementById('connectionDatabase').value,
    user: document.getElementById('connectionUser').value,
    password: document.getElementById('connectionPassword').value,
  };
  
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
  
  const server = {
    id: document.getElementById('connectionId').value || undefined,
    name: document.getElementById('connectionName').value,
    host: document.getElementById('connectionHost').value,
    port: parseInt(document.getElementById('connectionPort').value),
    user: document.getElementById('connectionUser').value,
    password: document.getElementById('connectionPassword').value,
  };
  
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
        currentConnectionId = null;
        currentSchema = null;
        
        // Reset title bar
        const titleBarDbName = document.getElementById('titleBarDbName');
        titleBarDbName.textContent = 'Welcome to NeuroDB';
        titleBarDbName.classList.remove('connected');
        
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
      const existingDbs = server?.databases?.map(db => db.database) || [];
      const availableDbs = result.databases.filter(dbName => !existingDbs.includes(dbName));
      
      if (availableDbs.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">All databases have been added</div>';
      } else {
        listContainer.innerHTML = '';
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
    showNotification('Connecting...', 'info');
    
    const result = await window.api.connectDB(connectionId);
    
    if (result.success) {
      currentConnectionId = connectionId;
      
      // Find the database in the nested structure
      let dbName = '';
      let serverName = '';
      let databaseName = '';
      for (const server of connections) {
        const db = server.databases?.find(d => d.id === connectionId);
        if (db) {
          serverName = server.name;
          databaseName = db.name;
          dbName = `${server.name} / ${db.name}`;
          break;
        }
      }

      
      // Update top bar
      document.getElementById('currentConnection').textContent = 
        `Connected to ${dbName}`;
      
      // Update title bar
      const titleBarDbName = document.getElementById('titleBarDbName');
      titleBarDbName.textContent = dbName;
      titleBarDbName.classList.add('connected');
      
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

async function loadDatabaseSchema() {
  if (!currentConnectionId) return;
  
  try {
    const result = await window.api.getDatabaseSchema(currentConnectionId);
    
    if (result.success) {
      currentSchema = result.schema;
      renderDatabaseTree(result.schema);
    } else {
      showNotification('Failed to load schema: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Error loading schema: ' + error.message, 'error');
  }
}

async function loadTablesAndViews() {
  if (!currentConnectionId) return;
  
  try {
    currentTablesAndViews = await window.api.getTablesAndViews(currentConnectionId);
    console.log('Loaded tables and views:', currentTablesAndViews);
  } catch (error) {
    console.error('Error loading tables and views:', error);
    currentTablesAndViews = [];
  }
}

function renderDatabaseTree(schema) {
  dbTree.innerHTML = '';
  
  for (const [schemaName, tables] of Object.entries(schema)) {
    const schemaEl = document.createElement('div');
    schemaEl.className = 'tree-item';
    schemaEl.textContent = `📁 ${schemaName}`;
    
    const tablesEl = document.createElement('div');
    tablesEl.className = 'tree-children';
    
    for (const [tableName, tableInfo] of Object.entries(tables)) {
      const tableEl = document.createElement('div');
      tableEl.className = 'tree-item';
      
      const tableContent = document.createElement('div');
      tableContent.style.display = 'flex';
      tableContent.style.justifyContent = 'space-between';
      tableContent.style.alignItems = 'center';
      tableContent.style.flex = '1';
      
      const tableName_span = document.createElement('span');
      tableName_span.innerHTML = `📋 ${tableName} <span style="color: var(--text-secondary); font-size: 11px;">(${tableInfo.columns.length})</span>`;
      tableName_span.style.flex = '1';
      tableName_span.style.cursor = 'pointer';
      
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
      
      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadTableData(schemaName, tableName);
      });
      
      tableName_span.addEventListener('click', () => {
        selectTable(schemaName, tableName, tableInfo);
      });
      
      tableContent.appendChild(tableName_span);
      tableContent.appendChild(downloadBtn);
      tableEl.appendChild(tableContent);
      
      tablesEl.appendChild(tableEl);
    }
    
    schemaEl.addEventListener('click', (e) => {
      if (e.target === schemaEl) {
        tablesEl.style.display = tablesEl.style.display === 'none' ? 'block' : 'none';
      }
    });
    
    dbTree.appendChild(schemaEl);
    dbTree.appendChild(tablesEl);
  }
}

function selectTable(schemaName, tableName, tableInfo) {
  const fullTableName = `${schemaName}.${tableName}`;
  
  // Generate query with all column names
  const columnNames = tableInfo.columns.map(c => c.name).join(',\n  ');
  queryEditor.value = `SELECT\n  ${columnNames}\nFROM ${fullTableName}\nLIMIT 100;`;
  
  // Update line numbers after setting the value
  updateLineNumbers();
  
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');
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
  
  // Replace placeholders
  query = replacePlaceholders(query);
  
  resultsInfo.innerHTML = '<div class="loading"></div> Executing...';
  resultsTableContainer.innerHTML = '';
  
  // Disable export buttons initially
  disableExportButtons();
  
  try {
    const startTime = Date.now();
    const result = await window.api.executeQuery(currentConnectionId, query);
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
    
    // Keep only last 100 queries
    if (queryHistory.length > 100) {
      queryHistory = queryHistory.slice(0, 100);
    }
    
    if (result.success) {
      resultsInfo.textContent = `${result.rowCount} rows in ${result.executionTime}ms`;
      
      // Update global state for cell editing
      globalState.lastExecutedQuery = query;
      globalState.lastQueryResults = result.rows || [];
      
      if (result.rows && result.rows.length > 0) {
        renderResultsTable(result.rows, result.fields);
      } else {
        resultsTableContainer.innerHTML = `<div class="no-results">Query executed successfully. ${result.command} completed.</div>`;
        // Disable export buttons for non-SELECT queries
        disableExportButtons();
      }
      
      showNotification('Query executed successfully', 'success');
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
      showNotification('Query failed', 'error');
    }
  } catch (error) {
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
    
    if (queryHistory.length > 100) {
      queryHistory = queryHistory.slice(0, 100);
    }
    
    resultsInfo.textContent = 'Error';
    resultsTableContainer.innerHTML = `<div class="no-results" style="color: var(--error);">${error.message}</div>`;
    // Disable export buttons on error
    disableExportButtons();
    showNotification('Error executing query', 'error');
  }
}

function renderResultsTable(rows, fields) {
  const table = document.createElement('table');
  table.className = 'results-table';
  
  // Clear any existing selections
  clearAllSelections();
  
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
    
    // Add column selection handler
    th.addEventListener('click', (e) => {
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
      td.addEventListener('click', (e) => {
        const isCtrlCmd = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;
        
        if (isShift && lastSelectedCell) {
          // Range selection
          isShiftSelecting = true;
          clearAllSelections();
          selectCellRange(lastSelectedCell.rowIndex, lastSelectedCell.colIndex, rowIndex, colIndex);
          isShiftSelecting = false;
        } else {
          // Single cell or multi-selection
          selectCell(td, rowIndex, colIndex, isCtrlCmd);
        }
        
        e.preventDefault();
      });
      
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  resultsTableContainer.appendChild(table);
  
  // Enable export buttons when we have results and store data
  window.currentQueryResults = rows;
  enableExportButtons();
}

// Export Functions
window.currentQueryResults = [];

function enableExportButtons() {
  const exportButtons = document.getElementById('exportButtons');
  const buttons = exportButtons?.querySelectorAll('.export-btn');
  
  if (exportButtons) {
    exportButtons.classList.remove('disabled');
  }
  
  buttons?.forEach(btn => {
    btn.disabled = false;
  });
}

function disableExportButtons() {
  const exportButtons = document.getElementById('exportButtons');
  const buttons = exportButtons?.querySelectorAll('.export-btn');
  
  if (exportButtons) {
    exportButtons.classList.add('disabled');
  }
  
  buttons?.forEach(btn => {
    btn.disabled = true;
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

// Make export function global
window.exportResults = exportResults;

// Database and Table Backup/Download Functions
async function downloadDatabaseBackup(databaseId, databaseName) {
  try {
    showNotification('Generating database backup...', 'info');
    
    const result = await window.api.generateDatabaseBackup(databaseId);
    
    if (result.success) {
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
      
      if (saveResult.success) {
        showNotification('Database backup saved successfully', 'success');
      } else if (!saveResult.canceled) {
        showNotification('Failed to save backup: ' + saveResult.error, 'error');
      }
    } else {
      showNotification('Failed to generate backup: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error downloading database backup:', error);
    showNotification('Error downloading backup: ' + error.message, 'error');
  }
}

async function downloadTableData(schemaName, tableName) {
  try {
    showNotification('Downloading table data...', 'info');
    
    const fullTableName = `${schemaName}.${tableName}`;
    const query = `SELECT * FROM ${fullTableName}`;
    
    const result = await window.api.executeQuery(currentConnectionId, query);
    
    if (result.success && result.rows && result.rows.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const defaultFilename = `${tableName}_${timestamp}.csv`;
      
      // Convert to CSV
      const csvContent = convertToCSV(result.rows);
      
      // Use save dialog
      const saveResult = await window.api.saveFile({
        content: csvContent,
        defaultPath: defaultFilename,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (saveResult.success) {
        showNotification(`Table data saved: ${result.rowCount} rows`, 'success');
      } else if (!saveResult.canceled) {
        showNotification('Failed to save table data: ' + saveResult.error, 'error');
      }
    } else if (result.success && result.rowCount === 0) {
      showNotification('Table is empty, no data to download', 'error');
    } else {
      showNotification('Failed to download table data: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Error downloading table data:', error);
    showNotification('Error downloading table data: ' + error.message, 'error');
  }
}

// Make functions global
window.downloadDatabaseBackup = downloadDatabaseBackup;
window.downloadTableData = downloadTableData;

// AI Operations
async function generateSQL() {
  const prompt = aiPrompt.value.trim();
  
  if (!prompt) {
    showNotification('Please enter a prompt', 'error');
    return;
  }
  
  if (!currentConnectionId || !currentSchema) {
    showNotification('Please connect to a database first', 'error');
    return;
  }
  
  showNotification('Generating SQL...', 'info');
  queryEditor.value = '-- Generating...';
  
  try {
    const result = await window.api.generateSQL(prompt, currentSchema, currentConnectionId);
    
    if (result.success) {
      queryEditor.value = result.query;
      showNotification('SQL generated successfully', 'success');
      aiPrompt.value = '';
    } else {
      queryEditor.value = `-- Error: ${result.error}`;
      showNotification('Failed to generate SQL', 'error');
    }
  } catch (error) {
    queryEditor.value = `-- Error: ${error.message}`;
    showNotification('Error generating SQL', 'error');
  }
}

async function explainQuery() {
  const query = queryEditor.value.trim();
  
  if (!query) {
    showNotification('Please enter a query to explain', 'error');
    return;
  }
  
  if (!currentSchema) {
    showNotification('Please connect to a database first', 'error');
    return;
  }
  
  try {
    const result = await window.api.explainQuery(query, currentSchema);
    
    if (result.success) {
      addAIMessage('assistant', result.explanation);
      aiPanel.classList.remove('hidden');
      showNotification('Query explained', 'success');
    } else {
      showNotification('Failed to explain query', 'error');
    }
  } catch (error) {
    showNotification('Error explaining query', 'error');
  }
}

// AI Chat
function toggleAIPanel() {
  aiPanel.classList.toggle('hidden');
}

async function sendChatMessage() {
  const message = aiChatInput.value.trim();
  
  if (!message) return;
  
  addAIMessage('user', message);
  aiChatInput.value = '';
  
  const context = {
    schema: currentSchema,
    connectionName: connections.find(c => c.id === currentConnectionId)?.name,
    currentTable: null
  };
  
  try {
    const result = await window.api.chatWithAI(message, context, chatHistory);
    
    if (result.success) {
      addAIMessage('assistant', result.response);
      
      chatHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: result.response }
      );
      
      // Keep only last 6 conversations (12 messages)
      if (chatHistory.length > 12) {
        chatHistory = chatHistory.slice(-12);
      }
    } else {
      addAIMessage('assistant', 'Sorry, I encountered an error: ' + result.error);
    }
  } catch (error) {
    addAIMessage('assistant', 'Sorry, I encountered an error: ' + error.message);
  }
}

function addAIMessage(role, content) {
  const messageEl = document.createElement('div');
  messageEl.className = `ai-message ${role}`;
  
  // Format code blocks
  const formattedContent = content.replace(/```sql\n([\s\S]*?)```/g, '<pre>$1</pre>');
  messageEl.innerHTML = formattedContent.replace(/\n/g, '<br>');
  
  aiChatContainer.appendChild(messageEl);
  aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
}

// PSQL Terminal
async function executePSQLCommand() {
  const command = psqlInput.value.trim();
  
  if (!command) return;
  
  if (!currentConnectionId) {
    addPSQLOutput('error', 'Not connected to any database');
    return;
  }
  
  addPSQLOutput('command', command);
  psqlInput.value = '';
  
  try {
    const result = await window.api.executeQuery(currentConnectionId, command);
    
    if (result.success) {
      if (result.rows && result.rows.length > 0) {
        addPSQLOutput('result', JSON.stringify(result.rows, null, 2));
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
  psqlOutput.scrollTop = psqlOutput.scrollHeight;
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
    case 'variables':
      loadVariables();
      break;
    case 'psql':
      // Reset PSQL input if needed
      const psqlInput = document.getElementById('psqlInput');
      if (psqlInput) psqlInput.focus();
      break;
    case 'dbml':
      // Refresh DBML view if needed
      const dbmlCanvas = document.getElementById('dbmlCanvas');
      if (dbmlCanvas && dbmlCanvas.innerHTML.includes('no-results')) {
        renderDBML();
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
function loadSnippets() {
  try {
    const saved = localStorage.getItem('neurodb_snippets');
    snippets = saved ? JSON.parse(saved) : [];
    renderSnippets();
  } catch (error) {
    console.error('Error loading snippets:', error);
    showNotification('Error loading snippets', 'error');
    snippets = [];
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

function saveSnippets() {
  localStorage.setItem('neurodb_snippets', JSON.stringify(snippets));
}

function saveVariables() {
  localStorage.setItem('neurodb_variables', JSON.stringify(variables));
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

function saveSnippet(event) {
  event.preventDefault();
  
  const id = document.getElementById('snippetId').value || Date.now().toString();
  const snippet = {
    id,
    name: document.getElementById('snippetName').value,
    shortcut: document.getElementById('snippetShortcut').value.toLowerCase().replace(/\s/g, ''),
    query: document.getElementById('snippetQuery').value,
    description: document.getElementById('snippetDescription').value
  };
  
  const index = snippets.findIndex(s => s.id === id);
  if (index >= 0) {
    snippets[index] = snippet;
  } else {
    snippets.push(snippet);
  }
  
  saveSnippets();
  renderSnippets();
  document.getElementById('snippetModal').classList.add('hidden');
  showNotification('Snippet saved successfully', 'success');
}

function editSnippet(id) {
  const snippet = snippets.find(s => s.id === id);
  if (snippet) {
    openSnippetModal(snippet);
  }
}

function deleteSnippet(id) {
  if (confirm('Are you sure you want to delete this snippet?')) {
    snippets = snippets.filter(s => s.id !== id);
    saveSnippets();
    renderSnippets();
    showNotification('Snippet deleted', 'success');
  }
}

function useSnippet(id) {
  const snippet = snippets.find(s => s.id === id);
  if (snippet) {
    switchMainTab('query');
    queryEditor.value = snippet.query;
    showNotification('Snippet loaded into editor', 'success');
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
      const databases = result.databases || [];
      databases.forEach(db => {
        if (!db || !db.name) return; // Skip invalid entries
        if (addedDatabases.has(db.name)) return; // Skip already added databases
        
        const item = document.createElement('div');
        item.className = 'database-item';
        item.innerHTML = `
          <div class="database-name">${db.name}</div>
          <button class="btn-secondary btn-sm" onclick="addDatabaseToConnections('${serverId}', '${db.name}')">
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
  const input = document.getElementById('newDatabaseName');
  const databaseName = input.value.trim();
  
  if (!databaseName) {
    showNotification('Please enter a database name', 'error');
    return;
  }
  
  try {
    const result = await window.api.createDatabase(serverId, databaseName);
    
    if (result.success) {
      showNotification('Database created successfully', 'success');
      // Add the new database to connections
      await addDatabaseToConnections(serverId, databaseName);
      // Refresh the database list
      await listDatabasesOnServer(serverId);
    } else {
      showNotification(result.error || 'Failed to create database', 'error');
    }
  } catch (error) {
    console.error('Error creating database:', error);
    showNotification('Failed to create database', 'error');
  }
}

function showCreateDatabaseForm(serverId) {
  const createButton = document.getElementById('createDatabaseButton');
  const createForm = document.getElementById('createDatabaseForm');
  if (createButton && createForm) {
    createButton.classList.add('hidden');
    createForm.classList.remove('hidden');
    document.getElementById('newDatabaseName')?.focus();
  }
}

function hideCreateDatabaseForm() {
  const createButton = document.getElementById('createDatabaseButton');
  const createForm = document.getElementById('createDatabaseForm');
  if (createButton && createForm) {
    createButton.classList.remove('hidden');
    createForm.classList.add('hidden');
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
function renderDBML() {
  const dbmlScript = document.getElementById('dbmlEditor').value;
  const canvas = document.getElementById('dbmlCanvas');
  
  if (!dbmlScript.trim()) {
    canvas.innerHTML = '<div class="no-results">Enter DBML script and click Render</div>';
    return;
  }
  
  try {
    const parsed = parseDBML(dbmlScript);
    dbmlTables = parsed.tables;
    dbmlRelationships = parsed.relationships;
    
    renderDBMLDiagram();
    showNotification('Diagram rendered successfully', 'success');
  } catch (error) {
    canvas.innerHTML = `<div class="no-results" style="color: var(--error);">Error parsing DBML: ${error.message}</div>`;
    showNotification('Error parsing DBML', 'error');
  }
}

function parseDBML(script) {
  const tables = [];
  const relationships = [];
  
  const lines = script.split('\n').map(l => l.trim());
  let currentTable = null;
  
  for (let line of lines) {
    if (line.startsWith('//') || !line) continue;
    
    if (line.startsWith('Table ')) {
      const name = line.match(/Table\s+(\w+)/)?.[1];
      if (name) {
        currentTable = { name, columns: [], x: Math.random() * 400 + 50, y: Math.random() * 400 + 50 };
        tables.push(currentTable);
      }
    } else if (currentTable && line.match(/^\w+\s+\w+/)) {
      const match = line.match(/(\w+)\s+([\w()]+)(\s+\[(.*?)\])?/);
      if (match) {
        const [, name, type, , attrs] = match;
        const column = {
          name,
          type,
          isPK: attrs?.includes('pk') || attrs?.includes('primary key'),
          isFK: false
        };
        
        const refMatch = attrs?.match(/ref:\s*([><])\s*(\w+)\.(\w+)/);
        if (refMatch) {
          const [, dir, refTable, refCol] = refMatch;
          column.isFK = true;
          relationships.push({
            from: currentTable.name,
            fromCol: name,
            to: refTable,
            toCol: refCol
          });
        }
        
        currentTable.columns.push(column);
      }
    } else if (line === '}') {
      currentTable = null;
    }
  }
  
  return { tables, relationships };
}

function renderDBMLDiagram() {
  const canvas = document.getElementById('dbmlCanvas');
  canvas.innerHTML = '';
  canvas.style.position = 'relative';
  canvas.style.minHeight = '600px';
  
  // Create SVG for relationship lines
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  canvas.appendChild(svg);
  
  // Render tables
  dbmlTables.forEach(table => {
    const card = createTableCard(table);
    canvas.appendChild(card);
  });
  
  // Render relationships
  setTimeout(() => renderRelationships(svg), 100);
}

function createTableCard(table) {
  const card = document.createElement('div');
  card.className = 'db-table-card';
  card.style.left = table.x + 'px';
  card.style.top = table.y + 'px';
  card.dataset.tableName = table.name;
  
  let html = `<div class="db-table-header">📋 ${table.name}</div><div class="db-table-body">`;
  
  table.columns.forEach(col => {
    const key = col.isPK ? '<span class="column-key">PK</span>' : col.isFK ? '<span class="column-key">FK</span>' : '';
    html += `
      <div class="db-table-column">
        <span class="column-name">${col.name}</span>
        <span><span class="column-type">${col.type}</span> ${key}</span>
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
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = startLeft + dx;
      const newTop = startTop + dy;
      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
      table.x = newLeft;
      table.y = newTop;
      
      // Update relationship lines
      const svg = document.querySelector('.dbml-canvas svg');
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
      const fromRect = fromCard.getBoundingClientRect();
      const toRect = toCard.getBoundingClientRect();
      const canvasRect = svg.parentElement.getBoundingClientRect();
      
      const x1 = fromRect.left + fromRect.width / 2 - canvasRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
      const x2 = toRect.left + toRect.width / 2 - canvasRect.left;
      const y2 = toRect.top + toRect.height / 2 - canvasRect.top;
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', '#007acc');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '0.6');
      
      svg.appendChild(line);
    }
  });
}

// Toggle Sidebar and Database Browser
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const icon = toggleBtn.querySelector('svg');
  
  sidebar.classList.toggle('hidden');
  
  // Rotate the chevron icon
  if (sidebar.classList.contains('hidden')) {
    icon.style.transform = 'rotate(-90deg)';
  } else {
    icon.style.transform = 'rotate(0deg)';
  }
}

function toggleDBBrowser() {
  const dbBrowser = document.getElementById('dbBrowser');
  const toggleBtn = document.getElementById('toggleDBBrowserBtn');
  const showBtn = document.getElementById('showDBBrowserBtn');
  const icon = toggleBtn.querySelector('svg');
  
  dbBrowser.classList.toggle('hidden');
  
  // Show/hide the show button in the AI prompt bar
  if (dbBrowser.classList.contains('hidden')) {
    icon.style.transform = 'rotate(-90deg)';
    showBtn.classList.remove('hidden');
  } else {
    icon.style.transform = 'rotate(0deg)';
    showBtn.classList.add('hidden');
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
    div.dataset.tableName = item.fullName;
    
    const typeLabel = document.createElement('span');
    typeLabel.className = `autocomplete-item-type ${item.type}`;
    typeLabel.textContent = item.type === 'table' ? 'TBL' : 'VIEW';
    
    const name = document.createElement('span');
    name.className = 'autocomplete-item-name';
    name.textContent = item.fullName;
    
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
    const newText = textBeforeCursor.substring(0, matchStart) + 
                    `{{${shortcut}}}` + 
                    textAfterCursor;
    
    queryEditor.value = newText;
    queryEditor.selectionStart = queryEditor.selectionEnd = 
      matchStart + `{{${shortcut}}}`.length;
    
    updateLineNumbers();
  } 
  // Check if this is a table/view selection
  else {
    const tableName = selected.dataset.tableName;
    
    // Find the SQL keyword and current word
    const sqlKeywords = /\b(FROM|JOIN|INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|UPDATE|INTO|TABLE)\s+(\w*)$/i;
    const sqlMatch = textBeforeCursor.match(sqlKeywords);
    
    if (sqlMatch && tableName) {
      const keywordEnd = textBeforeCursor.lastIndexOf(sqlMatch[2]) || textBeforeCursor.length;
      const newText = textBeforeCursor.substring(0, keywordEnd) + 
                      tableName + 
                      textAfterCursor;
      
      queryEditor.value = newText;
      queryEditor.selectionStart = queryEditor.selectionEnd = 
        keywordEnd + tableName.length;
      
      updateLineNumbers();
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
  content.innerHTML = `
    <div class="cell-popover-view">
      <pre class="cell-content-display">${fullValue}</pre>
      <div class="cell-popover-actions">
        <button class="btn-secondary btn-sm" onclick="startPopoverEdit('${columnName}', ${rowIndex}, '${fullValue.replace(/'/g, "\\'")}')">
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
  
  // Hide popover when clicking elsewhere
  setTimeout(() => {
    document.addEventListener('click', hideCellPopover);
  }, 0);
}

function hideCellPopover() {
  const popover = document.getElementById('cellPopover');
  popover.classList.add('hidden');
  document.removeEventListener('click', hideCellPopover);
}

// Start editing in the popover
function startPopoverEdit(columnName, rowIndex, currentValue) {
  const content = document.getElementById('cellPopoverContent');
  
  content.innerHTML = `
    <div class="cell-popover-edit">
      <label class="cell-edit-label">Editing: ${columnName}</label>
      <textarea class="cell-edit-textarea" rows="4" cols="40">${currentValue}</textarea>
      <div class="cell-popover-actions">
        <button class="btn-primary btn-sm" onclick="saveCellEdit()">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 2l-1 1-8 8-4-4 1-1 3 3 7-7z"/>
          </svg>
          Save
        </button>
        <button class="btn-secondary btn-sm" onclick="cancelCellEdit('${columnName}', ${rowIndex}, '${currentValue.replace(/'/g, "\\'")}')">Cancel</button>
      </div>
    </div>
  `;
  
  // Focus on textarea
  const textarea = content.querySelector('.cell-edit-textarea');
  textarea.focus();
  textarea.select();
  
  // Handle Enter + Ctrl to save
  textarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      saveCellEdit();
    } else if (e.key === 'Escape') {
      cancelCellEdit(columnName, rowIndex, currentValue);
    }
  });
}

// Make cell popover functions globally accessible
window.showCellPopover = showCellPopover;
window.hideCellPopover = hideCellPopover;
window.startPopoverEdit = startPopoverEdit;
window.cancelCellEdit = cancelCellEdit;
window.saveCellEdit = saveCellEdit;

// Cancel editing and return to view mode
function cancelCellEdit(columnName, rowIndex, originalValue) {
  const content = document.getElementById('cellPopoverContent');
  
  content.innerHTML = `
    <div class="cell-popover-view">
      <pre class="cell-content-display">${originalValue}</pre>
      <div class="cell-popover-actions">
        <button class="btn-secondary btn-sm" onclick="startPopoverEdit('${columnName}', ${rowIndex}, '${originalValue.replace(/'/g, "\\'")}')">
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
  const popover = document.getElementById('cellPopover');
  const textarea = document.querySelector('.cell-edit-textarea');
  const newValue = textarea.value;
  const columnName = popover.dataset.columnName;
  const rowIndex = parseInt(popover.dataset.rowIndex);
  
  try {
    // Show loading state
    const saveBtn = document.querySelector('.cell-popover-edit .btn-primary');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span>Saving...</span>';
    saveBtn.disabled = true;
    
    // Get current query results to identify the table and construct WHERE clause
    const currentResults = globalState.lastQueryResults;
    if (!currentResults || !currentResults.length) {
      throw new Error('No query results available for updating');
    }
    
    // Try to identify primary key or unique identifier
    const row = currentResults[rowIndex];
    const primaryKeys = ['id', 'ID', 'Id', '_id', 'pk', 'primary_key'];
    let whereClause = '';
    let primaryKeyFound = false;
    
    // Look for a primary key column
    for (const pk of primaryKeys) {
      if (row.hasOwnProperty(pk)) {
        whereClause = `${pk} = '${row[pk]}'`;
        primaryKeyFound = true;
        break;
      }
    }
    
    // If no primary key found, use all columns except the one being edited
    if (!primaryKeyFound) {
      const conditions = [];
      for (const [key, value] of Object.entries(row)) {
        if (key !== columnName) {
          conditions.push(`${key} = '${value}'`);
        }
      }
      whereClause = conditions.join(' AND ');
    }
    
    // Extract table name from last query if possible
    let tableName = '';
    const lastQuery = globalState.lastExecutedQuery || '';
    const fromMatch = lastQuery.match(/FROM\s+([^\s]+)/i);
    if (fromMatch) {
      tableName = fromMatch[1];
    } else {
      throw new Error('Could not determine table name from query');
    }
    
    // Construct UPDATE query
    const updateQuery = `UPDATE ${tableName} SET ${columnName} = '${newValue.replace(/'/g, "''")}' WHERE ${whereClause}`;
    
    // Execute update query
    const updateResult = await window.api.executeQuery(currentConnectionId, updateQuery);
    
    if (updateResult.error) {
      throw new Error(updateResult.error);
    }
    
    // Update the cell in the table display
    const tableBody = document.querySelector('#queryResultsTable tbody');
    const rowElement = tableBody.children[rowIndex];
    const cellIndex = Array.from(document.querySelectorAll('#queryResultsTable thead th')).findIndex(th => th.textContent === columnName);
    
    if (rowElement && cellIndex >= 0) {
      const cell = rowElement.children[cellIndex];
      const truncatedValue = newValue.length > 50 ? newValue.substring(0, 50) + '...' : newValue;
      cell.innerHTML = `<span onclick="showCellPopover(event, '${columnName}', '${newValue.replace(/'/g, "\\'")}', ${rowIndex}, this)" style="cursor: pointer;">${truncatedValue}</span>`;
      
      // Update the global results
      globalState.lastQueryResults[rowIndex][columnName] = newValue;
    }
    
    // Show success and return to view mode
    showNotification('Cell updated successfully', 'success');
    
    // Return to view mode with new value
    const content = document.getElementById('cellPopoverContent');
    content.innerHTML = `
      <div class="cell-popover-view">
        <pre class="cell-content-display">${newValue}</pre>
        <div class="cell-popover-actions">
          <button class="btn-secondary btn-sm" onclick="startPopoverEdit('${columnName}', ${rowIndex}, '${newValue.replace(/'/g, "\\'")}')">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l2 2-8 8-4 1 1-4 8-8z"/>
            </svg>
            Edit
          </button>
          <button class="btn-secondary btn-sm" onclick="hideCellPopover()">Close</button>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('Error updating cell:', error);
    showNotification(`Error updating cell: ${error.message}`, 'error');
    
    // Reset button state
    const saveBtn = document.querySelector('.cell-popover-edit .btn-primary');
    if (saveBtn) {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }
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

async function saveCellEdit(td, rowIndex, columnName, newValue) {
  if (!currentEditingCell) return;
  
  const originalValue = td.dataset.originalValue;
  
  // If value hasn't changed, just cancel
  if (newValue === originalValue) {
    cancelCellEdit();
    return;
  }
  
  try {
    // Get the primary key or unique identifier for this row
    const table = td.closest('table');
    const headerRow = table.querySelector('thead tr');
    const headers = Array.from(headerRow.querySelectorAll('th')).slice(1).map(th => th.textContent); // Skip line number header
    
    const currentRow = Array.from(table.querySelectorAll('tbody tr'))[rowIndex];
    const rowData = {};
    
    Array.from(currentRow.querySelectorAll('td')).slice(1).forEach((cell, index) => { // Skip line number cell
      const header = headers[index];
      rowData[header] = cell.dataset.originalValue;
    });
    
    // Try to find a primary key or unique column
    // For now, we'll show a notification that manual editing needs more implementation
    showNotification('Cell editing is in development. Use SQL UPDATE statements for now.', 'info');
    cancelCellEdit();
    
    // TODO: Implement actual UPDATE query
    // This would require:
    // 1. Determining the table name
    // 2. Finding primary key or unique columns
    // 3. Building and executing UPDATE query
    // 4. Refreshing the results
    
  } catch (error) {
    showNotification('Error saving cell edit: ' + error.message, 'error');
    cancelCellEdit();
  }
}

function cancelCellEdit() {
  if (!currentEditingCell) return;
  
  const td = currentEditingCell;
  const originalValue = td.dataset.originalValue;
  
  // Restore original content
  td.classList.remove('editing');
  
  let displayValue = originalValue;
  if (displayValue.length > 50) {
    displayValue = displayValue.substring(0, 47) + '...';
  }
  
  td.textContent = displayValue;
  
  currentEditingCell = null;
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
  closeQueryHistoryModal();
  showNotification('Query loaded from history', 'success');
}

function clearQueryHistory() {
  if (confirm('Are you sure you want to clear all query history for this session?')) {
    queryHistory = [];
    renderQueryHistory();
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
window.closeQueryHistoryModal = closeQueryHistoryModal;
window.clearQueryHistory = clearQueryHistory;

// Initialize on load
loadSnippets();
loadVariables();
