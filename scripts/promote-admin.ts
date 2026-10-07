/**
 * Promote a phone number to admin (or create the user first).
 * Admin web UI is a backlog item — this CLI is the v1 way to grant the role.
 *
 * Usage: npm run db:promote-admin -- +6281234567890
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { normalizePhone } from "../src/lib/phone";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "money.db");
const raw = process.argv[2];
const phone = raw ? normalizePhone(raw) : null;

if (!phone) {
  console.error("Usage: npm run db:promote-admin -- <phone>  (e.g. +6281234567890 or 0812-3456-7890)");
  process.exit(1);
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const existing = db.prepare("SELECT id, role FROM users WHERE phone = ?").get(phone) as
  | { id: number; role: string }
  | undefined;

if (existing) {
  db.prepare("UPDATE users SET role = 'admin', updated_at = datetime('now') WHERE id = ?").run(existing.id);
  console.log(`✓ ${phone} promoted to admin (user #${existing.id})`);
} else {
  const info = db
    .prepare("INSERT INTO users (phone, role) VALUES (?, 'admin')")
    .run(phone);
  console.log(`✓ ${phone} created and promoted to admin (user #${info.lastInsertRowid})`);
}
db.close();
