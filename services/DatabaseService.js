const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseService {
  constructor() {
    this.servers = new Map(); // Server configurations
    this.databases = new Map(); // Database connections within servers
    this.pools = new Map();
    this.activeQueries = new Map(); // Track active queries for cancellation
    
    // Use different paths for development vs production
    try {
      const { app } = require('electron');
      if (app && app.isPackaged) {
        // In packaged app, use user data directory
        this.configPath = path.join(app.getPath('userData'), 'connections.json');
      } else {
        // In development, use the project directory
        this.configPath = path.join(__dirname, '../connections.json');
      }
    } catch (error) {
      // Fallback for cases where electron app is not available
      this.configPath = path.join(__dirname, '../connections.json');
    }
    
    console.log('DatabaseService config path:', this.configPath);
    this.loadConnections();
  }

  // Helper function to quote PostgreSQL identifiers when needed
  quoteIdentifier(identifier) {
    // Don't quote if already quoted
    if (identifier.startsWith('"') && identifier.endsWith('"')) {
      return identifier;
    }
    
    // Check if identifier needs quoting:
    // 1. Contains uppercase letters
    // 2. Contains special characters (except underscore)
    // 3. Is a PostgreSQL reserved word
    // 4. Starts with a number
    const needsQuoting = /[A-Z]/.test(identifier) || 
                         /[^a-z0-9_]/.test(identifier) ||
                         /^[0-9]/.test(identifier) ||
                         this.isPostgreSQLReservedWord(identifier.toLowerCase());
    
    if (needsQuoting) {
      return `"${identifier.replace(/"/g, '""')}"`;
    }
    
    return identifier;
  }

  // Check if a word is a PostgreSQL reserved word
  isPostgreSQLReservedWord(word) {
    const reservedWords = [
      'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop', 
      'alter', 'table', 'index', 'view', 'database', 'schema', 'user', 'group',
      'order', 'by', 'group', 'having', 'limit', 'offset', 'union', 'intersect',
      'except', 'join', 'inner', 'left', 'right', 'outer', 'on', 'as', 'and',
      'or', 'not', 'in', 'exists', 'between', 'like', 'ilike', 'similar',
      'primary', 'foreign', 'key', 'unique', 'check', 'constraint', 'references',
      'default', 'null', 'true', 'false', 'case', 'when', 'then', 'else', 'end'
    ];
    return reservedWords.includes(word.toLowerCase());
  }

  // Server Management Methods
  async saveServer(server) {
    if (!server.id) {
      server.id = Date.now().toString();
    }
    this.servers.set(server.id, server);
    this.saveConnections();
    return { success: true, server };
  }

  async deleteServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }
    
    // Delete all databases associated with this server
    for (const [dbId, db] of this.databases) {
      if (db.serverId === serverId) {
        this.databases.delete(dbId);
      }
    }
    
    this.servers.delete(serverId);
    this.saveConnections();
    return { success: true };
  }

  // Database Management Methods
  async saveDatabase(database) {
    if (!database.id) {
      database.id = Date.now().toString();
    }
    this.databases.set(database.id, database);
    this.saveConnections();
    return { success: true, database };
  }

  async deleteDatabase(databaseId) {
    if (this.databases.has(databaseId)) {
      this.databases.delete(databaseId);
      this.saveConnections();
      return { success: true };
    }
    return { success: false, error: 'Database not found' };
  }

  async addExistingDatabase(serverId, databaseName) {
    const server = this.servers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    const database = {
      id: Date.now().toString(),
      serverId,
      name: databaseName
    };

    this.databases.set(database.id, database);
    this.saveConnections();
    return { success: true, database };
  }

  // Create a new database on the specified server and register it locally
  async createDatabase(serverId, databaseName) {
    const server = this.servers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    // Connect to the default 'postgres' database to issue CREATE DATABASE
    const poolConfig = {
      host: server.host,
      port: server.port,
      database: 'postgres',
      user: server.user,
      password: server.password
    };

    if (server.ssl || server.sslmode) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    const pool = new Pool(poolConfig);

    try {
      // Check if database already exists
      const existsRes = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
      if (existsRes.rowCount > 0) {
        // If it exists, register it locally and return
        const database = {
          id: Date.now().toString(),
          serverId,
          name: databaseName
        };

        this.databases.set(database.id, database);
        this.saveConnections();
        await pool.end();
        return { success: true, database, existed: true };
      }

      // Quote the identifier properly to avoid syntax errors
      const quotedName = this.quoteIdentifier(databaseName);

      await pool.query(`CREATE DATABASE ${quotedName}`);
      await pool.end();

      const database = {
        id: Date.now().toString(),
        serverId,
        name: databaseName
      };

      this.databases.set(database.id, database);
      this.saveConnections();

      return { success: true, database };
    } catch (error) {
      try { await pool.end(); } catch (e) { /* ignore */ }
      return { success: false, error: error.message };
    }
  }

  // Drop (delete) a database from the PostgreSQL server
  async dropDatabase(serverId, databaseName) {
    const server = this.servers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    // Prevent dropping system databases
    const systemDatabases = ['postgres', 'template0', 'template1'];
    if (systemDatabases.includes(databaseName.toLowerCase())) {
      return { success: false, error: 'Cannot drop system database' };
    }

    // Connect to the default 'postgres' database to issue DROP DATABASE
    const poolConfig = {
      host: server.host,
      port: server.port,
      database: 'postgres',
      user: server.user,
      password: server.password
    };

    if (server.ssl || server.sslmode) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    const pool = new Pool(poolConfig);

    try {
      // Check if database exists
      const existsRes = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
      if (existsRes.rowCount === 0) {
        await pool.end();
        return { success: false, error: 'Database does not exist' };
      }

      // Terminate all connections to the database first
      await pool.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid()
      `, [databaseName]);

      // Quote the identifier properly to avoid syntax errors
      const quotedName = this.quoteIdentifier(databaseName);

      await pool.query(`DROP DATABASE ${quotedName}`);
      await pool.end();

      // Also remove from local connections if it was added
      for (const [dbId, db] of this.databases) {
        if (db.serverId === serverId && db.name === databaseName) {
          this.databases.delete(dbId);
        }
      }
      this.saveConnections();

      return { success: true };
    } catch (error) {
      try { await pool.end(); } catch (e) { /* ignore */ }
      return { success: false, error: error.message };
    }
  }

  // Connection Management Methods (Legacy + New)
  async getConnections() {
    return {
      success: true,
      servers: Array.from(this.servers.values()),
      databases: Array.from(this.databases.values())
    };
  }

  async saveConnection(connection) {
    // Legacy support for old connection format
    if (connection.type === 'server') {
      return this.saveServer(connection);
    } else if (connection.type === 'database') {
      return this.saveDatabase(connection);
    }
    return { success: false, error: 'Invalid connection type' };
  }

  async deleteConnection(id) {
    // Try deleting as both server and database
    if (this.servers.has(id)) {
      return this.deleteServer(id);
    }
    if (this.databases.has(id)) {
      return this.deleteDatabase(id);
    }
    return { success: false, error: 'Connection not found' };
  }

  async testConnection(connection) {
    try {
      const poolConfig = {
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.user,
        password: connection.password
      };
      
      // Add SSL configuration if present
      if (connection.ssl || connection.sslmode) {
        poolConfig.ssl = {
          rejectUnauthorized: false // Allow self-signed certificates
        };
      }
      
      const pool = new Pool(poolConfig);

      const client = await pool.connect();
      client.release();
      await pool.end();
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listDatabasesOnServer(serverId) {
    const server = this.servers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    try {
      const poolConfig = {
        host: server.host,
        port: server.port,
        database: 'postgres', // Connect to default postgres database
        user: server.user,
        password: server.password
      };
      
      // Add SSL configuration if present
      if (server.ssl || server.sslmode) {
        poolConfig.ssl = {
          rejectUnauthorized: false
        };
      }
      
      const pool = new Pool(poolConfig);

      const result = await pool.query(`
        SELECT datname 
        FROM pg_database 
        WHERE datistemplate = false 
        ORDER BY datname
      `);

      await pool.end();

      return {
        success: true,
        databases: result.rows.map(row => row.datname)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  loadConnections() {
    try {
      // First check if connections file exists at config path
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        
        // Clear existing maps
        this.servers.clear();
        this.databases.clear();
        
        if (config.servers && Array.isArray(config.servers)) {
          config.servers.forEach(server => {
            this.servers.set(server.id, server);
          });
        }
        
        if (config.databases && Array.isArray(config.databases)) {
          config.databases.forEach(db => {
            this.databases.set(db.id, db);
          });
        }

        console.log('Loaded connections from:', this.configPath, {
          servers: this.servers.size,
          databases: this.databases.size
        });
      } else {
        // Try to migrate from development location if in packaged app
        const devConfigPath = path.join(__dirname, '../connections.json');
        if (this.configPath !== devConfigPath && fs.existsSync(devConfigPath)) {
          console.log('Migrating connections from dev location to user data directory');
          const data = fs.readFileSync(devConfigPath, 'utf8');
          
          // Ensure directory exists
          const configDir = path.dirname(this.configPath);
          if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
          }
          
          // Copy to new location
          fs.writeFileSync(this.configPath, data, 'utf8');
          
          // Load the migrated data
          this.loadConnections();
          return;
        }
        
        console.log('No connections file found at:', this.configPath);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  }

  saveConnections() {
    try {
      const config = {
        servers: Array.from(this.servers.values()),
        databases: Array.from(this.databases.values())
      };
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log('Saved connections:', {
        servers: config.servers.length,
        databases: config.databases.length
      });
    } catch (error) {
      console.error('Error saving connections:', error);
    }
  }

  saveConnections() {
    try {
      const config = {
        servers: Array.from(this.servers.values()),
        databases: Array.from(this.databases.values())
      };
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving connections:', error);
    }
  }

  getConnection(id) {
    const db = this.databases.get(id);
    if (!db) return null;
    
    const server = this.servers.get(db.serverId);
    if (!server) return null;
    
    const connection = {
      id: db.id,
      name: `${db.name}@${server.host}:${server.port}`,
      host: server.host,
      port: server.port,
      database: db.name,
      user: server.user,
      password: server.password
    };
    
    // Include SSL configuration if present
    if (server.ssl !== undefined) {
      connection.ssl = server.ssl;
    }
    if (server.sslmode !== undefined) {
      connection.sslmode = server.sslmode;
    }
    
    return connection;
  }

  async connect(connectionId) {
    try {
      const connection = this.getConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      if (this.pools.has(connectionId)) {
        return { success: true };
      }

      const poolConfig = {
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.user,
        password: connection.password
      };
      
      // Add SSL configuration if present
      if (connection.ssl || connection.sslmode) {
        poolConfig.ssl = {
          rejectUnauthorized: false
        };
      }
      
      const pool = new Pool(poolConfig);

      const client = await pool.connect();
      client.release();

      this.pools.set(connectionId, pool);
      return { success: true };
    } catch (error) {
      console.error('Error connecting to database:', error);
      return { success: false, error: error.message };
    }
  }

  async disconnect(connectionId) {
    try {
      const pool = this.pools.get(connectionId);
      if (pool) {
        await pool.end();
        this.pools.delete(connectionId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async disconnectAll() {
    try {
      console.log('Disconnecting all database connections...');
      const disconnectPromises = [];
      
      // Disconnect all active pools
      for (const [connectionId, pool] of this.pools.entries()) {
        console.log(`Closing connection: ${connectionId}`);
        disconnectPromises.push(
          pool.end()
            .then(() => {
              console.log(`Connection ${connectionId} closed successfully`);
              this.pools.delete(connectionId);
            })
            .catch(error => {
              console.error(`Error closing connection ${connectionId}:`, error.message);
              // Still delete from map even if error occurs
              this.pools.delete(connectionId);
            })
        );
      }
      
      // Wait for all connections to close
      await Promise.all(disconnectPromises);
      
      console.log('All database connections closed');
      return { success: true };
    } catch (error) {
      console.error('Error disconnecting all connections:', error);
      return { success: false, error: error.message };
    }
  }

  async executeQuery(connectionId, query, queryId = null) {
    try {
      const pool = this.pools.get(connectionId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      // Create a client from the pool for this specific query
      const client = await pool.connect();
      
      // If queryId is provided, track this query for potential cancellation
      if (queryId) {
        // Get the backend process ID for cancellation
        const pidResult = await client.query('SELECT pg_backend_pid()');
        const pid = pidResult.rows[0].pg_backend_pid;
        
        this.activeQueries.set(queryId, { client, connectionId, pid });
      }

      try {
        const startTime = Date.now();
        const result = await client.query(query);
        const executionTime = Date.now() - startTime;
        
        return {
          success: true,
          rows: result.rows,
          fields: result.fields,
          rowCount: result.rowCount,
          executionTime: executionTime
        };
      } finally {
        // Always release the client back to the pool
        client.release();
        
        // Remove from active queries if it was being tracked
        if (queryId) {
          this.activeQueries.delete(queryId);
        }
      }
    } catch (error) {
      // Remove from active queries if it was being tracked
      if (queryId) {
        this.activeQueries.delete(queryId);
      }
      
      // Check if the error is due to query cancellation
      const isCancelled = error.message && (
        error.message.includes('canceling statement') ||
        error.message.includes('query canceled') ||
        error.code === '57014' // PostgreSQL error code for query_canceled
      );
      
      return {
        success: false,
        error: error.message,
        position: error.position,
        cancelled: isCancelled
      };
    }
  }

  async cancelQuery(queryId) {
    try {
      const queryInfo = this.activeQueries.get(queryId);
      if (!queryInfo) {
        return { success: false, error: 'Query not found or already completed' };
      }

      const { connectionId, pid } = queryInfo;
      
      // Get the pool to create a new connection for cancellation
      const pool = this.pools.get(connectionId);
      if (!pool) {
        return { success: false, error: 'Database connection not found' };
      }
      
      // Use a separate client to cancel the query
      const cancelClient = await pool.connect();
      
      try {
        // Cancel the query using pg_cancel_backend
        const result = await cancelClient.query('SELECT pg_cancel_backend($1)', [pid]);
        
        console.log('Cancel query result:', result.rows[0]);
        
        // pg_cancel_backend returns true if successful
        const cancelled = result.rows[0]?.pg_cancel_backend;
        
        if (cancelled) {
          // Keep in activeQueries for now - it will be removed when the query errors out
          return { success: true, message: 'Query cancellation signal sent' };
        } else {
          return { success: false, error: 'Query may have already completed' };
        }
      } finally {
        cancelClient.release();
      }
    } catch (error) {
      console.error('Error cancelling query:', error);
      return { success: false, error: error.message };
    }
  }

  async getTablesAndViews(connectionId) {
    try {
      const schemaResult = await this.getDatabaseSchema(connectionId);
      if (!schemaResult.success) {
        return schemaResult;
      }

      const { schema } = schemaResult;
      return {
        success: true,
        tables: Object.values(schema.tables).map(table => ({
          name: table.name,
          schema: table.schema,
          fullName: `${table.schema}.${table.name}`,
          columns: table.columns
        })),
        views: Object.values(schema.views).map(view => ({
          name: view.name,
          schema: view.schema,
          fullName: `${view.schema}.${view.name}`,
          definition: view.definition
        }))
      };
    } catch (error) {
      console.error('Error getting tables and views:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getDatabaseSchema(connectionId) {
    try {
      console.log('Getting database schema for connectionId:', connectionId);
      const pool = this.pools.get(connectionId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      const schemaInfo = {
        tables: {},
        views: {},
        schemas: []
      };

      // Get all schemas except system schemas
      console.log('Fetching schemas...');
      const schemasQuery = 'SELECT nspname as schema_name FROM pg_catalog.pg_namespace ' +
        "WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND nspname NOT LIKE 'pg_%' " +
        "AND nspname NOT LIKE '_timescaledb%' " +
        "AND nspname NOT LIKE 'timescaledb_%' " +
        'ORDER BY nspname';
      
      const schemasResult = await pool.query(schemasQuery);
      schemaInfo.schemas = schemasResult.rows.map(row => row.schema_name);
      console.log(`Found ${schemaInfo.schemas.length} user schemas`);

      // Get tables and columns
      console.log('Fetching tables and columns...');
      const tablesQuery = 'SELECT ' +
        'n.nspname as schema_name, ' +
        'c.relname as table_name, ' +
        'a.attname as column_name, ' +
        't.typname as data_type, ' +
        'format_type(a.atttypid, a.atttypmod) as full_data_type, ' +
        'NOT a.attnotnull as is_nullable, ' +
        'pg_get_expr(d.adbin, d.adrelid) as column_default, ' +
        'a.attnum as ordinal_position ' +
        'FROM pg_catalog.pg_class c ' +
        'JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace ' +
        'JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid ' +
        'JOIN pg_catalog.pg_type t ON t.oid = a.atttypid ' +
        'LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum ' +
        "WHERE c.relkind = 'r' " +
        'AND a.attnum > 0 ' +
        'AND NOT a.attisdropped ' +
        "AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND n.nspname NOT LIKE 'pg_%' " +
        "AND n.nspname NOT LIKE '_timescaledb%' " +
        "AND n.nspname NOT LIKE 'timescaledb_%' " +
        'ORDER BY n.nspname, c.relname, a.attnum';
      
      const tablesResult = await pool.query(tablesQuery);

      // Process tables and columns
      for (const row of tablesResult.rows) {
        const fullTableName = `${row.schema_name}.${row.table_name}`;
        if (!schemaInfo.tables[fullTableName]) {
          schemaInfo.tables[fullTableName] = {
            schema: row.schema_name,
            name: row.table_name,
            columns: []
          };
        }
        
        schemaInfo.tables[fullTableName].columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable,
          default: row.column_default,
          position: row.ordinal_position
        });
      }
      
      // Get primary keys
      console.log('Fetching primary keys...');
      const primaryKeysQuery = 'SELECT ' +
        'n.nspname as schema_name, ' +
        'c.relname as table_name, ' +
        'a.attname as column_name ' +
        'FROM pg_catalog.pg_constraint con ' +
        'JOIN pg_catalog.pg_class c ON con.conrelid = c.oid ' +
        'JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace ' +
        'JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey) ' +
        "WHERE con.contype = 'p' " +
        "AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND n.nspname NOT LIKE 'pg_%' " +
        "AND n.nspname NOT LIKE '_timescaledb%' " +
        "AND n.nspname NOT LIKE 'timescaledb_%'";
      
      const primaryKeysResult = await pool.query(primaryKeysQuery);
      
      // Add primary key information to columns
      for (const row of primaryKeysResult.rows) {
        const fullTableName = `${row.schema_name}.${row.table_name}`;
        if (schemaInfo.tables[fullTableName]) {
          const column = schemaInfo.tables[fullTableName].columns.find(col => col.name === row.column_name);
          if (column) {
            column.primary_key = true;
          }
        }
      }

      // Get foreign keys
      console.log('Fetching foreign keys...');
      const foreignKeysQuery = 'SELECT ' +
        'n1.nspname as table_schema, ' +
        'c1.relname as table_name, ' +
        'a1.attname as column_name, ' +
        'n2.nspname as foreign_table_schema, ' +
        'c2.relname as foreign_table_name, ' +
        'a2.attname as foreign_column_name ' +
        'FROM pg_catalog.pg_constraint con ' +
        'JOIN pg_catalog.pg_class c1 ON con.conrelid = c1.oid ' +
        'JOIN pg_catalog.pg_namespace n1 ON n1.oid = c1.relnamespace ' +
        'JOIN pg_catalog.pg_class c2 ON con.confrelid = c2.oid ' +
        'JOIN pg_catalog.pg_namespace n2 ON n2.oid = c2.relnamespace ' +
        'JOIN pg_catalog.pg_attribute a1 ON a1.attrelid = c1.oid AND a1.attnum = ANY(con.conkey) ' +
        'JOIN pg_catalog.pg_attribute a2 ON a2.attrelid = c2.oid AND a2.attnum = ANY(con.confkey) ' +
        "WHERE con.contype = 'f' " +
        "AND n1.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND n1.nspname NOT LIKE 'pg_%' " +
        "AND n1.nspname NOT LIKE '_timescaledb%' " +
        "AND n1.nspname NOT LIKE 'timescaledb_%'";
      
      const foreignKeysResult = await pool.query(foreignKeysQuery);
      
      // Add foreign key information to columns
      for (const row of foreignKeysResult.rows) {
        const fullTableName = `${row.table_schema}.${row.table_name}`;
        if (schemaInfo.tables[fullTableName]) {
          const column = schemaInfo.tables[fullTableName].columns.find(col => col.name === row.column_name);
          if (column) {
            column.foreign_key = {
              table: `${row.foreign_table_schema}.${row.foreign_table_name}`,
              column: row.foreign_column_name
            };
          }
        }
      }

      // Get indexes
      console.log('Fetching indexes...');
      const indexesQuery = 'SELECT ' +
        'n.nspname as schema_name, ' +
        'c.relname as table_name, ' +
        'i.relname as index_name, ' +
        'a.attname as column_name, ' +
        'am.amname as index_type, ' +
        'ix.indisunique as is_unique, ' +
        'ix.indisprimary as is_primary ' +
        'FROM pg_catalog.pg_index ix ' +
        'JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid ' +
        'JOIN pg_catalog.pg_class c ON c.oid = ix.indrelid ' +
        'JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace ' +
        'JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey) ' +
        'JOIN pg_catalog.pg_am am ON am.oid = i.relam ' +
        "WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND n.nspname NOT LIKE 'pg_%' " +
        "AND n.nspname NOT LIKE '_timescaledb%' " +
        "AND n.nspname NOT LIKE 'timescaledb_%' " +
        'ORDER BY n.nspname, c.relname, i.relname';
      
      const indexesResult = await pool.query(indexesQuery);
      
      // Add index information to columns
      for (const row of indexesResult.rows) {
        const fullTableName = `${row.schema_name}.${row.table_name}`;
        if (schemaInfo.tables[fullTableName]) {
          const column = schemaInfo.tables[fullTableName].columns.find(col => col.name === row.column_name);
          if (column) {
            if (!column.indexes) {
              column.indexes = [];
            }
            // Skip primary key indexes as they're already marked
            if (!row.is_primary) {
              column.indexes.push({
                name: row.index_name,
                type: row.index_type,
                unique: row.is_unique
              });
            }
          }
        }
      }

      // Get views
      console.log('Fetching views...');
      const viewsQuery = 'SELECT ' +
        'n.nspname as schema_name, ' +
        'c.relname as view_name, ' +
        'pg_get_viewdef(c.oid, true) as view_definition ' +
        'FROM pg_catalog.pg_class c ' +
        'JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace ' +
        "WHERE c.relkind = 'v' " +
        "AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND n.nspname NOT LIKE 'pg_%' " +
        "AND n.nspname NOT LIKE '_timescaledb%' " +
        "AND n.nspname NOT LIKE 'timescaledb_%' " +
        'ORDER BY n.nspname, c.relname';
      
      const viewsResult = await pool.query(viewsQuery);

      // Process views
      for (const row of viewsResult.rows) {
        const fullViewName = `${row.schema_name}.${row.view_name}`;
        schemaInfo.views[fullViewName] = {
          schema: row.schema_name,
          name: row.view_name,
          definition: row.view_definition
        };
      }

      const stats = {
        tables: Object.keys(schemaInfo.tables).length,
        views: Object.keys(schemaInfo.views).length,
        schemas: schemaInfo.schemas.length
      };

      console.log('Schema retrieval complete:', stats);

      return {
        success: true,
        schema: schemaInfo,
        ...stats
      };

    } catch (error) {
      console.error('Error retrieving database schema:', error);
      if (error.message.toLowerCase().includes('lock timeout')) {
        console.warn('Lock timeout while fetching schema, some tables may be locked');
        return {
          success: true,
          schema: schemaInfo,
          warning: 'Some tables are locked and could not be fetched'
        };
      }
      if (error.message.toLowerCase().includes('statement timeout')) {
        console.warn('Statement timeout while fetching schema, query took too long');
        return {
          success: true,
          schema: schemaInfo,
          warning: 'Schema fetch was incomplete due to timeout'
        };
      }
      return {
        success: false,
        error: error.message,
        schema: {
          tables: {},
          views: {},
          schemas: []
        }
      };
    }
  }

  // Format a single JS value (as returned by node-postgres) into a SQL literal.
  // Handles NULL, numbers, booleans, Buffers (bytea), Dates, arrays and
  // objects (json/jsonb) plus generic strings with proper quote escaping.
  formatSQLValue(val, dataType) {
    if (val === null || val === undefined) return 'NULL';

    if (Buffer.isBuffer(val)) {
      return `'\\x${val.toString('hex')}'::bytea`;
    }

    if (val instanceof Date) {
      return `'${val.toISOString()}'`;
    }

    if (typeof val === 'boolean') {
      return val ? 'TRUE' : 'FALSE';
    }

    if (typeof val === 'number') {
      return Number.isFinite(val) ? String(val) : `'${val}'`;
    }

    if (typeof val === 'bigint') {
      return val.toString();
    }

    if (Array.isArray(val)) {
      // node-postgres returns SQL arrays as JS arrays. Rebuild an ARRAY[...] literal.
      const inner = val.map(v => this.formatSQLValue(v, dataType)).join(', ');
      return `ARRAY[${inner}]`;
    }

    if (typeof val === 'object') {
      // json / jsonb / composite / range types come back as objects.
      const json = JSON.stringify(val).replace(/'/g, "''");
      return `'${json}'`;
    }

    // Fallback: treat as string.
    const str = String(val).replace(/'/g, "''");
    return `'${str}'`;
  }

  async generateDatabaseBackup(databaseId, selectedSchemas = null) {
    try {
      console.log('Generating database backup for databaseId:', databaseId);
      console.log('Selected schemas:', selectedSchemas);
      const pool = this.pools.get(databaseId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      const connection = this.getConnection(databaseId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      let backupSQL = '';
      const timestamp = new Date().toISOString();

      // Add header
      backupSQL += `-- NeuroDB Database Backup\n`;
      backupSQL += `-- Database: ${connection.database}\n`;
      backupSQL += `-- Host: ${connection.host}:${connection.port}\n`;
      backupSQL += `-- Generated: ${timestamp}\n`;
      if (selectedSchemas && selectedSchemas.length > 0) {
        backupSQL += `-- Schemas: ${selectedSchemas.join(', ')}\n`;
      }
      backupSQL += `-- =====================================================\n\n`;

      // Helper: run a query, but tolerate failures (older PG versions, missing
      // catalogs, permission issues) by logging a warning and returning empty rows.
      const safeQuery = async (label, sql, params = []) => {
        try {
          return await pool.query(sql, params);
        } catch (err) {
          console.warn(`Backup: skipping ${label} (${err.message})`);
          backupSQL += `-- NOTE: could not export ${label}: ${err.message}\n`;
          return { rows: [] };
        }
      };

      // Get all schemas or filtered schemas
      let schemasQuery = 'SELECT nspname as schema_name FROM pg_catalog.pg_namespace ' +
        "WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND nspname NOT LIKE 'pg_%' ";

      const schemasQueryParams = [];
      if (selectedSchemas && selectedSchemas.length > 0) {
        schemasQuery += 'AND nspname = ANY($1) ';
        schemasQueryParams.push(selectedSchemas);
      }

      schemasQuery += 'ORDER BY nspname';

      const schemasResult = await pool.query(schemasQuery, schemasQueryParams);
      const schemaNames = schemasResult.rows.map(r => r.schema_name);

      // ============================================================
      // 1. Extensions (CREATE EXTENSION IF NOT EXISTS ...)
      // ============================================================
      const extResult = await safeQuery('extensions', `
        SELECT e.extname AS name, n.nspname AS schema
        FROM pg_catalog.pg_extension e
        JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname <> 'plpgsql'
        ORDER BY e.extname
      `);
      if (extResult.rows.length > 0) {
        backupSQL += `-- ============================================\n`;
        backupSQL += `-- Extensions\n`;
        backupSQL += `-- ============================================\n`;
        for (const ext of extResult.rows) {
          backupSQL += `CREATE EXTENSION IF NOT EXISTS ${this.quoteIdentifier(ext.name)}`;
          if (ext.schema && ext.schema !== 'public') {
            backupSQL += ` WITH SCHEMA ${this.quoteIdentifier(ext.schema)}`;
          }
          backupSQL += `;\n`;
        }
        backupSQL += `\n`;
      }

      // ============================================================
      // 2. Schemas
      // ============================================================
      for (const schemaName of schemaNames) {
        if (schemaName !== 'public') {
          backupSQL += `CREATE SCHEMA IF NOT EXISTS ${this.quoteIdentifier(schemaName)};\n`;
        }
      }
      backupSQL += `\n`;

      // ============================================================
      // 3. User-defined types (enum / composite / domain)
      // ============================================================
      for (const schemaName of schemaNames) {
        const quotedSchema = this.quoteIdentifier(schemaName);

        // Enums
        const enumResult = await safeQuery(`enums in ${schemaName}`, `
          SELECT t.typname AS name,
                 array_agg(e.enumlabel::text ORDER BY e.enumsortorder)::text[] AS labels
          FROM pg_catalog.pg_type t
          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
          JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
          WHERE n.nspname = $1
          GROUP BY t.typname
          ORDER BY t.typname
        `, [schemaName]);
        for (const en of enumResult.rows) {
          const labels = en.labels.map(l => `'${String(l).replace(/'/g, "''")}'`).join(', ');
          backupSQL += `DROP TYPE IF EXISTS ${quotedSchema}.${this.quoteIdentifier(en.name)} CASCADE;\n`;
          backupSQL += `CREATE TYPE ${quotedSchema}.${this.quoteIdentifier(en.name)} AS ENUM (${labels});\n`;
        }

        // Composite types (not table row types)
        const compResult = await safeQuery(`composite types in ${schemaName}`, `
          SELECT t.typname AS name,
                 string_agg(
                   quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod),
                   ', ' ORDER BY a.attnum
                 ) AS attrs
          FROM pg_catalog.pg_type t
          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
          JOIN pg_catalog.pg_class c ON c.oid = t.typrelid
          JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
          WHERE n.nspname = $1 AND c.relkind = 'c'
          GROUP BY t.typname
          ORDER BY t.typname
        `, [schemaName]);
        for (const comp of compResult.rows) {
          backupSQL += `DROP TYPE IF EXISTS ${quotedSchema}.${this.quoteIdentifier(comp.name)} CASCADE;\n`;
          backupSQL += `CREATE TYPE ${quotedSchema}.${this.quoteIdentifier(comp.name)} AS (${comp.attrs});\n`;
        }

        // Domains
        const domainResult = await safeQuery(`domains in ${schemaName}`, `
          SELECT t.typname AS name,
                 format_type(t.typbasetype, t.typtypmod) AS base_type,
                 t.typnotnull AS not_null,
                 pg_get_expr(t.typdefaultbin, 0) AS default_expr,
                 (SELECT string_agg('CONSTRAINT ' || quote_ident(con.conname) || ' ' || pg_get_constraintdef(con.oid), ' ')
                    FROM pg_catalog.pg_constraint con WHERE con.contypid = t.oid) AS constraints
          FROM pg_catalog.pg_type t
          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = $1 AND t.typtype = 'd'
          ORDER BY t.typname
        `, [schemaName]);
        for (const dom of domainResult.rows) {
          backupSQL += `DROP DOMAIN IF EXISTS ${quotedSchema}.${this.quoteIdentifier(dom.name)} CASCADE;\n`;
          let d = `CREATE DOMAIN ${quotedSchema}.${this.quoteIdentifier(dom.name)} AS ${dom.base_type}`;
          if (dom.default_expr) d += ` DEFAULT ${dom.default_expr}`;
          if (dom.not_null) d += ` NOT NULL`;
          if (dom.constraints) d += ` ${dom.constraints}`;
          backupSQL += d + `;\n`;
        }
        if (enumResult.rows.length || compResult.rows.length || domainResult.rows.length) {
          backupSQL += `\n`;
        }
      }

      // Track table dependency graph for topological ordering of data inserts.
      const tableDeps = new Map(); // "schema.table" -> Set of "schema.table" it references

      // Buffers for objects that must be emitted after all tables exist.
      const deferredOwnedBy = [];   // ALTER SEQUENCE ... OWNED BY
      const deferredIndexes = [];   // CREATE INDEX ...
      const deferredData = [];      // { fullTableName, sql }  (ordered later)
      const deferredMatViews = [];  // materialized views

      // ============================================================
      // 4. Sequences  +  5. Tables (structure only)
      // ============================================================
      for (const schemaRow of schemasResult.rows) {
        const schemaName = schemaRow.schema_name;
        const quotedSchema = this.quoteIdentifier(schemaName);

        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Schema: ${schemaName}\n`;
        backupSQL += `-- ============================================\n\n`;

        // ---- Sequences (emit before tables so nextval() defaults resolve) ----
        // Skip sequences that back an IDENTITY column: those are created implicitly
        // by the CREATE TABLE ... GENERATED AS IDENTITY clause (dumping them would
        // collide and produce a duplicate sequence like foo_id_seq1).
        let sequencesResult;
        try {
          sequencesResult = await pool.query(`
            SELECT s.relname AS sequence_name,
                   seq.seqstart AS start_value,
                   seq.seqincrement AS increment_by,
                   seq.seqmin AS min_value,
                   seq.seqmax AS max_value,
                   seq.seqcache AS cache_value,
                   seq.seqcycle AS is_cycled,
                   format_type(seq.seqtypid, NULL) AS data_type
            FROM pg_catalog.pg_class s
            JOIN pg_catalog.pg_namespace n ON n.oid = s.relnamespace
            JOIN pg_catalog.pg_sequence seq ON seq.seqrelid = s.oid
            WHERE s.relkind = 'S' AND n.nspname = $1
            AND NOT EXISTS (
              SELECT 1 FROM pg_catalog.pg_depend d
              WHERE d.objid = s.oid AND d.deptype = 'i'
            )
            ORDER BY s.relname
          `, [schemaName]);
        } catch (seqErr) {
          // pg_sequence exists only on PostgreSQL 10+; fall back to information_schema
          console.warn('pg_sequence query failed, falling back:', seqErr.message);
          sequencesResult = await safeQuery(`sequences in ${schemaName}`, `
            SELECT sequence_name,
                   start_value,
                   increment AS increment_by,
                   minimum_value AS min_value,
                   maximum_value AS max_value,
                   1 AS cache_value,
                   (cycle_option = 'YES') AS is_cycled,
                   data_type
            FROM information_schema.sequences
            WHERE sequence_schema = $1
            ORDER BY sequence_name
          `, [schemaName]);
        }

        for (const seqRow of sequencesResult.rows) {
          const fullSequenceName = `${quotedSchema}.${this.quoteIdentifier(seqRow.sequence_name)}`;

          backupSQL += `DROP SEQUENCE IF EXISTS ${fullSequenceName} CASCADE;\n`;
          backupSQL += `CREATE SEQUENCE ${fullSequenceName}`;
          if (seqRow.data_type && seqRow.data_type !== 'bigint') backupSQL += ` AS ${seqRow.data_type}`;
          backupSQL += ` INCREMENT BY ${seqRow.increment_by}`;
          backupSQL += ` MINVALUE ${seqRow.min_value} MAXVALUE ${seqRow.max_value}`;
          backupSQL += ` START WITH ${seqRow.start_value} CACHE ${seqRow.cache_value || 1}`;
          backupSQL += seqRow.is_cycled ? ` CYCLE;\n` : ` NO CYCLE;\n`;

          try {
            const cur = await pool.query(`SELECT last_value, is_called FROM ${fullSequenceName}`);
            if (cur.rows.length > 0) {
              const { last_value, is_called } = cur.rows[0];
              backupSQL += `SELECT setval('${fullSequenceName.replace(/'/g, "''")}', ${last_value}, ${is_called});\n`;
            }
          } catch (valErr) {
            console.warn(`Could not read current value for sequence ${fullSequenceName}:`, valErr.message);
          }
        }
        if (sequencesResult.rows.length) backupSQL += `\n`;

        // ---- Sequence OWNED BY links (deferred until tables exist) ----
        const ownedByResult = await safeQuery(`sequence ownership in ${schemaName}`, `
          SELECT quote_ident(sn.nspname) || '.' || quote_ident(s.relname) AS sequence_name,
                 quote_ident(tn.nspname) || '.' || quote_ident(t.relname) AS table_name,
                 quote_ident(a.attname) AS column_name
          FROM pg_catalog.pg_depend d
          JOIN pg_catalog.pg_class s ON s.oid = d.objid AND s.relkind = 'S'
          JOIN pg_catalog.pg_namespace sn ON sn.oid = s.relnamespace
          JOIN pg_catalog.pg_class t ON t.oid = d.refobjid
          JOIN pg_catalog.pg_namespace tn ON tn.oid = t.relnamespace
          JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
          WHERE d.deptype = 'a' AND sn.nspname = $1
        `, [schemaName]);
        for (const dep of ownedByResult.rows) {
          deferredOwnedBy.push(`ALTER SEQUENCE ${dep.sequence_name} OWNED BY ${dep.table_name}.${dep.column_name};`);
        }

        // ---- Tables ----
        const tablesResult = await pool.query(`
          SELECT c.relname AS table_name, c.oid AS oid
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r', 'p')
          AND c.relispartition = false
          AND n.nspname = $1
          ORDER BY c.relname
        `, [schemaName]);

        for (const tableRow of tablesResult.rows) {
          const tableName = tableRow.table_name;
          const tableOid = tableRow.oid;
          const fullTableName = `${quotedSchema}.${this.quoteIdentifier(tableName)}`;
          const depKey = `${schemaName}.${tableName}`;
          if (!tableDeps.has(depKey)) tableDeps.set(depKey, new Set());

          // Columns — including IDENTITY and GENERATED (stored) columns.
          const columnsResult = await pool.query(`
            SELECT a.attname AS column_name,
                   format_type(a.atttypid, a.atttypmod) AS data_type,
                   a.attnotnull AS not_null,
                   a.attidentity AS identity,
                   a.attgenerated AS generated,
                   pg_get_expr(d.adbin, d.adrelid) AS column_default,
                   (SELECT seqclass.relname
                      FROM pg_catalog.pg_depend dep
                      JOIN pg_catalog.pg_class seqclass ON seqclass.oid = dep.objid AND seqclass.relkind = 'S'
                      WHERE dep.refobjid = a.attrelid AND dep.refobjsubid = a.attnum AND dep.deptype = 'i'
                      LIMIT 1) AS identity_seq_name,
                   (SELECT seqns.nspname
                      FROM pg_catalog.pg_depend dep
                      JOIN pg_catalog.pg_class seqclass ON seqclass.oid = dep.objid AND seqclass.relkind = 'S'
                      JOIN pg_catalog.pg_namespace seqns ON seqns.oid = seqclass.relnamespace
                      WHERE dep.refobjid = a.attrelid AND dep.refobjsubid = a.attnum AND dep.deptype = 'i'
                      LIMIT 1) AS identity_seq_schema
            FROM pg_catalog.pg_attribute a
            LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped
            ORDER BY a.attnum
          `, [tableOid]);

          backupSQL += `-- Table: ${fullTableName}\n`;
          backupSQL += `DROP TABLE IF EXISTS ${fullTableName} CASCADE;\n`;
          backupSQL += `CREATE TABLE ${fullTableName} (\n`;

          const tableItems = [];

          for (const col of columnsResult.rows) {
            let def = `  ${this.quoteIdentifier(col.column_name)} ${col.data_type}`;

            if (col.generated === 's') {
              // Stored generated column
              def += ` GENERATED ALWAYS AS (${col.column_default}) STORED`;
            } else if (col.identity === 'a' || col.identity === 'd') {
              const kind = col.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT';
              def += ` GENERATED ${kind} AS IDENTITY`;
            } else if (col.column_default) {
              def += ` DEFAULT ${col.column_default}`;
            }

            if (col.not_null && col.generated !== 's') def += ` NOT NULL`;
            tableItems.push(def);
          }

          // Primary key (inline)
          const pkResult = await pool.query(`
            SELECT pg_get_constraintdef(con.oid) AS def
            FROM pg_catalog.pg_constraint con
            WHERE con.conrelid = $1 AND con.contype = 'p'
          `, [tableOid]);
          for (const pk of pkResult.rows) {
            tableItems.push(`  ${pk.def}`);
          }

          // UNIQUE + CHECK constraints (inline). Exclude NOT VALID checks handled elsewhere.
          const consResult = await pool.query(`
            SELECT con.conname AS name, con.contype AS type,
                   pg_get_constraintdef(con.oid) AS def
            FROM pg_catalog.pg_constraint con
            WHERE con.conrelid = $1 AND con.contype IN ('u', 'c')
            ORDER BY con.contype, con.conname
          `, [tableOid]);
          for (const con of consResult.rows) {
            tableItems.push(`  CONSTRAINT ${this.quoteIdentifier(con.name)} ${con.def}`);
          }

          backupSQL += tableItems.join(',\n');
          backupSQL += `\n);\n\n`;

          // Record FK dependencies for data ordering.
          const fkDepResult = await pool.query(`
            SELECT n2.nspname AS ref_schema, c2.relname AS ref_table
            FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_class c2 ON con.confrelid = c2.oid
            JOIN pg_catalog.pg_namespace n2 ON n2.oid = c2.relnamespace
            WHERE con.conrelid = $1 AND con.contype = 'f'
          `, [tableOid]);
          for (const fkd of fkDepResult.rows) {
            const refKey = `${fkd.ref_schema}.${fkd.ref_table}`;
            if (refKey !== depKey) tableDeps.get(depKey).add(refKey);
          }

          // ---- Data (buffered; INSERT column list makes IDENTITY/defaults safe) ----
          const alwaysIdentityCols = columnsResult.rows
            .filter(c => c.identity === 'a')
            .map(c => c.column_name);
          const identityCols = columnsResult.rows
            .filter(c => c.identity === 'a' || c.identity === 'd')
            .map(c => c.column_name);
          const genCols = columnsResult.rows
            .filter(c => c.generated === 's')
            .map(c => c.column_name);
          const skipCols = new Set([...genCols]); // never write generated columns

          try {
            const dataResult = await pool.query(`SELECT * FROM ${fullTableName}`);
            if (dataResult.rows.length > 0) {
              let block = `-- Data for ${fullTableName}\n`;
              const allCols = dataResult.fields
                .map(f => f.name)
                .filter(name => !skipCols.has(name));
              const colTypeByName = {};
              for (const f of dataResult.fields) colTypeByName[f.name] = f.dataTypeID;
              const colList = allCols.map(c => this.quoteIdentifier(c)).join(', ');
              const needsOverriding = alwaysIdentityCols.length > 0;

              for (const row of dataResult.rows) {
                const vals = allCols.map(c => this.formatSQLValue(row[c], colTypeByName[c]));
                block += `INSERT INTO ${fullTableName} (${colList})`;
                if (needsOverriding) block += ` OVERRIDING SYSTEM VALUE`;
                block += ` VALUES (${vals.join(', ')});\n`;
              }

              // Advance IDENTITY sequences past the inserted rows.
              for (const idCol of identityCols) {
                try {
                  const mv = await pool.query(
                    `SELECT max(${this.quoteIdentifier(idCol)}) AS m FROM ${fullTableName}`
                  );
                  const maxVal = mv.rows[0] && mv.rows[0].m;
                  if (maxVal != null) {
                    block += `SELECT setval(pg_get_serial_sequence('${fullTableName.replace(/'/g, "''")}', '${idCol.replace(/'/g, "''")}'), ${maxVal}, true);\n`;
                  }
                } catch (svErr) {
                  console.warn(`Could not compute identity setval for ${fullTableName}.${idCol}:`, svErr.message);
                }
              }

              block += `\n`;
              deferredData.push({ key: depKey, fullTableName, sql: block });
            }
          } catch (dataErr) {
            console.warn(`Could not export data for ${fullTableName}:`, dataErr.message);
            backupSQL += `-- NOTE: could not export data for ${fullTableName}: ${dataErr.message}\n\n`;
          }
        }

        // ---- Indexes (deferred; skip those backing a constraint) ----
        const idxResult = await safeQuery(`indexes in ${schemaName}`, `
          SELECT i.indexname AS name, i.indexdef AS def
          FROM pg_catalog.pg_indexes i
          WHERE i.schemaname = $1
          AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_class ic ON ic.oid = con.conindid
            JOIN pg_catalog.pg_namespace icn ON icn.oid = ic.relnamespace
            WHERE icn.nspname = i.schemaname AND ic.relname = i.indexname
          )
          ORDER BY i.indexname
        `, [schemaName]);
        for (const idx of idxResult.rows) {
          // pg_get_indexdef already emits CREATE [UNIQUE] INDEX ... ; make it idempotent.
          const def = idx.def.replace(/^CREATE (UNIQUE )?INDEX /i, 'CREATE $1INDEX IF NOT EXISTS ');
          deferredIndexes.push(def.endsWith(';') ? def : def + ';');
        }

        // ---- Regular views (dependency-ordered within schema) ----
        const viewsResult = await safeQuery(`views in ${schemaName}`, `
          SELECT c.relname AS view_name, c.oid AS oid,
                 pg_get_viewdef(c.oid, true) AS view_definition
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'v' AND n.nspname = $1
        `, [schemaName]);

        // Order views so a view is emitted after any view it depends on.
        const viewByOid = new Map(viewsResult.rows.map(v => [String(v.oid), v]));
        const viewOrder = [];
        const visited = new Set();
        const visitView = async (oid) => {
          if (visited.has(oid)) return;
          visited.add(oid);
          try {
            const depRes = await pool.query(`
              SELECT DISTINCT d.refobjid AS dep_oid
              FROM pg_catalog.pg_rewrite rw
              JOIN pg_catalog.pg_depend d ON d.objid = rw.oid
                AND d.classid = 'pg_rewrite'::regclass
                AND d.refclassid = 'pg_class'::regclass
              WHERE rw.ev_class = $1
                AND d.refobjid <> $1
            `, [oid]);
            for (const dr of depRes.rows) {
              if (viewByOid.has(String(dr.dep_oid))) await visitView(String(dr.dep_oid));
            }
          } catch (e) { /* best effort ordering */ }
          if (viewByOid.has(oid)) viewOrder.push(viewByOid.get(oid));
        };
        for (const v of viewsResult.rows) await visitView(String(v.oid));

        for (const viewRow of viewOrder) {
          const fullViewName = `${quotedSchema}.${this.quoteIdentifier(viewRow.view_name)}`;
          backupSQL += `-- View: ${fullViewName}\n`;
          backupSQL += `DROP VIEW IF EXISTS ${fullViewName} CASCADE;\n`;
          backupSQL += `CREATE VIEW ${fullViewName} AS\n${viewRow.view_definition}\n\n`;
        }

        // ---- Materialized views (deferred to the very end, after data) ----
        const matViewResult = await safeQuery(`materialized views in ${schemaName}`, `
          SELECT c.relname AS name, pg_get_viewdef(c.oid, true) AS definition
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'm' AND n.nspname = $1
          ORDER BY c.relname
        `, [schemaName]);
        for (const mv of matViewResult.rows) {
          const fullName = `${quotedSchema}.${this.quoteIdentifier(mv.name)}`;
          const mvDef = String(mv.definition).trim().replace(/;\s*$/, '');
          deferredMatViews.push(
            `DROP MATERIALIZED VIEW IF EXISTS ${fullName} CASCADE;\n` +
            `CREATE MATERIALIZED VIEW ${fullName} AS\n${mvDef}\nWITH DATA;\n`
          );
        }

        // ---- Functions & procedures ----
        const funcResult = await safeQuery(`functions in ${schemaName}`, `
          SELECT p.oid,
                 p.proname AS name,
                 pg_get_functiondef(p.oid) AS def
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = $1
          AND p.prokind IN ('f', 'p')
          AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_depend d
            WHERE d.objid = p.oid AND d.deptype = 'e'
          )
          ORDER BY p.proname
        `, [schemaName]);
        if (funcResult.rows.length > 0) {
          backupSQL += `-- Functions & procedures for schema: ${schemaName}\n`;
          for (const fn of funcResult.rows) {
            if (!fn.def) continue;
            // pg_get_functiondef emits CREATE OR REPLACE already.
            backupSQL += `${fn.def}${fn.def.trim().endsWith(';') ? '' : ';'}\n\n`;
          }
        }
      }

      // ============================================================
      // 6. Sequence ownership (tables now exist)
      // ============================================================
      if (deferredOwnedBy.length > 0) {
        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Sequence ownership\n`;
        backupSQL += `-- ============================================\n`;
        backupSQL += deferredOwnedBy.join('\n') + '\n';
      }

      // ============================================================
      // 7. Data (topologically sorted by FK dependencies)
      // ============================================================
      if (deferredData.length > 0) {
        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Data\n`;
        backupSQL += `-- ============================================\n`;

        const dataByKey = new Map(deferredData.map(d => [d.key, d]));
        const emitted = new Set();
        const emitting = new Set();
        const orderedData = [];
        const visitData = (key) => {
          if (emitted.has(key) || emitting.has(key)) return; // break cycles
          emitting.add(key);
          const deps = tableDeps.get(key) || new Set();
          for (const dep of deps) {
            if (dataByKey.has(dep)) visitData(dep);
          }
          emitting.delete(key);
          emitted.add(key);
          if (dataByKey.has(key)) orderedData.push(dataByKey.get(key));
        };
        for (const d of deferredData) visitData(d.key);

        // Detect FK cycles among tables that actually have data.
        const hasCycle = deferredData.some(d => {
          const seen = new Set();
          const stack = [d.key];
          while (stack.length) {
            const cur = stack.pop();
            if (cur === d.key && seen.size > 0) return true;
            if (seen.has(cur)) continue;
            seen.add(cur);
            for (const dep of (tableDeps.get(cur) || [])) {
              if (dep === d.key) return true;
              stack.push(dep);
            }
          }
          return false;
        });

        if (hasCycle) {
          backupSQL += `SET session_replication_role = replica;  -- defer FK checks (circular references)\n\n`;
        }
        for (const d of orderedData) {
          backupSQL += d.sql;
        }
        if (hasCycle) {
          backupSQL += `SET session_replication_role = DEFAULT;\n\n`;
        }
      }

      // ============================================================
      // 8. Indexes
      // ============================================================
      if (deferredIndexes.length > 0) {
        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Indexes\n`;
        backupSQL += `-- ============================================\n`;
        backupSQL += deferredIndexes.join('\n') + '\n';
      }

      // ============================================================
      // 9. Foreign keys
      // ============================================================
      let fkQuery = `
        SELECT
          quote_ident(n1.nspname) || '.' || quote_ident(c1.relname) AS table_name,
          quote_ident(con.conname) AS constraint_name,
          pg_get_constraintdef(con.oid) AS def
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class c1 ON con.conrelid = c1.oid
        JOIN pg_catalog.pg_namespace n1 ON n1.oid = c1.relnamespace
        WHERE con.contype = 'f'
        AND n1.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND n1.nspname NOT LIKE 'pg_%'
        AND n1.nspname NOT LIKE '\\_timescaledb%'
      `;

      const fkQueryParams = [];
      if (selectedSchemas && selectedSchemas.length > 0) {
        fkQuery += ' AND n1.nspname = ANY($1)';
        fkQueryParams.push(selectedSchemas);
      }
      fkQuery += ' ORDER BY n1.nspname, c1.relname, con.conname';

      const fkResult = await safeQuery('foreign keys', fkQuery, fkQueryParams);
      if (fkResult.rows.length > 0) {
        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Foreign Keys\n`;
        backupSQL += `-- ============================================\n`;
        for (const fk of fkResult.rows) {
          backupSQL += `ALTER TABLE ${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} ${fk.def};\n`;
        }
      }

      // ============================================================
      // 10. Triggers
      // ============================================================
      let trigQuery = `
        SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS table_name,
               t.tgname AS name,
               pg_get_triggerdef(t.oid, true) AS def
        FROM pg_catalog.pg_trigger t
        JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE NOT t.tgisinternal
        AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND n.nspname NOT LIKE 'pg_%'
      `;
      const trigParams = [];
      if (selectedSchemas && selectedSchemas.length > 0) {
        trigQuery += ' AND n.nspname = ANY($1)';
        trigParams.push(selectedSchemas);
      }
      trigQuery += ' ORDER BY n.nspname, c.relname, t.tgname';

      const trigResult = await safeQuery('triggers', trigQuery, trigParams);
      if (trigResult.rows.length > 0) {
        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Triggers\n`;
        backupSQL += `-- ============================================\n`;
        for (const tg of trigResult.rows) {
          backupSQL += `DROP TRIGGER IF EXISTS ${this.quoteIdentifier(tg.name)} ON ${tg.table_name};\n`;
          backupSQL += `${tg.def};\n`;
        }
      }

      // ============================================================
      // 11. Materialized views (after data so WITH DATA can populate)
      // ============================================================
      if (deferredMatViews.length > 0) {
        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Materialized Views\n`;
        backupSQL += `-- ============================================\n`;
        backupSQL += deferredMatViews.join('\n') + '\n';
      }

      // ============================================================
      // 12. Row-Level Security (enable + policies)
      // ============================================================
      let rlsQuery = `
        SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) AS table_name,
               policyname AS name, permissive, roles, cmd, qual, with_check
        FROM pg_catalog.pg_policies
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND schemaname NOT LIKE 'pg_%'
      `;
      const rlsParams = [];
      if (selectedSchemas && selectedSchemas.length > 0) {
        rlsQuery += ' AND schemaname = ANY($1)';
        rlsParams.push(selectedSchemas);
      }
      rlsQuery += ' ORDER BY schemaname, tablename, policyname';

      const rlsResult = await safeQuery('RLS policies', rlsQuery, rlsParams);
      if (rlsResult.rows.length > 0) {
        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Row-Level Security Policies\n`;
        backupSQL += `-- ============================================\n`;
        const rlsTables = new Set();
        for (const p of rlsResult.rows) {
          if (!rlsTables.has(p.table_name)) {
            backupSQL += `ALTER TABLE ${p.table_name} ENABLE ROW LEVEL SECURITY;\n`;
            rlsTables.add(p.table_name);
          }
          let stmt = `CREATE POLICY ${this.quoteIdentifier(p.name)} ON ${p.table_name}`;
          stmt += p.permissive === 'PERMISSIVE' ? ` AS PERMISSIVE` : ` AS RESTRICTIVE`;
          if (p.cmd && p.cmd !== 'ALL') stmt += ` FOR ${p.cmd}`;
          if (Array.isArray(p.roles) && p.roles.length && !(p.roles.length === 1 && p.roles[0] === 'public')) {
            stmt += ` TO ${p.roles.map(r => this.quoteIdentifier(r)).join(', ')}`;
          }
          if (p.qual) stmt += ` USING (${p.qual})`;
          if (p.with_check) stmt += ` WITH CHECK (${p.with_check})`;
          backupSQL += stmt + `;\n`;
        }
      }

      // ============================================================
      // 13. Comments (tables, columns, and other objects)
      // ============================================================
      let commentQuery = `
        SELECT 'TABLE'  AS obj_type,
               quote_ident(n.nspname) || '.' || quote_ident(c.relname) AS obj_name,
               NULL::text AS extra,
               d.description AS comment
        FROM pg_catalog.pg_description d
        JOIN pg_catalog.pg_class c ON c.oid = d.objoid AND d.objsubid = 0
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','p','v','m') AND n.nspname = ANY($1)
        UNION ALL
        SELECT 'COLUMN' AS obj_type,
               quote_ident(n.nspname) || '.' || quote_ident(c.relname) || '.' || quote_ident(a.attname) AS obj_name,
               NULL::text AS extra,
               d.description AS comment
        FROM pg_catalog.pg_description d
        JOIN pg_catalog.pg_class c ON c.oid = d.objoid AND d.objsubid > 0
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.objsubid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY($1)
      `;
      const commentSchemas = (selectedSchemas && selectedSchemas.length > 0)
        ? selectedSchemas
        : schemaNames;
      const commentResult = await safeQuery('comments', commentQuery, [commentSchemas]);
      if (commentResult.rows.length > 0) {
        backupSQL += `\n-- ============================================\n`;
        backupSQL += `-- Comments\n`;
        backupSQL += `-- ============================================\n`;
        for (const cm of commentResult.rows) {
          if (cm.comment == null) continue;
          const esc = String(cm.comment).replace(/'/g, "''");
          backupSQL += `COMMENT ON ${cm.obj_type} ${cm.obj_name} IS '${esc}';\n`;
        }
      }

      backupSQL += `\n-- Backup completed: ${new Date().toISOString()}\n`;

      return {
        success: true,
        backup: backupSQL
      };
    } catch (error) {
      console.error('Error generating database backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAvailableSchemas(databaseId) {
    try {
      console.log('Getting available schemas for databaseId:', databaseId);
      const pool = this.pools.get(databaseId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      // Get schemas with table and view counts
      const schemasQuery = `
        SELECT 
          n.nspname as schema_name,
          COUNT(DISTINCT CASE WHEN c.relkind = 'r' THEN c.relname END) as table_count,
          COUNT(DISTINCT CASE WHEN c.relkind = 'v' THEN c.relname END) as view_count
        FROM pg_catalog.pg_namespace n
        LEFT JOIN pg_catalog.pg_class c ON n.oid = c.relnamespace 
          AND c.relkind IN ('r', 'v')
        WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND n.nspname NOT LIKE 'pg_%'
        GROUP BY n.nspname
        ORDER BY n.nspname
      `;
      
      const schemasResult = await pool.query(schemasQuery);

      const schemas = schemasResult.rows.map(row => ({
        name: row.schema_name,
        tableCount: parseInt(row.table_count) || 0,
        viewCount: parseInt(row.view_count) || 0
      }));

      return {
        success: true,
        schemas: schemas
      };
    } catch (error) {
      console.error('Error getting available schemas:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateDatabaseSchema(databaseId, selectedSchemas = null) {
    try {
      console.log('Generating database schema for databaseId:', databaseId);
      console.log('Selected schemas:', selectedSchemas);
      const pool = this.pools.get(databaseId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      const connection = this.getConnection(databaseId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      let schemaSQL = '';
      const timestamp = new Date().toISOString();
      
      // Add header
      schemaSQL += `-- NeuroDB Database Schema (DDL Only)\n`;
      schemaSQL += `-- Database: ${connection.database}\n`;
      schemaSQL += `-- Host: ${connection.host}:${connection.port}\n`;
      schemaSQL += `-- Generated: ${timestamp}\n`;
      if (selectedSchemas && selectedSchemas.length > 0) {
        schemaSQL += `-- Schemas: ${selectedSchemas.join(', ')}\n`;
      }
      schemaSQL += `-- =====================================================\n\n`;

      // Get all schemas or filtered schemas
      let schemasQuery = 'SELECT nspname as schema_name FROM pg_catalog.pg_namespace ' +
        "WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND nspname NOT LIKE 'pg_%' ";
      
      const queryParams = [];
      if (selectedSchemas && selectedSchemas.length > 0) {
        schemasQuery += 'AND nspname = ANY($1) ';
        queryParams.push(selectedSchemas);
      }
      
      schemasQuery += 'ORDER BY nspname';
      
      const schemasResult = await pool.query(schemasQuery, queryParams);

      for (const schemaRow of schemasResult.rows) {
        const schemaName = schemaRow.schema_name;
        
        schemaSQL += `\n-- Schema: ${schemaName}\n`;
        schemaSQL += `CREATE SCHEMA IF NOT EXISTS ${schemaName};\n\n`;

        // Get tables in this schema
        const tablesQuery = `
          SELECT c.relname as table_name
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r'
          AND n.nspname = $1
          ORDER BY c.relname
        `;
        
        const tablesResult = await pool.query(tablesQuery, [schemaName]);

        for (const tableRow of tablesResult.rows) {
          const tableName = tableRow.table_name;
          // Properly quote schema and table names for PostgreSQL
          const quotedSchema = this.quoteIdentifier(schemaName);
          const quotedTable = this.quoteIdentifier(tableName);
          const fullTableName = `${quotedSchema}.${quotedTable}`;

          // Get table structure
          const columnsQuery = `
            SELECT 
              a.attname as column_name,
              format_type(a.atttypid, a.atttypmod) as data_type,
              NOT a.attnotnull as is_nullable,
              pg_get_expr(d.adbin, d.adrelid) as column_default
            FROM pg_catalog.pg_attribute a
            LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE a.attrelid = $1::regclass
            AND a.attnum > 0
            AND NOT a.attisdropped
            ORDER BY a.attnum
          `;

          const columnsResult = await pool.query(columnsQuery, [fullTableName]);

          // Build CREATE TABLE statement
          schemaSQL += `-- Table: ${fullTableName}\n`;
          schemaSQL += `DROP TABLE IF EXISTS ${fullTableName} CASCADE;\n`;
          schemaSQL += `CREATE TABLE ${fullTableName} (\n`;

          const columnDefs = columnsResult.rows.map((col, idx) => {
            let def = `  ${col.column_name} ${col.data_type}`;
            if (!col.is_nullable) {
              def += ' NOT NULL';
            }
            if (col.column_default) {
              def += ` DEFAULT ${col.column_default}`;
            }
            return def;
          });

          schemaSQL += columnDefs.join(',\n');

          // Get primary keys
          const pkQuery = `
            SELECT a.attname as column_name
            FROM pg_catalog.pg_constraint con
            JOIN pg_catalog.pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
            WHERE con.conrelid = $1::regclass
            AND con.contype = 'p'
          `;
          
          const pkResult = await pool.query(pkQuery, [fullTableName]);
          
          if (pkResult.rows.length > 0) {
            const pkColumns = pkResult.rows.map(r => r.column_name).join(', ');
            schemaSQL += `,\n  PRIMARY KEY (${pkColumns})`;
          }

          schemaSQL += `\n);\n\n`;

          // Get indexes (excluding primary key indexes)
          const indexQuery = `
            SELECT 
              i.relname as index_name,
              ix.indisunique as is_unique,
              string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum)) as columns
            FROM pg_catalog.pg_index ix
            JOIN pg_catalog.pg_class i ON i.oid = ix.indexrelid
            JOIN pg_catalog.pg_class c ON c.oid = ix.indrelid
            JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey)
            WHERE c.oid = $1::regclass
            AND NOT ix.indisprimary
            GROUP BY i.relname, ix.indisunique
          `;

          const indexResult = await pool.query(indexQuery, [fullTableName]);
          
          for (const idx of indexResult.rows) {
            const uniqueStr = idx.is_unique ? 'UNIQUE ' : '';
            schemaSQL += `CREATE ${uniqueStr}INDEX ${idx.index_name} ON ${fullTableName} (${idx.columns});\n`;
          }
          
          if (indexResult.rows.length > 0) {
            schemaSQL += '\n';
          }
        }

        // Get views
        const viewsQuery = `
          SELECT c.relname as view_name, pg_get_viewdef(c.oid, true) as view_definition
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'v'
          AND n.nspname = $1
          ORDER BY c.relname
        `;
        
        const viewsResult = await pool.query(viewsQuery, [schemaName]);

        for (const viewRow of viewsResult.rows) {
          const viewName = viewRow.view_name;
          const fullViewName = `${schemaName}.${viewName}`;
          
          schemaSQL += `-- View: ${fullViewName}\n`;
          schemaSQL += `DROP VIEW IF EXISTS ${fullViewName} CASCADE;\n`;
          schemaSQL += `CREATE VIEW ${fullViewName} AS\n${viewRow.view_definition}\n\n`;
        }
      }

      // Get foreign keys (add at the end to avoid dependency issues)
      let fkQueryStr = `
        SELECT
          quote_ident(n1.nspname) || '.' || quote_ident(c1.relname) as table_name,
          quote_ident(con.conname) as constraint_name,
          quote_ident(a1.attname) as column_name,
          quote_ident(n2.nspname) || '.' || quote_ident(c2.relname) as foreign_table_name,
          quote_ident(a2.attname) as foreign_column_name
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class c1 ON con.conrelid = c1.oid
        JOIN pg_catalog.pg_namespace n1 ON n1.oid = c1.relnamespace
        JOIN pg_catalog.pg_class c2 ON con.confrelid = c2.oid
        JOIN pg_catalog.pg_namespace n2 ON n2.oid = c2.relnamespace
        JOIN pg_catalog.pg_attribute a1 ON a1.attrelid = c1.oid AND a1.attnum = ANY(con.conkey)
        JOIN pg_catalog.pg_attribute a2 ON a2.attrelid = c2.oid AND a2.attnum = ANY(con.confkey)
        WHERE con.contype = 'f'
        AND n1.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        AND n1.nspname NOT LIKE 'pg_%'
        AND n1.nspname NOT LIKE '\\_timescaledb%'
      `;

      const fkParams = [];
      if (selectedSchemas && selectedSchemas.length > 0) {
        fkQueryStr += ` AND n1.nspname = ANY($1)`;
        fkParams.push(selectedSchemas);
      }

      fkQueryStr += ` ORDER BY n1.nspname, c1.relname, con.conname`;

      const fkResult = await pool.query(fkQueryStr, fkParams);

      if (fkResult.rows.length > 0) {
        schemaSQL += `\n-- Foreign Keys\n`;
        for (const fk of fkResult.rows) {
          schemaSQL += `ALTER TABLE ${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
          schemaSQL += `FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name});\n`;
        }
      } else {
        // No explicit FK constraints defined — infer relationships from naming conventions:
        // column "foo_id" (int/bigint) → table "foo" PK "id"
        // column "foo"    (int/bigint) → table "foo" PK "id"
        let inferredFkQuery = `
          SELECT DISTINCT
            quote_ident(n.nspname) || '.' || quote_ident(t.relname) AS table_name,
            'fk_' || t.relname || '_' || a.attname AS constraint_name,
            quote_ident(a.attname) AS column_name,
            quote_ident(rn.nspname) || '.' || quote_ident(rt.relname) AS foreign_table_name,
            'id' AS foreign_column_name
          FROM pg_catalog.pg_attribute a
          JOIN pg_catalog.pg_class t ON t.oid = a.attrelid AND t.relkind = 'r'
          JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
          JOIN pg_catalog.pg_type at ON at.oid = a.atttypid
          -- strip _id suffix or use column name as-is to find the referenced table
          JOIN pg_catalog.pg_class rt ON rt.relkind = 'r' AND rt.oid != t.oid AND (
            rt.relname = regexp_replace(a.attname, '_id$', '')
            OR (a.attname NOT LIKE '%_id' AND rt.relname = a.attname)
          )
          JOIN pg_catalog.pg_namespace rn ON rn.oid = rt.relnamespace AND rn.nspname = n.nspname
          -- referenced table must have an 'id' column that is its primary key
          JOIN pg_catalog.pg_attribute ra ON ra.attrelid = rt.oid AND ra.attname = 'id'
            AND ra.attnum > 0 AND NOT ra.attisdropped
          JOIN pg_catalog.pg_type rat ON rat.oid = ra.atttypid
          JOIN pg_catalog.pg_constraint pk ON pk.conrelid = rt.oid AND pk.contype = 'p'
            AND ARRAY[ra.attnum::int] <@ pk.conkey::int[]
          WHERE a.attnum > 0 AND NOT a.attisdropped
          AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          AND n.nspname NOT LIKE 'pg_%'
          AND n.nspname NOT LIKE '\\_timescaledb%'
          -- both columns must be integer-family types for a valid FK
          AND at.typname IN ('int2', 'int4', 'int8')
          AND rat.typname IN ('int2', 'int4', 'int8')
        `;

        const inferredFkParams = [];
        if (selectedSchemas && selectedSchemas.length > 0) {
          inferredFkQuery += ` AND n.nspname = ANY($1)`;
          inferredFkParams.push(selectedSchemas);
        }

        inferredFkQuery += ` ORDER BY 1, 3`;

        const inferredFkResult = await pool.query(inferredFkQuery, inferredFkParams);

        if (inferredFkResult.rows.length > 0) {
          schemaSQL += `\n-- Foreign Keys (inferred from column naming conventions — no explicit FK constraints were defined in the database)\n`;
          for (const fk of inferredFkResult.rows) {
            schemaSQL += `ALTER TABLE ${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
            schemaSQL += `FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name});\n`;
          }
        }
      }

      schemaSQL += `\n-- Schema export completed: ${new Date().toISOString()}\n`;

      return {
        success: true,
        schema: schemaSQL
      };
    } catch (error) {
      console.error('Error generating database schema:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createTable(connectionId, tableData) {
    try {
      const pool = this.pools.get(connectionId);
      if (!pool) {
        return { success: false, error: 'Not connected to database' };
      }

      const { tableName, columns, indexes } = tableData;

      // Quote table name properly
      const quotedTableName = this.quoteIdentifier(tableName);

      // Start building the CREATE TABLE statement
      let createTableSQL = `CREATE TABLE ${quotedTableName} (\n`;
      
      // Add columns
      const columnDefs = [];
      let primaryKeyColumns = [];
      
      for (const column of columns) {
        const quotedColumnName = this.quoteIdentifier(column.name);
        let columnDef = `  ${quotedColumnName} ${column.dataType}`;
        
        // Add NOT NULL if it's a primary key
        if (column.isPrimaryKey) {
          columnDef += ' NOT NULL';
          primaryKeyColumns.push(quotedColumnName);
        }
        
        columnDefs.push(columnDef);
      }
      
      createTableSQL += columnDefs.join(',\n');
      
      // Add primary key constraint if any primary key columns exist
      if (primaryKeyColumns.length > 0) {
        createTableSQL += `,\n  PRIMARY KEY (${primaryKeyColumns.join(', ')})`;
      }
      
      createTableSQL += '\n);';
      
      console.log('Generated CREATE TABLE SQL:', createTableSQL);
      
      // Execute the CREATE TABLE statement
      await pool.query(createTableSQL);
      
      // Create indexes for columns that need them
      for (const indexColumn of indexes) {
        const quotedIndexColumn = this.quoteIdentifier(indexColumn);
        const quotedIndexName = this.quoteIdentifier(`idx_${tableName}_${indexColumn}`);
        const createIndexSQL = `CREATE INDEX ${quotedIndexName} ON ${quotedTableName} (${quotedIndexColumn});`;
        console.log('Generated CREATE INDEX SQL:', createIndexSQL);
        await pool.query(createIndexSQL);
      }
      
      return {
        success: true,
        message: `Table "${tableName}" created successfully`
      };
      
    } catch (error) {
      console.error('Error creating table:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeCreateTableSQL(connectionId, sql) {
    try {
      const pool = this.getConnection(connectionId);
      if (!pool) {
        return {
          success: false,
          error: 'Database connection not found'
        };
      }

      // Execute the SQL query
      await pool.query(sql);
      
      return {
        success: true,
        message: 'Table created successfully'
      };
      
    } catch (error) {
      console.error('Error executing CREATE TABLE SQL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DatabaseService;