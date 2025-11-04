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
      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.user,
        password: connection.password
      });

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
      const pool = new Pool({
        host: server.host,
        port: server.port,
        database: 'postgres', // Connect to default postgres database
        user: server.user,
        password: server.password
      });

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
    
    return {
      id: db.id,
      name: `${db.name}@${server.host}:${server.port}`,
      host: server.host,
      port: server.port,
      database: db.name,
      user: server.user,
      password: server.password
    };
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

      const pool = new Pool({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        user: connection.user,
        password: connection.password
      });

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
        this.activeQueries.set(queryId, { client, connectionId });
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
      
      return {
        success: false,
        error: error.message,
        position: error.position
      };
    }
  }

  async cancelQuery(queryId) {
    try {
      const queryInfo = this.activeQueries.get(queryId);
      if (!queryInfo) {
        return { success: false, error: 'Query not found or already completed' };
      }

      const { client } = queryInfo;
      
      // Cancel the query using PostgreSQL's cancel request
      await client.cancel();
      
      // Remove from active queries
      this.activeQueries.delete(queryId);
      
      return { success: true, message: 'Query cancelled successfully' };
    } catch (error) {
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
}

module.exports = DatabaseService;