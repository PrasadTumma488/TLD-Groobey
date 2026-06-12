import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GROOBEY_LOGO_BILL_FILE,
  GROOBEY_LOGO_FILE,
  GROOBEY_WEB_LOGO_FILE,
} from "@/lib/groobey-brand";

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

function readPublicPng(fileName: string): Uint8Array | null {
  for (const root of candidateProjectRoots()) {
    const fp = join(root, "public", fileName);
    if (!existsSync(fp)) continue;
    try {
      return new Uint8Array(readFileSync(fp));
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Hi-res PNG for bills (email + PDF). Falls back to UI logo if missing. */
export function getGroobeyBillLogoPngBytes(): Uint8Array | null {
  return (
    readPublicPng(GROOBEY_LOGO_BILL_FILE) ??
    readPublicPng(GROOBEY_WEB_LOGO_FILE) ??
    readPublicPng(GROOBEY_LOGO_FILE)
  );
}

/** @deprecated Use getGroobeyBillLogoPngBytes for bills. */
export function getGroobeyLogoPngBytes(): Uint8Array | null {
  return getGroobeyBillLogoPngBytes();
}

/** Inline hi-res logo for bill HTML / email when remote URL is blocked. */
export function getGroobeyBillLogoDataUrl(): string | null {
  const bytes = getGroobeyBillLogoPngBytes();
  if (!bytes?.length) return null;
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

/** @deprecated Use getGroobeyBillLogoDataUrl for bills. */
export function getGroobeyLogoDataUrl(): string | null {
  return getGroobeyBillLogoDataUrl();
}
