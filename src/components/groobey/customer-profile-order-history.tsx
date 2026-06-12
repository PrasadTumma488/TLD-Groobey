import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ProfileOrderHistoryCard } from "@/components/groobey/groobey-shop-ui";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  backfillMyCustomerOrderBillIds,
  ordersMissingBillId,
} from "@/lib/groobey-bill-backfill";
import { customerOrderBillLabel } from "@/lib/groobey-customer-order-display";
import { printCustomerOrderBill } from "@/lib/groobey-dual-bill";
import { CUSTOMER_ORDER_HISTORY_DAYS } from "@/lib/groobey-guest-shop-cart";

type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];

function historySinceIso() {
  const since = new Date();
  since.setDate(since.getDate() - CUSTOMER_ORDER_HISTORY_DAYS);
  return since.toISOString();
}

export function CustomerProfileOrderHistory() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (sess.session?.access_token) {
      try {
        await supabase.rpc("purge_my_old_customer_orders", {
          p_days: CUSTOMER_ORDER_HISTORY_DAYS,
        });
      } catch {
        /* migration may be pending */
      }
    }

    const since = historySinceIso();
    const [shopRows, orderRows] = await Promise.all([
      supabase.from("shops").select("*").eq("is_active", true),
      supabase
        .from("customer_orders")
        .select("*")
        .eq("created_by", user.id)
        .is("deleted_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
    ]);

    let orders = orderRows.data ?? [];
    const missing = ordersMissingBillId(orders);
    if (missing.length) {
      await backfillMyCustomerOrderBillIds(supabase, missing);
      const refreshed = await supabase
        .from("customer_orders")
        .select("*")
        .eq("created_by", user.id)
        .is("deleted_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      orders = refreshed.data ?? orders;
    }

    setShops(shopRows.data ?? []);
    setOrders(orders);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function viewBill(order: CustomerOrder) {
    const shopName = shops.find((s) => s.id === order.shop_id)?.name ?? null;
    printCustomerOrderBill({
      kind: "customer",
      order,
      shopName,
      orderTakerLabel: "Online order",
    });
  }

  if (loading) {
    return (
      <p className="groobey-profile-history-loading">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading orders…
      </p>
    );
  }

  if (!orders.length) {
    return (
      <div className="groobey-profile-history-empty">
        <FileText className="size-8" strokeWidth={1.5} aria-hidden />
        <p className="groobey-profile-history-empty-title">No orders in the last week</p>
        <p className="groobey-profile-history-empty-text">
          Orders and bills are kept for {CUSTOMER_ORDER_HISTORY_DAYS} days, then removed automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="groobey-profile-history">
      <p className="groobey-profile-history-hint">
        Last {CUSTOMER_ORDER_HISTORY_DAYS} days · tap Bill to view or download
      </p>
      <ul className="groobey-profile-order-list">
        {orders.map((order) => (
          <ProfileOrderHistoryCard
            key={order.id}
            billLabel={customerOrderBillLabel(order)}
            total={Number(order.total_amount || 0)}
            createdAt={order.created_at}
            onViewBill={() => viewBill(order)}
          />
        ))}
      </ul>
    </div>
  );
}
