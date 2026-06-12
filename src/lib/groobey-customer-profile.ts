import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isValidCustomerMobile } from "@/lib/groobey-delivery-order-fields";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function isCustomerProfileComplete(
  profile: Profile | null,
  authEmail?: string | null,
): boolean {
  const name = profile?.display_name?.trim();
  const email = profile?.email?.trim() || authEmail?.trim();
  const phone = profile?.phone?.trim();
  const address = profile?.default_address?.trim();
  return Boolean(
    name && email?.includes("@") && isValidCustomerMobile(phone ?? "") && (address?.length ?? 0) >= 5,
  );
}

export function customerProfileSnapshot(profile: Profile | null, authEmail?: string | null) {
  return {
    name: profile?.display_name?.trim() || "",
    email: profile?.email?.trim() || authEmail?.trim() || "",
    phone: profile?.phone?.trim() || "",
    address: profile?.default_address?.trim() || "",
  };
}

/** Upserts profile + customer role (works when direct profile UPDATE is blocked by RLS). */
export async function saveCustomerProfile(
  supabase: SupabaseClient<Database>,
  fields: {
    displayName: string;
    email: string;
    phone: string;
    defaultAddress: string;
  },
) {
  const { error } = await supabase.rpc("register_customer_self", {
    p_display_name: fields.displayName.trim(),
    p_email: fields.email.trim().toLowerCase(),
    p_phone: fields.phone.trim(),
    p_default_address: fields.defaultAddress.trim(),
  });
  return { error };
}
