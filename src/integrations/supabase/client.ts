import { createClient } from "@supabase/supabase-js";
import {
  getPublicSupabaseConfig,
  hasPublicSupabaseConfig,
  missingPublicSupabaseConfigMessage,
} from "@/lib/groobey-public-env";

export { hasPublicSupabaseConfig };

/** Resolve config at runtime (bundled env or API). Not placed in HTML view-source. */
export async function ensurePublicSupabaseEnv(): Promise<boolean> {
  if (hasPublicSupabaseConfig()) return true;
  return hydratePublicSupabaseEnvFromApi();
}
import type { Database } from "./types";

function browserLocalStorage(): Storage | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Fetch runtime config from Nitro when build-time / inline env was empty (e.g. blank Vercel vars). */
export async function hydratePublicSupabaseEnvFromApi(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const current = getPublicSupabaseConfig();
  if (current.url && current.publishableKey) return true;
  try {
    const res = await fetch("/api/groobey-public-env", { credentials: "same-origin" });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      supabaseUrl?: string;
      supabasePublishableKey?: string;
    };
    if (!data.supabaseUrl?.trim() || !data.supabasePublishableKey?.trim()) return false;
    window.__GROOBEY_PUBLIC_ENV__ = {
      supabaseUrl: data.supabaseUrl.trim(),
      supabasePublishableKey: data.supabasePublishableKey.trim(),
    };
    return true;
  } catch {
    return false;
  }
}

function createSupabaseClient() {
  const { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY } =
    getPublicSupabaseConfig();

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(missingPublicSupabaseConfigMessage());
  }

  const storage = browserLocalStorage();
  const canPersist = Boolean(storage);

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage,
      persistSession: canPersist,
      autoRefreshToken: canPersist,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;
let _clientHadPersist: boolean | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    const canPersist = Boolean(browserLocalStorage());
    // If the singleton was first created during SSR without storage, rebuild once localStorage exists.
    if (_supabase && canPersist && _clientHadPersist === false) {
      _supabase = undefined;
    }
    if (!_supabase) {
      _supabase = createSupabaseClient();
      _clientHadPersist = canPersist;
    }
    return Reflect.get(_supabase, prop, receiver);
  },
});
