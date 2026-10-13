/**
 * Database connection (libSQL / Turso).
 *
 * - Local dev & tests: a plain SQLite file (`file:./data/money.db`) through the
 *   native libSQL binding, so `npm run dev` needs zero configuration.
 * - Production (Vercel): a remote Turso database over HTTP (`libsql:`/`https:`),
 *   using the pure-web client so no native module is loaded in the serverless
 *   function.
 *
 * Picking the web vs. native implementation is a dynamic import, so the client
 * is created lazily and shared; callers `await getDb()`. The promise (not the
 * resolved db) is cached on `globalThis` so dev hot-reloads and warm
 * serverless invocations reuse one client.
 */
import path from "node:path";
import fs from "node:fs";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import type { Client } from "@libsql/client";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

/** An open transaction — Drizzle models it as a db-like object. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Helpers accept either the db or an active transaction. */
export type Exec = Db | Tx;

/** Remote libSQL/Turso URL, or a local `file:` SQLite path. */
export function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Local file: `DATABASE_PATH` may be absolute (tests/scripts) or a file name
  // under ./data. Keep the common case statically scoped so the bundler doesn't
  // trace the whole project; the absolute override is annotated to opt out.
  const dbFile = process.env.DATABASE_PATH ?? "money.db";
  const localPath = path.isAbsolute(dbFile)
    ? path.resolve(/* turbopackIgnore: true */ dbFile)
    : path.join(process.cwd(), "data", dbFile);
  return `file:${localPath}`;
}

export const isRemoteUrl = /^(libsql|https?|wss?):/i.test(databaseUrl());

/** Redacted target for logs (never print the auth token). */
export function databaseTarget(): string {
  const url = databaseUrl();
  if (!isRemoteUrl) return url;
  try {
    const parsed = new URL(url.replace(/^libsql:/i, "https:"));
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Create a raw libSQL client. Remote URLs use the web (HTTP-only) client;
 * local `file:` URLs use the native client. Used by both the app and the
 * migration/admin scripts.
 */
export async function createSqliteClient(): Promise<Client> {
  const url = databaseUrl();
  const remote = /^(libsql|https?|wss?):/i.test(url);

  if (remote) {
    const { createClient } = await import("@libsql/client/web");
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN });
  }

  const localPath = url.replace(/^file:/, "");
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url });
  // libSQL (like SQLite) defaults foreign_keys OFF per connection; the schema
  // relies on ON DELETE CASCADE, so enable it for the local file connection.
  await client.execute("PRAGMA foreign_keys = ON");
  return client;
}

const globalForDb = globalThis as unknown as { __moneyDb?: Promise<Db> };

async function connect(): Promise<Db> {
  return drizzle(await createSqliteClient(), { schema });
}

/** Lazily-created, shared database handle. */
export function getDb(): Promise<Db> {
  return (globalForDb.__moneyDb ??= connect());
}
