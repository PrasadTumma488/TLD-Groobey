import { useServerFn } from "@tanstack/react-start";
import { Bike, ClipboardList, Package } from "lucide-react";
import { type FormEvent, useCallback, useMemo, useEffect, useRef, useState } from "react";

import { CustomerOrderDeliveryQueue } from "@/components/groobey/customer-order-delivery-queue";
import { GroobeyDashboardHeader } from "@/components/groobey/groobey-brand-logo";
import { GroobeyMemberChrome } from "@/components/groobey/groobey-member-chrome";
import { GroobeyNotificationBell } from "@/components/groobey/groobey-notification-bell";
import { Button } from "@/components/ui/button";
import { DeliveryAttendanceReport } from "@/components/groobey/delivery-attendance-report";
import { DeliveryBillLogForm } from "@/components/groobey/delivery-bill-log-form";
import { Message, Panel, Stat } from "@/components/groobey/workspace-ui";
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
import { EM_DASH, MIDDLE_DOT } from "@/lib/groobey-currency";
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
import { sendCustomerBillEmail } from "@/lib/tldGroobey.functions";

type AttendanceFilter = "today" | "month";
type DeliveryPanel = "queue" | "log" | "report";

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
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("today");
  const [deliveryPanel, setDeliveryPanel] = useState<DeliveryPanel>("queue");
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
        setDeliveryPanel("queue");
      }
      if (action.focus === "attendance") {
        setDeliveryPanel("report");
        setAttendanceFilter("month");
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
    setDeliveryPanel("report");
  }

  if (!session?.user) return null;

  return (
    <GroobeyMemberChrome className="pb-8">
      <GroobeyDashboardHeader
        title="Delivery"
        subtitle={`${monthLabel} · your delivery queue`}
        actions={
          <GroobeyNotificationBell
            compact
            items={notifications.items}
            unreadCount={notifications.unreadCount}
            onMarkAllRead={notifications.markAllRead}
            onMarkRead={notifications.markRead}
            onClearAll={notifications.clearAll}
          />
        }
      />
      <div className="groobey-dashboard-body mx-auto max-w-7xl space-y-3 px-4 py-3 sm:py-4">
        <p className="groobey-delivery-summary text-[11px] font-semibold text-muted-foreground">
          {deliveryBoyName}
          {MIDDLE_DOT}
          {profile?.groobey_code?.trim() || "-"}
          {MIDDLE_DOT}
          {monthLabel}
        </p>
        <section className="groobey-delivery-panel-switch grid grid-cols-3 gap-2">
          <Stat
            icon={Package}
            label="Delivery queue"
            value={String(customerOrders.length)}
            pressed={deliveryPanel === "queue"}
            onClick={() => setDeliveryPanel("queue")}
          />
          <Stat
            icon={Bike}
            label="Log by Bill ID"
            value={String(customerOrders.length)}
            hint="Manual entry"
            pressed={deliveryPanel === "log"}
            onClick={() => setDeliveryPanel("log")}
          />
          <Stat
            icon={ClipboardList}
            label="Delivered today"
            value={String(todayDeliveredOrders.length)}
            pressed={deliveryPanel === "report" && attendanceFilter === "today"}
            onClick={() => scrollToAttendance("today")}
          />
        </section>
        <Message error={error} notice={notice} loading={loading} />
        {deliveryPanel === "queue" ?
          <Panel title="Orders to deliver" icon={Package}>
            <div ref={queuePanelRef}>
              <p className="mb-2 text-[11px] font-semibold leading-snug text-muted-foreground">
                Assigned to you — update status or mark delivered when done.
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
        : null}
        {deliveryPanel === "log" ?
          <Panel title="Log delivery by Bill ID" icon={Bike}>
            <DeliveryBillLogForm
              orders={customerOrders}
              resetNonce={workFormResetNonce}
              submitting={submittingWork}
              onSubmit={submitWorkUpdate}
            />
          </Panel>
        : null}
        {deliveryPanel === "report" ?
          <Panel
            title={
              attendanceFilter === "today" ? "Today's deliveries" : `${monthLabel} delivery report`
            }
            icon={ClipboardList}
          >
            <div className="mb-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={attendanceFilter === "today" ? "groobey" : "outline"}
                className="groobey-dashboard-action-btn"
                onClick={() => setAttendanceFilter("today")}
              >
                Today
              </Button>
              <Button
                type="button"
                variant={attendanceFilter === "month" ? "groobey" : "outline"}
                className="groobey-dashboard-action-btn"
                onClick={() => setAttendanceFilter("month")}
              >
                This month
              </Button>
            </div>
            <div ref={attendancePanelRef}>
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
        : null}
      </div>
    </GroobeyMemberChrome>
  );
}
