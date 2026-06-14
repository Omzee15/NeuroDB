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

  async generateDatabaseBackup(databaseId) {
    try {
      console.log('Generating database backup for databaseId:', databaseId);
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
      backupSQL += `-- =====================================================\n\n`;

      // Get all schemas
      const schemasQuery = 'SELECT nspname as schema_name FROM pg_catalog.pg_namespace ' +
        "WHERE nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast') " +
        "AND nspname NOT LIKE 'pg_%' " +
        'ORDER BY nspname';
      
      const schemasResult = await pool.query(schemasQuery);

      for (const schemaRow of schemasResult.rows) {
        const schemaName = schemaRow.schema_name;
        
        backupSQL += `\n-- Schema: ${schemaName}\n`;
        backupSQL += `CREATE SCHEMA IF NOT EXISTS ${schemaName};\n\n`;

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
          backupSQL += `-- Table: ${fullTableName}\n`;
          backupSQL += `DROP TABLE IF EXISTS ${fullTableName} CASCADE;\n`;
          backupSQL += `CREATE TABLE ${fullTableName} (\n`;

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

          backupSQL += columnDefs.join(',\n');

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
            backupSQL += `,\n  PRIMARY KEY (${pkColumns})`;
          }

          backupSQL += `\n);\n\n`;

          // Get data
          const dataResult = await pool.query(`SELECT * FROM ${fullTableName}`);
          
          if (dataResult.rows.length > 0) {
            backupSQL += `-- Data for ${fullTableName}\n`;
            
            for (const row of dataResult.rows) {
              const columns = Object.keys(row);
              const values = columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                if (val instanceof Date) return `'${val.toISOString()}'`;
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                return val;
              });

              backupSQL += `INSERT INTO ${fullTableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }
            
            backupSQL += '\n';
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
          
          backupSQL += `-- View: ${fullViewName}\n`;
          backupSQL += `DROP VIEW IF EXISTS ${fullViewName} CASCADE;\n`;
          backupSQL += `CREATE VIEW ${fullViewName} AS\n${viewRow.view_definition}\n\n`;
        }
      }

      // Get foreign keys (add at the end to avoid dependency issues)
      const fkQuery = `
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
        ORDER BY n1.nspname, c1.relname, con.conname
      `;

      const fkResult = await pool.query(fkQuery);

      if (fkResult.rows.length > 0) {
        backupSQL += `\n-- Foreign Keys\n`;
        for (const fk of fkResult.rows) {
          backupSQL += `ALTER TABLE ${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
          backupSQL += `FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name});\n`;
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