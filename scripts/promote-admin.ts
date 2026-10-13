/**
 * Promote a phone number to admin (or create the user first).
 * Admin web UI is a backlog item — this CLI is the v1 way to grant the role.
 *
 * Local:      npm run db:promote-admin -- +6281234567890
 * Production: MIGRATE_ALLOW_REMOTE=1 TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:promote-admin -- +6281234567890
 */
import { normalizePhone } from "../src/lib/phone";
import { createSqliteClient, databaseTarget } from "../src/lib/db";

const raw = process.argv[2];
const phone = raw ? normalizePhone(raw) : null;

if (!phone) {
  console.error("Usage: npm run db:promote-admin -- <phone>  (e.g. +6281234567890 or 0812-3456-7890)");
  process.exit(1);
}

async function main() {
  console.log(`Promoting ${phone} on ${databaseTarget()}`);
  const client = await createSqliteClient();

  const existing = (
    await client.execute({ sql: "SELECT id, role FROM users WHERE phone = ?", args: [phone!] })
  ).rows[0];

  if (existing) {
    await client.execute({
      sql: "UPDATE users SET role = 'admin', updated_at = datetime('now') WHERE id = ?",
      args: [Number(existing.id)],
    });
    console.log(`✓ ${phone} promoted to admin (user #${Number(existing.id)})`);
  } else {
    const result = await client.execute({
      sql: "INSERT INTO users (phone, role) VALUES (?, 'admin')",
      args: [phone!],
    });
    console.log(`✓ ${phone} created and promoted to admin (user #${Number(result.lastInsertRowid)})`);
  }

  client.close();
}

main().catch((error) => {
  console.error(`Failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
