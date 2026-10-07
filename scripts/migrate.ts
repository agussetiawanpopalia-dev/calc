/**
 * Flyway-style migration runner.
 *
 * - Migrations live in db/migrations and are named V<version>__<description>.sql
 * - Each migration runs inside a transaction and is recorded in `_migrations`
 *   with a sha256 checksum; re-applying an already-applied version is a no-op,
 *   but editing an already-applied file is an error (flyway "validate" behaviour).
 * - Versions must be unique and are applied in ascending order.
 *
 * Usage: npm run db:migrate
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "money.db");

const FILE_RE = /^V(\d+)__([A-Za-z0-9_]+)\.sql$/;

type MigrationFile = { version: number; description: string; file: string; sql: string; checksum: string };

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function loadMigrations(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const migrations: MigrationFile[] = [];
  const seen = new Map<number, string>();

  for (const file of files) {
    const match = FILE_RE.exec(file);
    if (!match) {
      throw new Error(`Invalid migration filename "${file}". Expected V<version>__<description>.sql`);
    }
    const version = Number(match[1]);
    if (seen.has(version)) {
      throw new Error(`Duplicate migration version ${version}: ${seen.get(version)} and ${file}`);
    }
    seen.set(version, file);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    migrations.push({
      version,
      description: match[2].replace(/_/g, " "),
      file,
      sql,
      checksum: sha256(sql),
    });
  }
  return migrations.sort((a, b) => a.version - b.version);
}

function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version         INTEGER PRIMARY KEY,
      description     TEXT    NOT NULL,
      script          TEXT    NOT NULL UNIQUE,
      checksum        TEXT    NOT NULL,
      installed_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      execution_time_ms INTEGER NOT NULL
    );
  `);

  const migrations = loadMigrations();
  const appliedStmt = db.prepare("SELECT * FROM _migrations WHERE version = ?");

  let applied = 0;
  let skipped = 0;

  for (const migration of migrations) {
    const existing = appliedStmt.get(migration.version) as
      | { version: number; checksum: string; script: string }
      | undefined;

    if (existing) {
      if (existing.checksum !== migration.checksum) {
        throw new Error(
          `Checksum mismatch for ${migration.file}: it was applied with a different content. ` +
            `Migrations are immutable — create a new V${migration.version + 1}__*.sql instead of editing history.`,
        );
      }
      skipped++;
      continue;
    }

    const started = Date.now();
    const run = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare(
        `INSERT INTO _migrations (version, description, script, checksum, execution_time_ms)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(migration.version, migration.description, migration.file, migration.checksum, Date.now() - started);
    });
    run();
    applied++;
    console.log(`✓ Applied V${migration.version} (${migration.description}) — ${Date.now() - started}ms`);
  }

  console.log(
    applied === 0 && skipped > 0
      ? `Database is up to date (${skipped} migrations already applied).`
      : `Migrations complete: ${applied} applied, ${skipped} already up to date.`,
  );
  db.close();
}

try {
  main();
} catch (error) {
  console.error(`Migration failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
