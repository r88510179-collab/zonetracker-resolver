const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function resolveDbPath() {
  if (process.env.RESOLVER_DB_PATH) return process.env.RESOLVER_DB_PATH;
  return process.env.NODE_ENV === 'production'
    ? '/data/resolver.db'
    : './data/resolver.db';
}

function openDb(dbPath) {
  const resolved = dbPath || resolveDbPath();
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  return db;
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
}

function listMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      version: f.replace(/\.sql$/, ''),
      filepath: path.join(migrationsDir, f),
    }));
}

function runMigrations(db, migrationsDir) {
  ensureMigrationsTable(db);

  const isApplied = db.prepare(
    'SELECT 1 FROM schema_migrations WHERE version = ?'
  );
  const insertApplied = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)'
  );

  const migrations = listMigrations(migrationsDir);
  for (const { version, filepath } of migrations) {
    if (isApplied.get(version)) {
      console.log(`[migrate] skipping ${version} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(filepath, 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      insertApplied.run(version, Date.now());
    });
    try {
      apply();
      console.log(`[migrate] applied ${version}`);
    } catch (err) {
      throw new Error(`[migrate] failed to apply ${version}: ${err.message}`);
    }
  }
}

module.exports = { openDb, runMigrations, resolveDbPath };
