function setupEventListeners() {
  // Add Connection
  const addConnectionBtn = document.getElementById('addConnectionBtn');
  if (addConnectionBtn) {
    addConnectionBtn.addEventListener('click', () => openConnectionModal());
  }
  
  const welcomeAddConnection = document.getElementById('welcomeAddConnection');
  if (welcomeAddConnection) {
    welcomeAddConnection.addEventListener('click', () => openConnectionModal());
  }
  
  // Header Tabs
  document.querySelectorAll('.header-tab').forEach(tab => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const tabName = tab.dataset.tab;
      if (tabName) {
        switchMainTab(tabName);
      }
    });
  });
  
  // Modals
  document.getElementById('closeConnectionModal')?.addEventListener('click', closeConnectionModal);
  document.getElementById('cancelConnectionBtn')?.addEventListener('click', closeConnectionModal);
  document.getElementById('testConnectionBtn')?.addEventListener('click', testConnection);
  connectionForm?.addEventListener('submit', saveConnection);
  
  // Query Editor
  document.getElementById('executeQueryBtn')?.addEventListener('click', executeQuery);
  document.getElementById('explainQueryBtn')?.addEventListener('click', explainQuery);
  document.getElementById('queryHistoryBtn')?.addEventListener('click', openQueryHistoryModal);
  document.getElementById('clearEditorBtn')?.addEventListener('click', () => {
    if (queryEditor) {
      queryEditor.value = '';
      updateLineNumbers();
    }
  });
  
  // Editor Features
  if (queryEditor) {
    queryEditor.addEventListener('input', () => {
      updateLineNumbers();
    });
    
    queryEditor.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
      }
    });
  }
  
  // Snippets and Variables
  document.getElementById('addSnippetBtn')?.addEventListener('click', () => openSnippetModal());
  document.getElementById('addVariableBtn')?.addEventListener('click', () => openVariableModal());
  
  // Settings
  document.getElementById('settingsBtn')?.addEventListener('click', openSettingsModal);
  
  // Theme handling
  document.getElementById('themeSelect')?.addEventListener('change', (e) => {
    changeTheme(e.target.value);
  });
}