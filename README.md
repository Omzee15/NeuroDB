# NeuroDB

AI-Powered PostgreSQL Database Management Tool

Cursor for pgadmin

## Features

- 🔌 **Multi-Connection Management**: Save and manage multiple PostgreSQL database connections
- 🤖 **AI-Powered SQL Generation**: Generate SQL queries from natural language prompts
- 📊 **Query Tool**: Execute SQL queries with beautiful result visualization
- 💻 **PSQL Terminal**: Interactive terminal for PostgreSQL commands
- 🔍 **Database Browser**: Visual tree view of schemas, tables, and columns
- 📝 **Query Explanation**: Get AI-powered explanations of complex queries
- 💬 **AI Chat Assistant**: Ask questions about your database and SQL

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

## Technology Stack

- **Electron**: Cross-platform desktop framework
- **PostgreSQL (pg)**: Database connectivity
- **LangChain**: AI orchestration framework
- **Google Gemini 2.0 Flash**: Large language model for SQL generation
- **Modern JavaScript**: ES6+ for clean, maintainable code

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/Omzee15/NeuroDB.git
cd NeuroDB
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file and add your Google API key:
```bash
GOOGLE_API_KEY=your_api_key_here
```

4. Run the application:
```bash
npm run electron:dev
```

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
