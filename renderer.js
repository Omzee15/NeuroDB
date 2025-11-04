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

// PSQL Terminal state
let psqlCommandHistory = []; // Store PSQL command history
let psqlHistoryIndex = -1; // Current position in command history
let psqlCurrentCommand = ''; // Store current command when navigating history

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

// Where Clause Builder Elements
const whereClauseBuilder = document.getElementById('whereClauseBuilder');
const selectedTableName = document.getElementById('selectedTableName');
const columnSelect = document.getElementById('columnSelect');
const operatorSelect = document.getElementById('operatorSelect');
const valueInput = document.getElementById('valueInput');
const executeWhereBtn = document.getElementById('executeWhereBtn');
const closeWhereBuilder = document.getElementById('closeWhereBuilder');

// Query execution control elements
const executeQueryBtn = document.getElementById('executeQueryBtn');
const executeSelectedBtn = document.getElementById('executeSelectedBtn');
const stopQueryBtn = document.getElementById('stopQueryBtn');
const limitSelect = document.getElementById('limitSelect');

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
  document.getElementById('executeSelectedBtn').addEventListener('click', executeSelectedQuery);
  document.getElementById('stopQueryBtn').addEventListener('click', stopQuery);
  document.getElementById('generateSQLBtn').addEventListener('click', generateSQL);
  document.getElementById('explainQueryBtn').addEventListener('click', explainQuery);
  document.getElementById('queryHistoryBtn').addEventListener('click', openQueryHistoryModal);
  document.getElementById('clearEditorBtn').addEventListener('click', () => {
    queryEditor.value = '';
    updateLineNumbers();
  });
  
  // Limit dropdown
  limitSelect.addEventListener('change', handleLimitChange);
  
  // Line numbers and autocomplete
  queryEditor.addEventListener('input', () => {
    updateLineNumbers();
    handleAutocomplete();
  });
  
  // Update execute selected button state on selection change
  queryEditor.addEventListener('selectionchange', updateExecuteSelectedButtonState);
  queryEditor.addEventListener('keyup', updateExecuteSelectedButtonState);
  queryEditor.addEventListener('mouseup', updateExecuteSelectedButtonState);
  
  queryEditor.addEventListener('scroll', () => {
    const lineNumbers = document.getElementById('lineNumbers');
    lineNumbers.scrollTop = queryEditor.scrollTop;
  });
  
  // Keyboard shortcuts
  queryEditor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      executeSelectedQuery();
      return;
    }
    
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
  document.getElementById('toggleSidebarBtn')?.addEventListener('click', toggleSidebar);
  document.getElementById('showSidebarBtn')?.addEventListener('click', toggleSidebar);
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
  document.getElementById('loadSchemaBtn').addEventListener('click', loadSchemaToDBML);
  document.getElementById('renderDBMLBtn').addEventListener('click', renderDBML);
  document.getElementById('clearDBMLBtn').addEventListener('click', () => {
    document.getElementById('dbmlEditor').value = '';
    const viewport = document.getElementById('dbmlViewport');
    if (viewport) {
      viewport.innerHTML = '<div class="no-results">Render your DBML script to see the diagram</div>';
    }
    resetDBMLZoom();
  });

  // DBML Zoom and Pan
  document.getElementById('zoomInBtn').addEventListener('click', () => zoomDBML(1.2));
  document.getElementById('zoomOutBtn').addEventListener('click', () => zoomDBML(0.8));
  document.getElementById('resetZoomBtn').addEventListener('click', resetDBMLZoom);
  
  // Initialize DBML pan and zoom
  initializeDBMLPanZoom();
  
  // Override execute query button to use placeholder replacement
  document.getElementById('executeQueryBtn').addEventListener('click', executeQuery);
  
  // Refresh Schema
  document.getElementById('refreshSchemaBtn').addEventListener('click', loadDatabaseSchema);
  
  // Database Search
  document.getElementById('dbSearchInput').addEventListener('input', (e) => {
    filterDatabaseTree(e.target.value);
  });
  
  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => openSettingsModal());
  document.getElementById('closeSettingsModal').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
  });
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    changeTheme(e.target.value);
  });
  
  // API Key Management
  document.getElementById('saveApiKeyBtn').addEventListener('click', () => saveApiKey());
  document.getElementById('toggleApiKeyVisibility').addEventListener('click', () => toggleApiKeyVisibility());
  document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveApiKey();
    }
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
  
  // Where Clause Builder
  executeWhereBtn.addEventListener('click', generateWhereQuery);
  closeWhereBuilder.addEventListener('click', hideWhereClauseBuilder);
  
  // Handle Enter key in value input
  valueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      generateWhereQuery();
    }
  });
  
  // Auto-hide certain operators that don't need values
  operatorSelect.addEventListener('change', (e) => {
    const operator = e.target.value;
    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      valueInput.style.display = 'none';
    } else {
      valueInput.style.display = 'block';
      if (operator === 'IN' || operator === 'NOT IN') {
        valueInput.placeholder = 'Enter comma-separated values...';
      } else if (operator === 'LIKE' || operator === 'ILIKE') {
        valueInput.placeholder = 'Enter pattern (use % for wildcard)...';
      } else {
        valueInput.placeholder = 'Enter value...';
      }
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
      const existingDbs = server?.databases?.map(db => db.name) || [];
      const availableDbs = result.databases.filter(dbName => !existingDbs.includes(dbName));
      
      listContainer.innerHTML = '';
      
      // Add "Create New Database" button at the top
      const createDbButton = document.createElement('button');
      createDbButton.className = 'btn-primary';
      createDbButton.style.width = '100%';
      createDbButton.style.marginBottom = '12px';
      createDbButton.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
          <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2"/>
        </svg>
        Create New Database
      `;
      createDbButton.onclick = () => showCreateDatabaseForm(serverId);
      listContainer.appendChild(createDbButton);
      
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
    console.log('Database schema result:', result);
    
    if (result.success) {
      currentSchema = result.schema;
      console.log('Current schema:', currentSchema);
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
        tableName_span.innerHTML = `� ${tableName} <span style="color: var(--text-secondary); font-size: 11px;">(${tableInfo.columns.length})</span>`;
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
        viewName_span.innerHTML = `� ${viewName} <span style="color: var(--text-secondary); font-size: 11px;">(view)</span>`;
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
          downloadTableData(schemaName, viewName);
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
  const columnNames = tableInfo.columns.map(c => c.name).join(',\n  ');
  
  // Handle table name formatting for PostgreSQL
  let formattedTableName = fullTableName;
  const nameParts = formattedTableName.split('.');
  if (nameParts.length > 2) {
    // Take the last two parts (schema.table)
    formattedTableName = `${nameParts[nameParts.length - 2]}.${nameParts[nameParts.length - 1]}`;
  } else if (nameParts.length === 1) {
    // If no schema specified, use just the table name
    formattedTableName = nameParts[0];
  }
  
  // Quote table name parts if they contain special characters or are reserved words
  const tableNameParts = formattedTableName.split('.');
  if (tableNameParts.length === 2) {
    const [schema, table] = tableNameParts;
    const quotedSchema = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) ? schema : `"${schema}"`;
    const quotedTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table) ? table : `"${table}"`;
    formattedTableName = `${quotedSchema}.${quotedTable}`;
  } else {
    formattedTableName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formattedTableName) ? formattedTableName : `"${formattedTableName}"`;
  }
  
  queryEditor.value = `SELECT\n  ${columnNames}\nFROM ${formattedTableName}${currentLimit === 'all' ? '' : `\nLIMIT ${currentLimit}`};`;
  
  // Update line numbers after setting the value
  updateLineNumbers();
  
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
  
  // Handle view name formatting for PostgreSQL
  let formattedViewName = fullViewName;
  const nameParts = formattedViewName.split('.');
  if (nameParts.length > 2) {
    // Take the last two parts (schema.view)
    formattedViewName = `${nameParts[nameParts.length - 2]}.${nameParts[nameParts.length - 1]}`;
  } else if (nameParts.length === 1) {
    // If no schema specified, use just the view name
    formattedViewName = nameParts[0];
  }
  
  // Quote view name parts if they contain special characters or are reserved words
  const viewNameParts = formattedViewName.split('.');
  if (viewNameParts.length === 2) {
    const [schema, view] = viewNameParts;
    const quotedSchema = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) ? schema : `"${schema}"`;
    const quotedView = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(view) ? view : `"${view}"`;
    formattedViewName = `${quotedSchema}.${quotedView}`;
  } else {
    formattedViewName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formattedViewName) ? formattedViewName : `"${formattedViewName}"`;
  }
  
  queryEditor.value = `SELECT *\nFROM ${formattedViewName}${currentLimit === 'all' ? '' : `\nLIMIT ${currentLimit}`};`;
  
  // Update line numbers after setting the value
  updateLineNumbers();
  
  // Hide where clause builder for views (since we don't have column info)
  hideWhereClauseBuilder();
  
  document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');
}

// Where Clause Builder Functions
function showWhereClauseBuilder(tableName, columns) {
  // Update table name in header
  selectedTableName.textContent = tableName;
  
  // Clear and populate column dropdown
  columnSelect.innerHTML = '<option value="">Select Column</option>';
  columns.forEach(column => {
    const option = document.createElement('option');
    option.value = column.name;
    option.textContent = `${column.name} (${column.type})`;
    columnSelect.appendChild(option);
  });
  
  // Reset form
  operatorSelect.value = '=';
  valueInput.value = '';
  
  // Show the where clause builder
  whereClauseBuilder.classList.remove('hidden');
}

function hideWhereClauseBuilder() {
  whereClauseBuilder.classList.add('hidden');
  selectedTableInfo = null;
}

function filterDatabaseTree(searchTerm) {
  const dbTree = document.getElementById('dbTree');
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
  
  // First hide all items
  allTreeItems.forEach(item => {
    item.style.display = 'none';
  });
  allTreeChildren.forEach(container => {
    container.style.display = 'none';
  });
  
  // Get all schema containers (first level children)
  const schemaElements = Array.from(dbTree.children).filter((child, index) => index % 2 === 0);
  const schemaContainers = Array.from(dbTree.children).filter((child, index) => index % 2 === 1);
  
  schemaElements.forEach((schemaEl, schemaIndex) => {
    const schemaContainer = schemaContainers[schemaIndex];
    if (!schemaContainer) return;
    
    let schemaHasMatches = false;
    
    // Get Tables and Views folders within this schema
    const folderElements = Array.from(schemaContainer.children).filter((child, index) => index % 2 === 0);
    const folderContainers = Array.from(schemaContainer.children).filter((child, index) => index % 2 === 1);
    
    folderElements.forEach((folderEl, folderIndex) => {
      const folderContainer = folderContainers[folderIndex];
      if (!folderContainer) return;
      
      let folderHasMatches = false;
      
      // Check items within this folder (Tables or Views)
      const items = folderContainer.querySelectorAll('.tree-item[data-type]');
      
      items.forEach(item => {
        const itemName = item.dataset.itemName;
        const schemaName = item.dataset.schemaName;
        const fullName = `${schemaName}.${itemName}`;
        
        if (itemName.toLowerCase().includes(searchLower) || 
            schemaName.toLowerCase().includes(searchLower) ||
            fullName.toLowerCase().includes(searchLower)) {
          item.style.display = 'flex';
          folderHasMatches = true;
          schemaHasMatches = true;
        }
      });
      
      // Show folder if it has matches
      if (folderHasMatches) {
        folderEl.style.display = 'flex';
        folderContainer.style.display = 'block';
      }
    });
    
    // Show schema if it has matches
    if (schemaHasMatches) {
      schemaEl.style.display = 'flex';
      schemaContainer.style.display = 'block';
    }
  });
}

function generateWhereQuery() {
  if (!selectedTableInfo) {
    showNotification('No table selected', 'error');
    return;
  }
  
  const column = columnSelect.value;
  const operator = operatorSelect.value;
  const value = valueInput.value.trim();
  
  if (!column) {
    showNotification('Please select a column', 'error');
    return;
  }
  
  // Build the WHERE clause
  let whereClause = '';
  let formattedValue = value;
  
  // Handle different operators
  if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
    whereClause = `${column} ${operator}`;
  } else if (operator === 'IN' || operator === 'NOT IN') {
    if (!value) {
      showNotification('Please enter values for IN/NOT IN (comma-separated)', 'error');
      return;
    }
    // Parse comma-separated values and format them
    const values = value.split(',').map(v => `'${v.trim()}'`).join(', ');
    whereClause = `${column} ${operator} (${values})`;
  } else {
    if (!value) {
      showNotification('Please enter a value', 'error');
      return;
    }
    
    // Quote the value if it's not a number
    if (isNaN(value) && operator !== 'LIKE' && operator !== 'ILIKE') {
      formattedValue = `'${value}'`;
    } else if (operator === 'LIKE' || operator === 'ILIKE') {
      formattedValue = `'${value}'`;
    }
    
    whereClause = `${column} ${operator} ${formattedValue}`;
  }
  
  // Generate the full query with properly formatted table name
  const columnNames = selectedTableInfo.info.columns.map(c => c.name).join(',\n  ');
  
  // Ensure proper table name formatting (schema.table_name)
  let tableName = selectedTableInfo.fullName;
  
  // If fullName contains more than one dot, it might be incorrectly formatted
  // Extract just the schema and table name
  const nameParts = tableName.split('.');
  if (nameParts.length > 2) {
    // Take the last two parts (schema.table)
    tableName = `${nameParts[nameParts.length - 2]}.${nameParts[nameParts.length - 1]}`;
  } else if (nameParts.length === 1) {
    // If no schema specified, use just the table name
    tableName = nameParts[0];
  }
  
  // For table names that are PostgreSQL reserved words or contain special characters, quote them
  const tableNameParts = tableName.split('.');
  if (tableNameParts.length === 2) {
    const [schema, table] = tableNameParts;
    // Quote individual parts if they contain special characters or are reserved words
    const quotedSchema = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) ? schema : `"${schema}"`;
    const quotedTable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table) ? table : `"${table}"`;
    tableName = `${quotedSchema}.${quotedTable}`;
  } else {
    // Single table name, quote if necessary
    tableName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName) ? tableName : `"${tableName}"`;
  }
  
  const query = `SELECT\n  ${columnNames}\nFROM ${tableName}\nWHERE ${whereClause}${currentLimit === 'all' ? '' : `\nLIMIT ${currentLimit}`};`;
  
  // Set the query in the editor
  queryEditor.value = query;
  updateLineNumbers();
  
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
        hideSearchControls();
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
    
    // Keep only last 100 queries
    if (queryHistory.length > 100) {
      queryHistory = queryHistory.slice(0, 100);
    }
    
    if (result.success) {
      resultsInfo.textContent = `${result.rowCount} rows in ${result.executionTime}ms (selected text)`;
      
      // Update global state for cell editing
      globalState.lastExecutedQuery = query;
      globalState.lastQueryResults = result.rows || [];
      
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
  } else {
    executeQueryBtn.disabled = false;
    executeQueryBtn.classList.remove('hidden');
    stopQueryBtn.classList.add('hidden');
    stopQueryBtn.disabled = true;
  }
}

// Cancel current query execution
async function stopQuery() {
  if (!currentQueryId || !isQueryExecuting) {
    showNotification('No query is currently executing', 'warning');
    return;
  }
  
  try {
    const result = await window.api.cancelQuery(currentQueryId);
    if (result.success) {
      showNotification('Query cancellation requested', 'info');
    } else {
      showNotification(`Failed to cancel query: ${result.error}`, 'error');
    }
  } catch (error) {
    showNotification(`Error cancelling query: ${error.message}`, 'error');
  }
}

function renderResultsTable(rows, fields) {
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
  
  // Enable export buttons when we have results
  enableExportButtons();
}

// Search and Sort functionality for results
function setupSearchControls() {
  const searchContainer = document.getElementById('resultsSearch');
  const columnSelect = document.getElementById('searchColumnSelect');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  
  // Sort controls
  const sortColumnSelect = document.getElementById('sortColumnSelect');
  const sortOrderSelect = document.getElementById('sortOrderSelect');
  const clearSortBtn = document.getElementById('clearSortBtn');
  
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
  clearBtn.replaceWith(clearBtn.cloneNode(true));
  const newClearBtn = document.getElementById('clearSearchBtn');
  
  // Clear previous event listeners for sort controls
  sortColumnSelect.replaceWith(sortColumnSelect.cloneNode(true));
  const newSortColumnSelect = document.getElementById('sortColumnSelect');
  sortOrderSelect.replaceWith(sortOrderSelect.cloneNode(true));
  const newSortOrderSelect = document.getElementById('sortOrderSelect');
  clearSortBtn.replaceWith(clearSortBtn.cloneNode(true));
  const newClearSortBtn = document.getElementById('clearSortBtn');
  
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
  newClearBtn.addEventListener('click', clearSearch);
  
  // Add sort event listeners
  newSortColumnSelect.addEventListener('change', performSort);
  newSortOrderSelect.addEventListener('change', performSort);
  newClearSortBtn.addEventListener('click', clearSort);
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
    const cells = row.querySelectorAll('td');
    let shouldShow = false;
    
    if (!searchTerm) {
      shouldShow = true;
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
            // Highlight the match
            highlightSearchTerm(cell, searchTerm);
          } else {
            // Remove existing highlights
            removeHighlight(cell);
          }
        } else {
          // Remove highlights from non-searched columns
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
  const fullValue = cell.dataset.fullValue || cell.textContent;
  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  const highlightedText = fullValue.replace(regex, '<span class="search-highlight">$1</span>');
  
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
        
        displayText = truncated.replace(regex, '<span class="search-highlight">$1</span>');
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
  
  // Remove all highlights and show all rows
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
      
      // Remove highlights
      const cells = row.querySelectorAll('td');
      cells.forEach(cell => removeHighlight(cell));
    });
    
    // Update results info
    updateResultsInfo(rows.length, rows.length);
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
  startWidth = th.offsetWidth;
  
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
}

function handleColumnResize(e) {
  if (!isResizing || !currentColumn) return;
  
  e.preventDefault();
  
  const deltaX = e.clientX - startX;
  const newWidth = Math.max(80, startWidth + deltaX); // Minimum width of 80px
  
  // Set the width on the header
  currentColumn.style.width = newWidth + 'px';
  currentColumn.style.minWidth = newWidth + 'px';
  
  // Find the column index and apply width to all cells in that column
  const columnIndex = parseInt(currentColumn.dataset.columnIndex);
  const table = currentColumn.closest('.results-table');
  
  // Apply width to all cells in this column
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    const cell = row.children[columnIndex + 1]; // +1 because of line number column
    if (cell) {
      cell.style.width = newWidth + 'px';
      cell.style.minWidth = newWidth + 'px';
      cell.style.maxWidth = newWidth + 'px';
    }
  });
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
  
  // Restore text selection
  document.body.style.userSelect = '';
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
    
    // Convert schema to DBML
    const dbmlScript = convertSchemaToDBML();
    if (dbmlScript) {
      // Set the DBML editor content
      const editor = document.getElementById('dbmlEditor');
      if (editor) {
        editor.value = dbmlScript;
      }
      
      // Auto-render the diagram
      renderDBML();
      showNotification('Schema loaded successfully', 'success');
    } else {
      showNotification('No schema data available', 'warning');
    }
  } catch (error) {
    console.error('Error loading schema to DBML:', error);
    showNotification('Error loading schema: ' + error.message, 'error');
  }
}

function renderDBML() {
  const dbmlScript = document.getElementById('dbmlEditor').value;
  const canvas = document.getElementById('dbmlCanvas');
  const viewport = document.getElementById('dbmlViewport');
  
  if (!dbmlScript.trim()) {
    if (viewport) {
      viewport.innerHTML = '<div class="no-results">Enter DBML script and click Render</div>';
    }
    return;
  }
  
  try {
    const parsed = parseDBML(dbmlScript);
    dbmlTables = parsed.tables;
    dbmlRelationships = parsed.relationships;
    
    renderDBMLDiagram();
    showNotification('Diagram rendered successfully', 'success');
  } catch (error) {
    console.error('DBML Parse Error:', error);
    if (viewport) {
      viewport.innerHTML = `<div class="no-results" style="color: var(--error);">Error parsing DBML: ${error.message}</div>`;
    }
    showNotification('Error parsing DBML', 'error');
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
  
  sidebar.classList.toggle('hidden');
  
  // Show/hide the show button in the title bar
  if (sidebar.classList.contains('hidden')) {
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
  const escapedValue = String(fullValue || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/`/g, '\\`');
  const displayValue = String(fullValue || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
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
    
    if (status.hasUserApiKey) {
      statusElement.textContent = '✓ Using your custom API key';
      statusElement.style.color = 'var(--success-color)';
    } else if (status.usingDefaultKey) {
      statusElement.textContent = '✓ Using default API key (you can optionally set your own)';
      statusElement.style.color = 'var(--info-color, #4a9eff)';
    } else {
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

  // Keyboard shortcuts for zoom
  document.addEventListener('keydown', (e) => {
    const activeTab = document.querySelector('.header-tab.active');
    if (activeTab && activeTab.dataset.tab === 'dbml') {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomDBML(1.2);
        } else if (e.key === '-') {
          e.preventDefault();
          zoomDBML(0.8);
        } else if (e.key === '0') {
          e.preventDefault();
          resetDBMLZoom();
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
