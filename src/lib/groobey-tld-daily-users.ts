import type { Database } from "@/integrations/supabase/types";
import { EM_DASH } from "@/lib/groobey-currency";
import { calendarMonthKey, orderCreatedInMonth } from "@/lib/groobey-order-month";
import { resolveTldUserId } from "@/lib/groobey-tld-user-account";

import type { AdminCustomerRow } from "@/components/groobey/groobey-admin-customer-inbox";

type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];

export type TldCustomerAccount = {
  userId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  groobeyId: string | null;
  joinedAt: string | null;
  isActive: boolean;
};

export function mergeTldDailyUserRows(
  accounts: TldCustomerAccount[],
  orders: CustomerOrder[],
  monthKey: string = calendarMonthKey(),
): AdminCustomerRow[] {
  const monthlyOrders = orders.filter((order) => orderCreatedInMonth(order, monthKey));
  const monthlyCountByUser = new Map<string, number>();
  const lastOrderByUser = new Map<string, string>();

  for (const order of monthlyOrders) {
    const userId = order.created_by;
    if (!userId) continue;
    monthlyCountByUser.set(userId, (monthlyCountByUser.get(userId) ?? 0) + 1);
    const created = order.created_at || "";
    const prev = lastOrderByUser.get(userId) || "";
    if (created > prev) lastOrderByUser.set(userId, created);
  }

  return accounts
    .map((account) => {
      const monthlyCount = monthlyCountByUser.get(account.userId) ?? 0;
      const groobeyId = account.groobeyId?.trim() || null;
      return {
        key: `user:${account.userId}`,
        userId: account.userId,
        name: account.displayName.trim() || account.email?.split("@")[0] || "TLD member",
        phone: account.phone?.trim() || account.email?.trim() || EM_DASH,
        address: account.address?.trim() || EM_DASH,
        email: account.email,
        groobeyId,
        tldUserId: resolveTldUserId(groobeyId, account.userId),
        joinedAt: account.joinedAt,
        isActive: account.isActive,
        count: monthlyCount,
        pending: 0,
        active: 0,
        lastOrder: lastOrderByUser.get(account.userId) ?? "",
        kind: "tld-account" as const,
        monthKey,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const aJoin = a.joinedAt || "";
      const bJoin = b.joinedAt || "";
      if (aJoin !== bJoin) return bJoin.localeCompare(aJoin);
      return a.name.localeCompare(b.name);
    });
}
