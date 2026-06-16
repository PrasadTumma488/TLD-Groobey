import { AlertCircle, Eye, EyeOff, Loader2, Pencil } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Product = Database["public"]["Tables"]["products"]["Row"];

export function Field({
  name,
  label,
  type = "text",
  icon: Icon,
  required = false,
  disabled = false,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  icon?: LucideIcon;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-foreground">
      <span>{label}</span>
      <span className="flex h-11 min-h-11 items-center gap-2 rounded-xl border border-input bg-card px-3 ring-ring transition focus-within:ring-2">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <input
          name={name}
          type={type}
          required={required}
          disabled={disabled}
          defaultValue={defaultValue}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70"
        />
      </span>
    </label>
  );
}

export function PasswordField({
  name,
  label,
  icon: Icon,
  required = false,
  disabled = false,
  defaultValue,
  autoComplete = "new-password",
}: {
  name: string;
  label: string;
  icon?: LucideIcon;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-1.5 text-sm font-semibold text-foreground">
      <span>{label}</span>
      <span className="flex h-11 min-h-11 items-center gap-2 rounded-xl border border-input bg-card pr-1 ring-ring transition focus-within:ring-2">
        {Icon && <Icon className="ml-3 size-4 shrink-0 text-muted-foreground" />}
        <input
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          disabled={disabled}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent py-2 pl-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
    </label>
  );
}

export function Panel({
  title,
  icon: Icon,
  children,
  action,
  feedback,
  feedbackPlacement = "top",
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
  feedback?: { error?: string; notice?: string };
  feedbackPlacement?: "top" | "bottom";
}) {
  const feedbackEl =
    feedback?.error || feedback?.notice ?
      <InlineFeedback
        error={feedback?.error}
        notice={feedback?.notice}
        className={feedbackPlacement === "top" ? "mb-4" : "mt-4"}
      />
    : null;
  return (
    <section className="groobey-card min-w-0 rounded-2xl border border-border p-4 sm:p-5">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-5 shrink-0 text-primary" />
          <h2 className="text-lg font-black leading-tight sm:text-xl">{title}</h2>
        </div>
        {action}
      </div>
      {feedbackPlacement === "top" ? feedbackEl : null}
      {children}
      {feedbackPlacement === "bottom" ? feedbackEl : null}
    </section>
  );
}

/** Centers the whole panel (title + card) in the page - same width as staff directory. */
export function GroobeyWorkspaceShell({
  children,
  wide = false,
  className,
}: {
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "groobey-centered-workspace",
        wide && "groobey-centered-workspace--wide",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Bordered inner card - matches directory table / people list styling. */
export function GroobeyWorkspaceFormCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "groobey-workspace-form-card overflow-hidden rounded-2xl border border-border bg-card/70 p-4 shadow-[var(--shadow-soft)] sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  hint,
  onClick,
  pressed = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  /** Optional one-line hint under the label (e.g. margin explanation). */
  hint?: string;
  /** When set, the tile is a button (keyboard + screen-reader friendly). */
  onClick?: () => void;
  /** Highlights the tile when its filter/view is active. */
  pressed?: boolean;
}) {
  const className = cn(
    "groobey-card groobey-stat-tile min-w-0 rounded-2xl border border-border p-3 text-left transition duration-200 sm:p-4",
    onClick &&
      "cursor-pointer select-none hover:border-primary/45 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    pressed && "border-primary/45 bg-primary/10 shadow-sm ring-1 ring-primary/25",
  );
  const body = (
    <>
      <Icon className="mb-2 size-5 text-primary sm:mb-3" aria-hidden />
      <p className="text-xl font-black tabular-nums sm:text-2xl">{value}</p>
      <p className="text-xs font-semibold leading-snug text-muted-foreground sm:text-sm">{label}</p>
      {hint ?
        <p className="mt-1 text-[11px] font-semibold leading-snug text-muted-foreground">{hint}</p>
      : null}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-pressed={pressed}
        aria-label={`${label}: ${value}. Show matching orders.`}
      >
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export function InlineFeedback({
  error,
  notice,
  className = "",
}: {
  error?: string;
  notice?: string;
  className?: string;
}) {
  if (!error && !notice) return null;
  return (
    <div className={`space-y-2 ${className}`.trim()} aria-live="polite">
      {error ?
        <div
          role="alert"
          className="rounded-xl border border-destructive/80 bg-destructive/10 px-3 py-2.5 text-sm font-semibold leading-snug text-destructive"
        >
          {error}
        </div>
      : null}
      {notice ?
        <div
          role="status"
          className="rounded-xl border border-emerald-600/40 bg-emerald-50 px-3 py-2.5 text-sm font-semibold leading-snug text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          {notice}
        </div>
      : null}
    </div>
  );
}

export function Message({
  error,
  notice,
  loading,
  refreshing,
  showAlerts = true,
}: {
  error: string;
  notice: string;
  loading: boolean;
  refreshing?: boolean;
  showAlerts?: boolean;
}) {
  if (loading)
    return (
      <div
        className={
          showAlerts ?
            "mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-semibold"
          : "mt-2 flex min-h-9 items-center gap-2 rounded-lg border border-border/80 bg-card/80 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground"
        }
      >
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />{" "}
        {showAlerts ? "Loading workspace…" : "Loading…"}
      </div>
    );
  if (!showAlerts) {
    if (!refreshing) return null;
    return (
      <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Syncing…
      </p>
    );
  }
  if (!error && !notice && !refreshing) return null;
  return (
    <div className="mt-4 space-y-2">
      {error ? (
        <div className="rounded-xl border border-destructive bg-destructive/10 p-3 text-sm font-semibold text-destructive">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-success bg-success/10 p-3 text-sm font-semibold text-success">
          {notice}
        </div>
      ) : null}
      {refreshing && (error || notice) ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Syncing data…
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/50 p-5 text-center">
      <Icon className="mx-auto mb-2 size-6 text-primary" />
      <p className="font-black">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function Records({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length)
    return (
      <EmptyState
        icon={AlertCircle}
        title={empty}
        text="New records will appear here automatically."
      />
    );
  return (
    <div className="max-h-52 space-y-2 overflow-y-auto groobey-scrollbar">
      {items.map((item) => (
        <div
          key={item}
          className="rounded-xl border border-border bg-card/70 p-3 text-sm font-semibold"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

export function ProductRow({
  item,
  canEdit = false,
  onRateUpdate,
  onDelete,
  onEdit,
  onToggleOutOfStock,
}: {
  item: Product;
  canEdit?: boolean;
  onRateUpdate?: (productId: string, nextPrice: number) => void;
  onDelete?: (productId: string) => void;
  onEdit?: () => void;
  onToggleOutOfStock?: (productId: string, nextValue: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(item.price));

  useEffect(() => {
    setPrice(String(item.price));
  }, [item.id, item.price]);

  function saveRate() {
    const nextPrice = Number(price || item.price);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) return;
    onRateUpdate?.(item.id, nextPrice);
    setEditing(false);
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card/70 p-3 transition hover:translate-x-1",
        item.is_out_of_stock && "border-amber-300/70 bg-amber-50/40",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black">{item.name}</p>
          {item.is_out_of_stock ?
            <span className="rounded-full bg-amber-200/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-950">
              Out of stock
            </span>
          : null}
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {item.unit}
          {Number(item.default_quantity ?? 1) !== 1 ?
            ` · default qty ${item.default_quantity}`
          : ""}
          {" · "}₹{item.price}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center">
            <label className="grid gap-0.5 text-[10px] font-bold uppercase text-muted-foreground">
              Retail
              <input
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="h-9 w-20 rounded-lg border border-input bg-card px-2 text-sm font-black outline-none ring-ring focus:ring-2"
                type="number"
              />
            </label>
            <Button type="button" variant="calm" className="h-9 shrink-0 rounded-lg px-3" onClick={saveRate}>
              Save
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="max-w-[min(100%,14rem)] truncate rounded-full bg-secondary px-3 py-1 text-left text-xs font-black leading-tight text-secondary-foreground sm:max-w-none sm:text-sm"
            onClick={() => canEdit && setEditing(true)}
          >
            ₹{item.price}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {onToggleOutOfStock && (
            <Button
              type="button"
              variant={item.is_out_of_stock ? "groobey" : "outline"}
              className="h-9 rounded-lg px-2 text-xs"
              onClick={() => onToggleOutOfStock(item.id, !item.is_out_of_stock)}
            >
              {item.is_out_of_stock ?
                <>
                  <Eye className="size-3.5" /> Mark in stock
                </>
              : <>
                  <EyeOff className="size-3.5" /> Out of stock
                </>
              }
            </Button>
          )}
          {onEdit && (
            <Button
              type="button"
              variant="calm"
              className="h-9 min-h-9 rounded-lg px-2 text-xs"
              onClick={onEdit}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-lg px-2 text-xs"
              onClick={() => onDelete(item.id)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function VerifyList({
  title,
  records,
  onApprove,
  onReject,
  emptyText,
}: {
  title: string;
  records: Array<{ id: string; label: string }>;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  emptyText: string;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-card/60 p-3">
      <p className="text-sm font-black">{title}</p>
      {!records.length ? (
        <p className="text-xs font-semibold text-muted-foreground">{emptyText}</p>
      ) : (
        records.map((record) => (
          <div
            key={record.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2"
          >
            <p className="text-xs font-semibold text-muted-foreground">{record.label}</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="calm"
                className="min-h-9 rounded-lg px-3 text-xs"
                onClick={() => onApprove(record.id)}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-9 rounded-lg px-3 text-xs"
                onClick={() => onReject(record.id)}
              >
                Reject
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
