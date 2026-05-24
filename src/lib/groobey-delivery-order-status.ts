import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { markDeliveryOrderStatus } from "@/lib/tldGroobey.functions";

type OrderStatus = Database["public"]["Enums"]["order_status"];

function isRlsOrPolicyError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("row-level security") || lower.includes("policy");
}

function isMissingRpcError(message: string): boolean {
  return (
    message.includes("mark_assigned_order_status") &&
    (message.includes("does not exist") || message.includes("Could not find"))
  );
}

/** Advance an assigned customer order through the delivery status chain. */
export async function updateAssignedDeliveryOrderStatus(
  client: SupabaseClient<Database>,
  orderId: string,
  status: OrderStatus,
): Promise<{ error: string | null }> {
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  if (!token) return { error: "Not signed in." };

  const { error: rpcError } = await client.rpc("mark_assigned_order_status", {
    p_order_id: orderId,
    p_status: status,
  });

  if (!rpcError) return { error: null };

  const shouldUseServer =
    isMissingRpcError(rpcError.message) || isRlsOrPolicyError(rpcError.message);

  if (shouldUseServer) {
    try {
      await markDeliveryOrderStatus({
        data: { requesterToken: token, orderId, status },
      });
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unable to update order status." };
    }
  }

  return { error: rpcError.message };
}
