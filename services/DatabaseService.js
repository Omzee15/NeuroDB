const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseService {
  constructor() {
    this.servers = new Map(); // Server configurations
    this.databases = new Map(); // Database connections within servers
    this.pools = new Map();
    this.configPath = path.join(__dirname, '../connections.json');
    this.loadConnections();
  }

  async createDatabase(serverId, databaseName) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      // Create a temporary connection to postgres database
      const tempPool = new Pool({
        host: server.host,
        port: server.port,
        user: server.user,
        password: server.password,
        database: 'postgres' // Connect to default postgres database
      });

      // Create the new database
      await tempPool.query(`CREATE DATABASE "${databaseName}"`);
      await tempPool.end();

      // Add the new database to our configuration
      const dbId = `${serverId}_${databaseName}`;
      const newDb = {
        id: dbId,
        serverId: serverId,
        name: databaseName
      };

      this.databases.set(dbId, newDb);
      this.saveConnections();

      return newDb;
    } catch (error) {
      console.error('Error creating database:', error);
      throw error;
    }
  }

  loadConnections() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        
        // Load servers
        if (config.servers) {
          config.servers.forEach(server => {
            this.servers.set(server.id, server);
          });
        }
        
        // Load databases
        if (config.databases) {
          config.databases.forEach(db => {
            this.databases.set(db.id, db);
          });
        }
        
        // Migrate old connections to new format if needed
        if (!config.servers && !config.databases && Array.isArray(config)) {
          this.migrateOldConnections(config);
        }
      }
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  }

  migrateOldConnections(oldConnections) {
    // Convert old flat connection list to server/database structure
    const serverMap = new Map();
    
    oldConnections.forEach(conn => {
      const serverKey = `${conn.host}:${conn.port}:${conn.user}`;
      
      if (!serverMap.has(serverKey)) {
        const serverId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const server = {
          id: serverId,
          name: conn.name || `${conn.host}:${conn.port}`,
          host: conn.host,
          port: conn.port,
          user: conn.user,
          password: conn.password
        };
        serverMap.set(serverKey, serverId);
        this.servers.set(serverId, server);
      }
      
      const serverId = serverMap.get(serverKey);
      const dbId = conn.id || `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const database = {
        id: dbId,
        serverId: serverId,
        name: conn.database,
        database: conn.database
      };
      this.databases.set(dbId, database);
    });
    
    this.saveConnectionsToFile();
  }

  saveConnectionsToFile() {
    try {
      const config = {
        servers: Array.from(this.servers.values()),
        databases: Array.from(this.databases.values())
      };
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving connections:', error);
      throw error;
    }
  }

  saveServer(server) {
    try {
      const id = server.id || `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const srv = { ...server, id };
      this.servers.set(id, srv);
      this.saveConnectionsToFile();
      return { success: true, id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  saveDatabase(database) {
    try {
      const id = database.id || `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const db = { ...database, id };
      this.databases.set(id, db);
      this.saveConnectionsToFile();
      return { success: true, id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  saveConnection(connection) {
    // Legacy method for backward compatibility
    return this.saveServer(connection);
  }

  getConnections() {
    // Return structured data with servers and their databases
    const servers = Array.from(this.servers.values()).map(server => ({
      ...server,
      password: '********', // Don't send passwords to frontend
      databases: Array.from(this.databases.values())
        .filter(db => db.serverId === server.id)
        .map(db => ({
          ...db
        }))
    }));
    
    return servers;
  }

  getServer(serverId) {
    return this.servers.get(serverId);
  }

  getDatabase(databaseId) {
    return this.databases.get(databaseId);
  }

  deleteServer(serverId) {
    try {
      // Delete all databases in this server
      const databaseIds = Array.from(this.databases.values())
        .filter(db => db.serverId === serverId)
        .map(db => db.id);
      
      databaseIds.forEach(dbId => {
        if (this.pools.has(dbId)) {
          this.pools.get(dbId).end();
          this.pools.delete(dbId);
        }
        this.databases.delete(dbId);
      });
      
      this.servers.delete(serverId);
      this.saveConnectionsToFile();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  deleteDatabase(databaseId) {
    try {
      if (this.pools.has(databaseId)) {
        this.pools.get(databaseId).end();
        this.pools.delete(databaseId);
      }
      this.databases.delete(databaseId);
      this.saveConnectionsToFile();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  deleteConnection(id) {
    // Legacy method - try both server and database
    const serverResult = this.deleteServer(id);
    if (serverResult.success) return serverResult;
    
    return this.deleteDatabase(id);
  }

  async testConnection(connection) {
    const pool = new Pool({
      host: connection.host,
      port: connection.port,
      database: connection.database || 'postgres',
      user: connection.user,
      password: connection.password,
      connectionTimeoutMillis: 5000,
    });

    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      await pool.end();
      return { success: true, message: 'Connection successful!' };
    } catch (error) {
      await pool.end();
      return { success: false, error: error.message };
    }
  }

  async listDatabasesOnServer(serverId) {
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      const pool = new Pool({
        host: server.host,
        port: server.port,
        database: 'postgres', // Connect to postgres database to list all databases
        user: server.user,
        password: server.password,
        connectionTimeoutMillis: 5000,
      });

      const result = await pool.query(`
        SELECT datname as name 
        FROM pg_database 
        WHERE datistemplate = false 
        AND datname NOT IN ('postgres')
        ORDER BY datname;
      `);

      await pool.end();

      return { 
        success: true, 
        databases: result.rows.map(row => ({ name: row.name }))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async connect(connectionId) {
    try {
      // connectionId can be either a database ID
      const database = this.databases.get(connectionId);
      if (!database) {
        throw new Error('Database connection not found');
      }

      const server = this.servers.get(database.serverId);
      if (!server) {
        throw new Error('Server not found');
      }

      if (this.pools.has(connectionId)) {
        return { success: true, message: 'Already connected' };
      }

      const pool = new Pool({
        host: server.host,
        port: server.port,
        database: database.database,
        user: server.user,
        password: server.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test the connection
      const client = await pool.connect();
      client.release();

      this.pools.set(connectionId, pool);
      return { success: true, message: 'Connected successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async disconnect(connectionId) {
    try {
      if (this.pools.has(connectionId)) {
        await this.pools.get(connectionId).end();
        this.pools.delete(connectionId);
      }
      return { success: true, message: 'Disconnected successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeQuery(connectionId, query) {
    try {
      const pool = this.pools.get(connectionId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      const startTime = Date.now();
      const result = await pool.query(query);
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        rows: result.rows,
        rowCount: result.rowCount,
        fields: result.fields?.map(f => ({
          name: f.name,
          dataType: f.dataTypeID
        })),
        executionTime,
        command: result.command
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        detail: error.detail,
        hint: error.hint,
        position: error.position
      };
    }
  }

  async getDatabaseSchema(connectionId) {
    try {
      const pool = this.pools.get(connectionId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      // Get all tables with their columns
      const query = `
        SELECT 
          t.table_schema,
          t.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length,
          tc.constraint_type,
          kcu.constraint_name
        FROM information_schema.tables t
        LEFT JOIN information_schema.columns c 
          ON t.table_schema = c.table_schema 
          AND t.table_name = c.table_name
        LEFT JOIN information_schema.key_column_usage kcu
          ON c.table_schema = kcu.table_schema
          AND c.table_name = kcu.table_name
          AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
          AND kcu.table_schema = tc.table_schema
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_schema, t.table_name, c.ordinal_position;
      `;

      const result = await pool.query(query);

      // Organize the results by schema and table
      const schema = {};
      result.rows.forEach(row => {
        const schemaName = row.table_schema;
        const tableName = row.table_name;

        if (!schema[schemaName]) {
          schema[schemaName] = {};
        }

        if (!schema[schemaName][tableName]) {
          schema[schemaName][tableName] = {
            columns: [],
            constraints: []
          };
        }

        if (row.column_name) {
          const existingColumn = schema[schemaName][tableName].columns.find(
            c => c.name === row.column_name
          );

          if (!existingColumn) {
            schema[schemaName][tableName].columns.push({
              name: row.column_name,
              type: row.data_type,
              nullable: row.is_nullable === 'YES',
              default: row.column_default,
              maxLength: row.character_maximum_length,
              constraints: row.constraint_type ? [row.constraint_type] : []
            });
          } else if (row.constraint_type && !existingColumn.constraints.includes(row.constraint_type)) {
            existingColumn.constraints.push(row.constraint_type);
          }
        }
      });

      return { success: true, schema };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTables(connectionId) {
    try {
      const pool = this.pools.get(connectionId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      const query = `
        SELECT 
          table_schema,
          table_name,
          (SELECT COUNT(*) FROM information_schema.columns 
           WHERE table_schema = t.table_schema 
           AND table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name;
      `;

      const result = await pool.query(query);
      return { success: true, tables: result.rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getTableSchema(connectionId, tableName) {
    try {
      const pool = this.pools.get(connectionId);
      if (!pool) {
        throw new Error('Not connected to database');
      }

      const [schema, table] = tableName.includes('.') 
        ? tableName.split('.') 
        : ['public', tableName];

      const query = `
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length,
          tc.constraint_type,
          kcu.constraint_name
        FROM information_schema.columns c
        LEFT JOIN information_schema.key_column_usage kcu
          ON c.table_schema = kcu.table_schema
          AND c.table_name = kcu.table_name
          AND c.column_name = kcu.column_name
        LEFT JOIN information_schema.table_constraints tc
          ON kcu.constraint_name = tc.constraint_name
          AND kcu.table_schema = tc.table_schema
        WHERE c.table_schema = $1
          AND c.table_name = $2
        ORDER BY c.ordinal_position;
      `;

      const result = await pool.query(query, [schema, table]);
      return { success: true, columns: result.rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async generateDatabaseBackup(databaseId) {
    try {
      const database = this.databases.get(databaseId);
      if (!database) {
        return { success: false, error: 'Database not found' };
      }

      const server = this.servers.get(database.serverId);
      if (!server) {
        return { success: false, error: 'Server not found' };
      }

      const pool = this.pools.get(databaseId);
      if (!pool) {
        return { success: false, error: 'Not connected to database' };
      }

      let backup = `-- PostgreSQL Database Backup\n`;
      backup += `-- Database: ${database.name}\n`;
      backup += `-- Generated: ${new Date().toISOString()}\n\n`;

      // Get all schemas
      const schemasResult = await pool.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name;
      `);

      for (const schemaRow of schemasResult.rows) {
        const schemaName = schemaRow.schema_name;
        backup += `\n-- Schema: ${schemaName}\n`;
        backup += `CREATE SCHEMA IF NOT EXISTS ${schemaName};\n\n`;

        // Get all tables in this schema
        const tablesResult = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = $1 AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `, [schemaName]);

        for (const tableRow of tablesResult.rows) {
          const tableName = tableRow.table_name;
          const fullTableName = `${schemaName}.${tableName}`;

          backup += `\n-- Table: ${fullTableName}\n`;

          // Get table structure
          const columnsResult = await pool.query(`
            SELECT 
              c.column_name,
              c.data_type,
              c.character_maximum_length,
              c.is_nullable,
              c.column_default
            FROM information_schema.columns c
            WHERE c.table_schema = $1 AND c.table_name = $2
            ORDER BY c.ordinal_position;
          `, [schemaName, tableName]);

          // Create table statement
          backup += `DROP TABLE IF EXISTS ${fullTableName} CASCADE;\n`;
          backup += `CREATE TABLE ${fullTableName} (\n`;
          
          const columnDefs = columnsResult.rows.map((col, idx) => {
            let def = `  ${col.column_name} ${col.data_type}`;
            if (col.character_maximum_length) {
              def += `(${col.character_maximum_length})`;
            }
            if (col.is_nullable === 'NO') {
              def += ' NOT NULL';
            }
            if (col.column_default) {
              def += ` DEFAULT ${col.column_default}`;
            }
            return def;
          });
          
          backup += columnDefs.join(',\n');
          backup += `\n);\n\n`;

          // Get table data
          const dataResult = await pool.query(`SELECT * FROM ${fullTableName}`);
          
          if (dataResult.rows.length > 0) {
            backup += `-- Data for ${fullTableName}\n`;
            
            for (const row of dataResult.rows) {
              const columns = Object.keys(row);
              const values = Object.values(row).map(val => {
                if (val === null) return 'NULL';
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                if (val instanceof Date) return `'${val.toISOString()}'`;
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                return val;
              });
              
              backup += `INSERT INTO ${fullTableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
            }
            
            backup += `\n`;
          }
        }
      }

      return {
        success: true,
        backup: backup
      };
    } catch (error) {
      console.error('Error generating backup:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DatabaseService;
