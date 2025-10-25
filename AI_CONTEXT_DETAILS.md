# NeuroDB AI Assistant - Context Details

## What We Pass to the AI Assistant

### 1. **System Prompt**
The AI receives a comprehensive system prompt that includes:
- Role definition: "NeuroDB AI Assistant, an expert PostgreSQL database assistant"
- Capabilities list (query writing, optimization, debugging, etc.)
- Instructions for behavior (helpful, concise, practical)

### 2. **Database Schema** ✅
Full database schema information including:
- Schema names
- Table names
- Column names with data types
- Column constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, etc.)
- Nullable/NOT NULL information

**Example format sent:**
```
Schema: public
Table: users
Columns:
  - id: integer NOT NULL (PRIMARY KEY)
  - name: varchar(100) NOT NULL
  - email: varchar(255) NOT NULL (UNIQUE)
  - created_at: timestamp NULL
```

### 3. **Current Connection Context** ✅
- **Connection Name**: Name of the currently connected database
- **Current Table**: Currently selected table (if browsing schema)

### 4. **Conversation History** ✅ (NOW FIXED)
- **Last 6 conversations** (12 messages total: 6 user + 6 assistant)
- Maintains context across multiple questions
- Automatically trimmed to prevent token overflow

**History format:**
```javascript
[
  { role: 'user', content: 'Show me all users' },
  { role: 'assistant', content: 'SELECT * FROM users;' },
  { role: 'user', content: 'Add a WHERE clause for active users' },
  { role: 'assistant', content: 'SELECT * FROM users WHERE status = \'active\';' },
  // ... up to 6 conversations
]
```

## Recent Fixes Applied

### Issue 1: Assistant Messages Incorrectly Mapped ❌ → ✅
**Problem**: Assistant responses were being sent as `SystemMessage` instead of `AIMessage`

**Before:**
```javascript
...history.map(msg => 
  msg.role === 'user' 
    ? new HumanMessage(msg.content)
    : new SystemMessage(msg.content)  // ❌ WRONG!
)
```

**After:**
```javascript
...history.map(msg => 
  msg.role === 'user' 
    ? new HumanMessage(msg.content)
    : new AIMessage(msg.content)  // ✅ CORRECT!
)
```

**Impact**: The AI will now properly understand the conversation flow and maintain better context.

### Issue 2: History Length Not Optimized ❌ → ✅
**Problem**: Keeping 20 messages (10 conversations) was too much

**Before:**
```javascript
// Keep only last 10 messages
if (chatHistory.length > 20) {
  chatHistory = chatHistory.slice(-20);
}
```

**After:**
```javascript
// Keep only last 6 conversations (12 messages)
if (chatHistory.length > 12) {
  chatHistory = chatHistory.slice(-12);
}
```

**Impact**: More focused context, better performance, reduced token usage.

## Message Flow

```
User Query → Frontend (renderer.js)
              ↓
          Context Preparation:
          - Current message
          - Schema
          - Connection info
          - Last 6 conversations
              ↓
          Backend API (main.js)
              ↓
          AIService (AIService.js)
              ↓
          LangChain + Gemini 2.0 Flash
              ↓
          Response → Frontend → UI
              ↓
          Update chatHistory
```

## How Context Helps the AI

1. **Schema Awareness**: AI knows exact table/column names, avoiding hallucinations
2. **Type Safety**: AI suggests queries with correct data types
3. **Constraint Awareness**: AI respects PRIMARY KEY, FOREIGN KEY relationships
4. **Conversation Memory**: AI remembers previous questions and builds upon them
5. **Connection Context**: AI knows which database you're working with

## Example Conversation with Context

**User**: "Show me all users"
**AI**: (Uses schema) `SELECT id, name, email, created_at FROM users;`

**User**: "Only active ones"
**AI**: (Remembers previous query + schema) `SELECT id, name, email, created_at FROM users WHERE status = 'active';`

**User**: "Add their orders"
**AI**: (Remembers context + uses schema relationships)
```sql
SELECT 
  u.id, 
  u.name, 
  u.email,
  COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.name, u.email;
```

## Technical Details

- **Model**: Gemini 2.0 Flash Exp
- **Temperature**: 0.3 (balanced between creativity and consistency)
- **Max Output Tokens**: 2048
- **History Limit**: 6 conversations (12 messages)
- **Message Types**: SystemMessage, HumanMessage, AIMessage

## Files Modified

1. `/services/AIService.js`:
   - Added `AIMessage` import
   - Fixed history mapping to use `AIMessage` for assistant responses

2. `/renderer.js`:
   - Updated history limit from 20 to 12 messages
   - Updated comment to reflect "6 conversations"
