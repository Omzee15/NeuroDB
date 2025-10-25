class DBMLParser {
  parse(dbmlScript) {
    const tables = [];
    const relationships = [];
    
    // Simple DBML parser
    const lines = dbmlScript.split('\n').map(line => line.trim());
    let currentTable = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comments and empty lines
      if (line.startsWith('//') || line === '') continue;
      
      // Parse table definition
      if (line.startsWith('Table ')) {
        const tableName = line.match(/Table\s+(\w+)/)?.[1];
        if (tableName) {
          currentTable = {
            name: tableName,
            columns: []
          };
          tables.push(currentTable);
        }
      }
      
      // Parse column definition
      if (currentTable && line.includes(' ') && !line.startsWith('Table') && !line.startsWith('}')) {
        const columnMatch = line.match(/(\w+)\s+([\w()]+)(\s+\[(.*?)\])?/);
        if (columnMatch) {
          const [, name, type, , attributes] = columnMatch;
          const column = {
            name,
            type,
            isPrimaryKey: attributes?.includes('primary key') || attributes?.includes('pk'),
            isForeignKey: false,
            isUnique: attributes?.includes('unique'),
            isNotNull: attributes?.includes('not null')
          };
          
          // Parse inline relationship (ref: > other_table.column)
          const refMatch = attributes?.match(/ref:\s*([><])\s*(\w+)\.(\w+)/);
          if (refMatch) {
            const [, direction, refTable, refColumn] = refMatch;
            column.isForeignKey = true;
            relationships.push({
              from: { table: currentTable.name, column: name },
              to: { table: refTable, column: refColumn },
              type: direction === '>' ? 'many-to-one' : 'one-to-many'
            });
          }
          
          currentTable.columns.push(column);
        }
      }
      
      // Close table
      if (line === '}') {
        currentTable = null;
      }
      
      // Parse standalone relationships
      const standaloneRef = line.match(/Ref:\s*(\w+)\.(\w+)\s*([><-]+)\s*(\w+)\.(\w+)/);
      if (standaloneRef) {
        const [, fromTable, fromColumn, relation, toTable, toColumn] = standaloneRef;
        relationships.push({
          from: { table: fromTable, column: fromColumn },
          to: { table: toTable, column: toColumn },
          type: relation.includes('>') ? 'many-to-one' : relation.includes('<') ? 'one-to-many' : 'one-to-one'
        });
      }
    }
    
    return { tables, relationships };
  }
}

module.exports = DBMLParser;
