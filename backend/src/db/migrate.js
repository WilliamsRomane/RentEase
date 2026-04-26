const { DataTypes } = require("sequelize");
const { sequelize } = require("../models");
const { ensureTable } = require("./migration-utils");
const initialSchemaMigration = require("./migrations/202604250001-initial-schema");

const migrations = [initialSchemaMigration];
const MIGRATIONS_TABLE = "schema_migrations";

async function ensureMigrationsTable(queryInterface) {
  await ensureTable(queryInterface, MIGRATIONS_TABLE, {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    runAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });
}

async function getAppliedMigrationNames(queryInterface) {
  const [rows] = await sequelize.query(`SELECT name FROM ${MIGRATIONS_TABLE}`, {
    raw: true,
  });

  return new Set(rows.map((row) => row.name));
}

async function runMigrations() {
  const queryInterface = sequelize.getQueryInterface();
  await ensureMigrationsTable(queryInterface);

  const appliedMigrations = await getAppliedMigrationNames(queryInterface);

  for (const migration of migrations) {
    if (appliedMigrations.has(migration.name)) {
      continue;
    }

    await migration.up({ queryInterface, sequelize });
    await queryInterface.bulkInsert(MIGRATIONS_TABLE, [
      { name: migration.name, runAt: new Date() },
    ]);

    console.log(`[Migrations] applied ${migration.name}`);
  }
}

async function printMigrationStatus() {
  const queryInterface = sequelize.getQueryInterface();
  await ensureMigrationsTable(queryInterface);
  const appliedMigrations = await getAppliedMigrationNames(queryInterface);

  for (const migration of migrations) {
    const status = appliedMigrations.has(migration.name) ? "up" : "pending";
    console.log(`${status.padEnd(7)} ${migration.name}`);
  }
}

if (require.main === module) {
  const command = process.argv[2] || "up";

  sequelize
    .authenticate()
    .then(async () => {
      if (command === "status") {
        await printMigrationStatus();
      } else {
        await runMigrations();
      }
      await sequelize.close();
    })
    .catch(async (error) => {
      console.error("[Migrations] failed", error);
      try {
        await sequelize.close();
      } catch (_) {
        // ignore close errors after a failed startup path
      }
      process.exit(1);
    });
}

module.exports = {
  runMigrations,
  printMigrationStatus,
};
