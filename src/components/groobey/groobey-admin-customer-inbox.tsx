import { ChevronRight, Mail, Phone, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EM_DASH } from "@/lib/groobey-currency";
import { formatGroobeyDateShort } from "@/lib/groobey-datetime";
import { formatCalendarMonthLabel } from "@/lib/groobey-order-month";
import { TLD_USER_ID_LABEL } from "@/lib/groobey-tld-user-account";
import { cn } from "@/lib/utils";

export type AdminCustomerRow = {
  key: string;
  userId?: string | null;
  name: string;
  phone: string;
  address: string;
  email?: string | null;
  groobeyId?: string | null;
  /** Resolved TLD User ID (Groobey code or short user id). */
  tldUserId?: string | null;
  joinedAt?: string | null;
  isActive?: boolean;
  count: number;
  pending: number;
  active: number;
  lastOrder: string;
  kind?: "shopper" | "tld-account";
  monthKey?: string;
};

const CUSTOMER_PAGE_SIZE = 12;

function CustomerBadges({
  customer,
  variant,
}: {
  customer: AdminCustomerRow;
  variant: "shoppers" | "daily-users";
}) {
  if (variant === "daily-users") {
    return (
      <div className="groobey-admin-inbox-meta">
        <span className="groobey-admin-inbox-badge groobey-admin-inbox-badge--live">
          {customer.count} monthly order{customer.count === 1 ? "" : "s"}
        </span>
      </div>
    );
  }

  return (
    <div className="groobey-admin-inbox-meta">
      <span className="groobey-admin-inbox-badge">
        {customer.count} order{customer.count === 1 ? "" : "s"}
      </span>
      {customer.pending > 0 ?
        <span className="groobey-admin-inbox-badge groobey-admin-inbox-badge--warn">
          {customer.pending} pending
        </span>
      : null}
      {customer.active > 0 ?
        <span className="groobey-admin-inbox-badge groobey-admin-inbox-badge--live">
          {customer.active} active
        </span>
      : null}
    </div>
  );
}

function tldUserIdLabel(customer: AdminCustomerRow): string {
  return customer.tldUserId?.trim() || customer.groobeyId?.trim() || EM_DASH;
}

export function AdminCustomerInbox({
  customers,
  onOpenCustomer,
  variant = "shoppers",
}: {
  customers: AdminCustomerRow[];
  onOpenCustomer: (customer: AdminCustomerRow) => void;
  /** shoppers = order history · daily-users = TLD group accounts */
  variant?: "shoppers" | "daily-users";
}) {
  const isDailyUsers = variant === "daily-users";
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(CUSTOMER_PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.groobeyId?.toLowerCase().includes(q) ?? false) ||
        (c.tldUserId?.toLowerCase().includes(q) ?? false),
    );
  }, [customers, query]);

  useEffect(() => {
    setVisibleCount(CUSTOMER_PAGE_SIZE);
  }, [query]);

  const visible = isDailyUsers ? filtered : filtered.slice(0, visibleCount);
  const hiddenCount = isDailyUsers ? 0 : Math.max(0, filtered.length - visible.length);
  const showScrollBox = isDailyUsers ? filtered.length > 0 : filtered.length > 6;
  const monthLabel =
    isDailyUsers && customers[0]?.monthKey ?
      formatCalendarMonthLabel(customers[0].monthKey)
    : null;

  if (!customers.length) {
    return (
      <div className="groobey-admin-inbox-empty">
        <UserRound className="size-8 opacity-40" aria-hidden />
        <p className="groobey-admin-inbox-empty-title">
          {isDailyUsers ? "No TLD group accounts yet" : "No customers yet"}
        </p>
        <p className="groobey-admin-inbox-empty-text">
          {isDailyUsers ?
            "When someone signs up on TLD Groobey, their account appears here automatically."
          : "Online shop orders will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="groobey-admin-customer-directory space-y-3">
      <p className="text-center text-xs font-semibold text-muted-foreground sm:text-left">
        {isDailyUsers ?
          <>
            Tap a TLD group account for profile and bills — same popup as delivery team.
            {monthLabel ?
              <span className="mt-1 block font-bold text-foreground/80">
                Monthly orders · {monthLabel} (resets automatically next month)
              </span>
            : null}
            <span className="mt-1 block">
              {TLD_USER_ID_LABEL} looks like TLD-USER-260608-01 — signup date (IST) + daily number, same as bills.
            </span>
          </>
        : "Tap a shopper to open their profile, bills, and orders — same as delivery team."}
      </p>

      <div className="groobey-admin-inbox-toolbar">
        <label className="groobey-admin-inbox-search">
          <Search className="size-3.5 shrink-0 opacity-60" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isDailyUsers ? "Search name, email, phone…" : "Search name, phone, address…"
            }
            autoComplete="off"
          />
        </label>
        <p className="groobey-admin-inbox-count">
          {filtered.length} {isDailyUsers ? "account" : "shopper"}
          {filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <div
        className={cn(
          showScrollBox ?
            "groobey-admin-customer-scroll groobey-scrollbar"
          : "groobey-admin-customer-scroll groobey-admin-customer-scroll--open",
          isDailyUsers && "groobey-admin-customer-scroll--daily-users",
        )}
      >
        <div className="grid gap-2.5 lg:hidden">
          {visible.map((customer) => {
            const last = customer.lastOrder ? formatGroobeyDateShort(customer.lastOrder) : EM_DASH;
            return (
              <button
                key={customer.key}
                type="button"
                className="owner-admin-people-card"
                onClick={() => onOpenCustomer(customer)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black leading-tight">{customer.name}</p>
                  {isDailyUsers && customer.email ?
                    <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs font-semibold text-muted-foreground">
                      <Mail className="size-3 shrink-0" aria-hidden />
                      {customer.email}
                    </p>
                  : null}
                  {isDailyUsers ?
                    <p className="mt-0.5 font-mono text-[11px] font-bold text-sky-900">
                      {TLD_USER_ID_LABEL} · {tldUserIdLabel(customer)}
                    </p>
                  : null}
                  <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs font-semibold text-muted-foreground">
                    <Phone className="size-3 shrink-0" aria-hidden />
                    {customer.phone}
                  </p>
                  <CustomerBadges customer={customer} variant={variant} />
                  {!isDailyUsers ?
                    <p className="groobey-admin-inbox-date mt-1">Last order {last}</p>
                  : customer.lastOrder ?
                    <p className="groobey-admin-inbox-date mt-1">
                      Last this month {formatGroobeyDateShort(customer.lastOrder)}
                    </p>
                  : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {isDailyUsers && customer.isActive === false ?
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      Off
                    </span>
                  : customer.pending > 0 ?
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                      Pending
                    </span>
                  : customer.active > 0 ?
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      Active
                    </span>
                  : isDailyUsers ?
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-900">
                      TLD
                    </span>
                  : null}
                  <ChevronRight className="size-4 text-primary" aria-hidden />
                </div>
              </button>
            );
          })}
        </div>

        <div className="owner-admin-directory-table-wrap hidden lg:block">
          <table className="groobey-admin-customer-table text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">
                  {isDailyUsers ? "TLD account" : "Customer"}
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  {isDailyUsers ? "Contact" : "Phone"}
                </th>
                {isDailyUsers ?
                  <th className="px-4 py-2.5 font-semibold">{TLD_USER_ID_LABEL}</th>
                : null}
                <th className="px-4 py-2.5 font-semibold">
                  {isDailyUsers ? "Monthly orders" : "Orders"}
                </th>
                {!isDailyUsers ?
                  <th className="px-4 py-2.5 font-semibold">Last order</th>
                : null}
                <th className="w-12 px-2 py-2.5" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => {
                const last = customer.lastOrder ? formatGroobeyDateShort(customer.lastOrder) : EM_DASH;
                return (
                  <tr
                    key={customer.key}
                    className="border-b border-border/50 last:border-0"
                    onClick={() => onOpenCustomer(customer)}
                  >
                    <td className="max-w-[12rem] px-4 py-3">
                      <p className="truncate font-semibold">{customer.name}</p>
                      {customer.address && customer.address !== EM_DASH ?
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
                          {customer.address}
                        </p>
                      : null}
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-3 text-sm">
                      {isDailyUsers && customer.email ?
                        <p className="truncate font-semibold">{customer.email}</p>
                      : null}
                      <p className={cn("truncate", isDailyUsers && customer.email && "text-[11px] text-muted-foreground")}>
                        {customer.phone}
                      </p>
                    </td>
                    {isDailyUsers ?
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{tldUserIdLabel(customer)}</td>
                    : null}
                    <td className="px-4 py-3">
                      <CustomerBadges customer={customer} variant={variant} />
                    </td>
                    {!isDailyUsers ?
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">
                        {last}
                      </td>
                    : null}
                    <td className="px-2 py-3 text-primary">
                      <ChevronRight className="size-4" aria-hidden />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 ?
          <p className="py-6 text-center text-sm font-semibold text-muted-foreground">
            No shoppers match your search.
          </p>
        : null}
      </div>

      <div className="groobey-admin-customer-footer">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {isDailyUsers ?
            `${filtered.length} account${filtered.length === 1 ? "" : "s"} · scroll inside the list for more`
          : <>
              Showing {visible.length} of {filtered.length}
              {showScrollBox ? " · scroll inside the list for more" : ""}
            </>
          }
        </p>
        {!isDailyUsers && hiddenCount > 0 ?
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-lg px-3 text-xs font-bold"
            onClick={() => setVisibleCount((n) => n + CUSTOMER_PAGE_SIZE)}
          >
            Show more ({hiddenCount} left)
          </Button>
        : !isDailyUsers && filtered.length > CUSTOMER_PAGE_SIZE ?
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-lg px-3 text-xs font-bold"
            onClick={() => setVisibleCount(CUSTOMER_PAGE_SIZE)}
          >
            Show less
          </Button>
        : null}
      </div>
    </div>
  );
}
