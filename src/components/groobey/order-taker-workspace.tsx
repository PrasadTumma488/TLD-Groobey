import { Copy, Loader2, Mail, Plus, Printer, Receipt, Search, Wand2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { GroobeyGroceryLinePicker } from "@/components/groobey/groobey-grocery-line-picker";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { displayBillId } from "@/lib/groobey-bill-id";
import { exampleBillIdForNow } from "@/lib/groobey-bill-id";
import {
  billPickerLabel,
  filterOrdersForBillSearch,
  findOrderByBillQuery,
  normalizeBillIdInput,
  ordersForBillPicker,
  ordersWithBillNumbers,
  type CustomerOrderRow,
} from "@/lib/groobey-bill-lookup";
import {
  groceryCartRetailTotal,
  groceryCartSummaryText,
  type GroceryCartLine,
  type GroceryProduct,
} from "@/lib/groobey-grocery-cart";

import { BillKindButtons } from "@/components/groobey/groobey-bill-buttons";
import type { BillKind } from "@/lib/groobey-dual-bill";

import { CustomerOrderDeliveryFields } from "./customer-order-delivery-fields";
import { Field, InlineFeedback } from "./workspace-ui";

type Shop = Database["public"]["Tables"]["shops"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

const statusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrderTakerWorkspace({
  orders,
  products,
  shops,
  defaultShopId,
  ordersLoading = false,
  missingBillCount = 0,
  backfillingBills = false,
  resetNonce = 0,
  saving,
  feedback,
  billActionFeedback,
  emailingOrderId,
  nextStatuses,
  onSubmit,
  onPrintBill,
  onEmailBill,
  onCopyBillId,
  onUpdateStatus,
  onBackfillMissingBills,
  focusOrderId = null,
  onFocusOrderHandled,
}: {
  orders: CustomerOrderRow[];
  products: GroceryProduct[];
  shops: Shop[];
  defaultShopId: string;
  ordersLoading?: boolean;
  missingBillCount?: number;
  backfillingBills?: boolean;
  resetNonce?: number;
  saving?: boolean;
  feedback?: { error?: string; notice?: string };
  billActionFeedback?: { error?: string; notice?: string };
  emailingOrderId?: string | null;
  nextStatuses: Record<OrderStatus, OrderStatus[]>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPrintBill: (order: CustomerOrderRow, kind: BillKind) => void;
  onEmailBill: (order: CustomerOrderRow, customerEmail: string) => void | Promise<void>;
  onCopyBillId: (billNumber: string) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onBackfillMissingBills?: () => void | Promise<void>;
  /** After creating an order, parent sets this so the new bill is selected in the dropdown. */
  focusOrderId?: string | null;
  onFocusOrderHandled?: () => void;
}) {
  const [pickedOrderId, setPickedOrderId] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [cartLines, setCartLines] = useState<GroceryCartLine[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState(0);

  const pickerOrders = useMemo(() => ordersForBillPicker(orders), [orders]);
  const billedOrders = useMemo(() => ordersWithBillNumbers(orders), [orders]);
  const billCount = billedOrders.length;
  const currentBillIdExample = useMemo(() => exampleBillIdForNow(), []);

  const listBills = useMemo(() => {
    if (!typeQuery.trim()) return billedOrders;
    return filterOrdersForBillSearch(orders, typeQuery);
  }, [billedOrders, orders, typeQuery]);

  const billIdSuggestions = useMemo(
    () => billedOrders.map((o) => o.bill_number?.trim()).filter(Boolean) as string[],
    [billedOrders],
  );

  const selectedOrder = useMemo(() => {
    if (pickedOrderId) {
      return orders.find((o) => o.id === pickedOrderId) ?? null;
    }
    if (typeQuery.trim()) {
      return findOrderByBillQuery(orders, typeQuery);
    }
    return null;
  }, [orders, pickedOrderId, typeQuery]);

  const statusActions = selectedOrder ? (nextStatuses[selectedOrder.status] ?? []) : [];
  const isEmailing = Boolean(selectedOrder && emailingOrderId === selectedOrder.id);

  useEffect(() => {
    setCartLines([]);
    setTypeQuery("");
    setPickedOrderId("");
    setCustomerEmail("");
    setDeliveryCharge(0);
  }, [resetNonce]);

  useEffect(() => {
    if (!selectedOrder) return;
    const phone = selectedOrder.customer_phone?.trim() ?? "";
    setCustomerEmail(phone.includes("@") ? phone : "");
  }, [selectedOrder?.id, selectedOrder?.customer_phone]);

  const pickOrder = useCallback((order: CustomerOrderRow) => {
    setPickedOrderId(order.id);
    setTypeQuery(order.bill_number?.trim() ?? "");
  }, []);

  useEffect(() => {
    if (!focusOrderId) return;
    const order = orders.find((o) => o.id === focusOrderId);
    if (!order) return;
    pickOrder(order);
    onFocusOrderHandled?.();
  }, [focusOrderId, orders, onFocusOrderHandled, pickOrder]);

  const recentBillList = useMemo(() => {
    if (typeQuery.trim()) return listBills.length ? listBills : billedOrders;
    return billedOrders;
  }, [typeQuery, listBills, billedOrders]);

  const cartTotal = useMemo(
    () => groceryCartRetailTotal(cartLines, products),
    [cartLines, products],
  );
  const orderItemsText = useMemo(
    () => groceryCartSummaryText(cartLines, products),
    [cartLines, products],
  );

  return (
    <div className="grid max-w-xl gap-6">
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Receipt className="size-4 text-primary" />
            Find bill by Bill ID
          </div>
          {ordersLoading ?
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading bills…
            </span>
          : <span className="text-xs font-semibold text-muted-foreground">
              {billCount} bill{billCount === 1 ? "" : "s"}
              {missingBillCount > 0 ?
                ` · ${missingBillCount} missing Bill ID`
              : null}
            </span>
          }
        </div>

        {missingBillCount > 0 && onBackfillMissingBills ?
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            <span>
              {missingBillCount} order{missingBillCount === 1 ? "" : "s"} have no Bill ID yet.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg border-amber-300 bg-white"
              disabled={backfillingBills || ordersLoading}
              onClick={() => void onBackfillMissingBills()}
            >
              {backfillingBills ?
                <Loader2 className="size-3.5 animate-spin" />
              : <Wand2 className="size-3.5" />}
              Fix missing bill IDs
            </Button>
          </div>
        : null}

        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          <span>Type or pick Bill ID</span>
          <span className="flex h-11 min-h-11 items-center gap-2 rounded-xl border border-input bg-card px-3 ring-ring transition focus-within:ring-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={typeQuery}
              onChange={(e) => {
                setTypeQuery(e.target.value);
                setPickedOrderId("");
              }}
              list="groobey-bill-ids"
              placeholder={`${currentBillIdExample} or last 4 digits…`}
              className="min-w-0 flex-1 bg-transparent text-sm font-mono outline-none"
              autoComplete="off"
            />
          </span>
          <datalist id="groobey-bill-ids">
            {billIdSuggestions.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </label>

        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          <span>Bill dropdown</span>
          <select
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2 disabled:opacity-60"
            value={pickedOrderId}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                setPickedOrderId("");
                return;
              }
              const order = orders.find((o) => o.id === id);
              if (order) pickOrder(order);
            }}
            disabled={ordersLoading}
          >
            <option value="">
              {ordersLoading ?
                "Loading bills…"
              : billCount === 0 && orders.length > 0 ?
                "No Bill IDs on file — use Fix missing bill IDs"
              : billCount === 0 ?
                "No orders yet — create one below"
              : `Choose a bill (${billCount})…`}
            </option>
            {pickerOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {billPickerLabel(order)}
              </option>
            ))}
          </select>
          <span className="text-[11px] font-medium text-muted-foreground">
            New orders use <span className="font-mono font-bold">{currentBillIdExample}</span> (YYMMDD-##, daily sequence).
            Older GCO-* / GB-* IDs still work in search.
          </span>
        </label>

        {billCount > 0 ?
          <div className="grid gap-1">
            <p className="text-xs font-semibold text-muted-foreground">Recent bills (tap to load)</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-muted/30 p-2">
              {recentBillList.map((order) => {
                const active = selectedOrder?.id === order.id;
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => pickOrder(order)}
                      className={`w-full rounded-lg px-2 py-2 text-left text-xs font-semibold transition ${
                        active ?
                          "bg-primary text-primary-foreground"
                        : "bg-card hover:bg-primary/10"
                      }`}
                    >
                      <span className="font-mono text-sm font-black">
                        {displayBillId(order.bill_number)}
                      </span>
                      <span className="mt-0.5 block truncate opacity-90">
                        {order.customer_name} · ₹{Math.round(Number(order.total_amount || 0))} ·{" "}
                        {statusLabel[order.status]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        : !ordersLoading && orders.length > 0 ?
          <p className="text-sm font-semibold text-muted-foreground">
            You have {orders.length} order{orders.length === 1 ? "" : "s"} but none show a Bill ID.
            {onBackfillMissingBills ?
              " Use “Fix missing bill IDs” above."
            : " Ask admin to run bill migrations."}
          </p>
        : null}

        <InlineFeedback {...billActionFeedback} />

        {selectedOrder ?
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="font-mono text-xl font-black text-primary">
              {displayBillId(selectedOrder.bill_number, "No bill ID")}
            </p>
            <p className="mt-1 text-sm font-bold">{selectedOrder.customer_name}</p>
            <p className="text-xs font-semibold text-muted-foreground">
              ₹{Math.round(Number(selectedOrder.total_amount || 0))} ·{" "}
              {statusLabel[selectedOrder.status]}
            </p>
            <p className="mt-2 line-clamp-3 text-xs font-semibold text-muted-foreground">
              {selectedOrder.order_items}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <BillKindButtons onPrint={(kind) => onPrintBill(selectedOrder, kind)} />
              <Button
                type="button"
                variant="outline"
                className="min-h-10 rounded-xl"
                disabled={isEmailing}
                onClick={() => void onEmailBill(selectedOrder, customerEmail)}
              >
                {isEmailing ?
                  <Loader2 className="size-4 animate-spin" />
                : <Mail className="size-4" />}{" "}
                Email
              </Button>
              {selectedOrder.bill_number ?
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 rounded-xl"
                  onClick={() => onCopyBillId(selectedOrder.bill_number!)}
                >
                  <Copy className="size-4" /> Copy ID
                </Button>
              : null}
            </div>
            <label className="mt-3 grid gap-1 text-xs font-semibold text-foreground">
              <span>Customer email (required to send bill)</span>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
              />
            </label>
            {statusActions.length ?
              <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                {statusActions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={s === "cancelled" ? "outline" : "calm"}
                    className="h-8 rounded-lg text-xs"
                    onClick={() => onUpdateStatus(selectedOrder.id, s)}
                  >
                    Mark {statusLabel[s]}
                  </Button>
                ))}
              </div>
            : null}
          </div>
        : typeQuery.trim() && !ordersLoading ?
          <p className="text-sm font-semibold text-muted-foreground">
            No order matches “{normalizeBillIdInput(typeQuery)}”.
          </p>
        : null}
      </section>

      <section className="border-t border-border pt-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <Plus className="size-4 text-primary" />
          Quick new order
        </div>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <InlineFeedback {...feedback} />
          <Field name="customerName" label="Customer name" required />
          <input type="hidden" name="customerPhone" value="" />
          <input type="hidden" name="shopId" value={defaultShopId} />
          <input type="hidden" name="orderItems" value={orderItemsText} />
          <input type="hidden" name="totalAmount" value={String(cartTotal)} />
          <input type="hidden" name="requiredDate" value="" />
          <input type="hidden" name="notes" value="" />
          <GroobeyGroceryLinePicker
            products={products}
            lines={cartLines}
            onLinesChange={setCartLines}
            disabled={saving}
          />
          <CustomerOrderDeliveryFields
            shops={shops}
            products={products}
            resetNonce={resetNonce}
            disabled={saving}
            cartItemsSummary={orderItemsText}
            onDeliveryChargeChange={setDeliveryCharge}
          />
          <p className="text-sm font-black text-foreground">
            Grocery: ₹{Math.round(cartTotal)}
            {deliveryCharge > 0 ?
              <span className="font-semibold text-muted-foreground">
                {" "}
                + delivery ₹{deliveryCharge} = ₹{Math.round(cartTotal + deliveryCharge)}
              </span>
            : null}
          </p>
          <Button
            type="submit"
            variant="groobey"
            className="min-h-11 rounded-xl"
            disabled={saving || cartLines.length === 0}
          >
            {saving ?
              <Loader2 className="size-4 animate-spin" />
            : <Plus className="size-4" />}
            Create order &amp; print bill
          </Button>
        </form>
      </section>
    </div>
  );
}
