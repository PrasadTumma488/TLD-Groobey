#!/usr/bin/env node
/**
 * Verify required Vercel env vars exist before deploy.
 * Usage: npm run env:vercel-check
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const REQUIRED_PRODUCTION = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

const result = spawnSync("vercel", ["env", "ls"], {
  cwd: projectRoot,
  encoding: "utf8",
  shell: true,
});

if (result.status !== 0) {
  console.error("\nCould not list Vercel env vars. Run: vercel link\n");
  process.exit(result.status ?? 1);
}

const output = `${result.stdout}\n${result.stderr}`;
const namesInProduction = new Set();

for (const line of output.split(/\r?\n/u)) {
  const match = line.match(/^\s+(\S+)\s+.*\s+Production\s+/u);
  if (match) namesInProduction.add(match[1]);
}

const missing = REQUIRED_PRODUCTION.filter((name) => !namesInProduction.has(name));

if (missing.length) {
  console.error("\n✗ Missing Vercel Production environment variables:\n");
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  console.error("\nFix:");
  if (missing.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    console.error("  npm run env:service-role -- YOUR_KEY_HERE");
    console.error("  npm run env:vercel-service-role");
  }
  console.error("  Vercel → Project → Settings → Environment Variables");
  console.error("  Then redeploy.\n");
  process.exit(1);
}

console.log("\n✓ Required Vercel Production environment variables are set.\n");
