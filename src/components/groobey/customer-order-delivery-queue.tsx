import { Bike, Loader2, MapPin, PhoneCall, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { buildCustomerOrderBillHtml, openBillPrintGuarded } from "@/lib/groobey-dual-bill";
import type { BillPreviewShowOptions } from "@/lib/groobey-bill-preview-bridge";
import { supabase } from "@/integrations/supabase/client";

import { InlineFeedback } from "./workspace-ui";

type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"] & {
  shop?: { name: string | null } | null;
};
type OrderStatus = Database["public"]["Enums"]["order_status"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];

const statusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const statusClass: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-sky-100 text-sky-700",
  packed: "bg-indigo-100 text-indigo-700",
  out_for_delivery: "bg-violet-100 text-violet-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const deliveryNext: Partial<Record<OrderStatus, OrderStatus[]>> = {
  confirmed: ["packed"],
  packed: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
};

export function CustomerOrderDeliveryQueue({
  orders,
  shops,
  onUpdated,
  billPreviewOptions,
}: {
  orders: CustomerOrder[];
  shops: Shop[];
  onUpdated: () => void;
  billPreviewOptions?: (order: CustomerOrder) => BillPreviewShowOptions | undefined;
}) {
  const [alert, setAlert] = useState<{ error?: string; notice?: string }>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const shopNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const shop of shops) map.set(shop.id, shop.name);
    return map;
  }, [shops]);

  const queue = useMemo(
    () =>
      orders.filter((o) =>
        ["confirmed", "packed", "out_for_delivery"].includes(o.status),
      ),
    [orders],
  );

  function shopLabel(order: CustomerOrder) {
    const joined = order.shop?.name?.trim();
    if (joined) return joined;
    const id = order.shop_id;
    if (id && shopNameById.has(id)) return shopNameById.get(id)!;
    return "—";
  }

  function printHandoff(order: CustomerOrder) {
    const retail = Number(order.total_amount || 0);
    const html = buildCustomerOrderBillHtml({
      kind: "customer",
      billNumber: order.bill_number,
      shopName: null,
      orderTakerLabel: "Delivery",
      dateLabel: (order.created_at || "").slice(0, 16),
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      deliveryAddress: order.delivery_address,
      orderItemsText: order.order_items,
      totalRetail: retail,
      totalMerchant: retail,
      notes: order.notes,
    });
    openBillPrintGuarded(html, "customer", billPreviewOptions?.(order));
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setBusyId(orderId);
    setAlert({});
    const { error } = await supabase
      .from("customer_orders")
      .update({ status } as never)
      .eq("id", orderId);
    setBusyId(null);
    if (error) {
      setAlert({ error: error.message });
      return;
    }
    setAlert({ notice: `Order marked as ${statusLabel[status]}.` });
    onUpdated();
  }

  if (!queue.length) {
    return (
      <p className="text-sm font-semibold text-muted-foreground">
        No customer orders waiting for delivery right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <InlineFeedback {...alert} />
      {queue.map((order) => {
        const next = deliveryNext[order.status] ?? [];
        return (
          <article
            key={order.id}
            className="rounded-xl border border-border bg-card/70 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-base font-black">{order.customer_name}</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-primary">
                  {order.bill_number || "No bill ID"}
                </p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  Shop: {shopLabel(order)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[order.status]}`}
              >
                {statusLabel[order.status]}
              </span>
            </div>
            <div className="mt-2 grid gap-1 text-xs font-semibold text-muted-foreground">
              <p className="text-sm font-black text-foreground">
                Total ₹{Math.round(Number(order.total_amount || 0))}
              </p>
              <p className="inline-flex items-center gap-1">
                <PhoneCall className="size-3" />
                {order.customer_phone || "—"}
              </p>
              <p className="inline-flex items-start gap-1 break-words">
                <MapPin className="mt-0.5 size-3 shrink-0" />
                {order.delivery_address || "—"}
              </p>
              <p className="break-words whitespace-pre-wrap">Items: {order.order_items}</p>
              {order.notes ?
                <p className="break-words">Notes: {order.notes}</p>
              : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-10 rounded-xl"
                onClick={() => printHandoff(order)}
              >
                <Printer className="size-4" /> Print bill
              </Button>
              {next.map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={status === "delivered" ? "groobey" : "calm"}
                  className="min-h-10 rounded-xl"
                  disabled={busyId === order.id}
                  onClick={() => void updateStatus(order.id, status)}
                >
                  {busyId === order.id ?
                    <Loader2 className="size-4 animate-spin" />
                  : <Bike className="size-4" />}{" "}
                  Mark {statusLabel[status]}
                </Button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
