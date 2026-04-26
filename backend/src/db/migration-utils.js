async function listTables(queryInterface) {
  const tables = await queryInterface.showAllTables();

  return tables.map((table) => {
    if (Array.isArray(table)) {
      return table[1] || table[0];
    }

    if (table && typeof table === "object") {
      return table.tableName || table.name || Object.values(table)[0];
    }

    return table;
  });
}

async function hasTable(queryInterface, tableName) {
  const tables = await listTables(queryInterface);
  return tables.some((table) => String(table).toLowerCase() === tableName.toLowerCase());
}

async function ensureTable(queryInterface, tableName, definition) {
  if (!(await hasTable(queryInterface, tableName))) {
    await queryInterface.createTable(tableName, definition);
  }
}

async function ensureColumn(queryInterface, tableName, columnName, definition) {
  const columns = await queryInterface.describeTable(tableName);
  if (!columns[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function ensureIndex(queryInterface, tableName, columns, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  const targetName =
    options.name || `${tableName}_${columns.join("_")}${options.unique ? "_unique" : "_idx"}`;

  const normalizedColumns = columns.map((column) => column.toLowerCase());
  const exists = indexes.some((index) => {
    if (index.name === targetName) {
      return true;
    }

    const indexColumns = (index.fields || [])
      .map((field) => String(field.attribute || field.name || "").toLowerCase())
      .filter(Boolean);

    return (
      index.unique === !!options.unique &&
      indexColumns.length === normalizedColumns.length &&
      indexColumns.every((column, idx) => column === normalizedColumns[idx])
    );
  });

  if (!exists) {
    await queryInterface.addIndex(tableName, columns, {
      ...options,
      name: targetName,
    });
  }
}

module.exports = {
  ensureColumn,
  ensureIndex,
  ensureTable,
  hasTable,
};
