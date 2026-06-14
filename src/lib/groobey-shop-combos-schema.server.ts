import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isShopCombosSchemaError } from "@/lib/groobey-shop-combos-schema";

const { Client } = pg;
const projectRef = "idhgenxhczbgddihdlid";

export async function shopCombosTableExists(): Promise<boolean> {
  const { error } = await supabaseAdmin.from("shop_combos").select("id").limit(0);
  if (!error) return true;
  return !isShopCombosSchemaError(error.message);
}

function readDbPassword(): string {
  return (
    process.env.SUPABASE_DB_PASSWORD?.trim() ||
    process.env.POSTGRES_PASSWORD?.trim() ||
    process.env.DATABASE_PASSWORD?.trim() ||
    ""
  );
}

function connectionUrls(password: string): string[] {
  const enc = encodeURIComponent(password);
  return [
    `postgresql://postgres.${projectRef}:${enc}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`,
  ];
}

function shopCombosMigrationSql(): string {
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const migrationPath = join(root, "supabase", "migrations", "20260608160000_shop_combos.sql");
  if (!existsSync(migrationPath)) {
    throw new Error("Missing shop_combos migration file.");
  }
  return readFileSync(migrationPath, "utf8");
}

async function connectPg(password: string) {
  let lastErr: unknown;
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
  throw lastErr instanceof Error ? lastErr : new Error("Could not connect to Supabase Postgres.");
}

export async function applyShopCombosSchema(): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: rpcError } = await supabaseAdmin.rpc("ensure_shop_combos_schema");
  if (!rpcError) {
    return { ok: true };
  }

  const rpcMissing = /function.*does not exist|Could not find the function/i.test(rpcError.message);
  if (!rpcMissing) {
    return { ok: false, message: rpcError.message };
  }

  const password = readDbPassword();
  if (!password) {
    return {
      ok: false,
      message:
        "Database password is not configured on the server. Run npm run env:db-password -- YOUR_PASSWORD then npm run db:push, or paste the migration SQL in Supabase SQL Editor.",
    };
  }

  let client: pg.Client | undefined;
  try {
    client = await connectPg(password);
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text PRIMARY KEY,
        statements text[],
        name text
      );
    `);
    await client.query(shopCombosMigrationSql());
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (version) DO NOTHING
    `, ["20260608160000_shop_combos", [shopCombosMigrationSql()], "20260608160000_shop_combos.sql"]);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not apply shop_combos schema.";
    return { ok: false, message };
  } finally {
    await client?.end().catch(() => {});
  }
}
