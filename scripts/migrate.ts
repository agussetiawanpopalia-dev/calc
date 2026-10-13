/**
 * Flyway-style migration runner (libSQL / Turso).
 *
 * - Migrations live in db/migrations and are named V<version>__<description>.sql
 * - Each migration runs inside a transaction and is recorded in `_migrations`
 *   with a sha256 checksum; re-applying an already-applied version is a no-op,
 *   but editing an already-applied file is an error (flyway "validate" behaviour).
 * - Versions must be unique and are applied in ascending order.
 *
 * Local (default): applies to `file:./data/money.db` — `npm run db:migrate`.
 * Production (Turso): point TURSO_DATABASE_URL/TURSO_AUTH_TOKEN at the database
 * and set MIGRATE_ALLOW_REMOTE=1 — remote targets are skipped otherwise so a
 * stray build/CI step can never touch production by accident.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createSqliteClient, databaseTarget, isRemoteUrl } from "../src/lib/db";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

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

async function main() {
  const allowRemote = process.env.MIGRATE_ALLOW_REMOTE === "1";
  const target = databaseTarget();

  if (process.env.VERCEL && !allowRemote) {
    console.log(
      `Skipping migrations during the Vercel build. Run them against production explicitly with MIGRATE_ALLOW_REMOTE=1 (target: ${target}).`,
    );
    return;
  }
  if (isRemoteUrl && !allowRemote) {
    console.log(
      `Database target is remote (${target}). Set MIGRATE_ALLOW_REMOTE=1 to apply migrations to it.`,
    );
    return;
  }

  console.log(`Applying migrations to ${target}`);
  const client = await createSqliteClient();

  await client.executeMultiple(`
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

  let applied = 0;
  let skipped = 0;

  for (const migration of migrations) {
    const existing = (
      await client.execute({
        sql: "SELECT version, checksum FROM _migrations WHERE version = ?",
        args: [migration.version],
      })
    ).rows[0];

    if (existing) {
      if (String(existing.checksum) !== migration.checksum) {
        throw new Error(
          `Checksum mismatch for ${migration.file}: it was applied with a different content. ` +
            `Migrations are immutable — create a new V${migration.version + 1}__*.sql instead of editing history.`,
        );
      }
      skipped++;
      continue;
    }

    const started = Date.now();
    const tx = await client.transaction("write");
    try {
      await tx.executeMultiple(migration.sql);
      await tx.execute({
        sql: `INSERT INTO _migrations (version, description, script, checksum, execution_time_ms)
              VALUES (?, ?, ?, ?, ?)`,
        args: [migration.version, migration.description, migration.file, migration.checksum, Date.now() - started],
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback().catch(() => {});
      throw error;
    }
    applied++;
    console.log(`✓ Applied V${migration.version} (${migration.description}) — ${Date.now() - started}ms`);
  }

  console.log(
    applied === 0 && skipped > 0
      ? `Database is up to date (${skipped} migrations already applied).`
      : `Migrations complete: ${applied} applied, ${skipped} already up to date.`,
  );
  client.close();
}

main().catch((error) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
