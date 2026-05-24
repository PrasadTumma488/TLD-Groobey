/** Public Supabase config - build-time (VITE_*), SSR (process.env), and runtime (inline script / meta). */

declare global {
  interface Window {
    __GROOBEY_PUBLIC_ENV__?: {
      supabaseUrl?: string;
      supabasePublishableKey?: string;
    };
  }
}

const URL_KEYS = [
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

const PUBLISHABLE_KEY_KEYS = [
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const PROJECT_ID_KEYS = ["VITE_SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_ID"] as const;

function pickFirst(
  record: Record<string, string | undefined>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = record[key]?.trim();
    if (value) return value;
  }
  return "";
}

/** Resolve public Supabase URL + anon/publishable key from any supported env names. */
export function resolvePublicSupabaseEnv(
  record: Record<string, string | undefined>,
): { url: string; publishableKey: string } {
  const projectId = pickFirst(record, PROJECT_ID_KEYS);

  let url = pickFirst(record, URL_KEYS);
  if (!url && projectId) {
    url = `https://${projectId}.supabase.co`;
  }

  const publishableKey = pickFirst(record, PUBLISHABLE_KEY_KEYS);

  return { url, publishableKey };
}

function readProcessEnv(name: string): string {
  if (typeof process === "undefined") return "";
  const raw = Reflect.get(process.env, name);
  return typeof raw === "string" ? raw.trim() : "";
}

function processEnvRecord(): Record<string, string | undefined> {
  if (typeof process === "undefined") return {};
  const out: Record<string, string | undefined> = {};
  for (const key of [
    ...URL_KEYS,
    ...PUBLISHABLE_KEY_KEYS,
    ...PROJECT_ID_KEYS,
  ]) {
    const value = readProcessEnv(key);
    if (value) out[key] = value;
  }
  return out;
}

function readMetaTag(name: string): string {
  if (typeof document === "undefined") return "";
  const el = document.querySelector(`meta[name="${name}"]`);
  return el?.getAttribute("content")?.trim() || "";
}

export function getPublicSupabaseConfig(): { url: string; publishableKey: string } {
  const fromWindow =
    typeof window !== "undefined" ? window.__GROOBEY_PUBLIC_ENV__ : undefined;

  const fromMeta = {
    VITE_SUPABASE_URL: readMetaTag("groobey-supabase-url"),
    VITE_SUPABASE_PUBLISHABLE_KEY: readMetaTag("groobey-supabase-publishable-key"),
  };

  const fromImportMeta: Record<string, string | undefined> = {
    VITE_SUPABASE_URL: String(import.meta.env.VITE_SUPABASE_URL ?? "").trim() || undefined,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim() || undefined,
    VITE_SUPABASE_PROJECT_ID:
      String(import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "").trim() || undefined,
  };

  const merged: Record<string, string | undefined> = {
    ...processEnvRecord(),
    ...fromImportMeta,
    ...fromMeta,
  };

  if (fromWindow?.supabaseUrl?.trim()) {
    merged.VITE_SUPABASE_URL = fromWindow.supabaseUrl.trim();
  }
  if (fromWindow?.supabasePublishableKey?.trim()) {
    merged.VITE_SUPABASE_PUBLISHABLE_KEY = fromWindow.supabasePublishableKey.trim();
  }

  return resolvePublicSupabaseEnv(merged);
}

export function buildPublicEnvInlineScript(): string {
  const { url, publishableKey } = resolvePublicSupabaseEnv(processEnvRecord());
  const payload = {
    supabaseUrl: url,
    supabasePublishableKey: publishableKey,
  };
  return `window.__GROOBEY_PUBLIC_ENV__=${JSON.stringify(payload)};`;
}

export function publicSupabaseMetaTags(): { url: string; publishableKey: string } {
  return resolvePublicSupabaseEnv(processEnvRecord());
}

export function missingPublicSupabaseConfigMessage(): string {
  const record = processEnvRecord();
  const hasUrlName = URL_KEYS.some((k) => k in (process.env ?? {}) || record[k] !== undefined);
  const hasKeyName = PUBLISHABLE_KEY_KEYS.some(
    (k) => k in (process.env ?? {}) || record[k] !== undefined,
  );
  const { url, publishableKey } = getPublicSupabaseConfig();

  if ((hasUrlName || hasKeyName) && (!url || !publishableKey)) {
    return (
      "Supabase environment variables are set but empty. In Vercel → Settings → Environment Variables, " +
      "paste your project URL and publishable (anon) key from Supabase → Project Settings → API, " +
      "then redeploy. Locally, fill VITE_SUPABASE_PUBLISHABLE_KEY in .env and restart npm run dev."
    );
  }

  return (
    "Missing Supabase configuration. In Vercel → Settings → Environment Variables, set " +
    "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY). " +
    "You can also set VITE_SUPABASE_PROJECT_ID=your-project-ref. Then redeploy."
  );
}
