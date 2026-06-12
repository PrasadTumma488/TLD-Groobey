#!/usr/bin/env node
/** Writes SUPABASE_DB_PASSWORD into the project root `.env`. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(projectRoot, ".env");
const projectRef = "idhgenxhczbgddihdlid";
const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/settings/database`;

const password = (process.argv[2] ?? "").trim().replace(/^["']|["']$/g, "");

if (!password) {
  console.error("\nMissing database password.\n");
  console.error("1. Open Supabase Database settings:");
  console.error(`   ${dashboardUrl}\n`);
  console.error("2. Copy or reset the database password.\n");
  console.error("3. Run:");
  console.error("   npm run env:db-password -- YOUR_DATABASE_PASSWORD\n");
  console.error("4. Then run:");
  console.error("   npm run db:push\n");
  process.exit(1);
}

if (!existsSync(envPath)) {
  console.error(`\nNo .env file at ${envPath}. Copy .env.example to .env first.\n`);
  process.exit(1);
}

let text = readFileSync(envPath, "utf8");
const line = `SUPABASE_DB_PASSWORD=${password}`;
if (/^SUPABASE_DB_PASSWORD=/m.test(text)) {
  text = text.replace(/^SUPABASE_DB_PASSWORD=.*$/m, line);
} else {
  text = `${text.replace(/\s*$/, "")}\n${line}\n`;
}
writeFileSync(envPath, text, "utf8");
console.log("\nUpdated SUPABASE_DB_PASSWORD in .env");
console.log("Run: npm run db:push\n");
