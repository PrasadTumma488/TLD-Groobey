#!/usr/bin/env node
/**
 * Push SUPABASE_DB_PASSWORD from local .env to Vercel (Production + Preview).
 * Usage: npm run env:vercel-db-password
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(projectRoot, ".env");
const projectRef = "idhgenxhczbgddihdlid";
const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/settings/database`;

function readPasswordFromEnvFile() {
  if (!existsSync(envPath)) return "";
  const text = readFileSync(envPath, "utf8").replace(/^\uFEFF/u, "");
  for (const line of text.split(/\r?\n/u)) {
    const m = line.match(/^\s*SUPABASE_DB_PASSWORD\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v.trim();
  }
  return "";
}

const password = (process.argv[2] ?? readPasswordFromEnvFile()).trim().replace(/^["']|["']$/g, "");

if (!password) {
  console.error("\nNo database password found.\n");
  console.error("Set it locally first:");
  console.error("  npm run env:db-password -- YOUR_DATABASE_PASSWORD\n");
  console.error("Or pass the password as an argument:");
  console.error("  npm run env:vercel-db-password -- YOUR_DATABASE_PASSWORD\n");
  console.error(`Get it from: ${dashboardUrl}\n`);
  process.exit(1);
}

function pushEnv(target) {
  const result = spawnSync(
    "vercel",
    ["env", "add", "SUPABASE_DB_PASSWORD", target, "--value", password, "--yes"],
    { cwd: projectRoot, stdio: "inherit", shell: true },
  );
  if (result.status !== 0) {
    console.error(`\nFailed to set SUPABASE_DB_PASSWORD for ${target}.`);
    console.error("Run: vercel link   then retry.\n");
    process.exit(result.status ?? 1);
  }
}

console.log("\nPushing SUPABASE_DB_PASSWORD to Vercel (Production + Preview)…\n");
pushEnv("production");
pushEnv("preview");

console.log("\n✓ Vercel environment updated.");
console.log("  Redeploy for changes to take effect:");
console.log("    vercel --prod\n");
