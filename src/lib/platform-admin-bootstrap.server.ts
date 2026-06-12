import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Directories that may contain `.env` (cwd wrong under some runners; bundle lives under dist/). */
function candidateProjectRoots(): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    const n = join(p);
    if (!n || seen.has(n)) return;
    seen.add(n);
    roots.push(n);
  };
  try {
    push(process.cwd());
  } catch {
    /* ignore */
  }
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 16; i++) {
      push(dir);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* ignore */
  }
  return roots;
}

/**
 * Resolves platform-admin allowlist env at runtime (not only at Vite config time).
 */
/** Read a key from project-root `.env*` when `process.env` is empty (SSR / serverless). */
export function readKeyFromEnvFiles(key: string): string {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bases = [
    ".env.local",
    ".env.development.local",
    ".env.development",
    ".env.production.local",
    ".env.production",
    ".env",
    ".dev.vars",
    join("dist", "server", ".dev.vars"),
  ];
  for (const root of candidateProjectRoots()) {
    for (const base of bases) {
      const fp = join(root, base);
      if (!existsSync(fp)) continue;
      try {
        const text = readFileSync(fp, "utf8").replace(/^\uFEFF/u, "");
        for (const line of text.split(/\r?\n/u)) {
          const m = line.match(new RegExp(`^\\s*${esc}\\s*=\\s*(.*)$`));
          if (!m) continue;
          let v = m[1].trim();
          if (!/^["']/u.test(v)) {
            const hashIdx = v.indexOf("#");
            if (hashIdx >= 0) v = v.slice(0, hashIdx).trim();
          }
          if (
            (v.startsWith('"') && v.endsWith('"')) ||
            (v.startsWith("'") && v.endsWith("'"))
          ) {
            v = v.slice(1, -1);
          }
          v = v.trim();
          if (v) return v;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return "";
}

function envString(key: string): string {
  const v = Reflect.get(process.env, key);
  return typeof v === "string" ? v.trim() : "";
}

export function getPlatformAdminEmailsResolved(): string {
  const fromProc = envString("PLATFORM_ADMIN_EMAILS");
  if (fromProc) return fromProc;
  return readKeyFromEnvFiles("PLATFORM_ADMIN_EMAILS");
}

export function getPlatformAdminUserIdsResolved(): string {
  const fromProc = envString("PLATFORM_ADMIN_USER_IDS");
  if (fromProc) return fromProc;
  return readKeyFromEnvFiles("PLATFORM_ADMIN_USER_IDS");
}
