import { useServerFn } from "@tanstack/react-start";
import { Bike, CalendarDays, ClipboardList, Package } from "lucide-react";
import { type FormEvent, useCallback, useMemo, useEffect, useRef, useState } from "react";

import { CustomerOrderDeliveryQueue } from "@/components/groobey/customer-order-delivery-queue";
import { GroobeyDashboardHeader } from "@/components/groobey/groobey-brand-logo";
import { GroobeyNotificationBell } from "@/components/groobey/groobey-notification-bell";
import { OrdersMonthScopeBanner } from "@/components/groobey/groobey-order-list-parts";
import { StaffIdentityCard } from "@/components/groobey/staff-identity-card";
import { Button } from "@/components/ui/button";
import { DeliveryAttendanceReport } from "@/components/groobey/delivery-attendance-report";
import { DeliveryBillLogForm } from "@/components/groobey/delivery-bill-log-form";
import { GroobeyWorkspaceShell, Message, Panel, Stat } from "@/components/groobey/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  CUSTOMER_ORDER_DELIVERY_SELECT,
  CUSTOMER_ORDER_DELIVERY_SELECT_LEGACY,
  CUSTOMER_ORDER_DELIVERY_SELECT_NO_EMBED,
  isAmbiguousCustomerOrderShopEmbedError,
  isMissingCustomerOrderShopIdError,
} from "@/lib/groobey-customer-order-columns";
import { isMissingCustomerOrderDeliveryFieldsError } from "@/lib/groobey-delivery-order-fields";
import { updateAssignedDeliveryOrderStatus } from "@/lib/groobey-delivery-order-status";
import { ordersDeliveredOnDay } from "@/lib/groobey-order-pipeline";
import { EM_DASH } from "@/lib/groobey-currency";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import {
  customerOrderBillEmailOrderBill,
  formatStaffBillLabel,
} from "@/lib/groobey-dual-bill";
import type { BillPreviewEmailResult, BillPreviewShowOptions } from "@/lib/groobey-bill-preview-bridge";
import {
  calendarMonthKey,
  filterOrdersByCalendarMonth,
  formatCalendarMonthLabel,
} from "@/lib/groobey-order-month";
import { buildDeliveryLogNotes, buildDeliveryReportForScope, splitOrderLineAmounts } from "@/lib/groobey-delivery-log";
import { upsertDeliveryAttendanceLog } from "@/lib/groobey-excel-exports";
import { setGroobeyNotificationNavigate } from "@/lib/groobey-notification-nav";
import { useGroobeyWorkspaceNotifications } from "@/lib/groobey-workspace-notifications";
import { groobeySignOut } from "@/lib/groobey-auth-logout";
import { sendCustomerBillEmail } from "@/lib/tldGroobey.functions";

type AttendanceFilter = "today" | "month";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export function DeliveryDashboard() {
  const sendBillEmail = useServerFn(sendCustomerBillEmail);
  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<
    Database["public"]["Tables"]["attendance"]["Row"][]
  >([]);
  const [deliveredOrders, setDeliveredOrders] = useState<
    (Database["public"]["Tables"]["customer_orders"]["Row"] & {
      shop?: { name: string | null } | null;
    })[]
  >([]);
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("month");
  const [loading, setLoading] = useState(true);
  const [submittingWork, setSubmittingWork] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workFormResetNonce, setWorkFormResetNonce] = useState(0);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [customerOrders, setCustomerOrders] = useState<
    (Database["public"]["Tables"]["customer_orders"]["Row"] & {
      shop?: { name: string | null } | null;
    })[]
  >([]);
  const hasLoaded = useRef(false);
  const loadInFlight = useRef(false);
  const attendancePanelRef = useRef<HTMLDivElement>(null);
  const queuePanelRef = useRef<HTMLDivElement>(null);
  const month = calendarMonthKey();
  const monthLabel = formatCalendarMonthLabel(month);

  const load = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (!hasLoaded.current) setLoading(true);
    try {
      const [prof, attRows, shopRows, productsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase
          .from("attendance")
          .select("*")
          .eq("worker_id", session.user.id)
          .order("work_date", { ascending: false })
          .limit(120),
        supabase.from("shops").select("*").eq("is_active", true).order("name"),
        supabase.from("products").select("*").order("name"),
      ]);
      const ordersWithShop = await supabase
        .from("customer_orders")
        .select(CUSTOMER_ORDER_DELIVERY_SELECT)
        .eq("assigned_delivery_user_id", session.user.id)
        .in("status", ["confirmed", "packed", "out_for_delivery"])
        .order("created_at", { ascending: true })
        .limit(100);
      let ordersRes =
        ordersWithShop.error &&
        isMissingCustomerOrderShopIdError(ordersWithShop.error.message)
          ? await supabase
              .from("customer_orders")
              .select(CUSTOMER_ORDER_DELIVERY_SELECT_LEGACY)
              .eq("assigned_delivery_user_id", session.user.id)
              .in("status", ["confirmed", "packed", "out_for_delivery"])
              .order("created_at", { ascending: true })
              .limit(100)
        : ordersWithShop.error &&
            isAmbiguousCustomerOrderShopEmbedError(ordersWithShop.error.message)
          ? await supabase
              .from("customer_orders")
              .select(CUSTOMER_ORDER_DELIVERY_SELECT_NO_EMBED)
              .eq("assigned_delivery_user_id", session.user.id)
              .in("status", ["confirmed", "packed", "out_for_delivery"])
              .order("created_at", { ascending: true })
              .limit(100)
          : ordersWithShop;
      if (prof.error) setError(prof.error.message);
      else setProfile(prof.data ?? null);
      if (shopRows.error) setError(shopRows.error.message);
      else setShops(shopRows.data ?? []);
      if (!attRows.error) setAttendanceRows(attRows.data ?? []);
      if (!productsRes.error) setProducts(productsRes.data ?? []);
      if (
        ordersRes.error &&
        isMissingCustomerOrderDeliveryFieldsError(ordersRes.error.message)
      ) {
        ordersRes = await supabase
          .from("customer_orders")
          .select(CUSTOMER_ORDER_DELIVERY_SELECT_LEGACY)
          .eq("assigned_delivery_user_id", session.user.id)
          .in("status", ["confirmed", "packed", "out_for_delivery"])
          .order("created_at", { ascending: true })
          .limit(100);
      }
      if (!ordersRes.error) {
        setCustomerOrders(
          (ordersRes.data ?? []) as (Database["public"]["Tables"]["customer_orders"]["Row"] & {
            shop?: { name: string | null } | null;
          })[],
        );
      } else if (ordersRes.error.message) {
        setError(ordersRes.error.message);
      }

      const deliveredRes = await supabase
        .from("customer_orders")
        .select(CUSTOMER_ORDER_DELIVERY_SELECT_NO_EMBED)
        .eq("assigned_delivery_user_id", session.user.id)
        .eq("status", "delivered")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (!deliveredRes.error) {
        setDeliveredOrders(
          (deliveredRes.data ?? []) as (Database["public"]["Tables"]["customer_orders"]["Row"] & {
            shop?: { name: string | null } | null;
          })[],
        );
      }
      hasLoaded.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load workspace.");
    } finally {
      loadInFlight.current = false;
      setLoading(false);
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
  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load, session?.user]);

  type DeliveryOrder = (typeof customerOrders)[number];

  const notifications = useGroobeyWorkspaceNotifications({
    userId: session?.user?.id,
    mode: "delivery",
    onRefresh: () => void load(),
  });

  useEffect(() => {
    setGroobeyNotificationNavigate((action) => {
      if (action.focus === "queue" || action.orderId) {
        queuePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (action.focus === "attendance") {
        setAttendanceFilter("month");
        attendancePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    return () => setGroobeyNotificationNavigate(null);
  }, []);

  const recordDeliveryLog = useCallback(
    async (
      order: DeliveryOrder,
      deliveredAt: string,
      opts?: { skipStatusUpdate?: boolean },
    ) => {
      if (!session?.user) return { error: "Not signed in." };
      const workDate = new Date().toISOString().slice(0, 10);
      const { itemsAmount, deliveryCharge } = splitOrderLineAmounts(order);
      const notes = buildDeliveryLogNotes({
        billId: order.bill_number?.trim() || "-",
        customerName: order.customer_name,
        orderAmount: itemsAmount,
        deliveryCharge,
        deliveredAt,
        date: workDate,
      });
      const { error: attendanceError } = await upsertDeliveryAttendanceLog(supabase, {
        workerId: session.user.id,
        workDate,
        notes,
        billId: order.bill_number?.trim() || order.id,
      });
      if (attendanceError) return { error: attendanceError };

      if (!opts?.skipStatusUpdate && order.status !== "delivered") {
        const { error: statusError } = await updateAssignedDeliveryOrderStatus(
          supabase,
          order.id,
          "delivered",
        );
        if (statusError) return { error: statusError };
      }
      return { error: null as string | null };
    },
    [session?.user],
  );

  async function submitWorkUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user) return;
    const formElement = event.currentTarget;
    setSubmittingWork(true);
    setError("");
    setNotice("");
    const form = new FormData(formElement);
    const orderId = String(form.get("orderId") || "").trim();
    const deliveredAt = String(form.get("deliveredAt") || "").trim();
    const order = customerOrders.find((o) => o.id === orderId);
    if (!order) {
      setSubmittingWork(false);
      setError("Choose a Bill ID from your assigned orders.");
      return;
    }
    if (!deliveredAt) {
      setSubmittingWork(false);
      setError("Choose the delivered time.");
      return;
    }

    const result = await recordDeliveryLog(order, deliveredAt);
    setSubmittingWork(false);
    if (result.error) setError(result.error);
    else {
      setNotice(`Delivery logged for ${order.bill_number || "bill"} and marked delivered.`);
      formElement.reset();
      setWorkFormResetNonce((n) => n + 1);
      setAttendanceFilter("month");
      void load();
    }
  }

  const deliveryBillLabel = useMemo(
    () =>
      formatStaffBillLabel({
        displayName: profile?.display_name?.trim() || "Delivery",
        groobeyCode: profile?.groobey_code ?? null,
      }),
    [profile],
  );

  const deliveryBoyName = useMemo(
    () => profile?.display_name?.trim() || session?.user?.email?.split("@")[0] || "Delivery boy",
    [profile?.display_name, session?.user?.email],
  );

  const orderBillPreviewOptions = useCallback(
    (order: DeliveryOrder): BillPreviewShowOptions | undefined => {
      if (!session?.access_token) return undefined;
      const defaultEmail =
        order.customer_phone?.includes("@") ? order.customer_phone.trim() : "";
      return {
        email: {
          defaultEmail,
          send: async (customerEmail): Promise<BillPreviewEmailResult> => {
            const trimmed = customerEmail.trim();
            if (!trimmed) {
              return { error: "Enter the customer's email address before sending the bill." };
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
              return { error: "Invalid email address." };
            }
            const shop = shops.find((s) => s.id === order.shop_id);
            try {
              const result = await sendBillEmail({
                data: {
                  requesterToken: session.access_token,
                  customerEmail: trimmed,
                  subject: `Bill ${order.bill_number || ""} - ${GROOBEY_APP_NAME}`.trim(),
                  shopName: GROOBEY_APP_NAME,
                  ownerName: deliveryBillLabel,
                  billDate: (order.created_at || "").slice(0, 16),
                  billKind: "customer",
                  billNumber: order.bill_number?.trim() || undefined,
                  orderBill: customerOrderBillEmailOrderBill(order, shop?.name),
                },
              });
              return { notice: `Customer bill emailed to ${result.deliveredTo}.` };
            } catch (e) {
              return {
                error: e instanceof Error ? e.message : "Unable to send bill email.",
              };
            }
          },
        },
      };
    },
    [session?.access_token, shops, deliveryBillLabel, sendBillEmail],
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayDeliveredOrders = useMemo(
    () => ordersDeliveredOnDay(deliveredOrders, today),
    [deliveredOrders, today],
  );
  const monthDeliveredOrders = useMemo(
    () => filterOrdersByCalendarMonth(deliveredOrders, month),
    [deliveredOrders, month],
  );

  const todayReportRows = useMemo(
    () =>
      buildDeliveryReportForScope(attendanceRows, deliveredOrders, { date: today }),
    [attendanceRows, deliveredOrders, today],
  );

  const monthReportRows = useMemo(
    () =>
      buildDeliveryReportForScope(attendanceRows, monthDeliveredOrders, { monthKey: month }),
    [attendanceRows, month, monthDeliveredOrders],
  );

  function scrollToAttendance(filter: AttendanceFilter) {
    setAttendanceFilter(filter);
    requestAnimationFrame(() => {
      attendancePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  if (!session?.user) return null;

  return (
    <main className="groobey-shell groobey-page min-h-dvh min-w-0 overflow-x-hidden text-foreground">
      <GroobeyDashboardHeader
        title="Delivery boy dashboard"
        subtitle={`${monthLabel} · customer deliveries`}
        actions={
          <>
            <GroobeyNotificationBell
              items={notifications.items}
              unreadCount={notifications.unreadCount}
              onMarkAllRead={notifications.markAllRead}
              onMarkRead={notifications.markRead}
              onClearAll={notifications.clearAll}
            />
            <Button variant="calm" className="rounded-xl" onClick={() => void groobeySignOut()}>
              Logout
            </Button>
          </>
        }
      />
      <div className="groobey-dashboard-body mx-auto max-w-7xl space-y-5 px-4 py-4 sm:py-6">
        <OrdersMonthScopeBanner
          monthKey={month}
          monthLabel={monthLabel}
          orderCount={monthDeliveredOrders.length}
        />
        <div className="merchant-shop-overview-split">
          <StaffIdentityCard
            title="Your delivery details"
            icon={Bike}
            subtitle="Name and login are managed by Platform Admin - contact admin to update your details."
            rows={[
              { label: "Delivery boy name", value: deliveryBoyName },
              {
                label: "Email",
                value: profile?.email?.trim() || session.user.email || "-",
              },
              { label: "Groobey ID", value: profile?.groobey_code?.trim() || "-" },
              { label: "Mobile", value: profile?.phone?.trim() || "-" },
              { label: "In queue now", value: String(customerOrders.length) },
              { label: "Delivered today", value: String(todayDeliveredOrders.length) },
              { label: "Delivered this month", value: String(monthDeliveredOrders.length) },
            ]}
          />
          <section className="merchant-shop-stat-steps grid grid-cols-2 gap-3">
            <Stat
              icon={ClipboardList}
              label="Today deliveries"
              value={String(todayReportRows.length)}
              pressed={attendanceFilter === "today"}
              onClick={() => scrollToAttendance("today")}
            />
            <Stat
              icon={CalendarDays}
              label="Month deliveries"
              value={String(monthReportRows.length)}
              pressed={attendanceFilter === "month"}
              onClick={() => scrollToAttendance("month")}
            />
          </section>
        </div>
        <Message error={error} notice={notice} loading={loading} />
        <Panel title="Customer orders to deliver" icon={Package}>
          <div ref={queuePanelRef} className="scroll-mt-24">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            Assigned to you only - not delivered yet. Mark Delivered once; the bill leaves this queue
            and appears under Today&apos;s delivered bills until tomorrow.
          </p>
          <CustomerOrderDeliveryQueue
            orders={customerOrders}
            shops={shops}
            onUpdated={() => void load()}
            billPreviewOptions={orderBillPreviewOptions}
            onStatusChanged={(order, status) => {
              if (status === "delivered") {
                const time = new Date().toTimeString().slice(0, 5);
                void recordDeliveryLog(order, time, { skipStatusUpdate: true }).then((r) => {
                  if (r.error) setError(r.error);
                  else void load();
                });
              }
            }}
          />
          </div>
        </Panel>
        <GroobeyWorkspaceShell>
          <Panel title="Log delivery by Bill ID" icon={Bike}>
            <DeliveryBillLogForm
              orders={customerOrders}
              resetNonce={workFormResetNonce}
              submitting={submittingWork}
              onSubmit={submitWorkUpdate}
            />
          </Panel>
        </GroobeyWorkspaceShell>
        {todayDeliveredOrders.length > 0 ?
          <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
            {todayDeliveredOrders.length} delivered today {EM_DASH} see the report below or Export
            Excel for your records (12-hour times).
          </p>
        : null}
        <Panel
          title={
            attendanceFilter === "today" ? "Today's deliveries" : `${monthLabel} delivery report`
          }
          icon={ClipboardList}
        >
          <div ref={attendancePanelRef} className="scroll-mt-28">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">
              One row per Bill ID. Order amount is items only; Delivery is the fee; Total is both. Times
              are 12-hour AM/PM. Export Excel weekly for your records {EM_DASH} full month totals stay here
              until the calendar month changes.
            </p>
            <DeliveryAttendanceReport
              monthKey={month}
              monthLabel={monthLabel}
              workerName={profile?.display_name?.trim() || "Delivery"}
              attendanceRows={attendanceRows}
              deliveredOrders={
                attendanceFilter === "today" ? deliveredOrders : monthDeliveredOrders
              }
              scope={attendanceFilter}
              todayIso={today}
            />
          </div>
        </Panel>
      </div>
    </main>
  );
}
