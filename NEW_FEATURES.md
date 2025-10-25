# NeuroDB - New Features Update

## 🎉 Latest Features Added

### 1. **Custom Header with Tabs** ✨
- Clean, draggable header bar with macOS traffic light support
- Tab navigation directly in the header for quick switching between:
  - Query Tool
  - PSQL Terminal  
  - DB Viewer (DBML)
  - Snippets (Saved Queries)
  - Variables
- Shows connected database name in the center

### 2. **DB Viewer - DBML Diagram Tool** 📊
- Visual database modeling with DBML syntax
- Draggable table cards
- Automatic relationship visualization
- Live diagram rendering
- Perfect for database design and documentation

**Example DBML:**
```dbml
Table users {
  id integer [pk]
  name varchar
  email varchar [unique]
}

Table posts {
  id integer [pk]
  user_id integer [ref: > users.id]
  title varchar
  content text
}
```

### 3. **Saved Queries (Snippets)** 💾
- Save frequently used queries
- Assign shortcuts to queries
- Use in editor with `{{shortcut_name}}`
- Quick insert from snippets tab
- Edit and manage all your saved queries

**Example:**
1. Create a snippet called "recent_users" with shortcut "recent"
2. In query editor, type: `SELECT * FROM {{recent}}`
3. Execute - the placeholder gets replaced automatically!

### 4. **Variables System** 🔧
- Create reusable variables
- Assign shortcuts for quick reference
- Use in queries with `{{variable_name}}`
- Perfect for:
  - Database names
  - Date ranges
  - Common filters
  - Environment-specific values

**Example:**
1. Create variable "prod_db" with value "production_database"
2. Use in query: `SELECT * FROM {{prod_db}}.users`
3. Easy to switch between environments!

### 5. **Collapsible Panels** 🎨
- Toggle sidebar visibility
- Toggle schema browser
- More screen space when you need it
- Smooth animations

### 6. **Drag Region in Header** 🖱️
- Full header is draggable
- Move window naturally
- Respects macOS traffic lights
- Professional desktop app feel

## 🎯 How to Use New Features

### Saved Queries Workflow:
1. Click "Snippets" tab in header
2. Click "New Snippet"
3. Enter name, shortcut, and SQL query
4. Use `{{shortcut}}` in any query
5. Placeholders auto-replace on execute!

### Variables Workflow:
1. Click "Variables" tab in header
2. Click "New Variable"
3. Define variable with shortcut
4. Reference with `{{shortcut}}` in queries
5. Change variable value to affect all queries!

### DBML Viewer Workflow:
1. Click "DB Viewer" tab in header
2. Write or paste DBML script
3. Click "Render Diagram"
4. Drag tables to arrange layout
5. See relationships automatically!

### Keyboard Shortcuts:
- `Ctrl/Cmd + Enter`: Execute query
- Click header tabs to switch views
- Drag header to move window

## 🔧 Technical Improvements

- **localStorage Integration**: Snippets and variables persist across sessions
- **Placeholder System**: Automatic replacement in queries before execution
- **DBML Parser**: Custom parser for database modeling language
- **Draggable Cards**: Interactive diagram with SVG relationship lines
- **Modular Design**: Clean separation of concerns

## 📝 Example Use Cases

### 1. Multi-Environment Development
```sql
-- Create variables:
-- dev_db = "development"
-- prod_db = "production"

-- Use in queries:
SELECT * FROM {{dev_db}}.users;
-- Switch to production by changing variable!
```

### 2. Complex Query Templates
```sql
-- Save as snippet "user_stats":
SELECT 
  u.id,
  u.name,
  COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id, u.name
ORDER BY post_count DESC;

-- Use anywhere: {{user_stats}}
```

### 3. Date Range Filters
```sql
-- Variable: start_date = "2024-01-01"
-- Variable: end_date = "2024-12-31"

SELECT * FROM orders 
WHERE created_at BETWEEN '{{start_date}}' AND '{{end_date}}';
```

## 🎨 UI Improvements

- **Cleaner Header**: More professional, less cluttered
- **Better Tab System**: Intuitive navigation in header
- **Collapsible Panels**: Maximize workspace
- **Visual Feedback**: Hover states, active indicators
- **Consistent Design**: Dark theme throughout

## 🚀 What's Next?

Potential future enhancements:
- Query history
- Export diagrams as images
- Import/export snippets and variables
- Collaborative features
- More diagram types
- Advanced DBML features

---

**Enjoy the new features! 🎊**

All your data is saved locally and persists across sessions.
