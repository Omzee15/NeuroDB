# NeuroDB

AI-Powered PostgreSQL Database Management Tool

NeuroDB is a cross-platform desktop application that brings AI capabilities to PostgreSQL database management, similar to how Warp enhances terminals and Cursor enhances VS Code.

## Features

- 🔌 **Multi-Connection Management**: Save and manage multiple PostgreSQL database connections
- 🤖 **AI-Powered SQL Generation**: Generate SQL queries from natural language prompts
- 📊 **Query Tool**: Execute SQL queries with beautiful result visualization
- 💻 **PSQL Terminal**: Interactive terminal for PostgreSQL commands
- 🧠 **Context-Aware AI**: AI assistant has full knowledge of your database schema
- 🔍 **Database Browser**: Visual tree view of schemas, tables, and columns
- 📝 **Query Explanation**: Get AI-powered explanations of complex queries
- 💬 **AI Chat Assistant**: Ask questions about your database and SQL

## Technology Stack

- **Electron**: Cross-platform desktop framework
- **PostgreSQL (pg)**: Database connectivity
- **LangChain**: AI orchestration framework
- **Google Gemini 2.0 Flash**: Large language model for SQL generation
- **Modern JavaScript**: ES6+ for clean, maintainable code

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database (for testing connections)
- Google API Key for Gemini

## Installation

1. Clone or navigate to the project directory:
```bash
cd /Users/pikachu/Desktop/J/Create/NeuroDB
```

2. Install dependencies:
```bash
npm install
```

3. The `.env` file is already configured with your API key

## Running the Application

### Development Mode
```bash
npm run electron:dev
```

This will start the application with DevTools open for debugging.

### Production Mode
```bash
npm start
```

## Building for Distribution

```bash
npm run build
```

This will create distributable packages for your platform in the `dist/` directory.

## Usage Guide

### 1. Creating a Connection

1. Click the "+" button in the sidebar or "Create Connection" on the welcome screen
2. Fill in your PostgreSQL connection details:
   - Connection Name
   - Host (e.g., localhost)
   - Port (default: 5432)
   - Database name
   - Username
   - Password
3. Click "Test Connection" to verify
4. Click "Save" to store the connection

### 2. Connecting to a Database

- Click on any saved connection in the sidebar
- The database browser will load showing your schemas and tables

### 3. Generating SQL with AI

**Method 1: AI Prompt Bar**
1. Type a natural language request in the AI prompt bar
   - Example: "Show all users created in the last 30 days"
   - Example: "Get the top 10 products by revenue"
2. Click "Generate" or press Enter
3. The AI will generate the SQL query in the editor

**Method 2: AI Chat Panel**
1. Click the AI assistant icon in the top bar
2. Chat with the AI about your database
3. Ask for query suggestions, explanations, or optimization tips

### 4. Executing Queries

1. Write or generate a SQL query in the editor
2. Click "Execute" or press `Ctrl+Enter` (Cmd+Enter on Mac)
3. View results in the table below

### 5. PSQL Terminal

1. Switch to the "PSQL Terminal" tab
2. Type PostgreSQL commands directly
3. Press Enter to execute

### 6. Query Explanation

1. Write or paste a complex SQL query
2. Click "Explain Query"
3. The AI will provide a detailed explanation in the AI panel

## AI Capabilities

The AI assistant has access to:
- Complete database schema (tables, columns, data types)
- Primary keys and foreign keys
- Constraints and indexes
- Your conversation history

It can help with:
- Generating SELECT, INSERT, UPDATE, DELETE queries
- Creating JOINs across multiple tables
- Writing complex WHERE clauses
- Aggregations and GROUP BY queries
- Window functions
- Query optimization suggestions
- Debugging SQL errors
- Database design advice

## Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Execute query in editor
- `Enter`: Submit in AI prompt bar (without Shift)
- `Shift + Enter`: New line in AI prompt
- `Enter`: Execute command in PSQL terminal

## Project Structure

```
NeuroDB/
├── main.js                 # Electron main process
├── preload.js             # Electron preload script (IPC bridge)
├── index.html             # Main UI
├── styles.css             # Application styles
├── renderer.js            # Frontend JavaScript
├── services/
│   ├── DatabaseService.js # PostgreSQL connection management
│   └── AIService.js       # LangChain + Gemini integration
├── package.json
├── .env                   # Environment variables (API keys)
└── connections.json       # Saved connections (auto-generated)
```

## Security Notes

- Database passwords are stored locally in `connections.json`
- Consider encrypting the connections file for production use
- The `.env` file contains your API key - never commit it to version control
- Add `.env` to `.gitignore` (already configured)

## Troubleshooting

### Cannot connect to database
- Verify PostgreSQL is running
- Check host, port, and credentials
- Ensure PostgreSQL allows connections from your machine
- Check `pg_hba.conf` for connection permissions

### AI not generating queries
- Verify your GOOGLE_API_KEY in `.env`
- Check internet connection
- Ensure you've connected to a database (AI needs schema context)

### Application won't start
- Run `npm install` to ensure all dependencies are installed
- Check for port conflicts (Electron uses port 5858 for debugging)
- Look for errors in the terminal output

## Future Enhancements

- [ ] Query history and favorites
- [ ] Export results to CSV/JSON
- [ ] Visual query builder
- [ ] Database migration tools
- [ ] Performance monitoring
- [ ] Multi-query execution
- [ ] Syntax highlighting in editor
- [ ] Auto-completion
- [ ] Connection encryption
- [ ] Cloud database support
- [ ] Collaborative features

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
