# NeuroDB - Complete Feature List

## 🎯 Overview
NeuroDB is a modern PostgreSQL database management tool built with Electron, featuring AI-powered SQL generation, intuitive UI, and powerful database management capabilities. Think of it as "Warp for Terminal, Cursor for VS Code, but for PostgreSQL".

---

## 🗄️ Database Connection Management

### Hierarchical Server/Database Structure
- **Server Management**
  - Add/edit/delete PostgreSQL servers
  - Server configurations stored with host, port, username, password
  - Visual server folders in the UI with expand/collapse functionality
  - Server icons with chevron rotation animation
  - Backward compatible with old flat connection format (auto-migration)

### Database Management
- **Multi-Database Support**
  - Add multiple databases per server
  - Connect to any database on a server
  - Visual connection status indicators (green dot when connected)
  - Connection buttons with arrow icons
  - Active database highlighting with accent color
  - Remove databases from servers

### Connection Actions
- **Connect Button**: Arrow icon (→) to connect to a database
- **Download Button**: Download icon to backup entire database
- **Delete Button**: Remove database from the list
- **Connection Testing**: Test connections before saving

---

## 📊 Query Tool

### Query Editor
- **Line Numbers**: Synchronized line numbers in left gutter
- **Syntax Highlighting Ready**: Monospace font with proper formatting
- **Multi-line Support**: Full SQL query editing capabilities
- **Auto-formatting**: Generated queries with proper indentation

### Query Execution
- **Execute Query**: Ctrl/Cmd + Enter to run queries
- **Clear Editor**: One-click clear button
- **Loading States**: Visual feedback during query execution
- **Error Handling**: Detailed error messages with hints

### Query Results
- **Tabular Display**: Clean table view with alternating row colors
- **Line Numbers**: Row numbers in results table (first column)
- **NULL Value Display**: Visual distinction for NULL values
- **JSON Object Support**: Automatic JSON stringification
- **Execution Time**: Query performance metrics
- **Row Count**: Number of rows returned
- **Export Options**: JSON, CSV, Excel (with save dialog)

### Export Functionality
- **JSON Export**: Pretty-printed JSON with 2-space indentation
- **CSV Export**: Standard CSV format with proper escaping
- **Excel Export**: CSV with UTF-8 BOM for Excel compatibility
- **Save Dialog**: Native OS file picker to choose save location
- **Disabled States**: Visual feedback when no results to export
- **Timestamps**: Auto-generated filenames with timestamps

---

## 🤖 AI Assistant

### SQL Generation
- **Natural Language to SQL**: Convert plain English to SQL queries
- **Schema-Aware**: Uses current database schema for accurate queries
- **Context-Aware**: Knows table names, column names, data types, constraints
- **Auto-Insert**: Generated SQL inserted directly into query editor
- **Error Handling**: Clear error messages when generation fails

### AI Chat Assistant
- **Interactive Chat**: Side panel for database questions
- **Conversation History**: Maintains last 6 conversations (12 messages)
- **Context Preservation**: Remembers previous questions and answers
- **Schema Context**: Full database schema available to AI
- **Connection Context**: Knows which database you're working with
- **Code Formatting**: SQL code blocks with proper formatting
- **Message Types**: Proper HumanMessage and AIMessage distinction

### AI Model Configuration
- **Model**: Gemini 2.0 Flash Exp
- **Temperature**: 0.3 (balanced creativity/consistency)
- **Max Tokens**: 2048
- **API Key**: Google Generative AI

---

## 🌲 Database Schema Browser

### Schema Tree View
- **Hierarchical Display**: Schema → Tables → Columns
- **Collapsible Sections**: Expand/collapse schemas and tables
- **Column Count**: Shows number of columns per table
- **Visual Icons**: Folder (📁) for schemas, Clipboard (📋) for tables

### Table Actions
- **Click to Generate Query**: Auto-generates SELECT query with all columns
- **Download Table Data**: Export entire table to CSV
- **Column Information**: View all columns with one click
- **Formatted Queries**: Multi-line SELECT with proper indentation

### Toggle Functionality
- **Toggle Button**: Show/hide database browser
- **Chevron Icon**: Visual indicator of panel state
- **Alternative Show Button**: Appears in AI prompt bar when hidden
- **Smooth Transitions**: Animated show/hide

---

## 🖥️ PSQL Terminal

### Terminal Emulation
- **Command Input**: Execute raw SQL commands
- **Output Display**: Scrollable terminal output
- **Command History**: View previous commands
- **Error Display**: Color-coded error messages
- **Result Formatting**: JSON formatting for query results
- **Connection Status**: Shows when not connected

---

## 📐 DBML Viewer

### DBML Editor
- **Syntax Highlighting**: Monospace editor for DBML
- **Multi-line Support**: Full DBML script editing
- **Example Template**: Built-in placeholder with DBML examples

### Diagram Rendering
- **Visual Tables**: Card-based table representation
- **Draggable Tables**: Drag and drop table positioning
- **Relationship Lines**: Visual foreign key relationships
- **SVG Canvas**: Scalable vector graphics
- **Auto-layout**: Smart positioning of tables
- **Refresh Button**: Re-render diagram
- **Clear Button**: Reset editor

---

## 📝 Snippets & Variables

### Snippet Management
- **Save SQL Queries**: Store frequently used queries
- **Shortcut System**: Use `{{shortcut}}` syntax in queries
- **Metadata**: Name, shortcut, description, SQL query
- **Snippet List**: View all saved snippets
- **Edit Snippets**: Modify existing snippets
- **Delete Snippets**: Remove unwanted snippets
- **Use Snippets**: One-click insert into query editor
- **Persistence**: Saved in localStorage

### Variable Management
- **Save Values**: Store connection strings, common values
- **Shortcut System**: Use `{{variable}}` syntax in queries
- **Metadata**: Name, shortcut, description, content
- **Variable List**: View all saved variables
- **Edit Variables**: Modify existing variables
- **Delete Variables**: Remove unwanted variables
- **Persistence**: Saved in localStorage

### Shortcut Features
- **Auto-replacement**: Variables/snippets replaced before query execution
- **Autocomplete Popover**: Type `{{` to see suggestions
- **Filtered Search**: Autocomplete filters as you type
- **Type Badges**: Visual distinction (SNIP for snippets, VAR for variables)
- **Keyboard Navigation**: Arrow keys, Enter, Tab, Escape
- **Hover Tooltips**: Show full content when hovering over `{{shortcut}}`
- **Tooltip Details**: Displays name, description, and content/query

---

## 🎨 Theme System

### Available Themes
1. **VS Code Dark** (Default): Classic VS Code dark theme
2. **Dark (ProjectNest)**: Modern dark theme with HSL colors
3. **Light**: Clean light theme for daytime use
4. **Solarized Light**: Popular Solarized color scheme

### Theme Features
- **Persistent Selection**: Theme saved in localStorage
- **Instant Switching**: No reload required
- **CSS Custom Properties**: Full theme customization
- **Dropdown Selector**: Easy theme switching in header
- **Consistent Colors**: All UI elements themed
- **Accent Colors**: Unique accent colors per theme

---

## 💾 Backup & Export

### Database Backup
- **Full Database Backup**: Complete SQL dump with structure and data
- **Schema Preservation**: Maintains all schemas
- **Table Structure**: CREATE TABLE statements with all constraints
- **Data Export**: INSERT statements for all rows
- **Metadata**: Includes database name, timestamp
- **Save Dialog**: Choose backup location
- **SQL Format**: Standard PostgreSQL SQL file

### Table Export
- **CSV Format**: Export individual tables to CSV
- **All Rows**: Exports complete table data
- **Column Headers**: Includes column names
- **Save Dialog**: Choose export location
- **Automatic Naming**: Table name + timestamp in filename

---

## 🎯 User Interface

### Window Management
- **Frameless Window**: Custom title bar
- **Minimize/Maximize/Close**: Standard window controls
- **Theme Selector**: Dropdown in title bar
- **Draggable**: Custom `-webkit-app-region` for dragging
- **Responsive**: Adapts to window size

### Layout
- **Three-Panel Layout**: 
  - Left: Connections & Database Browser
  - Center: Main content (Query Tool, PSQL, DBML, Snippets, Variables)
  - Right: AI Assistant Panel (toggle)
  
### Header Tabs
- **Query Tool**: SQL editor and results
- **PSQL**: Terminal interface
- **DB Viewer**: DBML diagram editor
- **Snippets**: Saved queries
- **Variables**: Saved values

### Visual Feedback
- **Loading Indicators**: Spinners during operations
- **Notifications**: Toast messages for success/error
- **Status Dots**: Green dot for active connections
- **Hover Effects**: Button highlights on hover
- **Active States**: Visual indication of selected items
- **Disabled States**: Reduced opacity for inactive buttons

### Animations
- **Smooth Transitions**: CSS transitions on UI changes
- **Chevron Rotation**: 90° rotation on expand/collapse
- **Fade In/Out**: Notification appearances
- **Hover Transforms**: Scale effects on buttons

---

## 🔧 Technical Features

### Data Persistence
- **Connection Storage**: JSON file for servers and databases
- **Snippet Storage**: localStorage with key `neurodb_snippets`
- **Variable Storage**: localStorage with key `neurodb_variables`
- **Theme Storage**: localStorage with key `theme`
- **Migration Support**: Auto-converts old connection format

### Performance
- **Connection Pooling**: PostgreSQL connection pools
- **Lazy Loading**: Connect only when needed
- **Query Optimization**: Efficient schema queries
- **Memory Management**: Cleanup on disconnect

### Security
- **Context Isolation**: Electron security best practices
- **No Node Integration**: Sandboxed renderer process
- **Preload Script**: Safe IPC communication
- **Environment Variables**: API keys in .env file

### Error Handling
- **Try-Catch Blocks**: Comprehensive error catching
- **User-Friendly Messages**: Clear error descriptions
- **Database Hints**: PostgreSQL error hints displayed
- **Graceful Degradation**: App continues on non-critical errors

---

## 🎮 Keyboard Shortcuts

### Query Editor
- **Ctrl/Cmd + Enter**: Execute query
- **Arrow Up/Down**: Navigate autocomplete (when open)
- **Enter/Tab**: Select autocomplete item
- **Escape**: Close autocomplete

### AI Chat
- **Enter**: Send message (without Shift)
- **Shift + Enter**: New line in message

---

## 📦 Technology Stack

### Frontend
- **Electron**: Desktop application framework
- **HTML/CSS/JavaScript**: Core web technologies
- **CSS Custom Properties**: Theme system
- **LocalStorage**: Client-side data persistence

### Backend
- **Node.js**: JavaScript runtime
- **PostgreSQL (pg)**: Database driver
- **LangChain**: AI framework
- **Google Generative AI**: AI model provider

### Development
- **dotenv**: Environment variable management
- **ES6+ Features**: Modern JavaScript
- **Async/Await**: Asynchronous operations
- **IPC Communication**: Main/renderer process communication

---

## 🚀 Advanced Features

### Smart Query Generation
- **All Column Names**: No truncation with `...`
- **Proper Formatting**: Multi-line SELECT statements
- **Schema Qualified**: Uses `schema.table` format
- **LIMIT Clause**: Defaults to 100 rows for safety

### Intelligent Autocomplete
- **Fuzzy Matching**: Finds shortcuts even with partial input
- **Case Insensitive**: Works regardless of case
- **Real-time Filtering**: Updates as you type
- **Position Aware**: Opens at cursor location

### Connection Intelligence
- **Auto-connect**: Remembers last connection
- **Visual Status**: Green dot for connected databases
- **Multi-database**: Switch between databases easily
- **Server Grouping**: Organized by server

---

## 📊 Statistics

### Code Metrics
- **renderer.js**: ~2000 lines of frontend logic
- **AIService.js**: ~220 lines of AI integration
- **DatabaseService.js**: ~600 lines of database operations
- **styles.css**: ~1600 lines of styling
- **Total Features**: 100+ distinct features implemented

---

## 🎯 Key Differentiators

1. **Hierarchical Connection Management**: Unlike traditional tools with flat lists
2. **AI-Powered SQL Generation**: Natural language to SQL
3. **Modern UI**: Clean, theme-able interface inspired by VS Code
4. **Snippet System**: Powerful variable/snippet replacement with autocomplete
5. **Integrated Tools**: Query tool, terminal, DBML viewer all in one
6. **Export Options**: Multiple formats with native save dialogs
7. **Backup System**: Full database and individual table backups
8. **Context-Aware AI**: AI knows your database schema and history
9. **Developer-Friendly**: Keyboard shortcuts, line numbers, formatting
10. **Cross-Platform**: Works on macOS, Windows, Linux

---

## 📝 Notes

- All features are production-ready and tested
- User data persisted across sessions
- Graceful error handling throughout
- Responsive design for different screen sizes
- Built with modern best practices and security in mind

---

**Version**: 1.0.0  
**Last Updated**: October 22, 2025  
**Repository**: PGWARP  
**Branch**: cd
