import type { ReactNode } from "react";

import { GroceryOrderItemsList } from "@/components/groobey/grocery-order-items-list";
import { BillKindButtons } from "@/components/groobey/groobey-bill-buttons";
import { Button } from "@/components/ui/button";
import type { BillKind } from "@/lib/groobey-dual-bill";
import { displayBillId } from "@/lib/groobey-bill-id";
import { orderDisplayDate } from "@/lib/groobey-order-month";
import { cn } from "@/lib/utils";

export const orderBillIdHighlightClass =
  "inline-flex max-w-full truncate rounded-lg border border-emerald-400/70 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-950 shadow-sm";

export const orderBillShopHighlightClass =
  "inline-flex max-w-full truncate rounded-lg border border-sky-300/80 bg-sky-50 px-2 py-0.5 text-xs font-black text-sky-950 shadow-sm";

export const orderBillAddressHighlightClass =
  "inline-flex max-w-full rounded-lg border border-violet-300/80 bg-violet-50 px-2 py-1 text-xs font-bold text-violet-950 shadow-sm";

export const orderBillMetaDateClass =
  "inline-flex shrink-0 rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-xs font-bold tabular-nums text-foreground";

export const orderBillMetaAmountClass =
  "inline-flex shrink-0 rounded-lg border border-emerald-400/70 bg-emerald-50 px-2.5 py-1 text-sm font-black tabular-nums text-emerald-950 shadow-sm";

export function OrderBillLabeledHighlight({
  label,
  value,
  pillClassName,
  className,
}: {
  label: string;
  value: string;
  pillClassName: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5",
        className,
      )}
    >
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={pillClassName}>{value}</span>
    </div>
  );
}

/** Placeholder when no bill is selected (avoids empty gap on desktop). */
export function BillLookupEmptyHint() {
  return (
    <div
      className="rounded-xl border border-dashed border-border bg-muted/25 px-4 py-5 text-center sm:py-6"
      role="status"
    >
      <p className="text-sm font-bold text-foreground">No bill selected</p>
      <p className="mx-auto mt-1 max-w-xs text-xs font-semibold leading-snug text-muted-foreground">
        Type a Bill ID or choose from the list to view the customer, print, email, or update
        status.
      </p>
    </div>
  );
}

export function SelectedBillDetailCard({
  billNumber,
  customerName,
  customerPhone,
  address,
  shopName,
  createdAt,
  totalAmount,
  statusClassName,
  statusLabelText,
  children,
}: {
  billNumber: string;
  customerName: string;
  customerPhone?: string | null;
  address?: string;
  shopName?: string | null;
  createdAt?: string | null;
  totalAmount: number;
  statusClassName: string;
  statusLabelText: string;
  children: ReactNode;
}) {
  const dateText = orderDisplayDate(createdAt);
  const totalText = `₹${Math.round(totalAmount)}`;

  return (
    <div
      className="rounded-xl border-2 border-primary/35 bg-gradient-to-b from-primary/[0.08] to-card p-4 shadow-sm sm:p-5"
      role="region"
      aria-labelledby="selected-bill-heading"
    >
      <h3 id="selected-bill-heading" className="sr-only">
        Selected bill details
      </h3>
      <OrderBillLabeledHighlight
        label="Bill ID"
        value={billNumber}
        pillClassName={orderBillIdHighlightClass}
      />
      <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-card p-3 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Customer
        </p>
        <p className="text-lg font-black leading-tight text-foreground sm:text-xl">
          {customerName}
        </p>
        {customerPhone?.trim() ?
          <OrderBillLabeledHighlight
            label="Mobile"
            value={customerPhone.trim()}
            pillClassName="inline-flex max-w-full truncate rounded-lg border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-950 shadow-sm"
            className="mt-1"
          />
        : null}
        {address ?
          <OrderBillLabeledHighlight
            label="Customer address"
            value={address}
            pillClassName={orderBillAddressHighlightClass}
            className="mt-1"
          />
        : null}
        {shopName ?
          <OrderBillLabeledHighlight
            label="Shop"
            value={shopName}
            pillClassName={orderBillShopHighlightClass}
            className="mt-1"
          />
        : null}
      </div>
      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Bill date, total, and status"
      >
        <span className={orderBillMetaDateClass}>
          <span className="sr-only">Date </span>
          {dateText}
        </span>
        <span className={orderBillMetaAmountClass}>
          <span className="sr-only">Total </span>
          {totalText}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
            statusClassName,
          )}
        >
          <span className="sr-only">Status </span>
          {statusLabelText}
        </span>
      </div>
      <div className="mt-4 grid w-full min-w-0 gap-3 border-t border-border/60 pt-4">
        {children}
      </div>
    </div>
  );
}

export function OrdersMonthScopeBanner({
  monthKey,
  monthLabel,
  orderCount,
  className,
}: {
  monthKey: string;
  monthLabel: string;
  orderCount: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="font-black text-foreground">This month - {monthLabel}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Bill IDs use daily sequence for {monthKey}. A new calendar month starts a fresh list
        automatically.
      </p>
      <p className="mt-1 text-xs font-bold tabular-nums text-primary">
        {orderCount} order{orderCount === 1 ? "" : "s"} this month
      </p>
    </div>
  );
}

type OrderRowShape = {
  id: string;
  bill_number?: string | null;
  customer_name: string;
  delivery_address?: string | null;
  order_items?: string | null;
  total_amount?: number | null;
  created_at?: string | null;
  status: string;
};

export function OrderStatusActionButtons({
  nextStatuses,
  statusLabels,
  onUpdateStatus,
  orderLabel,
  compact,
  className,
}: {
  nextStatuses?: string[];
  statusLabels?: Record<string, string>;
  onUpdateStatus?: (status: string) => void;
  /** Shown in aria-labels, e.g. bill id or customer name. */
  orderLabel?: string;
  compact?: boolean;
  className?: string;
}) {
  if (!nextStatuses?.length || !onUpdateStatus || !statusLabels) return null;
  const labelSuffix = orderLabel ? ` for ${orderLabel}` : "";
  return (
    <div
      className={cn("flex flex-wrap gap-1.5", className)}
      role="group"
      aria-label={`Update order status${labelSuffix}`}
    >
      {nextStatuses.map((s) => (
        <Button
          key={s}
          type="button"
          variant={s === "cancelled" ? "outline" : "calm"}
          className={cn(
            "rounded-lg font-semibold",
            compact ? "h-7 px-2 text-[10px]" : "h-8 text-xs",
          )}
          onClick={() => onUpdateStatus(s)}
          aria-label={`Mark ${statusLabels[s] ?? s}${labelSuffix}`}
        >
          Mark {statusLabels[s] ?? s}
        </Button>
      ))}
    </div>
  );
}

export function OrderQueueCard({
  order,
  shopName,
  statusLabel,
  statusClassName,
  isHighlighted,
  onPrint,
  onEmail,
  onCopyBillId,
  onUpdateStatus,
  nextStatuses,
  statusLabels,
  emailing,
  actions,
}: {
  order: OrderRowShape;
  shopName?: string | null;
  statusLabel: string;
  statusClassName: string;
  isHighlighted?: boolean;
  onPrint: (kind: BillKind) => void;
  onEmail?: () => void;
  onCopyBillId?: () => void;
  onUpdateStatus?: (status: string) => void;
  nextStatuses?: string[];
  statusLabels?: Record<string, string>;
  emailing?: boolean;
  actions?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-card/70 p-3",
        isHighlighted ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
      aria-labelledby={`order-${order.id}-bill`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <OrderBillLabeledHighlight
            label="Bill ID"
            value={displayBillId(order.bill_number, "No bill ID")}
            pillClassName={orderBillIdHighlightClass}
          />
          <p id={`order-${order.id}-bill`} className="text-sm font-black text-foreground">
            {order.customer_name}
          </p>
          <OrderBillLabeledHighlight
            label="Address"
            value={order.delivery_address?.trim() || "-"}
            pillClassName="inline-flex max-w-full truncate rounded-lg border border-border bg-muted/50 px-2 py-0.5 text-xs font-semibold text-foreground"
          />
          {shopName ?
            <OrderBillLabeledHighlight
              label="Shop"
              value={shopName}
              pillClassName={orderBillShopHighlightClass}
            />
          : null}
          <p className="text-xs font-semibold tabular-nums text-muted-foreground">
            {orderDisplayDate(order.created_at)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
            statusClassName,
          )}
        >
          {statusLabel}
        </span>
      </div>
      {order.order_items ?
        <GroceryOrderItemsList
          text={order.order_items}
          className="mt-2"
          showHeading={false}
        />
      : null}
      <p className="mt-1 text-sm font-bold tabular-nums">
        ₹{Math.round(Number(order.total_amount || 0))} retail
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions ?? (
          <>
            <BillKindButtons onPrint={onPrint} />
            {onEmail ?
              <Button
                type="button"
                variant="outline"
                className="min-h-10 rounded-xl"
                disabled={emailing}
                onClick={onEmail}
              >
                Email bill
              </Button>
            : null}
            {order.bill_number && onCopyBillId ?
              <Button type="button" variant="outline" className="min-h-10 rounded-xl" onClick={onCopyBillId}>
                Copy bill ID
              </Button>
            : null}
          </>
        )}
      </div>
      <OrderStatusActionButtons
        className="mt-2 gap-2 border-t border-border/60 pt-2"
        nextStatuses={nextStatuses}
        statusLabels={statusLabels}
        onUpdateStatus={onUpdateStatus}
        orderLabel={displayBillId(order.bill_number, order.customer_name)}
      />
    </article>
  );
}
