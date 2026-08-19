const fs = require('fs');
const path = require('path');

class ConfigService {
  constructor() {
    this.configPath = path.join(__dirname, '../user-config.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading user config:', error);
    }
    
    // Return default config if file doesn't exist or error occurred
    return {
      theme: 'vscode-dark',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  saveConfig() {
    try {
      this.config.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      return { success: true };
    } catch (error) {
      console.error('Error saving user config:', error);
      return { success: false, error: error.message };
    }
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    this.config[key] = value;
    return this.saveConfig();
  }

  getTheme() {
    return this.config.theme || 'vscode-dark';
  }

  setTheme(theme) {
    return this.set('theme', theme);
  }

  getApiKey() {
    // Priority: user-configured key > environment variable
    return this.config.googleApiKey || process.env.GOOGLE_API_KEY || null;
  }

  setApiKey(apiKey) {
    return this.set('googleApiKey', apiKey);
  }

  hasApiKey() {
    return this.hasUserApiKey();
  }
  
  hasUserApiKey() {
    // Check if user has configured their own API key
    return !!(this.config.googleApiKey || process.env.GOOGLE_API_KEY);
  }

  getStoredApiKey() {
    // Returns the user's stored API key (not the default one)
    return this.config.googleApiKey || null;
  }

  clearApiKey() {
    // Removes the user's custom API key
    delete this.config.googleApiKey;
    return this.saveConfig();
  }

  getAll() {
    return { ...this.config };
  }

  reset() {
    this.config = {
      theme: 'vscode-dark',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.saveConfig();
  }

  // Query History Management
  getQueryHistory() {
    return this.config.queryHistory || [];
  }

  saveQueryHistory(history) {
    // Keep only last 25 queries
    const limitedHistory = history.slice(0, 25);
    this.config.queryHistory = limitedHistory;
    return this.saveConfig();
  }

  addQueryToHistory(queryItem) {
    const history = this.getQueryHistory();
    // Add to beginning
    history.unshift(queryItem);
    // Keep only last 25
    return this.saveQueryHistory(history);
  }

  clearQueryHistory() {
    this.config.queryHistory = [];
    return this.saveConfig();
  }
}

module.exports = ConfigService;