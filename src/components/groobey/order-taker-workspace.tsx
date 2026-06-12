import { Loader2, Plus, Receipt, Search, Wand2, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { GroobeyGroceryLinePicker } from "@/components/groobey/groobey-grocery-line-picker";
import { GroobeySelect } from "@/components/groobey/groobey-select-field";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { displayBillId } from "@/lib/groobey-bill-id";
import { exampleBillIdForNow } from "@/lib/groobey-bill-id";
import {
  billPickerLabel,
  findOrderByBillQuery,
  normalizeBillIdInput,
  ordersForBillPicker,
  ordersWithBillNumbers,
  type CustomerOrderRow,
} from "@/lib/groobey-bill-lookup";
import { resolveCustomerStreetAddressForBill } from "@/lib/groobey-delivery-order-fields";
import {
  groceryCartRetailTotal,
  groceryCartSummaryText,
  type GroceryCartLine,
  type GroceryProduct,
} from "@/lib/groobey-grocery-cart";

import { BillKindButtons } from "@/components/groobey/groobey-bill-buttons";
import type { BillKind } from "@/lib/groobey-dual-bill";

import {
  BillLookupEmptyHint,
  OrdersMonthScopeBanner,
  SelectedBillDetailCard,
} from "@/components/groobey/groobey-order-list-parts";
import { cn } from "@/lib/utils";
import { CustomerOrderDeliveryFields } from "./customer-order-delivery-fields";
import { GroceryOrderItemsList } from "@/components/groobey/grocery-order-items-list";
import { Field, InlineFeedback } from "./workspace-ui";
import {
  calendarMonthKey,
  filterOrdersByCalendarMonth,
} from "@/lib/groobey-order-month";

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

const statusClass: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  packed: "bg-indigo-100 text-indigo-800",
  out_for_delivery: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

export function OrderTakerWorkspace({
  orders,
  products,
  shops,
  missingBillCount = 0,
  backfillingBills = false,
  resetNonce = 0,
  saving,
  feedback,
  billActionFeedback,
  nextStatuses,
  onSubmit,
  onPrintBill,
  onUpdateStatus,
  onBackfillMissingBills,
  focusOrderId = null,
  onFocusOrderHandled,
  calendarMonth,
  calendarMonthLabel,
}: {
  orders: CustomerOrderRow[];
  products: GroceryProduct[];
  shops: Shop[];
  missingBillCount?: number;
  backfillingBills?: boolean;
  resetNonce?: number;
  saving?: boolean;
  feedback?: { error?: string; notice?: string };
  billActionFeedback?: { error?: string; notice?: string };
  nextStatuses: Record<OrderStatus, OrderStatus[]>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPrintBill: (order: CustomerOrderRow, kind: BillKind) => boolean;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onBackfillMissingBills?: () => void | Promise<void>;
  /** After creating an order, parent sets this so the new bill is selected in the dropdown. */
  focusOrderId?: string | null;
  onFocusOrderHandled?: () => void;
  calendarMonth?: string;
  calendarMonthLabel?: string;
}) {
  const monthKey = calendarMonth ?? calendarMonthKey();
  const monthOrders = useMemo(
    () => filterOrdersByCalendarMonth(orders, monthKey),
    [orders, monthKey],
  );
  const [pickedOrderId, setPickedOrderId] = useState("");
  const [typeQuery, setTypeQuery] = useState("");
  const [cartLines, setCartLines] = useState<GroceryCartLine[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState(0);

  const pickerOrders = useMemo(() => ordersForBillPicker(monthOrders), [monthOrders]);
  const billedOrders = useMemo(() => ordersWithBillNumbers(monthOrders), [monthOrders]);
  const billCount = billedOrders.length;
  const billPickerSelectOptions = useMemo(() => {
    const emptyLabel =
      billCount === 0 && monthOrders.length > 0 ?
        "No Bill IDs this month - use Fix missing bill IDs"
      : billCount === 0 ? "No orders this month - create one below"
      : `Choose a bill this month (${billCount})…`;
    return [
      { value: "__none__", label: emptyLabel },
      ...pickerOrders.map((order) => ({
        value: order.id,
        label: billPickerLabel(order),
      })),
    ];
  }, [billCount, monthOrders.length, pickerOrders]);
  const currentBillIdExample = useMemo(() => exampleBillIdForNow(), []);

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
  const selectedBillAddress = selectedOrder
    ? resolveCustomerStreetAddressForBill({
        delivery_address: selectedOrder.delivery_address,
        delivery_destination: selectedOrder.delivery_destination,
        notes: selectedOrder.notes,
      })
    : "";
  const selectedShopName = selectedOrder?.shop_id
    ? shops.find((s) => s.id === selectedOrder.shop_id)?.name
    : undefined;

  useEffect(() => {
    setCartLines([]);
    setTypeQuery("");
    setPickedOrderId("");
    setDeliveryCharge(0);
  }, [resetNonce]);

  const pickOrder = useCallback((order: CustomerOrderRow) => {
    setPickedOrderId(order.id);
    setTypeQuery(order.bill_number?.trim() ?? "");
  }, []);

  const clearSelectedBill = useCallback(() => {
    setPickedOrderId("");
    setTypeQuery("");
  }, []);

  const handleBillKindClick = useCallback(
    (kind: BillKind) => {
      if (!selectedOrder) return;
      onPrintBill(selectedOrder, kind);
    },
    [onPrintBill, selectedOrder],
  );

  useEffect(() => {
    if (!focusOrderId) return;
    const order = orders.find((o) => o.id === focusOrderId);
    if (!order) return;
    pickOrder(order);
    onFocusOrderHandled?.();
  }, [focusOrderId, orders, onFocusOrderHandled, pickOrder]);

  const cartTotal = useMemo(
    () => groceryCartRetailTotal(cartLines, products),
    [cartLines, products],
  );
  const orderItemsText = useMemo(
    () => groceryCartSummaryText(cartLines, products),
    [cartLines, products],
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8 xl:gap-10">
      <div className="flex min-w-0 w-full flex-col gap-3 lg:max-w-md lg:shrink-0 xl:max-w-lg">
      <section className="grid min-w-0 gap-3" aria-labelledby="bill-lookup-heading">
        <h2 id="bill-lookup-heading" className="sr-only">
          Find and manage bills
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Receipt className="size-4 text-primary" aria-hidden />
            Find bill by Bill ID
          </div>
          <span
            className="text-xs font-semibold text-muted-foreground"
            aria-live="polite"
            aria-atomic="true"
          >
            {billCount} bill{billCount === 1 ? "" : "s"} this month
            {missingBillCount > 0 ?
              ` · ${missingBillCount} missing Bill ID`
            : null}
          </span>
        </div>

        <OrdersMonthScopeBanner
          monthKey={monthKey}
          monthLabel={calendarMonthLabel ?? monthKey}
          orderCount={monthOrders.length}
        />

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
              disabled={backfillingBills}
              onClick={() => void onBackfillMissingBills()}
            >
              {backfillingBills ?
                <Loader2 className="size-3.5 animate-spin" />
              : <Wand2 className="size-3.5" />}
              Fix missing bill IDs
            </Button>
          </div>
        : null}

        <label
          id="bill-id-search-label"
          className="grid gap-1.5 text-sm font-semibold text-foreground"
        >
          <span>Type or pick Bill ID</span>
          <span className="flex h-11 min-h-11 items-center gap-2 rounded-xl border border-input bg-card px-3 ring-ring transition focus-within:ring-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              id="bill-id-search"
              type="search"
              value={typeQuery}
              onChange={(e) => {
                setTypeQuery(e.target.value);
                setPickedOrderId("");
              }}
              list="groobey-bill-ids"
              placeholder={`${currentBillIdExample} or last 4 digits…`}
              aria-labelledby="bill-id-search-label"
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

        <label
          id="bill-picker-label"
          className="grid gap-1.5 text-sm font-semibold text-foreground"
        >
          <span>Choose from list</span>
          <GroobeySelect
            value={pickedOrderId || "__none__"}
            onValueChange={(id) => {
              if (id === "__none__") {
                setPickedOrderId("");
                return;
              }
              const order = orders.find((o) => o.id === id);
              if (order) pickOrder(order);
            }}
            id="bill-picker"
            aria-labelledby="bill-picker-label"
            options={billPickerSelectOptions}
          />
          <span className="text-[11px] font-medium text-muted-foreground">
            New orders use <span className="font-mono font-bold">{currentBillIdExample}</span> (YYMMDD-##, daily sequence).
            Older GCO-* / GB-* IDs still work in search.
          </span>
        </label>

        {billCount === 0 && monthOrders.length > 0 ?
          <p className="text-sm font-semibold text-muted-foreground" role="status">
            You have {monthOrders.length} order{monthOrders.length === 1 ? "" : "s"} this month but
            none show a Bill ID.
            {onBackfillMissingBills ?
              " Use “Fix missing bill IDs” above."
            : " Ask admin to run bill migrations."}
          </p>
        : null}

        <InlineFeedback {...billActionFeedback} />
      </section>

        {selectedOrder ?
          <SelectedBillDetailCard
            billNumber={displayBillId(selectedOrder.bill_number, "No bill ID")}
            customerName={selectedOrder.customer_name}
            customerPhone={selectedOrder.customer_phone}
            address={selectedBillAddress || undefined}
            shopName={selectedShopName}
            createdAt={selectedOrder.created_at}
            totalAmount={Number(selectedOrder.total_amount || 0)}
            statusClassName={statusClass[selectedOrder.status]}
            statusLabelText={statusLabel[selectedOrder.status]}
          >
            {selectedOrder.order_items ?
              <GroceryOrderItemsList text={selectedOrder.order_items} showHeading />
            : null}
            <div
              className="grid w-full min-w-0 grid-cols-2 gap-2"
              role="group"
              aria-label="Print and clear bill"
            >
              <BillKindButtons
                layout="grid"
                className="col-span-2 min-w-0"
                onPrint={handleBillKindClick}
              />
              <Button
                type="button"
                variant="outline"
                className="col-span-2 min-h-10 h-10 w-full min-w-0 rounded-xl text-sm font-bold"
                onClick={clearSelectedBill}
                aria-label="Clear selected bill"
              >
                <X className="size-4 shrink-0" aria-hidden />
                <span className="truncate">Clear bill</span>
              </Button>
            </div>

            {statusActions.length ?
              <div
                className="grid w-full min-w-0 grid-cols-2 gap-2 border-t border-border/60 pt-3"
                role="group"
                aria-label="Update order status"
              >
                {statusActions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={s === "cancelled" ? "outline" : "calm"}
                    className={cn(
                      "min-h-10 h-10 w-full min-w-0 rounded-xl text-xs font-bold",
                      statusActions.length === 1 && "col-span-2",
                    )}
                    onClick={() => onUpdateStatus(selectedOrder.id, s)}
                    aria-label={`Mark ${statusLabel[s]} for ${displayBillId(selectedOrder.bill_number)}`}
                  >
                    <span className="truncate">Mark {statusLabel[s]}</span>
                  </Button>
                ))}
              </div>
            : null}
          </SelectedBillDetailCard>
        : typeQuery.trim() ?
          <p className="text-sm font-semibold text-muted-foreground" role="status">
            No order matches “{normalizeBillIdInput(typeQuery)}”.
          </p>
        : <BillLookupEmptyHint />}
      </div>

      <section
        className="min-w-0 flex-1 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 xl:pl-10"
        aria-labelledby="quick-order-heading"
      >
        <h2
          id="quick-order-heading"
          className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"
        >
          <Plus className="size-4 text-primary" aria-hidden />
          Quick new order
        </h2>
        <form key={resetNonce} className="grid gap-4" onSubmit={onSubmit}>
          <InlineFeedback {...feedback} />
          <Field name="customerName" label="Customer name" required />
          <Field name="customerPhone" label="Customer mobile" type="tel" required />
          <Field name="customerAddress" label="Customer location (address)" required />
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
            orderTakerMode
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
            Create order
          </Button>
        </form>
      </section>
    </div>
  );
}
