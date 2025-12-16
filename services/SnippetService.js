const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SnippetService {
  constructor() {
    // Determine config path based on whether app is packaged
    const isPackaged = app.isPackaged;
    if (isPackaged) {
      const userDataPath = app.getPath('userData');
      this.snippetsPath = path.join(userDataPath, 'snippets.json');
      console.log('SnippetService initialized (packaged) at:', this.snippetsPath);
    } else {
      this.snippetsPath = path.join(__dirname, '../snippets.json');
      console.log('SnippetService initialized (dev) at:', this.snippetsPath);
    }

    // Initialize snippets array
    this.snippets = [];
    
    // Load existing snippets
    this.loadSnippets();
  }

  loadSnippets() {
    try {
      // First check if snippets file exists at config path
      if (fs.existsSync(this.snippetsPath)) {
        const data = fs.readFileSync(this.snippetsPath, 'utf8');
        const config = JSON.parse(data);
        
        if (config.snippets && Array.isArray(config.snippets)) {
          this.snippets = config.snippets;
        } else {
          this.snippets = [];
        }

        console.log('Loaded snippets from:', this.snippetsPath, {
          count: this.snippets.length
        });
      } else {
        // Try to migrate from localStorage data if available
        // For now, just initialize with empty array
        this.snippets = [];
        console.log('No snippets file found, initialized with empty array');
      }
    } catch (error) {
      console.error('Error loading snippets:', error);
      this.snippets = [];
    }
  }

  saveSnippets() {
    try {
      const config = {
        snippets: this.snippets
      };
      
      // Ensure directory exists
      const snippetsDir = path.dirname(this.snippetsPath);
      if (!fs.existsSync(snippetsDir)) {
        fs.mkdirSync(snippetsDir, { recursive: true });
      }

      fs.writeFileSync(this.snippetsPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('Saved snippets:', {
        count: config.snippets.length
      });
    } catch (error) {
      console.error('Error saving snippets:', error);
    }
  }

  getSnippets() {
    return this.snippets;
  }

  addSnippet(snippet) {
    try {
      // Generate ID if not provided
      if (!snippet.id) {
        snippet.id = Date.now().toString();
      }

      this.snippets.push(snippet);
      this.saveSnippets();
      return { success: true, snippet };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  updateSnippet(snippetId, updatedSnippet) {
    try {
      const index = this.snippets.findIndex(s => s.id === snippetId);
      if (index === -1) {
        return { success: false, error: 'Snippet not found' };
      }

      this.snippets[index] = { ...this.snippets[index], ...updatedSnippet };
      this.saveSnippets();
      return { success: true, snippet: this.snippets[index] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  deleteSnippet(snippetId) {
    try {
      const index = this.snippets.findIndex(s => s.id === snippetId);
      if (index === -1) {
        return { success: false, error: 'Snippet not found' };
      }

      this.snippets.splice(index, 1);
      this.saveSnippets();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  exportSnippets(filePath) {
    try {
      const config = {
        snippets: this.snippets,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
      return { success: true, count: this.snippets.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  importSnippets(filePath, replaceExisting = false) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(data);

      if (!config.snippets || !Array.isArray(config.snippets)) {
        return { success: false, error: 'Invalid snippets file format' };
      }

      if (replaceExisting) {
        this.snippets = config.snippets;
      } else {
        // Merge snippets, avoiding duplicates by ID
        const existingIds = new Set(this.snippets.map(s => s.id));
        const newSnippets = config.snippets.filter(s => !existingIds.has(s.id));
        this.snippets.push(...newSnippets);
      }

      this.saveSnippets();
      return { success: true, count: this.snippets.length, imported: config.snippets.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Migrate from localStorage data
  migrateFromLocalStorage(localStorageData) {
    try {
      if (Array.isArray(localStorageData)) {
        // Add IDs to snippets that don't have them
        localStorageData.forEach(snippet => {
          if (!snippet.id) {
            snippet.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          }
        });

        this.snippets = localStorageData;
        this.saveSnippets();
        return { success: true, count: this.snippets.length };
      }
      return { success: false, error: 'Invalid data format' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = SnippetService;
