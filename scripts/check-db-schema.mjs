#!/usr/bin/env node
/** Probe remote Supabase schema via service role (no DB password needed). */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env");

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
const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function columnExists(table, column) {
  const { error } = await admin.from(table).select(column).limit(1);
  if (!error) return true;
  const msg = error.message || "";
  if (/column.*does not exist|Could not find the .* column/i.test(msg)) return false;
  console.warn(`[check] ${table}.${column}: ${msg}`);
  return false;
}

async function rpcExists(name, args = {}) {
  const { error } = await admin.rpc(name, args);
  const msg = error?.message || "";
  if (!error) return true;
  if (/Could not find the function|function .* does not exist/i.test(msg)) return false;
  return true;
}

async function tableExists(table) {
  const { error } = await admin.from(table).select("*").limit(0);
  const msg = error?.message || "";
  if (/relation .* does not exist|Could not find the table/i.test(msg)) return false;
  return !error || !/does not exist/i.test(msg);
}

const checks = {
  "profiles.default_address": () => columnExists("profiles", "default_address"),
  "profiles.shop_slug": () => columnExists("profiles", "shop_slug"),
  staff_email_assignments: () => tableExists("staff_email_assignments"),
  "customer_orders.bill_number": () => columnExists("customer_orders", "bill_number"),
  "customer_orders.assigned_delivery_user_id": () =>
    columnExists("customer_orders", "assigned_delivery_user_id"),
  "customer_orders.delivery_charge": () => columnExists("customer_orders", "delivery_charge"),
  register_customer_self: () =>
    rpcExists("register_customer_self", {
      p_display_name: "x",
      p_email: "x@test.com",
      p_phone: "",
      p_default_address: "",
    }),
  purge_my_old_customer_orders: () => rpcExists("purge_my_old_customer_orders", { p_days: 15 }),
  shop_combos: () => tableExists("shop_combos"),
  "products.is_out_of_stock": () => columnExists("products", "is_out_of_stock"),
  ensure_products_out_of_stock_schema: () => rpcExists("ensure_products_out_of_stock_schema"),
  next_groobey_customer_order_bill_number: () => rpcExists("next_groobey_customer_order_bill_number"),
  mark_assigned_order_status: () =>
    rpcExists("mark_assigned_order_status", {
      p_order_id: "00000000-0000-0000-0000-000000000000",
      p_status: "delivered",
    }),
  archive_customer_order: () =>
    rpcExists("archive_customer_order", {
      p_order_id: "00000000-0000-0000-0000-000000000000",
    }),
};

const results = {};
for (const [label, fn] of Object.entries(checks)) {
  results[label] = await fn();
}

console.log(JSON.stringify(results, null, 2));
const missing = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
if (missing.length) {
  console.error("\nMissing on remote:", missing.join(", "));
  console.error("Run: npm run env:db-password -- YOUR_DATABASE_PASSWORD");
  console.error("Then: npm run db:push");
  process.exit(2);
}
console.log("\nRemote schema looks up to date for customer, delivery, and admin workflows.");
