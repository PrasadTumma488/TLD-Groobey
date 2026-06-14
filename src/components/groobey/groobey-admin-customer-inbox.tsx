import { ChevronRight, Phone, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { EM_DASH } from "@/lib/groobey-currency";
import { formatGroobeyDateShort } from "@/lib/groobey-datetime";

export type AdminCustomerRow = {
  key: string;
  name: string;
  phone: string;
  address: string;
  count: number;
  pending: number;
  active: number;
  lastOrder: string;
};

const CUSTOMER_PAGE_SIZE = 12;

function CustomerBadges({ customer }: { customer: AdminCustomerRow }) {
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

export function AdminCustomerInbox({
  customers,
  onOpenCustomer,
}: {
  customers: AdminCustomerRow[];
  onOpenCustomer: (customer: AdminCustomerRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(CUSTOMER_PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [customers, query]);

  useEffect(() => {
    setVisibleCount(CUSTOMER_PAGE_SIZE);
  }, [query]);

  const visible = filtered.slice(0, visibleCount);
  const hiddenCount = Math.max(0, filtered.length - visible.length);
  const showScrollBox = filtered.length > 6;

  if (!customers.length) {
    return (
      <div className="groobey-admin-inbox-empty">
        <UserRound className="size-8 opacity-40" aria-hidden />
        <p className="groobey-admin-inbox-empty-title">No customers yet</p>
        <p className="groobey-admin-inbox-empty-text">Online shop orders will appear here.</p>
      </div>
    );
  }

  return (
    <div className="groobey-admin-customer-directory space-y-3">
      <p className="text-center text-xs font-semibold text-muted-foreground sm:text-left">
        Tap a shopper to open their profile, bills, and orders — same as delivery team.
      </p>

      <div className="groobey-admin-inbox-toolbar">
        <label className="groobey-admin-inbox-search">
          <Search className="size-3.5 shrink-0 opacity-60" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, address…"
            autoComplete="off"
          />
        </label>
        <p className="groobey-admin-inbox-count">
          {filtered.length} shopper{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      <div
        className={
          showScrollBox ?
            "groobey-admin-customer-scroll groobey-scrollbar"
          : "groobey-admin-customer-scroll groobey-admin-customer-scroll--open"
        }
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
                  <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs font-semibold text-muted-foreground">
                    <Phone className="size-3 shrink-0" aria-hidden />
                    {customer.phone}
                  </p>
                  <CustomerBadges customer={customer} />
                  <p className="groobey-admin-inbox-date mt-1">Last order {last}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {customer.pending > 0 ?
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                      Pending
                    </span>
                  : customer.active > 0 ?
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      Active
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
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Phone</th>
                <th className="px-4 py-2.5 font-semibold">Orders</th>
                <th className="px-4 py-2.5 font-semibold">Last order</th>
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
                    <td className="max-w-[9rem] truncate px-4 py-3 text-sm">{customer.phone}</td>
                    <td className="px-4 py-3">
                      <CustomerBadges customer={customer} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-muted-foreground">
                      {last}
                    </td>
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
          Showing {visible.length} of {filtered.length}
          {showScrollBox ? " · scroll inside the list for more" : ""}
        </p>
        {hiddenCount > 0 ?
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-lg px-3 text-xs font-bold"
            onClick={() => setVisibleCount((n) => n + CUSTOMER_PAGE_SIZE)}
          >
            Show more ({hiddenCount} left)
          </Button>
        : filtered.length > CUSTOMER_PAGE_SIZE ?
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
