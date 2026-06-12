import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { slugifyDisplayName, withSlugSuffix } from "@/lib/groobey-member-url";

/** Assign a unique shop slug for `/my/:slug` (service role). */
export async function ensureProfileShopSlug(
  userId: string,
  displayName?: string | null,
  email?: string | null,
): Promise<string> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from("profiles")
    .select("shop_slug, display_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (existing?.shop_slug?.trim()) return existing.shop_slug.trim();

  const seed = displayName?.trim() || existing?.display_name?.trim() || email?.split("@")[0] || "account";
  const base = slugifyDisplayName(seed);

  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const slug = withSlugSuffix(base, attempt);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ shop_slug: slug } as never)
      .eq("user_id", userId)
      .is("shop_slug", null);
    if (!error) return slug;

    const { data: raced } = await supabaseAdmin
      .from("profiles")
      .select("shop_slug")
      .eq("user_id", userId)
      .maybeSingle();
    if (raced?.shop_slug?.trim()) return raced.shop_slug.trim();

    if (!/unique|duplicate/i.test(error.message)) {
      throw new Error(error.message);
    }
  }

  throw new Error("Could not assign a unique shop URL. Try again.");
}
