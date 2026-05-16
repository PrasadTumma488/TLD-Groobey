// Server-side Supabase client with service role key — bypasses RLS.
// Use only in trusted server code. Env is read at runtime (Reflect) so Vite does not bake keys into the bundle.
import { createClient } from "@supabase/supabase-js";
import {
  assertServiceRoleKeyIsNotPublishable,
  getServiceRoleKeyFromEnv,
} from "@/lib/supabase-service-role-env";
import type { Database } from "./types";

function createSupabaseAdminClient() {
  const urlRaw = Reflect.get(process.env, "SUPABASE_URL");
  const viteUrl = Reflect.get(process.env, "VITE_SUPABASE_URL");
  const SUPABASE_URL =
    (typeof urlRaw === "string" ? urlRaw.trim() : "") ||
    (typeof viteUrl === "string" ? viteUrl.trim() : "");
  const SUPABASE_SERVICE_ROLE_KEY = getServiceRoleKeyFromEnv();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing: string[] = [];
    if (!SUPABASE_URL) missing.push("SUPABASE_URL (or VITE_SUPABASE_URL)");
    if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    throw new Error(
      `Missing Supabase server variables: ${missing.join(", ")}. ` +
        "In the project root .env, set a non-empty value on one line, e.g. SUPABASE_SERVICE_ROLE_KEY=eyJ... (no quotes unless needed). " +
        "An empty line after = is treated as missing. Paste the service_role secret from Supabase Dashboard → Project Settings → API, then restart the dev server. " +
        "For Cloudflare dev, ensure the same keys exist in dist/server/.dev.vars if your build copies .env there.",
    );
  }

  assertServiceRoleKeyIsNotPublishable(SUPABASE_SERVICE_ROLE_KEY);

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
