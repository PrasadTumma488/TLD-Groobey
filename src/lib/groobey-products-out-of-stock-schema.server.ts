import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isProductsOutOfStockSchemaError } from "@/lib/groobey-products-out-of-stock-schema";

const { Client } = pg;
const projectRef = "idhgenxhczbgddihdlid";

export async function productsOutOfStockColumnExists(): Promise<boolean> {
  const { error } = await supabaseAdmin.from("products").select("is_out_of_stock").limit(0);
  if (!error) return true;
  return !isProductsOutOfStockSchemaError(error.message);
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

function outOfStockMigrationSql(): string {
  const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const migrationPath = join(
    root,
    "supabase",
    "migrations",
    "20260616120000_products_out_of_stock.sql",
  );
  if (!existsSync(migrationPath)) {
    throw new Error("Missing products out_of_stock migration file.");
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

export async function applyProductsOutOfStockSchema(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const { error: rpcError } = await supabaseAdmin.rpc("ensure_products_out_of_stock_schema");
  if (!rpcError) {
    return { ok: true };
  }

  const rpcMissing = /function.*does not exist|Could not find the function/i.test(rpcError.message);
  if (!rpcMissing && !isProductsOutOfStockSchemaError(rpcError.message)) {
    return { ok: false, message: rpcError.message };
  }

  const password = readDbPassword();
  if (!password) {
    return {
      ok: false,
      message:
        "Database password is not configured on the server. Add SUPABASE_DB_PASSWORD in Vercel env vars, or run npm run db:push locally, or paste supabase/scripts/products_out_of_stock_quick.sql in Supabase SQL Editor.",
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
    const sql = outOfStockMigrationSql();
    await client.query(sql);
    await client.query(
      `
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (version) DO NOTHING
    `,
      [
        "20260616120000_products_out_of_stock",
        [sql],
        "20260616120000_products_out_of_stock.sql",
      ],
    );
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not apply products out_of_stock schema.";
    return { ok: false, message };
  } finally {
    await client?.end().catch(() => {});
  }
}
