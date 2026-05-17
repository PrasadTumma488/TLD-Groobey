import { defineEventHandler } from "h3";

import { resolvePublicSupabaseEnv } from "@/lib/groobey-public-env";

/** Runtime public config for the browser when build-time VITE_* vars were empty. */
export default defineEventHandler(() => {
  const record: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && value.trim()) record[key] = value.trim();
  }
  const { url, publishableKey } = resolvePublicSupabaseEnv(record);
  return {
    supabaseUrl: url,
    supabasePublishableKey: publishableKey,
  };
});
