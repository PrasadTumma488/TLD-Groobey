#!/usr/bin/env node
/**
 * Apply products.is_out_of_stock column (RPC first, then direct Postgres).
 * Usage: npm run db:apply-out-of-stock
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env");
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

const url = readEnv("SUPABASE_URL") || readEnv("VITE_SUPABASE_URL");
const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
const dbPassword = readEnv("SUPABASE_DB_PASSWORD");

async function columnExists(admin) {
  const { error } = await admin.from("products").select("is_out_of_stock").limit(0);
  return !error;
}

async function tryRpc(admin) {
  const { error } = await admin.rpc("ensure_products_out_of_stock_schema");
  if (!error) return true;
  if (/function.*does not exist|Could not find the function/i.test(error.message)) return false;
  throw new Error(error.message);
}

async function tryPg() {
  if (!dbPassword) return false;
  const enc = encodeURIComponent(dbPassword);
  const urls = [
    `postgresql://postgres.${projectRef}:${enc}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`,
  ];
  const sql = readFileSync(
    join(root, "supabase", "migrations", "20260616120000_products_out_of_stock.sql"),
    "utf8",
  );
  let lastErr;
  for (const connectionString of urls) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
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

if (await columnExists(admin)) {
  console.log("\n✓ products.is_out_of_stock already exists.\n");
  process.exit(0);
}

try {
  const rpcOk = await tryRpc(admin);
  if (rpcOk || (await columnExists(admin))) {
    console.log("\n✓ Applied via ensure_products_out_of_stock_schema RPC.\n");
    process.exit(0);
  }
} catch (e) {
  console.warn("RPC apply failed:", e instanceof Error ? e.message : e);
}

try {
  const pgOk = await tryPg();
  if (pgOk && (await columnExists(admin))) {
    console.log("\n✓ Applied via Postgres migration SQL.\n");
    process.exit(0);
  }
} catch (e) {
  console.error("\nPostgres apply failed:", e instanceof Error ? e.message : e);
}

console.error(`
Could not add products.is_out_of_stock automatically.

Option 1 — Supabase SQL Editor (fastest):
  Open https://supabase.com/dashboard/project/${projectRef}/sql/new
  Paste contents of: supabase/scripts/products_out_of_stock_quick.sql
  Run

Option 2 — Local db password:
  npm run env:db-password -- YOUR_DATABASE_PASSWORD
  npm run db:push
`);
process.exit(1);
