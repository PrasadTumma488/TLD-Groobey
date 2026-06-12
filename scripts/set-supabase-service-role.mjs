#!/usr/bin/env node
/**
 * Writes SUPABASE_SERVICE_ROLE_KEY into the project root `.env`.
 * Usage: node scripts/set-supabase-service-role.mjs sb_secret_...  OR  eyJ...
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(projectRoot, ".env");
const projectRef = "idhgenxhczbgddihdlid";
const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/settings/api`;

const key = (process.argv[2] ?? "").trim().replace(/^["']|["']$/g, "");

if (!key) {
  console.error("\nMissing service role key.\n");
  console.error("1. Open Supabase API settings:");
  console.error(`   ${dashboardUrl}\n`);
  console.error('2. Copy the secret "service_role" key (sb_secret_… or legacy JWT).');
  console.error("   Do NOT use the publishable / anon key (sb_publishable_…).\n");
  console.error("3. Run:");
  console.error("   npm run env:service-role -- YOUR_KEY_HERE\n");
  console.error("4. Restart: npm run dev\n");
  console.error("For Vercel production, also add SUPABASE_SERVICE_ROLE_KEY in");
  console.error("Project → Settings → Environment Variables, then redeploy.\n");
  process.exit(1);
}

if (/^sb_publishable_/i.test(key)) {
  console.error(
    "\nThat looks like the publishable (anon) key. Use the secret service_role key instead.\n",
  );
  process.exit(1);
}

if (!existsSync(envPath)) {
  console.error(`\nNo .env file at ${envPath}. Copy .env.example to .env first.\n`);
  process.exit(1);
}

const text = readFileSync(envPath, "utf8").replace(/^\uFEFF/u, "");
const lineRe = /^(\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*).*(?:\r?\n|$)/m;

const next =
  lineRe.test(text) ?
    text.replace(lineRe, `$1${key}\n`)
  : `${text.replace(/\s*$/, "")}\nSUPABASE_SERVICE_ROLE_KEY=${key}\n`;

writeFileSync(envPath, next, "utf8");
console.log("\n✓ Updated SUPABASE_SERVICE_ROLE_KEY in .env");
console.log("  Restart the dev server: npm run dev\n");
