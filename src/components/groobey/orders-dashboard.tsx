import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  ClipboardList,
  Copy,
  Download,
  IndianRupee,
  Loader2,
  Mail,
  PhoneCall,
  Plus,
  Printer,
  Search,
  UserRound,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GroobeyDashboardHeader } from "@/components/groobey/groobey-brand-logo";
import { OrderTakerWorkspace } from "@/components/groobey/order-taker-workspace";
import { StaffIdentityCard } from "@/components/groobey/staff-identity-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { GroobeyBillEmailStatus } from "@/components/groobey/groobey-bill-email-status";
import { BillKindButtons } from "@/components/groobey/groobey-bill-buttons";
import {
  customerOrderItemsForBillEmail,
  formatStaffBillLabel,
  printCustomerOrderBill,
  type BillKind,
} from "@/lib/groobey-dual-bill";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import { allocateCustomerOrderBillNumber, asBillRpcClient } from "@/lib/groobey-bill-id";
import { billMatchesQuery } from "@/lib/groobey-bill-lookup";
import { runCustomerOrderBillBackfill, ordersMissingBillId } from "@/lib/groobey-bill-backfill";
import {
  CUSTOMER_ORDER_SELECT,
  CUSTOMER_ORDER_SELECT_LEGACY,
  isMissingCustomerOrderShopIdError,
  notesWithShopFallback,
} from "@/lib/groobey-customer-order-columns";
import type {
  BillPreviewEmailResult,
  BillPreviewShowOptions,
} from "@/lib/groobey-bill-preview-bridge";
import { clampMarginPercent, schemaSetupHint, tradeAmountFromRetail } from "@/lib/groobey-trade-margin";
import { sendCustomerBillEmail } from "@/lib/tldGroobey.functions";

import { InlineFeedback, Message, Panel, Stat } from "./workspace-ui";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Order takers hand off to delivery staff — cannot mark delivered. */
const orderTakerNextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["cancelled"],
  delivered: [],
  cancelled: [],
};

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

type StatusFilter = "all" | OrderStatus | "active";

function isActiveStatus(status: OrderStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}

export function OrdersDashboard() {
  const sendBillEmail = useServerFn(sendCustomerBillEmail);
  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formResetNonce, setFormResetNonce] = useState(0);
  const [shopIdColumnReady, setShopIdColumnReady] = useState(true);
  const shopIdColumnReadyRef = useRef(true);
  const [saving, setSaving] = useState(false);
  const [emailingOrderId, setEmailingOrderId] = useState<string | null>(null);
  const [pageAlert, setPageAlert] = useState<{ error?: string; notice?: string }>({});
  const [orderFormAlert, setOrderFormAlert] = useState<{ error?: string; notice?: string }>({});
  const [billTabAlert, setBillTabAlert] = useState<{ error?: string; notice?: string }>({});
  const [queueAlert, setQueueAlert] = useState<{ error?: string; notice?: string }>({});
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);
  const [focusBillOrderId, setFocusBillOrderId] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const loadInFlight = useRef(false);
  const backfillAttempted = useRef(false);
  const pendingBillMergeRef = useRef<{ orderId: string; billNumber: string } | null>(null);
  const [backfillingBills, setBackfillingBills] = useState(false);

  const missingBillCount = useMemo(() => ordersMissingBillId(orders).length, [orders]);

  const load = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (!hasLoaded.current) setLoading(true);
    setPageAlert({});
    try {
      const productsReq = supabase.from("products").select("*").order("name");

      async function fetchOrders() {
        let r = shopIdColumnReadyRef.current
          ? await supabase
              .from("customer_orders")
              .select(CUSTOMER_ORDER_SELECT)
              .eq("created_by", session.user.id)
              .order("created_at", { ascending: false })
              .limit(200)
          : await supabase
              .from("customer_orders")
              .select(CUSTOMER_ORDER_SELECT_LEGACY)
              .eq("created_by", session.user.id)
              .order("created_at", { ascending: false })
              .limit(200);
        if (
          r.error &&
          shopIdColumnReadyRef.current &&
          isMissingCustomerOrderShopIdError(r.error.message)
        ) {
          shopIdColumnReadyRef.current = false;
          setShopIdColumnReady(false);
          r = await supabase
            .from("customer_orders")
            .select(CUSTOMER_ORDER_SELECT_LEGACY)
            .eq("created_by", session.user.id)
            .order("created_at", { ascending: false })
            .limit(200);
        }
        return r;
      }

      const [profileRes, shopsRes, ordersRes, productsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,display_name,email,phone,groobey_code,trade_margin_percent")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase.from("shops").select("id,name").eq("is_active", true).order("name"),
        fetchOrders(),
        productsReq,
      ]);
      const err =
        profileRes.error?.message ||
        ordersRes.error?.message ||
        shopsRes.error?.message ||
        productsRes.error?.message;
      if (err) {
        const hint = schemaSetupHint(err);
        setPageAlert({ error: hint ?? err });
        return;
      }
      setProfile((profileRes.data ?? null) as Profile | null);
      const loaded = (ordersRes.data ?? []) as CustomerOrder[];
      const pendingMerge = pendingBillMergeRef.current;
      setOrders(
        pendingMerge ?
          loaded.map((o) =>
            o.id === pendingMerge.orderId && !o.bill_number?.trim() ?
              { ...o, bill_number: pendingMerge.billNumber }
            : o,
          )
        : loaded,
      );
      if (pendingMerge && loaded.some((o) => o.id === pendingMerge.orderId && o.bill_number?.trim())) {
        pendingBillMergeRef.current = null;
      }
      setShops((shopsRes.data ?? []) as Shop[]);
      hasLoaded.current = true;
      setLoading(false);

      if (!productsRes.error) setProducts((productsRes.data ?? []) as ProductRow[]);
    } catch (e) {
      setPageAlert({
        error: e instanceof Error ? e.message : "Unable to load orders workspace.",
      });
    } finally {
      loadInFlight.current = false;
      if (!hasLoaded.current) setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runBillBackfill = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!session?.user || backfillingBills) return;
      const missing = ordersMissingBillId(orders);
      if (!missing.length) return;
      setBackfillingBills(true);
      if (!opts?.silent) setBillTabAlert({});
      try {
        const result = await runCustomerOrderBillBackfill(supabase, orders);
        if (result.error) {
          const hint = schemaSetupHint(result.error);
          setBillTabAlert({ error: hint ?? result.error });
          return;
        }
        if (result.count > 0) {
          setBillTabAlert({
            notice: `Assigned ${result.count} Bill ID${result.count === 1 ? "" : "s"} (e.g. 260516-01).`,
          });
          await load();
        } else if (!opts?.silent) {
          setBillTabAlert({ notice: "No missing Bill IDs to assign." });
        }
      } finally {
        setBackfillingBills(false);
      }
    },
    [backfillingBills, load, orders, session?.user],
  );

  useEffect(() => {
    if (!hasLoaded.current || !session?.user || backfillAttempted.current) return;
    if (!missingBillCount) return;
    backfillAttempted.current = true;
    void runBillBackfill({ silent: true });
  }, [missingBillCount, runBillBackfill, session?.user]);

  useEffect(() => {
    if (!session?.user) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, session?.user]);

  const orderTakerName = useMemo(
    () =>
      profile?.display_name?.trim() ||
      String(session?.user?.user_metadata?.display_name || "").trim() ||
      "Order Taker",
    [profile?.display_name, session?.user?.user_metadata?.display_name],
  );

  const adminMarginPercent = clampMarginPercent(Number(profile?.trade_margin_percent ?? 0));
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const todayOrders = useMemo(
    () => orders.filter((o) => (o.created_at || "").slice(0, 10) === today),
    [orders, today],
  );
  const monthOrders = useMemo(
    () => orders.filter((o) => (o.created_at || "").slice(0, 7) === month),
    [orders, month],
  );
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const activeCount = orders.filter((o) => isActiveStatus(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const todayRetail = todayOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const monthRetail = monthOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter === "active" && !isActiveStatus(order.status)) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && order.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      if (order.bill_number?.trim() && billMatchesQuery(order.bill_number, orderSearch.trim())) {
        return true;
      }
      const hay = [
        order.customer_name,
        order.customer_phone,
        order.delivery_address,
        order.order_items,
        order.bill_number,
        order.notes,
        statusLabel[order.status],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [orders, orderSearch, statusFilter]);

  const orderTakerBillLabel = useMemo(
    () =>
      formatStaffBillLabel({
        displayName: orderTakerName,
        groobeyCode: profile?.groobey_code ?? null,
      }),
    [orderTakerName, profile?.groobey_code],
  );

  const shopNameById = useMemo(
    () => new Map(shops.map((s) => [s.id, s.name] as const)),
    [shops],
  );

  async function sendOrderBillEmail(
    order: CustomerOrder,
    customerEmail: string,
  ): Promise<BillPreviewEmailResult> {
    if (!session?.access_token) return { error: "Not signed in." };
    const trimmed = customerEmail.trim();
    if (!trimmed) {
      return { error: "Enter the customer's email address before sending the bill." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: "Invalid email address." };
    }
    try {
      const retail = Number(order.total_amount || 0);
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail: trimmed,
          subject: `Bill ${order.bill_number || ""} — ${GROOBEY_APP_NAME}`.trim(),
          shopName: GROOBEY_APP_NAME,
          ownerName: orderTakerBillLabel,
          billDate: (order.created_at || "").slice(0, 16),
          billKind: "customer",
          billNumber: order.bill_number?.trim() || undefined,
          items: customerOrderItemsForBillEmail(order.order_items, retail),
        },
      });
      return { notice: `Customer bill emailed to ${result.deliveredTo}.` };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Unable to send bill email.",
      };
    }
  }

  function orderBillPreviewOptions(order: CustomerOrder): BillPreviewShowOptions | undefined {
    if (!session?.access_token) return undefined;
    const defaultEmail =
      order.customer_phone?.includes("@") ? order.customer_phone.trim() : "";
    return {
      email: {
        defaultEmail,
        send: (customerEmail) => sendOrderBillEmail(order, customerEmail),
      },
    };
  }

  function printOrderBill(order: CustomerOrder, kind: BillKind): boolean {
    const shopName = order.shop_id ? shops.find((s) => s.id === order.shop_id)?.name : undefined;
    return printCustomerOrderBill({
      kind,
      order,
      shopName: shopName ?? null,
      orderTakerLabel: orderTakerBillLabel,
      preview: kind === "customer" ? orderBillPreviewOptions(order) : undefined,
    });
  }

  function printCustomerBill(order: CustomerOrder): boolean {
    return printOrderBill(order, "customer");
  }

  async function emailCustomerBill(order: CustomerOrder, customerEmailInput?: string) {
    if (!session?.access_token) return;
    if (customerEmailInput === undefined) {
      printCustomerBill(order);
      return;
    }
    setEmailingOrderId(order.id);
    setBillTabAlert({});
    const result = await sendOrderBillEmail(order, customerEmailInput);
    if (result.error) setBillTabAlert({ error: result.error });
    else if (result.notice) setBillTabAlert({ notice: result.notice });
    setEmailingOrderId(null);
  }

  function copyBillNumber(billNumber: string | null, forBillTab = false) {
    if (!billNumber?.trim()) return;
    void navigator.clipboard.writeText(billNumber.trim()).then(
      () => {
        const notice = `Copied bill ID ${billNumber}.`;
        if (forBillTab) setBillTabAlert({ notice });
        else setQueueAlert({ notice });
      },
      () => {
        const error = "Could not copy to clipboard.";
        if (forBillTab) setBillTabAlert({ error });
        else setQueueAlert({ error });
      },
    );
  }

  function exportOrdersCsv() {
    const header = [
      "bill_number",
      "customer_name",
      "customer_phone",
      "status",
      "retail_total",
      "required_date",
      "created_at",
    ].join(",");
    const body = filteredOrders.map((o) =>
      [
        o.bill_number ?? "",
        (o.customer_name || "").replace(/,/g, " "),
        (o.customer_phone || "").replace(/,/g, " "),
        o.status,
        String(Math.round(Number(o.total_amount || 0))),
        o.required_date ?? "",
        (o.created_at || "").slice(0, 16),
      ].join(","),
    );
    const blob = new Blob([[header, ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-orders-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setQueueAlert({ notice: `Exported ${filteredOrders.length} order(s).` });
  }

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user) return;
    setSaving(true);
    setOrderFormAlert({});
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const customerName = String(form.get("customerName") || "").trim();
    const customerPhone = String(form.get("customerPhone") || "").trim();
    const deliveryAddress = String(form.get("deliveryAddress") || "").trim();
    const shopId = String(form.get("shopId") || "").trim();
    const orderItems = String(form.get("orderItems") || "").trim();
    const totalAmount = Number(form.get("totalAmount") || 0);
    const requiredDate = String(form.get("requiredDate") || "").trim();
    const notes = String(form.get("notes") || "").trim();

    if (!customerName) {
      setSaving(false);
      setOrderFormAlert({ error: "Customer name is required." });
      return;
    }
    const resolvedShopId =
      shopId || (shopIdColumnReady && shops.length === 1 ? shops[0]?.id : "") || "";
    if (shopIdColumnReady && shops.length > 1 && !resolvedShopId) {
      setSaving(false);
      setOrderFormAlert({ error: "No shop configured — ask Platform Admin." });
      return;
    }
    if (!orderItems) {
      setSaving(false);
      setOrderFormAlert({ error: "Add at least one grocery item from the catalog." });
      return;
    }

    const { billNo, error: rpcErr } = await allocateCustomerOrderBillNumber(asBillRpcClient(supabase));
    if (rpcErr) {
      setSaving(false);
      const hint = schemaSetupHint(rpcErr.message);
      setOrderFormAlert({ error: hint ?? rpcErr.message });
      return;
    }
    if (typeof billNo !== "string" || !billNo) {
      setSaving(false);
      setOrderFormAlert({ error: "Could not assign bill number." });
      return;
    }

    const retail = Number.isFinite(totalAmount) ? Math.max(0, totalAmount) : 0;
    const marginPct = adminMarginPercent;
    const trade = tradeAmountFromRetail(retail, marginPct);
    const shopName = resolvedShopId ? shops.find((s) => s.id === resolvedShopId)?.name : undefined;
    const orderNotes = shopIdColumnReady
      ? notes || null
      : notesWithShopFallback(shopName, notes);

    const baseRow = {
      created_by: session.user.id,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      delivery_address: deliveryAddress || null,
      order_items: orderItems,
      total_amount: retail,
      merchant_settlement_amount: trade,
      trade_margin_percent_applied: marginPct,
      bill_number: billNo,
      required_date: requiredDate || null,
      notes: orderNotes,
      status: "pending" as const,
    };

    let inserted: { id: string } | null = null;
    let insertError: { message: string } | null = null;

    if (shopIdColumnReady) {
      const res = await supabase
        .from("customer_orders")
        .insert({ ...baseRow, shop_id: resolvedShopId || null } as never)
        .select("id")
        .single();
      inserted = res.data as { id: string } | null;
      insertError = res.error;
      if (
        insertError &&
        isMissingCustomerOrderShopIdError(insertError.message)
      ) {
        setShopIdColumnReady(false);
        const fallback = await supabase
          .from("customer_orders")
          .insert({
            ...baseRow,
            notes: notesWithShopFallback(shopName, notes),
          } as never)
          .select("id")
          .single();
        inserted = fallback.data as { id: string } | null;
        insertError = fallback.error;
      }
    } else {
      const res = await supabase
        .from("customer_orders")
        .insert({
          ...baseRow,
          notes: notesWithShopFallback(shopName, notes),
        } as never)
        .select("id")
        .single();
      inserted = res.data as { id: string } | null;
      insertError = res.error;
    }

    setSaving(false);
    if (insertError) {
      const hint = schemaSetupHint(insertError.message);
      setOrderFormAlert({ error: hint ?? insertError.message });
      return;
    }
    const newId = (inserted as { id: string } | null)?.id ?? null;
    setLastCreatedOrderId(newId);
    setFormResetNonce((n) => n + 1);
    setOrderFormAlert({
      notice: `Order created — Bill ${billNo}, total ₹${Math.round(retail)}. Print or email from the bill panel.`,
    });
    formElement.reset();
    if (newId) {
      const draft: CustomerOrder = {
        id: newId,
        created_by: session.user.id,
        shop_id: resolvedShopId || null,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        delivery_address: deliveryAddress || null,
        order_items: orderItems,
        total_amount: retail,
        merchant_settlement_amount: trade,
        trade_margin_percent_applied: marginPct,
        bill_number: billNo,
        required_date: requiredDate || null,
        notes: notes || null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      pendingBillMergeRef.current = { orderId: newId, billNumber: billNo };
      setOrders((prev) => [draft, ...prev.filter((o) => o.id !== newId)]);
      setFocusBillOrderId(newId);
      printCustomerBill(draft);
    }
    void load();
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setQueueAlert({});
    const { error: updateError } = await supabase
      .from("customer_orders")
      .update({ status } as never)
      .eq("id", orderId)
      .eq("created_by", session?.user?.id || "");
    if (updateError) {
      setQueueAlert({ error: updateError.message });
      return;
    }
    setQueueAlert({ notice: `Order marked as ${statusLabel[status]}.` });
    setBillTabAlert({ notice: `Order marked as ${statusLabel[status]}.` });
    void load();
  }

  if (!session?.user) return null;

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "pending", label: "Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "packed", label: "Packed" },
    { id: "out_for_delivery", label: "Out for delivery" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <main className="groobey-shell min-h-screen text-foreground">
      <GroobeyDashboardHeader
        title="Orders dashboard"
        subtitle="Bill ID lookup · quick new orders"
        actions={
          <Button variant="outline" className="rounded-xl" onClick={() => supabase.auth.signOut()}>
            Logout
          </Button>
        }
      />

      <section className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 lg:px-10">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={PhoneCall} label="Pending" value={String(pendingCount)} />
          <Stat icon={ClipboardList} label="Active orders" value={String(activeCount)} />
          <Stat icon={IndianRupee} label="Today (retail)" value={`₹${Math.round(todayRetail)}`} />
          <Stat icon={CalendarDays} label="This month" value={`₹${Math.round(monthRetail)}`} />
        </section>

        <Message
          error=""
          notice=""
          loading={loading && !hasLoaded.current}
          refreshing={loading && hasLoaded.current}
          showAlerts={false}
        />
        <InlineFeedback {...pageAlert} />

        <StaffIdentityCard
          title="Your order taker details"
          icon={UserRound}
          subtitle="Name and login are managed by Platform Admin. Groobey margin (if any) is set by admin — you only manage customer orders and bills here."
          rows={[
            { label: "Order taker name", value: orderTakerName },
            { label: "Email", value: profile?.email?.trim() || session.user.email || "—" },
            { label: "Groobey ID", value: profile?.groobey_code?.trim() || "—" },
            { label: "Mobile", value: profile?.phone?.trim() || "—" },
            { label: "Delivered (all time)", value: String(deliveredCount) },
          ]}
        />

        <Tabs defaultValue="bill" className="w-full">
          <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 p-1 sm:max-w-md">
            <TabsTrigger value="bill" className="min-h-10 gap-1.5 text-sm">
              <ClipboardList className="size-4 shrink-0" /> Bill &amp; new order
            </TabsTrigger>
            <TabsTrigger value="orders" className="min-h-10 gap-1.5 text-sm">
              <Search className="size-4 shrink-0" /> All orders ({orders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bill" className="mt-0 space-y-3">
            <GroobeyBillEmailStatus accessToken={session.access_token} />
            <Panel title="Bill ID" icon={ClipboardList}>
              <OrderTakerWorkspace
                orders={orders}
                products={products}
                shops={shops}
                defaultShopId={shops[0]?.id ?? ""}
                ordersLoading={loading && !hasLoaded.current}
                missingBillCount={missingBillCount}
                backfillingBills={backfillingBills}
                resetNonce={formResetNonce}
                saving={saving}
                feedback={orderFormAlert}
                billActionFeedback={billTabAlert}
                emailingOrderId={emailingOrderId}
                nextStatuses={orderTakerNextStatuses}
                onSubmit={handleCreateOrder}
                onPrintBill={(order, kind) => {
                  const opened = printOrderBill(order, kind);
                  if (opened) {
                    setBillTabAlert({
                      notice:
                        kind === "merchant" ?
                          "Settlement bill opened — same Bill ID as customer copy."
                        : "Bill preview opened — print or email from the panel.",
                    });
                  }
                }}
                onEmailBill={(order, email) => void emailCustomerBill(order, email)}
                onCopyBillId={(billNumber) => copyBillNumber(billNumber, true)}
                onUpdateStatus={(id, status) => void updateStatus(id, status)}
                onBackfillMissingBills={() => runBillBackfill()}
                focusOrderId={focusBillOrderId}
                onFocusOrderHandled={() => setFocusBillOrderId(null)}
              />
            </Panel>
          </TabsContent>

          <TabsContent value="orders" className="mt-0 space-y-4">
            <Panel title="Search & export" icon={Search}>
              <div className="grid gap-3">
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by Bill ID or customer name…"
                  className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                  autoComplete="off"
                />
                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((f) => (
                    <Button
                      key={f.id}
                      type="button"
                      size="sm"
                      variant={statusFilter === f.id ? "groobey" : "outline"}
                      className="h-8 rounded-lg text-xs"
                      onClick={() => setStatusFilter(f.id)}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 rounded-xl"
                    onClick={exportOrdersCsv}
                    disabled={!filteredOrders.length}
                  >
                    <Download className="size-4" /> Export CSV ({filteredOrders.length})
                  </Button>
                </div>
              </div>
            </Panel>

            <Panel
              title={`Orders (${filteredOrders.length}${filteredOrders.length !== orders.length ? ` of ${orders.length}` : ""})`}
              icon={ClipboardList}
              feedback={queueAlert}
            >
              {filteredOrders.length === 0 ?
                <p className="text-sm font-semibold text-muted-foreground">No orders match.</p>
              : <div className="space-y-3">
                  {filteredOrders.map((order) => {
                    const isNew = order.id === lastCreatedOrderId;
                    return (
                      <div
                        key={order.id}
                        className={`rounded-xl border bg-card/70 p-3 ${
                          isNew ? "border-primary ring-2 ring-primary/20" : "border-border"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-lg font-black text-primary">
                              {order.bill_number || "No bill ID"}
                            </p>
                            <p className="mt-0.5 text-sm font-bold text-foreground">
                              {order.customer_name} · ₹
                              {Math.round(Number(order.total_amount || 0))}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[order.status]}`}
                          >
                            {statusLabel[order.status]}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold text-muted-foreground">
                          {order.order_items}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <BillKindButtons onPrint={(kind) => printOrderBill(order, kind)} />
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-10 rounded-xl"
                            onClick={() => void emailCustomerBill(order)}
                            disabled={emailingOrderId === order.id}
                          >
                            {emailingOrderId === order.id ?
                              <Loader2 className="size-4 animate-spin" />
                            : <Mail className="size-4" />}{" "}
                            Email bill
                          </Button>
                          {order.bill_number ?
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-10 rounded-xl"
                              onClick={() => copyBillNumber(order.bill_number)}
                            >
                              <Copy className="size-4" /> Copy bill ID
                            </Button>
                          : null}
                        </div>
                        {orderTakerNextStatuses[order.status].length ?
                          <div className="mt-2 flex flex-wrap gap-2 border-t border-border/60 pt-2">
                            {orderTakerNextStatuses[order.status].map((s) => (
                              <Button
                                key={s}
                                type="button"
                                variant={s === "cancelled" ? "outline" : "calm"}
                                className="h-8 rounded-lg text-xs"
                                onClick={() => void updateStatus(order.id, s)}
                              >
                                Mark {statusLabel[s]}
                              </Button>
                            ))}
                          </div>
                        : null}
                      </div>
                    );
                  })}
                </div>
              }
            </Panel>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
