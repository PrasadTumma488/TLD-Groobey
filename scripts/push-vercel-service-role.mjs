#!/usr/bin/env node
/**
 * Push SUPABASE_SERVICE_ROLE_KEY from local .env to Vercel (Production + Preview).
 * Usage: npm run env:vercel-service-role
 *
 * Requires: vercel CLI linked to the project (vercel link).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(projectRoot, ".env");
const projectRef = "idhgenxhczbgddihdlid";
const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/settings/api`;

function readKeyFromEnvFile() {
  if (!existsSync(envPath)) return "";
  const text = readFileSync(envPath, "utf8").replace(/^\uFEFF/u, "");
  for (const line of text.split(/\r?\n/u)) {
    const m = line.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)$/);
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

const key = (process.argv[2] ?? readKeyFromEnvFile()).trim().replace(/^["']|["']$/g, "");

if (!key) {
  console.error("\nNo service role key found.\n");
  console.error("Set it locally first:");
  console.error("  npm run env:service-role -- YOUR_KEY_HERE\n");
  console.error("Or pass the key as an argument:");
  console.error("  npm run env:vercel-service-role -- YOUR_KEY_HERE\n");
  console.error(`Get the key from: ${dashboardUrl}\n`);
  process.exit(1);
}

if (/^sb_publishable_/i.test(key)) {
  console.error("\nThat looks like the publishable (anon) key. Use service_role instead.\n");
  process.exit(1);
}

function pushEnv(target, extraArgs = []) {
  const result = spawnSync(
    "vercel",
    ["env", "add", "SUPABASE_SERVICE_ROLE_KEY", target, "--value", key, "--yes", ...extraArgs],
    { cwd: projectRoot, stdio: "inherit", shell: true },
  );
  if (result.status !== 0) {
    console.error(`\nFailed to set SUPABASE_SERVICE_ROLE_KEY for ${target}.`);
    console.error("Run: vercel link   then retry.\n");
    process.exit(result.status ?? 1);
  }
}

console.log("\nPushing SUPABASE_SERVICE_ROLE_KEY to Vercel (Production + Preview)…\n");
pushEnv("production");
pushEnv("preview");

console.log("\n✓ Vercel environment updated.");
console.log("  Redeploy for changes to take effect:");
console.log("    vercel --prod");
console.log("  or push to GitHub to trigger a production deploy.\n");
