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
}

module.exports = ConfigService;