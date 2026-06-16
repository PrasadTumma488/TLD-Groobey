import type { Database } from "@/integrations/supabase/types";
import { formatGroobeyDateTime } from "@/lib/groobey-datetime";
import { groobeyBillDayKeyIst } from "@/lib/groobey-bill-id";
import {
  calendarMonthKey,
  formatCalendarMonthLabel,
  orderCreatedInMonth,
} from "@/lib/groobey-order-month";

type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const TLD_USER_ID_LABEL = "TLD User ID";

const TLD_USER_ID_RE = /^TLD-USER-(\d{6})-(\d+)$/i;

/** Staff / delivery codes must not show on shopper accounts. */
export function isStaffGroobeyCode(code: string): boolean {
  return /TLDG-(PA|SO|OT|DB|SM)-/i.test(code) || /-DB-/i.test(code);
}

export function isValidTldUserId(code: string | null | undefined): boolean {
  return Boolean(code?.trim() && TLD_USER_ID_RE.test(code.trim()));
}

/** Parse TLD-USER-260608-01 → day 260608, seq 1 (same YYMMDD as Bill IDs). */
export function parseTldUserId(tldUserId: string): { dayKey: string; seq: number } | null {
  const match = tldUserId.trim().match(TLD_USER_ID_RE);
  if (!match) return null;
  return { dayKey: match[1], seq: Number(match[2]) };
}

/** Format: TLD-USER-YYMMDD-NN — date + daily signup number (like 260608-01 bills). */
export function formatTldUserId(dayKey: string, dailySeq: number): string {
  return `TLD-USER-${dayKey}-${String(Math.max(1, dailySeq)).padStart(2, "0")}`;
}

/** e.g. User 1 · 8 Jun */
export function tldUserNumberLabel(tldUserId: string): string {
  const parsed = parseTldUserId(tldUserId);
  if (!parsed) return "TLD member";
  const yy = Number(parsed.dayKey.slice(0, 2));
  const mm = Number(parsed.dayKey.slice(2, 4));
  const dd = Number(parsed.dayKey.slice(4, 6));
  const monthLabel = formatCalendarMonthLabel(`20${yy}-${String(mm).padStart(2, "0")}`);
  return `User ${parsed.seq} · ${dd} ${monthLabel.split(" ")[0]}`;
}

/** Customer-facing id from profile (assigned in DB). */
export function resolveTldUserId(
  groobeyId: string | null | undefined,
  _userId: string,
): string {
  const code = groobeyId?.trim();
  if (code && isValidTldUserId(code)) return code.toUpperCase();
  return "Assigning…";
}

export function previewTldUserId(joinedAt: string | null | undefined, dailySeq: number): string {
  const dayKey = joinedAt ? groobeyBillDayKeyIst(new Date(joinedAt)) : groobeyBillDayKeyIst();
  return formatTldUserId(dayKey, dailySeq);
}

export type TldUserAccountSummary = {
  userId: string;
  tldUserId: string;
  userNumberLabel: string;
  groobeyId: string | null;
  hasPermanentGroobeyId: boolean;
  displayName: string;
  email: string | null;
  phone: string | null;
  defaultAddress: string | null;
  joinedAt: string | null;
  joinedLabel: string;
  isActive: boolean;
  monthKey: string;
  monthLabel: string;
  monthlyOrders: number;
  lastOrderThisMonth: string | null;
  lastOrderThisMonthLabel: string;
};

export function buildTldUserAccountSummary(
  profile: Pick<
    Profile,
    | "user_id"
    | "display_name"
    | "email"
    | "phone"
    | "default_address"
    | "groobey_code"
    | "created_at"
    | "is_active"
  >,
  orders: Pick<CustomerOrder, "created_at" | "created_by">[],
  monthKey: string = calendarMonthKey(),
): TldUserAccountSummary {
  const monthly = orders.filter(
    (order) => order.created_by === profile.user_id && orderCreatedInMonth(order, monthKey),
  );
  let lastOrderThisMonth: string | null = null;
  for (const order of monthly) {
    const created = order.created_at || "";
    if (!lastOrderThisMonth || created > lastOrderThisMonth) {
      lastOrderThisMonth = created;
    }
  }

  const groobeyId = profile.groobey_code?.trim() || null;
  const tldUserId = resolveTldUserId(groobeyId, profile.user_id);
  const hasPermanentGroobeyId = isValidTldUserId(groobeyId);

  return {
    userId: profile.user_id,
    tldUserId,
    userNumberLabel: hasPermanentGroobeyId ? tldUserNumberLabel(tldUserId) : "TLD member",
    groobeyId: hasPermanentGroobeyId ? groobeyId : null,
    hasPermanentGroobeyId,
    displayName: profile.display_name?.trim() || "TLD member",
    email: profile.email?.trim() || null,
    phone: profile.phone?.trim() || null,
    defaultAddress: profile.default_address?.trim() || null,
    joinedAt: profile.created_at ?? null,
    joinedLabel: profile.created_at ? formatGroobeyDateTime(profile.created_at) : "—",
    isActive: profile.is_active ?? true,
    monthKey,
    monthLabel: formatCalendarMonthLabel(monthKey),
    monthlyOrders: monthly.length,
    lastOrderThisMonth,
    lastOrderThisMonthLabel:
      lastOrderThisMonth ? formatGroobeyDateTime(lastOrderThisMonth) : "No orders this month yet",
  };
}
