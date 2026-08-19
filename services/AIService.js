const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');

class AIService {
  constructor(configService = null) {
    const apiKey = configService ? configService.getApiKey() : (process.env.GOOGLE_API_KEY || null);
    this.hasKey = !!apiKey;

    this.model = this.hasKey
      ? new ChatGoogleGenerativeAI({
          modelName: 'gemini-2.5-flash',
          apiKey: apiKey,
          temperature: 0.3,
          maxOutputTokens: 8192, // Increased from 2048 to 8192 to prevent incomplete SQL queries
        })
      : null;
  }

  isAvailable() {
    return this.model !== null;
  }

  // Detect Gemini quota / rate-limit errors (429, RESOURCE_EXHAUSTED, quota exceeded)
  isQuotaError(error) {
    const message = `${error?.message || ''} ${error?.status || ''} ${error?.code || ''}`.toLowerCase();
    return (
      error?.status === 429 ||
      message.includes('429') ||
      message.includes('resource_exhausted') ||
      message.includes('resource has been exhausted') ||
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    );
  }

  quotaExhaustedResult(extra = {}) {
    return {
      success: false,
      errorType: 'quota_exhausted',
      error: "The AI model is running busy right now — the free usage limit has been reached. NeuroDB's built-in AI runs on shared credits used by all users, so it can occasionally max out. For a smooth, uninterrupted experience, we recommend adding your own Gemini API key in Settings — it's completely free to create.",
      ...extra
    };
  }

  // Helper to check if identifier needs quoting (contains uppercase or special characters)
  needsQuoting(identifier) {
    return /[A-Z]/.test(identifier) || /[^a-z0-9_]/.test(identifier);
  }

  // Format identifier with quotes if needed
  formatIdentifier(identifier) {
    if (this.needsQuoting(identifier)) {
      return `"${identifier}"  [REQUIRES QUOTES - contains uppercase]`;
    }
    return identifier;
  }

  formatSchemaForPrompt(schema) {
    let schemaText = 'Database Schema (EXACT NAMES - preserve casing):\n\n';
    schemaText += 'IMPORTANT: All identifiers below are shown with their EXACT casing.\n';
    schemaText += 'Identifiers marked with [REQUIRES QUOTES] MUST be enclosed in double quotes ("") in SQL.\n\n';
    
    // Handle the actual schema structure from DatabaseService
    if (schema.tables) {
      // Group tables by schema
      const tablesBySchema = {};
      
      for (const [fullTableName, tableInfo] of Object.entries(schema.tables)) {
        const schemaName = tableInfo.schema;
        if (!tablesBySchema[schemaName]) {
          tablesBySchema[schemaName] = {};
        }
        tablesBySchema[schemaName][tableInfo.name] = tableInfo;
      }
      
      // Format each schema and its tables
      for (const [schemaName, tables] of Object.entries(tablesBySchema)) {
        const schemaDisplay = this.needsQuoting(schemaName) 
          ? `"${schemaName}" [REQUIRES QUOTES]` 
          : schemaName;
        schemaText += `Schema: ${schemaDisplay}\n`;
        
        for (const [tableName, tableInfo] of Object.entries(tables)) {
          const tableDisplay = this.needsQuoting(tableName) 
            ? `"${tableName}" [REQUIRES QUOTES]` 
            : tableName;
          schemaText += `\nTable: ${tableDisplay}\n`;
          schemaText += 'Columns (EXACT names):\n';
          
          if (tableInfo.columns && Array.isArray(tableInfo.columns)) {
            tableInfo.columns.forEach(col => {
              // Build constraints array from available properties
              const constraints = [];
              if (col.primary_key) constraints.push('PRIMARY KEY');
              if (col.foreign_key) {
                const fkTable = this.needsQuoting(col.foreign_key.table) 
                  ? `"${col.foreign_key.table}"` 
                  : col.foreign_key.table;
                const fkCol = this.needsQuoting(col.foreign_key.column) 
                  ? `"${col.foreign_key.column}"` 
                  : col.foreign_key.column;
                constraints.push(`FOREIGN KEY REFERENCES ${fkTable}(${fkCol})`);
              }
              if (col.default) constraints.push(`DEFAULT ${col.default}`);
              
              const constraintText = constraints.length > 0 
                ? ` (${constraints.join(', ')})` 
                : '';
              const nullable = col.nullable ? 'NULL' : 'NOT NULL';
              
              // Mark columns that need quoting
              const colDisplay = this.needsQuoting(col.name) 
                ? `"${col.name}" [REQUIRES QUOTES]` 
                : col.name;
              schemaText += `  - ${colDisplay}: ${col.type} ${nullable}${constraintText}\n`;
            });
          }
        }
        schemaText += '\n';
      }
      
      // Add views if any
      if (schema.views && Object.keys(schema.views).length > 0) {
        schemaText += 'Views:\n';
        for (const [fullViewName, viewInfo] of Object.entries(schema.views)) {
          const viewDisplay = this.needsQuoting(viewInfo.name) 
            ? `"${viewInfo.name}" [REQUIRES QUOTES]` 
            : viewInfo.name;
          const viewSchemaDisplay = this.needsQuoting(viewInfo.schema) 
            ? `"${viewInfo.schema}"` 
            : viewInfo.schema;
          schemaText += `\nView: ${viewDisplay} (schema: ${viewSchemaDisplay})\n`;
        }
        schemaText += '\n';
      }
    }
    
    return schemaText;
  }

  async generateSQL(prompt, schema) {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'AI service is not available. Please configure your Google API key in Settings.',
        query: null
      };
    }
    
    try {
      const schemaText = this.formatSchemaForPrompt(schema);

      const systemPrompt = `You are an expert PostgreSQL assistant. Your task is to generate SQL statements based on user requests.

${schemaText}

Rules:
1. Generate ONLY valid PostgreSQL SQL statements (SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, DROP TABLE, etc.)
2. Use the EXACT table and column names from the schema, preserving case sensitivity (uppercase/lowercase)
3. NEVER change the case of table names or column names - use them exactly as shown in the schema
4. **CRITICAL QUOTING RULE**: Any identifier (schema, table, column) containing UPPERCASE letters or special characters MUST be enclosed in double quotes ("")
   - Example: "UserProfile", "firstName", "OrderID"
   - Lowercase-only identifiers do NOT need quotes: users, email, id
5. Include appropriate JOINs when querying multiple tables
6. Add WHERE clauses for filtering when mentioned
7. Use proper formatting and indentation
8. Return ONLY the SQL statement, no explanations or markdown
9. For SELECT queries, always specify column names (avoid SELECT *)
10. For ALTER TABLE operations, use proper PostgreSQL syntax
11. For data type changes, consider PostgreSQL-specific types (UUID, JSONB, TIMESTAMP, etc.)
12. Use table aliases for better readability in complex queries
13. Add appropriate ORDER BY clauses when relevant for SELECT statements
14. Consider performance implications and constraints
15. For DDL operations (CREATE, ALTER, DROP), ensure proper syntax and data types
16. CRITICAL: ALWAYS complete the entire SQL query - never stop mid-statement or mid-column list
17. CRITICAL: Ensure all SELECT column lists are complete with proper commas and closing
18. CRITICAL: Ensure all parentheses are properly closed
19. CRITICAL: End every statement with a semicolon (;)

Examples of supported operations:
- SELECT queries with JOINs, WHERE, ORDER BY, GROUP BY
- INSERT statements with proper value formatting
- UPDATE statements with WHERE conditions
- DELETE statements with WHERE conditions
- CREATE TABLE with proper constraints and data types
- ALTER TABLE to add, modify, or drop columns
- CREATE INDEX for performance optimization
- Any other valid PostgreSQL DDL or DML operation

QUOTING EXAMPLES (MANDATORY):
- Table "UserProfile" with column "firstName":
  CORRECT: SELECT "firstName" FROM "UserProfile";
  WRONG: SELECT firstName FROM UserProfile;
  
- Schema "MySchema" with table "Orders":
  CORRECT: SELECT * FROM "MySchema"."Orders";
  WRONG: SELECT * FROM MySchema.Orders;
  
- Mixed case: table "users" (lowercase) with column "createdAt" (has uppercase):
  CORRECT: SELECT "createdAt" FROM users;
  WRONG: SELECT createdAt FROM users;

If the request is unclear or cannot be fulfilled with the available schema, return an error message starting with "ERROR:".`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(prompt)
      ];

      const response = await this.model.invoke(messages);
      let sqlQuery = response.content.trim();

      // Remove markdown code blocks if present
      sqlQuery = sqlQuery.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();

      // Check if it's an error
      if (sqlQuery.startsWith('ERROR:')) {
        return {
          success: false,
          error: sqlQuery.replace('ERROR:', '').trim(),
          query: null
        };
      }

      // Validate that the SQL query appears complete
      const isIncomplete = this.detectIncompleteSQL(sqlQuery);
      if (isIncomplete) {
        console.warn('Detected potentially incomplete SQL query:', sqlQuery);
        return {
          success: false,
          error: 'The generated SQL query appears to be incomplete. Please try again or rephrase your request.',
          query: null
        };
      }

      return {
        success: true,
        query: sqlQuery,
        explanation: 'SQL query generated successfully'
      };
    } catch (error) {
      console.error('Error generating SQL:', error);
      if (this.isQuotaError(error)) {
        return this.quotaExhaustedResult({ query: null });
      }
      return {
        success: false,
        error: error.message,
        query: null
      };
    }
  }

  detectIncompleteSQL(sql) {
    if (!sql || sql.length === 0) return true;

    // Check for common signs of incomplete SQL
    const incompleteSigns = [
      // Ends with comma (incomplete column list)
      /,\s*$/,
      // Ends with open parenthesis
      /\(\s*$/,
      // Ends with JOIN keyword without ON clause
      /\b(INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|JOIN)\s+\w+\s*$/i,
      // Ends with WHERE/AND/OR without condition
      /\b(WHERE|AND|OR)\s*$/i,
      // Ends with AS without alias
      /\bAS\s*$/i,
      // Ends with incomplete table/column reference (table.)
      /\w+\.\s*$/,
      // Missing semicolon at the end (optional but good practice)
      // Unmatched parentheses
    ];

    for (const pattern of incompleteSigns) {
      if (pattern.test(sql)) {
        return true;
      }
    }

    // Check for balanced parentheses
    const openParens = (sql.match(/\(/g) || []).length;
    const closeParens = (sql.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return true;
    }

    // Check if SELECT statement has FROM clause
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      if (!/\bFROM\b/i.test(sql)) {
        // SELECT without FROM might be valid (e.g., SELECT 1), so only warn if it looks incomplete
        if (sql.includes(',') && !sql.includes('FROM')) {
          return true;
        }
      }
    }

    return false;
  }

  async explainQuery(query, schema) {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'AI service is not available. Please configure your Google API key in Settings.',
        explanation: null
      };
    }
    
    try {
      const schemaText = this.formatSchemaForPrompt(schema);

      const systemPrompt = `You are an expert PostgreSQL assistant. Your task is to explain SQL queries in a concise, clear way.

${schemaText}

IMPORTANT: Keep your explanation brief and to the point. Maximum 3-4 sentences.

Explain:
- What the query does (1 sentence)
- Key tables and conditions (1 sentence)
- Expected output (1 sentence)
- Only mention performance if critical

Use simple language. Be direct and concise.`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Explain this SQL query:\n\n${query}`)
      ];

      const response = await this.model.invoke(messages);

      return {
        success: true,
        explanation: response.content.trim()
      };
    } catch (error) {
      console.error('Error explaining query:', error);
      if (this.isQuotaError(error)) {
        return this.quotaExhaustedResult({ explanation: null });
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  async chat(message, context, history = []) {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'AI service is not available. Please configure your Google API key in Settings.',
        response: null
      };
    }

    try {
      const schemaText = context.schema ? this.formatSchemaForPrompt(context.schema) : '';

      const systemPrompt = `You are NeuroDB AI Assistant, an expert PostgreSQL database assistant built into a database management tool.

${schemaText ? schemaText : 'No database schema available yet.'}

You can help with:
1. Writing and optimizing SQL queries
2. Explaining query results and database concepts
3. Suggesting best practices for database design
4. Debugging query errors
5. Performance optimization tips
6. General PostgreSQL questions

Current context:
- Connected database: ${context.connectionName || 'None'}
- Current table: ${context.currentTable || 'None'}

IMPORTANT SQL GENERATION RULES:
- Use EXACT table and column names with their original casing from the schema
- Any identifier containing UPPERCASE letters MUST be enclosed in double quotes ("")
- Example: SELECT "firstName", "lastName" FROM "UserProfile" WHERE "userId" = 1;
- Lowercase-only identifiers do not need quotes: SELECT email FROM users;

Be helpful, concise, and practical. When suggesting SQL, use the schema provided with proper quoting.`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...history.map(msg => 
          msg.role === 'user' 
            ? new HumanMessage(msg.content)
            : new AIMessage(msg.content)
        ),
        new HumanMessage(message)
      ];

      const response = await this.model.invoke(messages);

      return {
        success: true,
        response: response.content.trim(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in chat:', error);
      if (this.isQuotaError(error)) {
        return this.quotaExhaustedResult();
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  async optimizeQuery(query, schema) {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'AI service is not available. Please configure your Google API key in Settings.',
        optimization: null
      };
    }

    try {
      const schemaText = this.formatSchemaForPrompt(schema);

      const systemPrompt = `You are an expert PostgreSQL query optimizer.

${schemaText}

Analyze the provided query and suggest optimizations. Consider:
1. Index usage
2. JOIN efficiency
3. Subquery optimization
4. Use of appropriate operators
5. Query structure improvements

IMPORTANT: When writing SQL:
- Preserve EXACT casing of all table and column names from the schema
- Any identifier containing UPPERCASE letters MUST be enclosed in double quotes ("")
- Example: SELECT "firstName" FROM "UserProfile"; (not: SELECT firstName FROM UserProfile)

Provide the optimized query and explanation of changes.`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Optimize this query:\n\n${query}`)
      ];

      const response = await this.model.invoke(messages);

      return {
        success: true,
        optimization: response.content.trim()
      };
    } catch (error) {
      console.error('Error optimizing query:', error);
      if (this.isQuotaError(error)) {
        return this.quotaExhaustedResult();
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AIService;
