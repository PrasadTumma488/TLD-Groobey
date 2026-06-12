#!/usr/bin/env node
/**
 * Apply Supabase migrations via direct Postgres (bypasses Supabase CLI org access).
 * Requires SUPABASE_DB_PASSWORD in .env (Dashboard → Project Settings → Database).
 *
 * Usage: npm run db:push
 * Setup:  npm run env:db-password -- YOUR_DATABASE_PASSWORD
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env");
const migrationsDir = join(root, "supabase", "migrations");
const projectRef = "idhgenxhczbgddihdlid";
const dashboardDbUrl = `https://supabase.com/dashboard/project/${projectRef}/settings/database`;

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

function migrationVersion(filename) {
  return filename.replace(/\.sql$/i, "");
}

function connectionUrls(password) {
  const enc = encodeURIComponent(password);
  return [
    `postgresql://postgres.${projectRef}:${enc}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`,
  ];
}

async function connectClient(password) {
  let lastErr;
  for (const connectionString of connectionUrls(password)) {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      return client;
    } catch (e) {
      lastErr = e;
      await client.end().catch(() => {});
    }
  }
  throw lastErr;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    );
  `);
}

async function appliedVersions(client) {
  const { rows } = await client.query(
    "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version",
  );
  return new Set(rows.map((r) => r.version));
}

const password = readEnv("SUPABASE_DB_PASSWORD");
if (!password) {
  console.error("\nMissing SUPABASE_DB_PASSWORD in .env\n");
  console.error("1. Open Supabase → Database settings:");
  console.error(`   ${dashboardDbUrl}\n`);
  console.error("2. Copy the database password (reset if needed).");
  console.error("3. Run:");
  console.error("   npm run env:db-password -- YOUR_DATABASE_PASSWORD\n");
  console.error("4. Then run:");
  console.error("   npm run db:push\n");
  console.error(
    "Tip: if schema is already applied via SQL Editor, run npm run db:check instead.\n",
  );
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let client;
try {
  client = await connectClient(password);
  console.log(`Connected to Supabase Postgres (${projectRef}).`);
  await ensureMigrationTable(client);
  const done = await appliedVersions(client);

  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    const version = migrationVersion(file);
    if (done.has(version)) {
      skipped += 1;
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`Applying ${file}...`);
    await client.query(sql);
    await client.query(
      "INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2, $3)",
      [version, [sql], file],
    );
    applied += 1;
  }

  console.log(`\nDone. Applied ${applied}, skipped ${skipped} (already recorded).`);
  if (applied === 0) {
    console.log("Database migration history is up to date.");
  }
} catch (e) {
  console.error("\nDatabase push failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await client?.end().catch(() => {});
}
