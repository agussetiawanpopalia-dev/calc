import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "money.db");

function createDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

// Singleton across dev hot-reloads.
const globalForDb = globalThis as unknown as { __moneyDb?: ReturnType<typeof createDb> };
export const db: BetterSQLite3Database<typeof schema> = globalForDb.__moneyDb ?? (globalForDb.__moneyDb = createDb());
