/** Groobey Bill ID - YYMMDD-NN (Asia/Kolkata day, daily sequence from 01). */

export type GroobeyBillStream = "sale" | "customer_order" | "legacy";

const BILL_DAY_IST = "Asia/Kolkata";

/** Legacy prefixes (pre–daily format); still recognized for search. */
export const GROOBEY_BILL_PREFIX = {
  sale: "GB",
  customer_order: "GCO",
  saleLegacyGbs: "GBS",
  legacy: "GB",
} as const;

export const GROOBEY_BILL_STREAM_LABEL: Record<GroobeyBillStream, string> = {
  sale: "Shop sale",
  customer_order: "Customer order",
  legacy: "Bill",
};

const DAILY_BILL_ID_RE = /^(\d{6})-(\d+)$/;

/** Calendar day key YYMMDD in Asia/Kolkata (matches DB `groobey_bill_day_ist`). */
export function groobeyBillDayKeyIst(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BILL_DAY_IST,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "00";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}${m}${d}`;
}

/** Example for UI placeholders: 260516-01 */
export function exampleBillIdForNow(): string {
  return `${groobeyBillDayKeyIst()}-01`;
}

export function isDailyGroobeyBillNumber(billNumber: string | null | undefined): boolean {
  const raw = billNumber?.trim() ?? "";
  return DAILY_BILL_ID_RE.test(raw);
}

export function billStreamFromNumber(billNumber: string | null | undefined): GroobeyBillStream | null {
  const raw = billNumber?.trim().toUpperCase() ?? "";
  if (!raw || isDailyGroobeyBillNumber(raw)) return null;
  if (raw.startsWith(`${GROOBEY_BILL_PREFIX.customer_order}-`)) return "customer_order";
  if (raw.startsWith(`${GROOBEY_BILL_PREFIX.saleLegacyGbs}-`)) return "sale";
  if (raw.startsWith(`${GROOBEY_BILL_PREFIX.sale}-`)) return "sale";
  return null;
}

export function displayBillId(
  billNumber: string | null | undefined,
  fallback = "-",
): string {
  const id = billNumber?.trim();
  return id || fallback;
}

export function billStreamLabel(billNumber: string | null | undefined): string {
  const stream = billStreamFromNumber(billNumber);
  return stream ? GROOBEY_BILL_STREAM_LABEL[stream] : "Bill ID";
}

export function isMissingBillRpcError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("next_groobey_daily_bill_number") ||
    m.includes("next_groobey_customer_order_bill_number") ||
    m.includes("next_groobey_sale_bill_number") ||
    m.includes("next_groobey_bill_number")
  );
}

type BillRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, never>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

async function allocateBillNumber(
  client: BillRpcClient,
  rpcNames: string[],
): Promise<{ billNo: string | null; error: { message: string } | null }> {
  let lastError: { message: string } | null = null;
  for (const fn of rpcNames) {
    const res = await client.rpc(fn);
    if (!res.error) {
      return {
        billNo: typeof res.data === "string" ? res.data : null,
        error: null,
      };
    }
    lastError = res.error;
    if (!isMissingBillRpcError(res.error.message)) {
      return { billNo: null, error: res.error };
    }
  }
  return { billNo: null, error: lastError };
}

/** Shop sales and customer orders share one daily YYMMDD-NN stream. */
export function allocateCustomerOrderBillNumber(client: BillRpcClient) {
  return allocateBillNumber(client, [
    "next_groobey_customer_order_bill_number",
    "next_groobey_daily_bill_number",
    "next_groobey_bill_number",
  ]);
}

export function allocateSaleBillNumber(client: BillRpcClient) {
  return allocateBillNumber(client, [
    "next_groobey_sale_bill_number",
    "next_groobey_daily_bill_number",
    "next_groobey_bill_number",
  ]);
}

/** Wrap typed Supabase client for bill RPC helpers. */
export function asBillRpcClient<T extends { rpc: (...args: never[]) => unknown }>(client: T): BillRpcClient {
  return client as unknown as BillRpcClient;
}
