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
  Package,
  Plus,
  Printer,
  Search,
  UserRound,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GroobeyDashboardHeader } from "@/components/groobey/groobey-brand-logo";
import { GroobeyNotificationBell } from "@/components/groobey/groobey-notification-bell";
import { OrderTakerWorkspace } from "@/components/groobey/order-taker-workspace";
import { StaffIdentityCard } from "@/components/groobey/staff-identity-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { BillKindButtons } from "@/components/groobey/groobey-bill-buttons";
import {
  customerOrderBillEmailOrderBill,
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
  CUSTOMER_ORDER_SELECT_WITHOUT_DELIVERY_EXTRA,
  isMissingCustomerOrderShopIdError,
  notesWithShopFallback,
} from "@/lib/groobey-customer-order-columns";
import {
  isMissingCustomerOrderDeliveryFieldsError,
  isValidCustomerMobile,
  parseCustomerOrderDeliveryFromForm,
} from "@/lib/groobey-delivery-order-fields";
import type {
  BillPreviewEmailResult,
  BillPreviewShowOptions,
} from "@/lib/groobey-bill-preview-bridge";
import {
  shopOwnerEmailForOrder,
} from "@/lib/groobey-shop-owner-email";
import { groobeySignOut } from "@/lib/groobey-auth-logout";
import { setGroobeyNotificationNavigate } from "@/lib/groobey-notification-nav";
import { clampMarginPercent, schemaSetupHint, tradeAmountFromRetail } from "@/lib/groobey-trade-margin";
import { useGroobeyWorkspaceNotifications } from "@/lib/groobey-workspace-notifications";
import { resolveShopOwnerEmails, sendCustomerBillEmail } from "@/lib/tldGroobey.functions";

import {
  OrderQueueCard,
  OrderStatusActionButtons,
  OrdersMonthScopeBanner,
  orderBillIdHighlightClass,
  orderBillShopHighlightClass,
} from "@/components/groobey/groobey-order-list-parts";
import { OrdersExcelExport } from "@/components/groobey/orders-excel-export";
import { InlineFeedback, Message, Panel, Stat } from "./workspace-ui";
import {
  calendarMonthKey,
  filterOrdersByCalendarMonth,
  formatCalendarMonthLabel,
  orderDisplayDate,
} from "@/lib/groobey-order-month";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Order takers confirm/cancel only - packed/delivered are delivery dashboard. */
const orderTakerNextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  packed: [],
  out_for_delivery: [],
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
type OrdersListPeriod = "all" | "today" | "month";

import { isOrderPipelineActive } from "@/lib/groobey-order-pipeline";

export function OrdersDashboard() {
  const sendBillEmail = useServerFn(sendCustomerBillEmail);
  const resolveShopEmailsFn = useServerFn(resolveShopOwnerEmails);
  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [formResetNonce, setFormResetNonce] = useState(0);
  const [shopIdColumnReady, setShopIdColumnReady] = useState(true);
  const shopIdColumnReadyRef = useRef(true);
  const deliveryFieldsReadyRef = useRef(true);
  const [saving, setSaving] = useState(false);
  const [shopOwnerEmailByShopId, setShopOwnerEmailByShopId] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [pageAlert, setPageAlert] = useState<{ error?: string; notice?: string }>({});
  const [orderFormAlert, setOrderFormAlert] = useState<{ error?: string; notice?: string }>({});
  const [billTabAlert, setBillTabAlert] = useState<{ error?: string; notice?: string }>({});
  const [queueAlert, setQueueAlert] = useState<{ error?: string; notice?: string }>({});
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [ordersListPeriod, setOrdersListPeriod] = useState<OrdersListPeriod>("month");
  const [dashboardTab, setDashboardTab] = useState("bill");
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);
  const [focusBillOrderId, setFocusBillOrderId] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const loadInFlight = useRef(false);
  const backfillAttempted = useRef(false);
  const pendingBillMergeRef = useRef<{ orderId: string; billNumber: string } | null>(null);
  const ordersSectionRef = useRef<HTMLElement>(null);
  const [backfillingBills, setBackfillingBills] = useState(false);

  const missingBillCount = useMemo(() => ordersMissingBillId(orders).length, [orders]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (hasLoaded.current) setLoading(true);
    if (!opts?.silent) setPageAlert({});
    try {
      const productsReq = supabase.from("products").select("*").order("name");

      async function fetchOrders() {
        let r = shopIdColumnReadyRef.current
          ? await supabase
              .from("customer_orders")
              .select(CUSTOMER_ORDER_SELECT)
              .eq("created_by", session.user.id)
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(200)
          : await supabase
              .from("customer_orders")
              .select(CUSTOMER_ORDER_SELECT_LEGACY)
              .eq("created_by", session.user.id)
              .is("deleted_at", null)
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
        if (
          r.error &&
          deliveryFieldsReadyRef.current &&
          isMissingCustomerOrderDeliveryFieldsError(r.error.message)
        ) {
          deliveryFieldsReadyRef.current = false;
          const fallbackSelect = shopIdColumnReadyRef.current
            ? CUSTOMER_ORDER_SELECT_WITHOUT_DELIVERY_EXTRA
            : CUSTOMER_ORDER_SELECT_LEGACY;
          r = await supabase
            .from("customer_orders")
            .select(fallbackSelect)
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
        supabase
          .from("shops")
          .select("id,name,created_by,trade_margin_percent")
          .eq("is_active", true)
          .order("name"),
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
      const loadedShops = (shopsRes.data ?? []) as Shop[];
      setShops(loadedShops);
      const accessToken = session.access_token?.trim() ?? "";
      if (accessToken && loadedShops.length) {
        try {
          const result = await resolveShopEmailsFn({
            data: {
              requesterToken: accessToken,
              shopIds: loadedShops.map((shop) => shop.id),
            },
          });
          setShopOwnerEmailByShopId(
            new Map(
              Object.entries((result as { emails?: Record<string, string> }).emails ?? {}).filter(
                ([, email]) => Boolean(email?.trim()),
              ) as [string, string][],
            ),
          );
        } catch {
          setShopOwnerEmailByShopId(new Map());
        }
      } else {
        setShopOwnerEmailByShopId(new Map());
      }
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
  }, [resolveShopEmailsFn, session?.user]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`order-taker-orders-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_orders",
          filter: `created_by=eq.${session.user.id}`,
        },
        () => void load({ silent: true }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, session?.user?.id]);

  const orderNotifications = useGroobeyWorkspaceNotifications({
    userId: session?.user?.id,
    mode: "order_taker",
    onRefresh: () => void load({ silent: true }),
  });

  useEffect(() => {
    setGroobeyNotificationNavigate((action) => {
      if (action.dashboard !== "orders") return;
      if (action.tab) setDashboardTab(action.tab);
      if (action.tab === "orders") {
        setOrdersListPeriod("month");
        requestAnimationFrame(() => {
          ordersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      if (action.orderId) setFocusBillOrderId(action.orderId);
    });
    return () => setGroobeyNotificationNavigate(null);
  }, []);

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
  const month = calendarMonthKey();
  const monthLabel = useMemo(() => formatCalendarMonthLabel(month), [month]);

  const todayOrders = useMemo(
    () => orders.filter((o) => (o.created_at || "").slice(0, 10) === today),
    [orders, today],
  );
  const monthOrders = useMemo(
    () => filterOrdersByCalendarMonth(orders, month),
    [orders, month],
  );
  const activeMonthOrders = useMemo(
    () => monthOrders.filter((o) => isOrderPipelineActive(o.status)),
    [monthOrders],
  );
  const pendingCount = monthOrders.filter((o) => o.status === "pending").length;
  const activeCount = activeMonthOrders.length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const todayRetail = todayOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const monthRetail = monthOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);

  const deliveredMonthCount = monthOrders.filter((o) => o.status === "delivered").length;

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    const scope =
      ordersListPeriod === "all" ? orders
      : ordersListPeriod === "today" ? todayOrders
      : monthOrders;
    return scope.filter((order) => {
      if (statusFilter === "active" && !isOrderPipelineActive(order.status)) return false;
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
  }, [orders, orderSearch, statusFilter, ordersListPeriod, todayOrders, monthOrders, orders]);

  const ordersExportPeriodLabel = useMemo(() => {
    if (ordersListPeriod === "today") return `Today (${today})`;
    if (ordersListPeriod === "all") return "All time";
    return monthLabel;
  }, [ordersListPeriod, today, monthLabel]);

  const openOrdersList = useCallback(
    (opts: { status?: StatusFilter; period?: OrdersListPeriod }) => {
      setDashboardTab("orders");
      if (opts.status !== undefined) setStatusFilter(opts.status);
      if (opts.period !== undefined) setOrdersListPeriod(opts.period);
      else if (opts.status === "delivered" || opts.status === "cancelled") {
        setOrdersListPeriod("all");
      }
      setPageAlert({
        notice:
          opts.status === "delivered" ?
            "Showing all delivered orders (all time). Use this for past days - Bill tab stays active-only."
          : opts.status === "cancelled" ?
            "Showing all cancelled orders (all time)."
          : opts.period === "today" ? "Showing orders created today."
          : opts.period === "month" ? "Showing orders created this month."
          : opts.status === "pending" ? "Showing pending orders this month."
          : opts.status === "active" ? "Showing active pipeline orders this month."
          : opts.period === "all" ? "Showing all orders (all time)."
          : "Showing orders this month.",
      });
      requestAnimationFrame(() => {
        ordersSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [],
  );

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

  const shopMarginPercentForOrder = useCallback(
    (order: CustomerOrder) => {
      if (order.shop_id) {
        const shop = shops.find((s) => s.id === order.shop_id);
        return clampMarginPercent(
          Number(shop?.trade_margin_percent ?? order.trade_margin_percent_applied ?? adminMarginPercent),
        );
      }
      return clampMarginPercent(Number(order.trade_margin_percent_applied ?? adminMarginPercent));
    },
    [adminMarginPercent, shops],
  );

  async function sendOrderSettlementBillEmail(
    order: CustomerOrder,
    shopOwnerEmail: string,
  ): Promise<BillPreviewEmailResult> {
    if (!session?.access_token) return { error: "Not signed in." };
    if (!order.shop_id?.trim()) {
      return {
        error: "Link this order to a shop before emailing the settlement bill to the shop owner.",
      };
    }
    const trimmed = shopOwnerEmail.trim();
    if (!trimmed) {
      return { error: "Enter the shop owner's email before sending the settlement bill." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: "Invalid shop owner email address." };
    }
    try {
      const shopName = shopNameById.get(order.shop_id) ?? "Shop";
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail: trimmed,
          shopId: order.shop_id,
          subject: `Settlement bill ${order.bill_number || ""} - ${shopName}`.trim(),
          shopName,
          ownerName: orderTakerBillLabel,
          billDate: (order.created_at || "").slice(0, 16),
          billKind: "merchant",
          billNumber: order.bill_number?.trim() || undefined,
          orderBill: customerOrderBillEmailOrderBill(order, shopName, {
            forMerchant: true,
            shopMarginPercent: shopMarginPercentForOrder(order),
          }),
        },
      });
      return { notice: `Settlement bill emailed to shop owner (${result.deliveredTo}).` };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Unable to send settlement bill email.",
      };
    }
  }

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
      const shopName = order.shop_id ? shopNameById.get(order.shop_id) : undefined;
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail: trimmed,
          subject: `Bill ${order.bill_number || ""} - ${GROOBEY_APP_NAME}`.trim(),
          shopName: GROOBEY_APP_NAME,
          ownerName: orderTakerBillLabel,
          billDate: (order.created_at || "").slice(0, 16),
          billKind: "customer",
          billNumber: order.bill_number?.trim() || undefined,
          orderBill: customerOrderBillEmailOrderBill(order, shopName),
        },
      });
      return { notice: `Customer bill emailed to ${result.deliveredTo}.` };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Unable to send bill email.",
      };
    }
  }

  function orderBillPreviewOptions(
    order: CustomerOrder,
    kind: BillKind,
  ): BillPreviewShowOptions | undefined {
    if (!session?.access_token) return undefined;
    const defaultCustomerEmail =
      order.customer_phone?.includes("@") ? order.customer_phone.trim() : "";
    const defaultSettlementEmail = shopOwnerEmailForOrder(order, shopOwnerEmailByShopId);
    if (kind === "customer") {
      return {
        email: {
          defaultEmail: defaultCustomerEmail,
          send: (customerEmail) => sendOrderBillEmail(order, customerEmail),
        },
      };
    }
    return {
      settlementEmail: {
        defaultEmail: defaultSettlementEmail,
        shopId: order.shop_id?.trim() || undefined,
        send: (shopOwnerEmail) => sendOrderSettlementBillEmail(order, shopOwnerEmail),
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
      shopMarginPercent: shopMarginPercentForOrder(order),
      preview: orderBillPreviewOptions(order, kind),
    });
  }

  function printCustomerBill(order: CustomerOrder): boolean {
    return printOrderBill(order, "customer");
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
    const customerAddress = String(form.get("customerAddress") || "").trim();
    const customerPhone = String(form.get("customerPhone") || "").trim();
    const orderItems = String(form.get("orderItems") || "").trim();
    const grocerySubtotal = Number(form.get("totalAmount") || 0);
    const requiredDate = String(form.get("requiredDate") || "").trim();
    const notes = String(form.get("notes") || "").trim();
    const delivery = parseCustomerOrderDeliveryFromForm(form);

    if (!customerName) {
      setSaving(false);
      setOrderFormAlert({ error: "Customer name is required." });
      return;
    }
    if (!customerPhone) {
      setSaving(false);
      setOrderFormAlert({ error: "Customer mobile number is required." });
      return;
    }
    if (!isValidCustomerMobile(customerPhone)) {
      setSaving(false);
      setOrderFormAlert({ error: "Enter a valid 10-digit mobile number." });
      return;
    }
    if (!customerAddress) {
      setSaving(false);
      setOrderFormAlert({ error: "Customer location (address) is required." });
      return;
    }
    if (delivery.destination === "shop" && !delivery.workFromShopId) {
      setSaving(false);
      setOrderFormAlert({ error: "Choose the shop for this order (Order type → Shop)." });
      return;
    }
    if (delivery.destination === "other" && !delivery.otherDestination) {
      setSaving(false);
      setOrderFormAlert({ error: "Enter the other delivery destination." });
      return;
    }
    const resolvedShopId =
      delivery.workFromShopId ||
      (delivery.destination === "shop" && shopIdColumnReady && shops.length === 1 ?
        shops[0]?.id
      : "") ||
      "";
    const shopName = resolvedShopId ? shops.find((s) => s.id === resolvedShopId)?.name : undefined;
    // Bills and customer email use this field - always the street/location the customer gave.
    const deliveryAddress = customerAddress || null;
    if (
      shopIdColumnReady &&
      delivery.destination === "shop" &&
      shops.length > 1 &&
      !resolvedShopId
    ) {
      setSaving(false);
      setOrderFormAlert({ error: "Choose the shop for this order (Order type → Shop)." });
      return;
    }
    if (!orderItems) {
      setSaving(false);
      setOrderFormAlert({ error: "Add grocery items to the cart." });
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

    const grocery = Number.isFinite(grocerySubtotal) ? Math.max(0, grocerySubtotal) : 0;
    const deliveryCharge = delivery.deliveryCharge;
    const retail = grocery + deliveryCharge;
    const assignedShop =
      resolvedShopId ? shops.find((s) => s.id === resolvedShopId) : undefined;
    const marginPct = clampMarginPercent(
      Number(assignedShop?.trade_margin_percent ?? adminMarginPercent),
    );
    const trade = tradeAmountFromRetail(grocery, marginPct) + deliveryCharge;
    const orderNotes = shopIdColumnReady
      ? notes || null
      : notesWithShopFallback(shopName, notes);
    const itemsText = orderItems || delivery.itemsDelivered || "";

    const baseRow = {
      created_by: session.user.id,
      customer_name: customerName,
      customer_phone: customerPhone || null,
      delivery_address: deliveryAddress || null,
      order_items: itemsText,
      total_amount: retail,
      merchant_settlement_amount: trade,
      trade_margin_percent_applied: marginPct,
      bill_number: billNo,
      required_date: requiredDate || null,
      notes: orderNotes,
      status: "pending" as const,
    };
    const deliveryExtras = deliveryFieldsReadyRef.current
      ? {
          grocery_subtotal: grocery,
          delivery_charge: deliveryCharge,
          delivery_destination: delivery.destination,
          work_from_shop_id: delivery.workFromShopId,
          items_delivered_text: delivery.itemsDelivered,
          delivery_time_slot: delivery.deliveryTimeSlot,
        }
      : {};

    let inserted: { id: string } | null = null;
    let insertError: { message: string } | null = null;

    if (shopIdColumnReady) {
      const res = await supabase
        .from("customer_orders")
        .insert({ ...baseRow, ...deliveryExtras, shop_id: resolvedShopId || null } as never)
        .select("id")
        .single();
      inserted = res.data as { id: string } | null;
      insertError = res.error;
      if (
        insertError &&
        isMissingCustomerOrderDeliveryFieldsError(insertError.message)
      ) {
        deliveryFieldsReadyRef.current = false;
        const retry = await supabase
          .from("customer_orders")
          .insert({ ...baseRow, shop_id: resolvedShopId || null } as never)
          .select("id")
          .single();
        inserted = retry.data as { id: string } | null;
        insertError = retry.error;
      }
      if (
        insertError &&
        isMissingCustomerOrderShopIdError(insertError.message)
      ) {
        setShopIdColumnReady(false);
        shopIdColumnReadyRef.current = false;
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
          ...deliveryExtras,
          notes: notesWithShopFallback(shopName, notes),
        } as never)
        .select("id")
        .single();
      inserted = res.data as { id: string } | null;
      insertError = res.error;
      if (
        insertError &&
        isMissingCustomerOrderDeliveryFieldsError(insertError.message)
      ) {
        deliveryFieldsReadyRef.current = false;
        const retry = await supabase
          .from("customer_orders")
          .insert({
            ...baseRow,
            notes: notesWithShopFallback(shopName, notes),
          } as never)
          .select("id")
          .single();
        inserted = retry.data as { id: string } | null;
        insertError = retry.error;
      }
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
      notice: `Order created - Bill ${billNo}, total ₹${Math.round(retail)}. Print or email from the bill panel.`,
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
        order_items: itemsText,
        grocery_subtotal: grocery,
        delivery_charge: deliveryCharge,
        delivery_destination: delivery.destination,
        work_from_shop_id: delivery.workFromShopId,
        items_delivered_text: delivery.itemsDelivered,
        delivery_time_slot: delivery.deliveryTimeSlot,
        assigned_delivery_user_id: null,
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
    <main className="groobey-shell groobey-page min-h-dvh min-w-0 overflow-x-hidden text-foreground">
      <GroobeyDashboardHeader
        title="Orders dashboard"
        subtitle="Bill ID lookup · quick new orders"
        actions={
          <>
            <GroobeyNotificationBell
              items={orderNotifications.items}
              unreadCount={orderNotifications.unreadCount}
              onMarkAllRead={orderNotifications.markAllRead}
              onMarkRead={orderNotifications.markRead}
              onClearAll={orderNotifications.clearAll}
            />
            <Button variant="outline" className="rounded-xl" onClick={() => void groobeySignOut()}>
              Logout
            </Button>
          </>
        }
      />

      <section ref={ordersSectionRef} className="groobey-dashboard-body mx-auto max-w-7xl scroll-mt-24 space-y-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            icon={PhoneCall}
            label="Pending"
            value={String(pendingCount)}
            pressed={dashboardTab === "orders" && statusFilter === "pending" && ordersListPeriod === "month"}
            onClick={() => openOrdersList({ status: "pending", period: "month" })}
          />
          <Stat
            icon={ClipboardList}
            label="Active orders"
            value={String(activeCount)}
            pressed={dashboardTab === "orders" && statusFilter === "active" && ordersListPeriod === "month"}
            onClick={() => openOrdersList({ status: "active", period: "month" })}
          />
          <Stat
            icon={IndianRupee}
            label="Today"
            hint={`${todayOrders.length} order${todayOrders.length === 1 ? "" : "s"} · ₹${Math.round(todayRetail)} retail`}
            value={String(todayOrders.length)}
            pressed={dashboardTab === "orders" && ordersListPeriod === "today"}
            onClick={() => openOrdersList({ status: "all", period: "today" })}
          />
          <Stat
            icon={CalendarDays}
            label="This month"
            hint={`${monthOrders.length} total · ${deliveredMonthCount} delivered`}
            value={String(monthOrders.length)}
            pressed={
              dashboardTab === "orders" &&
              statusFilter === "all" &&
              ordersListPeriod === "month"
            }
            onClick={() => openOrdersList({ status: "all", period: "month" })}
          />
          <Stat
            icon={Package}
            label="Delivered"
            hint={`${deliveredCount} all time · tap for history`}
            value={String(deliveredCount)}
            pressed={
              dashboardTab === "orders" &&
              statusFilter === "delivered" &&
              ordersListPeriod === "all"
            }
            onClick={() => openOrdersList({ status: "delivered", period: "all" })}
          />
        </section>

        <Message
          error=""
          notice=""
          loading={false}
          refreshing={loading && hasLoaded.current}
          showAlerts={false}
        />
        <InlineFeedback {...pageAlert} />

        <StaffIdentityCard
          title="Your order taker details"
          icon={UserRound}
          subtitle="Name and login are managed by Platform Admin. Groobey margin (if any) is set by admin - you only manage customer orders and bills here."
          rows={[
            { label: "Order taker name", value: orderTakerName },
            { label: "Email", value: profile?.email?.trim() || session.user.email || "-" },
            { label: "Groobey ID", value: profile?.groobey_code?.trim() || "-" },
            { label: "Mobile", value: profile?.phone?.trim() || "-" },
            { label: "Delivered (all time)", value: String(deliveredCount) },
          ]}
        />

        <Tabs value={dashboardTab} onValueChange={setDashboardTab} className="w-full">
          <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 p-1 sm:max-w-md">
            <TabsTrigger value="bill" className="min-h-10 gap-1.5 text-sm">
              <ClipboardList className="size-4 shrink-0" /> Bill &amp; new order
            </TabsTrigger>
            <TabsTrigger value="orders" className="min-h-10 gap-1.5 text-sm">
              <Search className="size-4 shrink-0" /> Active ({activeMonthOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bill" className="mt-0">
            <p className="mb-3 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold leading-relaxed text-muted-foreground">
              Active pipeline only: create bills and print here. After delivery completes, find the bill
              under Active tab, Delivered filter (all time).
            </p>
            <Panel title="Bill ID & new order" icon={ClipboardList}>
              <OrderTakerWorkspace
                orders={orders.filter((o) => isOrderPipelineActive(o.status))}
                products={products}
                shops={shops}
                missingBillCount={missingBillCount}
                backfillingBills={backfillingBills}
                resetNonce={formResetNonce}
                saving={saving}
                feedback={orderFormAlert}
                billActionFeedback={billTabAlert}
                nextStatuses={orderTakerNextStatuses}
                onSubmit={handleCreateOrder}
                onPrintBill={(order, kind) => printOrderBill(order, kind)}
                onUpdateStatus={(id, status) => void updateStatus(id, status)}
                onBackfillMissingBills={() => runBillBackfill()}
                focusOrderId={focusBillOrderId}
                onFocusOrderHandled={() => setFocusBillOrderId(null)}
                calendarMonth={month}
                calendarMonthLabel={monthLabel}
              />
            </Panel>
          </TabsContent>

          <TabsContent value="orders" className="mt-0 space-y-4">
            <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold leading-relaxed text-muted-foreground">
              Default view is active pipeline this month. Tap Delivered above for past days (all time).
              Delivery alerts you when an order is marked delivered.
            </p>
            <Panel title="Search & Orders Excel" icon={Search}>
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
                      onClick={() => {
                        setStatusFilter(f.id);
                        if (f.id === "delivered" || f.id === "cancelled") {
                          setOrdersListPeriod("all");
                        } else if (
                          ordersListPeriod === "all" &&
                          (f.id === "active" || f.id === "pending" || f.id === "all")
                        ) {
                          setOrdersListPeriod("month");
                        }
                      }}
                    >
                      {f.label}
                    </Button>
                  ))}
                  {ordersListPeriod === "today" ?
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => setOrdersListPeriod("month")}
                    >
                      Back to this month
                    </Button>
                  : null}
                  {ordersListPeriod !== "all" ?
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => setOrdersListPeriod("all")}
                    >
                      All time ({orders.length})
                    </Button>
                  : ordersListPeriod === "all" ?
                    <Button
                      type="button"
                      size="sm"
                      variant="groobey"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => setOrdersListPeriod("month")}
                    >
                      This month only
                    </Button>
                  : null}
                </div>
                <OrdersExcelExport
                  orders={filteredOrders}
                  periodLabel={ordersExportPeriodLabel}
                  workerName={orderTakerName}
                  shopNameById={shopNameById}
                  statusLabels={statusLabel}
                />
                <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 rounded-xl text-xs"
                    onClick={exportOrdersCsv}
                    disabled={!filteredOrders.length}
                  >
                    <Download className="size-4" /> Export CSV ({filteredOrders.length})
                  </Button>
                </div>
              </div>
            </Panel>

            <Panel
              title={
                ordersListPeriod === "month" ?
                  `Orders - ${monthLabel}`
                : ordersListPeriod === "today" ?
                  "Orders - today"
                : "Orders - all time"
              }
              icon={ClipboardList}
              feedback={queueAlert}
            >
              <OrdersMonthScopeBanner
                className="mb-4"
                monthKey={month}
                monthLabel={monthLabel}
                orderCount={
                  ordersListPeriod === "month" ? monthOrders.length
                  : ordersListPeriod === "today" ? todayOrders.length
                  : orders.length
                }
              />
              {filteredOrders.length === 0 ?
                <p className="text-sm font-semibold text-muted-foreground">No orders match.</p>
              : (
                <>
                  <div className="owner-orders-table-wrap hidden lg:block">
                    <div className="owner-orders-table-scroll groobey-scrollbar">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col" className="text-left">
                              Bill ID
                            </th>
                            <th scope="col" className="text-left">
                              Customer
                            </th>
                            <th scope="col" className="text-left">
                              Address
                            </th>
                            <th scope="col" className="text-left">
                              Shop
                            </th>
                            <th scope="col" className="text-left">
                              Date
                            </th>
                            <th scope="col" className="text-left">
                              Status
                            </th>
                            <th scope="col" className="text-right">
                              Total
                            </th>
                            <th scope="col" className="text-left">
                              Print
                            </th>
                            <th scope="col" className="text-left min-w-[10rem]">
                              Update status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map((order) => {
                            const shopName =
                              order.shop_id ? shopNameById.get(order.shop_id) : undefined;
                            return (
                              <tr
                                key={order.id}
                                className={
                                  order.id === lastCreatedOrderId ? "owner-orders-row--new" : ""
                                }
                              >
                                <td>
                                  <span className={orderBillIdHighlightClass}>
                                    {order.bill_number || "-"}
                                  </span>
                                </td>
                                <td className="max-w-[9rem] font-bold">{order.customer_name}</td>
                                <td className="max-w-[11rem] text-xs font-semibold text-muted-foreground">
                                  <span className="line-clamp-2">
                                    {order.delivery_address?.trim() || "-"}
                                  </span>
                                </td>
                                <td className="max-w-[8rem]">
                                  {shopName ?
                                    <span className={orderBillShopHighlightClass}>{shopName}</span>
                                  : "-"}
                                </td>
                                <td className="tabular-nums text-xs font-semibold whitespace-nowrap">
                                  {orderDisplayDate(order.created_at)}
                                </td>
                                <td>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass[order.status]}`}
                                  >
                                    {statusLabel[order.status]}
                                  </span>
                                </td>
                                <td className="text-right font-bold tabular-nums whitespace-nowrap">
                                  ₹{Math.round(Number(order.total_amount || 0))}
                                </td>
                                <td>
                                  <BillKindButtons
                                    compact
                                    layout="compact"
                                    onPrint={(kind) => printOrderBill(order, kind)}
                                  />
                                </td>
                                <td>
                                  <OrderStatusActionButtons
                                    compact
                                    nextStatuses={orderTakerNextStatuses[order.status]}
                                    statusLabels={statusLabel}
                                    onUpdateStatus={(s) =>
                                      void updateStatus(order.id, s as OrderStatus)
                                    }
                                    orderLabel={
                                      order.bill_number || order.customer_name
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="space-y-3 lg:hidden" role="list" aria-label="Orders list">
                    {filteredOrders.map((order) => (
                      <OrderQueueCard
                        key={order.id}
                        order={order}
                        shopName={
                          order.shop_id ? shopNameById.get(order.shop_id) : undefined
                        }
                        statusLabel={statusLabel[order.status]}
                        statusClassName={statusClass[order.status]}
                        isHighlighted={order.id === lastCreatedOrderId}
                        onPrint={(kind) => printOrderBill(order, kind)}
                        nextStatuses={orderTakerNextStatuses[order.status]}
                        statusLabels={statusLabel}
                        onUpdateStatus={(s) => void updateStatus(order.id, s as OrderStatus)}
                      />
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
