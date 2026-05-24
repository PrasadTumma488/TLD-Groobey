import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Orders still in the workflow (not finished). */
export function isOrderPipelineActive(status: OrderStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}

export function isOrderCompleted(status: OrderStatus): boolean {
  return status === "delivered" || status === "cancelled";
}

/** Calendar day (YYYY-MM-DD) when the order was last updated (delivery/cancel stamp). */
export function orderCompletedDayIso(order: {
  updated_at?: string | null;
  created_at?: string | null;
}): string {
  return (order.updated_at || order.created_at || "").slice(0, 10);
}

export function orderCompletedOnDay(
  order: { updated_at?: string | null; created_at?: string | null },
  dayIso: string,
): boolean {
  const day = dayIso.slice(0, 10);
  return Boolean(day) && orderCompletedDayIso(order) === day;
}

/** Completed (delivered/cancelled) orders whose status was set on this calendar day. */
export function ordersCompletedOnDay<
  T extends {
    status: OrderStatus;
    updated_at?: string | null;
    created_at?: string | null;
  },
>(orders: T[], dayIso: string): T[] {
  const day = dayIso.slice(0, 10);
  return orders.filter((o) => isOrderCompleted(o.status) && orderCompletedOnDay(o, day));
}

/** Delivered orders marked delivered on this calendar day. */
export function ordersDeliveredOnDay<
  T extends {
    status: OrderStatus;
    updated_at?: string | null;
    created_at?: string | null;
  },
>(orders: T[], dayIso: string): T[] {
  const day = dayIso.slice(0, 10);
  return orders.filter((o) => o.status === "delivered" && orderCompletedOnDay(o, day));
}

/** Ready for delivery handoff but no delivery boy assigned yet. */
export function orderNeedsDeliveryAssignment(order: {
  status: OrderStatus;
  assigned_delivery_user_id?: string | null;
}): boolean {
  if (order.status === "delivered" || order.status === "cancelled" || order.status === "pending") {
    return false;
  }
  return !order.assigned_delivery_user_id?.trim();
}

/** Active pipeline: pending through out for delivery (newest first, unassigned first). */
export function sortActivePipelineOrders<
  T extends {
    status: OrderStatus;
    assigned_delivery_user_id?: string | null;
    created_at?: string | null;
  },
>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    const aNeed = orderNeedsDeliveryAssignment(a) ? 0 : 1;
    const bNeed = orderNeedsDeliveryAssignment(b) ? 0 : 1;
    if (aNeed !== bNeed) return aNeed - bNeed;
    return (
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  });
}
