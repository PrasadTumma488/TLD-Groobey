#!/usr/bin/env node
/**
 * Apply customer TLD User ID functions + backfill (RPC assign_customer_tld_user_id).
 * Usage: npm run db:apply-tld-user-ids
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env");
const projectRef = "idhgenxhczbgddihdlid";
const migrationFile = "20260617120000_customer_tld_user_ids.sql";

function readEnv(key) {
  if (!existsSync(envPath)) return "";
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    if (t.slice(0, i).trim() === key) return t.slice(i + 1).trim();
  }
  return "";
}

const url = readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const dbPassword = readEnv("SUPABASE_DB_PASSWORD");

async function rpcReady(admin) {
  const { error } = await admin.rpc("assign_customer_tld_user_id", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
  });
  const msg = error?.message || "";
  if (/Could not find the function|function .* does not exist/i.test(msg)) return false;
  return true;
}

async function applyViaPg() {
  if (!dbPassword) return false;
  const enc = encodeURIComponent(dbPassword);
  const urls = [
    `postgresql://postgres.${projectRef}:${enc}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
  ];
  const sql = readFileSync(join(root, "supabase", "migrations", migrationFile), "utf8");
  const version = migrationFile.replace(/\.sql$/i, "");
  let lastErr;
  for (const connectionString of urls) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
      await client.query(`
        CREATE SCHEMA IF NOT EXISTS supabase_migrations;
        CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
          version text PRIMARY KEY,
          statements text[],
          name text
        );
      `);
      await client.query(
        `INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING`,
        [version, [sql], migrationFile],
      );
      await client.end();
      return true;
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => {});
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Postgres apply failed");
}

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

if (await rpcReady(admin)) {
  console.log("\n✓ assign_customer_tld_user_id already exists.\n");
  process.exit(0);
}

try {
  await applyViaPg();
} catch (e) {
  console.error("\nPostgres apply failed:", e instanceof Error ? e.message : e);
  console.error(`
Paste supabase/migrations/${migrationFile} in Supabase SQL Editor:
https://supabase.com/dashboard/project/${projectRef}/sql/new
`);
  process.exit(1);
}

if (!(await rpcReady(admin))) {
  console.error("\nMigration ran but assign_customer_tld_user_id is still missing.\n");
  process.exit(1);
}

console.log("\n✓ Customer TLD User IDs applied (functions + backfill).\n");
