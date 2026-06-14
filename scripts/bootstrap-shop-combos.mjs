#!/usr/bin/env node
/** Apply shop_combos migration only. Requires SUPABASE_DB_PASSWORD in .env */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env");
const migrationPath = join(root, "supabase", "migrations", "20260608160000_shop_combos.sql");
const projectRef = "idhgenxhczbgddihdlid";

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

const password = readEnv("SUPABASE_DB_PASSWORD");
if (!password) {
  console.error("Missing SUPABASE_DB_PASSWORD. Run: npm run env:db-password -- YOUR_PASSWORD");
  process.exit(1);
}

const enc = encodeURIComponent(password);
const urls = [
  `postgresql://postgres.${projectRef}:${enc}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`,
];

const sql = readFileSync(migrationPath, "utf8");
let client;
let lastErr;
for (const connectionString of urls) {
  client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    break;
  } catch (e) {
    lastErr = e;
    await client.end().catch(() => {});
    client = undefined;
  }
}

if (!client) {
  console.error("Connect failed:", lastErr instanceof Error ? lastErr.message : lastErr);
  process.exit(1);
}

try {
  console.log("Applying shop_combos migration…");
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    );
  `);
  await client.query(sql);
  await client.query(
    `INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
     VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING`,
    ["20260608160000_shop_combos", [sql], "20260608160000_shop_combos.sql"],
  );
  console.log("shop_combos ready.");
} catch (e) {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
