const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "database.sqlite");
const backupDir = path.join(projectRoot, "backups");

if (!fs.existsSync(sourcePath)) {
  console.error("SQLite database file not found:", sourcePath);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `database-${timestamp}.sqlite`);

fs.copyFileSync(sourcePath, backupPath);

console.log(`Backup created: ${backupPath}`);
