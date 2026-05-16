/** Read at runtime so Vite `define` cannot bake the wrong key into the server bundle. */
export function getServiceRoleKeyFromEnv(): string {
  const v = Reflect.get(process.env, "SUPABASE_SERVICE_ROLE_KEY");
  return typeof v === "string" ? v.trim() : "";
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
