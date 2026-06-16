import { defineEventHandler, setResponseHeader } from "h3";

import { resolvePublicSupabaseEnv } from "@/lib/groobey-public-env";

/** Runtime public config for the browser (not embedded in HTML). Publishable key is client-safe with RLS. */
export default defineEventHandler((event) => {
  setResponseHeader(event, "Cache-Control", "private, no-store");
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
