# NeuroDB

AI-Powered PostgreSQL Database Management Tool

Cursor for pgadmin

## Features

- 🔌 **Multi-Connection Management**: Save and manage multiple PostgreSQL database connections
- 🤖 **AI-Powered SQL Generation**: Generate SQL queries from natural language prompts
- � **Snippets Management**: Save and reuse frequently used SQL queries with custom shortcuts
- � **Variables System**: Create and manage variables for dynamic query parameters
- 🔍 **Database Browser**: Visual explorer for your database structure with schema diagrams
- 📝 **Query Explanation**: Get AI-powered explanations of complex queries
- 💬 **AI Chat Assistant**: Ask questions about your database and get instant SQL solutions

## AI Capabilities

NeuroDB's AI maintains persistent context of your database schema, eliminating the need to repeatedly explain table structures or relationships. Unlike traditional AI tools like ChatGPT, it:

- Automatically understands your complete database structure
- Remembers table relationships and foreign key connections
- Generates complex multi-table JOIN queries instantly
- Creates sophisticated WHERE clauses considering actual table constraints
- Provides contextually accurate query suggestions based on your schema
- Maintains conversation context for follow-up query refinements

Simply describe what you need in plain English, and the AI will generate the correct SQL, already optimized for your specific database structure - no need to explain your schema every time.

## Technology Stack

- **Electron**: Cross-platform desktop framework
- **PostgreSQL (pg)**: Database connectivity
- **LangChain**: AI orchestration framework
- **Google Gemini 2.0 Flash**: Large language model for SQL generation
- **Modern JavaScript**: ES6+ for clean, maintainable code

## Installation

Download the latest release from the [Releases page](https://github.com/Omzee15/NeuroDB/releases).

### macOS
1. Download the appropriate DMG file (Intel or ARM64)
2. Install to Applications folder
3. Run this command in Terminal:
```bash
xattr -cr /Applications/NeuroDB.app
```

### Windows
1. Download and run the `.exe` installer
2. Click "More info" → "Run anyway" if SmartScreen appears

### Linux
```bash
chmod +x NeuroDB-[version].AppImage
./NeuroDB-[version].AppImage
```

---

## Development Setup

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


