import { readKeyFromEnvFiles } from "@/lib/platform-admin-bootstrap.server";

/** Read at runtime so Vite `define` cannot bake the wrong key into the server bundle. */
export function getServiceRoleKeyFromEnv(): string {
  const fromProcess = Reflect.get(process.env, "SUPABASE_SERVICE_ROLE_KEY");
  const trimmed = typeof fromProcess === "string" ? fromProcess.trim() : "";
  if (trimmed) return trimmed;
  return readKeyFromEnvFiles("SUPABASE_SERVICE_ROLE_KEY");
}

/** Supabase project URL for server-side admin client (process.env, then `.env` on disk). */
export function getSupabaseUrlFromEnv(): string {
  const urlRaw = Reflect.get(process.env, "SUPABASE_URL");
  const viteUrl = Reflect.get(process.env, "VITE_SUPABASE_URL");
  const fromProcess =
    (typeof urlRaw === "string" ? urlRaw.trim() : "") ||
    (typeof viteUrl === "string" ? viteUrl.trim() : "");
  if (fromProcess) return fromProcess;
  return (
    readKeyFromEnvFiles("SUPABASE_URL") ||
    readKeyFromEnvFiles("VITE_SUPABASE_URL")
  );
}

/** New Supabase API keys: publishable must never be used as the service role client. */
export function isPublishableKeyUsedAsServiceRole(key: string): boolean {
  return /^sb_publishable_/i.test(key.trim());
}

export function assertServiceRoleKeyIsNotPublishable(key: string): void {
  if (!key) return;
  if (isPublishableKeyUsedAsServiceRole(key)) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is set to the publishable (anon) key (sb_publishable_…). " +
        "Open Supabase → Project Settings → API and paste the secret service_role key (sb_secret_… or legacy JWT labeled service_role), not the publishable key.",
    );
  }
}
