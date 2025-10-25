// State Management
let currentConnectionId = null;
let currentSchema = null;
let chatHistory = [];
let connections = [];
let snippets = [];
let variables = [];
let queryHistory = [];
let currentMainTab = 'query';
let globalState = {
  lastExecutedQuery: '',
  lastQueryResults: []
};
let currentTheme = 'vscode-dark';

// Initialize App
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  try {
    // Setup event listeners first
    setupEventListeners();
    
    // Load theme
    const theme = await window.api.getTheme();
    currentTheme = theme || 'vscode-dark';
    applyTheme(currentTheme);
    
    // Load connections
    await loadConnections();
    
    // Initialize UI state
    updateUIState();
    
    // Load editor state
    updateLineNumbers();
    
    // Load saved data
    await Promise.all([
      loadSnippets(),
      loadVariables()
    ]);
    
    // Set initial tab
    switchMainTab('query');
    
  } catch (error) {
    console.error('Error initializing app:', error);
    showNotification('Error initializing application', 'error');
  }
}

function updateUIState() {
  if (connections && connections.length > 0) {
    welcomeScreen.classList.add('hidden');
    databaseView.classList.remove('hidden');
  } else {
    welcomeScreen.classList.remove('hidden');
    databaseView.classList.add('hidden');
  }
}

// Load Connections
async function loadConnections() {
  try {
    const result = await window.api.getConnections();
    connections = Array.isArray(result) ? result : [];
    renderConnections();
    return connections;
  } catch (error) {
    console.error('Error loading connections:', error);
    showNotification('Failed to load connections', 'error');
    connections = [];
    renderConnections();
    return [];
  }
}

// Render Connections
function renderConnections() {
  if (!connectionsList) return;
  
  connectionsList.innerHTML = '';
  
  if (connections.length === 0) {
    connectionsList.innerHTML = '<div class="no-connections">No connections yet</div>';
    return;
  }
  
  connections.forEach(server => {
    const serverItem = document.createElement('div');
    serverItem.className = 'server-item';
    serverItem.dataset.serverId = server.id;
    
    const serverHtml = `
      <div class="server-header">
        <div class="server-info" onclick="toggleServer('${server.id}')">
          <svg class="server-toggle-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin: 0 6px;">
            <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/>
          </svg>
          <span class="server-name">${server.name}</span>
        </div>
        <div class="server-actions">
          <button class="btn-icon" onclick="openAddDatabaseModal('${server.id}')" title="Add Database">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    serverItem.innerHTML = serverHtml;
    
    // Add databases container
    const databasesContainer = document.createElement('div');
    databasesContainer.className = 'databases-container hidden';
    
    if (server.databases && server.databases.length > 0) {
      server.databases.forEach(db => {
        const dbItem = document.createElement('div');
        dbItem.className = 'database-item';
        if (db.id === currentConnectionId) dbItem.classList.add('active');
        
        dbItem.innerHTML = `
          <div class="database-info" onclick="connectToDatabase('${db.id}')">
            <span class="database-name">${db.name}</span>
            <span class="connection-status-dot ${db.connected ? 'connected' : ''}"></span>
          </div>
        `;
        
        databasesContainer.appendChild(dbItem);
      });
    } else {
      databasesContainer.innerHTML = '<div class="no-databases">No databases added</div>';
    }
    
    serverItem.appendChild(databasesContainer);
    connectionsList.appendChild(serverItem);
  });
}

// Tab Switching
function switchMainTab(tabName) {
  if (!tabName) return;
  
  currentMainTab = tabName;
  
  // Update header tabs
  document.querySelectorAll('.header-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  
  // Update content visibility
  document.querySelectorAll('.main-tab-content').forEach(content => {
    const isActive = content.dataset.mainContent === tabName;
    content.classList.toggle('active', isActive);
    content.style.display = isActive ? '' : 'none';
  });
  
  // Handle tab-specific actions
  if (tabName === 'snippets') {
    loadSnippets();
  } else if (tabName === 'variables') {
    loadVariables();
  } else if (tabName === 'psql') {
    document.getElementById('psqlInput')?.focus();
  } else if (tabName === 'query') {
    document.getElementById('queryEditor')?.focus();
  }
}

// Make functions available globally
window.toggleServer = toggleServer;
window.connectToDatabase = connectToDatabase;
window.openAddDatabaseModal = openAddDatabaseModal;