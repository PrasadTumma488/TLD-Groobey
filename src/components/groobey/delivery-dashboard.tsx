import { useServerFn } from "@tanstack/react-start";
import { Bike, ClipboardList, Package } from "lucide-react";
import { type FormEvent, useCallback, useMemo, useEffect, useRef, useState } from "react";

import { CustomerOrderDeliveryQueue } from "@/components/groobey/customer-order-delivery-queue";
import { GroobeyDashboardHeader } from "@/components/groobey/groobey-brand-logo";
import { Button } from "@/components/ui/button";
import { EmployeeWorkspace } from "@/components/groobey/groobey-forms";
import { Message, Panel, Stat } from "@/components/groobey/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  CUSTOMER_ORDER_DELIVERY_SELECT,
  CUSTOMER_ORDER_DELIVERY_SELECT_LEGACY,
  isMissingCustomerOrderShopIdError,
} from "@/lib/groobey-customer-order-columns";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import {
  customerOrderItemsForBillEmail,
  formatStaffBillLabel,
} from "@/lib/groobey-dual-bill";
import type { BillPreviewEmailResult, BillPreviewShowOptions } from "@/lib/groobey-bill-preview-bridge";
import { saleDisplayId, saleDisplayTime } from "@/lib/groobey-sale-display-id";
import { sendCustomerBillEmail, sendWorkConfirmationEmail } from "@/lib/tldGroobey.functions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export function DeliveryDashboard() {
  const sendBillEmail = useServerFn(sendCustomerBillEmail);
  const sendWorkMail = useServerFn(sendWorkConfirmationEmail);
  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [attendanceRows, setAttendanceRows] = useState<
    Database["public"]["Tables"]["attendance"]["Row"][]
  >([]);
  const [sales, setSales] = useState<Database["public"]["Tables"]["sales"]["Row"][]>([]);
  const [saleItems, setSaleItems] = useState<Database["public"]["Tables"]["sale_items"]["Row"][]>(
    [],
  );
  const [sendingBill, setSendingBill] = useState(false);
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

  const load = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (!hasLoaded.current) setLoading(true);
    try {
      const [prof, att, attRows, shopRows, productsRes, salesRes, saleItemsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("worker_id", session.user.id),
        supabase
          .from("attendance")
          .select("*")
          .eq("worker_id", session.user.id)
          .order("work_date", { ascending: false })
          .limit(60),
        supabase.from("shops").select("*").eq("is_active", true).order("name"),
        supabase.from("products").select("*").order("name"),
        supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(80),
        supabase.from("sale_items").select("*").order("created_at", { ascending: false }).limit(800),
      ]);
      const ordersWithShop = await supabase
        .from("customer_orders")
        .select(CUSTOMER_ORDER_DELIVERY_SELECT)
        .in("status", ["confirmed", "packed", "out_for_delivery"])
        .order("created_at", { ascending: true })
        .limit(100);
      let ordersRes =
        ordersWithShop.error &&
        isMissingCustomerOrderShopIdError(ordersWithShop.error.message)
          ? await supabase
              .from("customer_orders")
              .select(CUSTOMER_ORDER_DELIVERY_SELECT_LEGACY)
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
      if (!salesRes.error) setSales(salesRes.data ?? []);
      if (!saleItemsRes.error) setSaleItems(saleItemsRes.data ?? []);
      if (!ordersRes.error) {
        setCustomerOrders(
          (ordersRes.data ?? []) as (Database["public"]["Tables"]["customer_orders"]["Row"] & {
            shop?: { name: string | null } | null;
          })[],
        );
      } else if (ordersRes.error.message) {
        setError(ordersRes.error.message);
      }
      setAttendanceCount(att.count ?? 0);
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

  async function submitWorkUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user) return;
    const formElement = event.currentTarget;
    setSubmittingWork(true);
    setError("");
    const form = new FormData(formElement);
    const destination = String(form.get("destination") || "shop");
    const shopId = String(form.get("shopId") || "");
    const otherShop = String(form.get("otherShop") || "");
    const itemsDelivered = String(form.get("itemsDelivered") || "").trim();
    const deliveredAt = String(form.get("deliveredAt") || "");
    const selectedShop = destination === "shop" ? shops.find((shop) => shop.id === shopId) : null;
    if (!itemsDelivered) {
      setSubmittingWork(false);
      setError("Add at least one delivered item from the grocery dropdown.");
      return;
    }
    if (destination === "shop" && !selectedShop) {
      setSubmittingWork(false);
      setError("Please choose a shop.");
      return;
    }
    if (destination === "other" && !otherShop.trim()) {
      setSubmittingWork(false);
      setError("Please enter the other destination name.");
      return;
    }

    const destinationLabel =
      destination === "shop"
        ? `Shop: ${selectedShop?.name ?? "-"}`
        : destination === "self"
          ? "Self"
          : `Other: ${otherShop}`;
    const notes = `Destination: ${destinationLabel}\nItems: ${itemsDelivered}\nTime: ${deliveredAt}`;
    const { error: attendanceError } = await supabase.from("attendance").upsert({
      worker_id: session.user.id,
      work_date: new Date().toISOString().slice(0, 10),
      status: "present",
      check_in: new Date().toISOString(),
      notes,
    } as never);
    setSubmittingWork(false);
    if (attendanceError) setError(attendanceError.message);
    else {
      setNotice("Work update submitted successfully.");
      formElement.reset();
      setWorkFormResetNonce((n) => n + 1);
      try {
        await sendWorkMail({
          data: {
            requesterToken: session.access_token || "",
            subject: "Staff work update submitted - Groobey",
            message: `Your work update for ${new Date().toISOString().slice(0, 10)} was submitted successfully.`,
          },
        });
      } catch {
        // Keep UX smooth even if email delivery fails.
      }
      void load();
    }
  }

  async function handleSendBillToCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const customerEmail = String(form.get("customerEmail") || "").trim();
    const saleId = String(form.get("saleId") || "");
    const sale = sales.find((row) => row.id === saleId);
    if (!sale) {
      setError("Choose a sale first.");
      return;
    }
    const shop = shops.find((row) => row.id === sale.shop_id);
    const rows = saleItems
      .filter((row) => row.sale_id === sale.id)
      .map((row) => ({
        name: row.product_name,
        quantity: Number(row.quantity || 0),
        packUnit: row.product_unit ?? undefined,
        unitPrice: Number(row.unit_price || 0),
        merchantUnitPrice: Number(row.merchant_unit_price ?? row.unit_price ?? 0),
      }));
    if (!rows.length) {
      setError("Selected sale has no items.");
      return;
    }
    setSendingBill(true);
    setError("");
    try {
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail,
          subject: `Bill — ${GROOBEY_APP_NAME}`,
          shopName: GROOBEY_APP_NAME,
          ownerName: shop?.contact_name || "Shop Owner",
          billDate: (sale.sold_at || sale.created_at || "").slice(0, 16),
          billKind: "customer" as const,
          billNumber: sale.bill_number?.trim() || undefined,
          items: rows,
        },
      });
      setNotice(`Bill email sent to ${result.deliveredTo}.`);
      formElement.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send customer bill.");
    } finally {
      setSendingBill(false);
    }
  }

  const recentSales = useMemo(
    () => sales.filter((row) => row.status === "verified").slice(0, 30),
    [sales],
  );

  type DeliveryOrder = (typeof customerOrders)[number];

  const deliveryBillLabel = useMemo(
    () =>
      formatStaffBillLabel({
        displayName: profile?.display_name?.trim() || "Delivery",
        groobeyCode: profile?.groobey_code ?? null,
      }),
    [profile],
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
            const retail = Number(order.total_amount || 0);
            try {
              const result = await sendBillEmail({
                data: {
                  requesterToken: session.access_token,
                  customerEmail: trimmed,
                  subject: `Bill ${order.bill_number || ""} — ${GROOBEY_APP_NAME}`.trim(),
                  shopName: GROOBEY_APP_NAME,
                  ownerName: deliveryBillLabel,
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
          },
        },
      };
    },
    [session?.access_token, shops, deliveryBillLabel, sendBillEmail],
  );

  if (!session?.user) return null;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const todayRows = attendanceRows.filter((row) => (row.work_date || "").slice(0, 10) === today);
  const monthRows = attendanceRows.filter((row) => (row.work_date || "").slice(0, 7) === month);

  return (
    <main className="groobey-shell min-h-screen text-foreground">
      <GroobeyDashboardHeader
        title="Delivery boy dashboard"
        subtitle="Daily work updates"
        actions={
          <Button variant="calm" className="rounded-xl" onClick={() => supabase.auth.signOut()}>
            Logout
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat icon={ClipboardList} label="Your attendance rows" value={String(attendanceCount)} />
          <Stat icon={ClipboardList} label="Today updates" value={String(todayRows.length)} />
          <Stat icon={ClipboardList} label="Month updates" value={String(monthRows.length)} />
        </section>
        <Message error={error} notice={notice} loading={loading} />
        <Panel title="Customer orders to deliver" icon={Package}>
          <p className="mb-3 text-xs font-semibold text-muted-foreground">
            Packed and out-for-delivery orders from order takers — mark delivered when done.
          </p>
          <CustomerOrderDeliveryQueue
            orders={customerOrders}
            shops={shops}
            onUpdated={() => void load()}
            billPreviewOptions={orderBillPreviewOptions}
          />
        </Panel>
        <Panel title="Your workspace" icon={Bike}>
          <EmployeeWorkspace
            profile={profile}
            shops={shops}
            products={products}
            resetNonce={workFormResetNonce}
            onSubmitWork={submitWorkUpdate}
            submitting={submittingWork}
          />
        </Panel>
        <Panel title="Email bill (your inbox)" icon={ClipboardList}>
          <form className="grid gap-3 md:max-w-xl" onSubmit={handleSendBillToCustomer}>
            <label className="grid gap-1.5 text-sm font-semibold text-foreground">
              Sale
              <select
                name="saleId"
                required
                defaultValue=""
                className="groobey-select h-11 w-full"
              >
                <option value="" disabled>
                  {recentSales.length ? "Choose sale" : "No recent verified sales"}
                </option>
                {recentSales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {saleDisplayId(sale, sales)} · {saleDisplayTime(sale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-foreground">
              Customer email (bill is sent here)
              <input
                name="customerEmail"
                type="email"
                placeholder="customer@example.com — leave blank to use your profile email"
                className="h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Resend delivers to this address. Verify a domain at resend.com/domains and set
              RESEND_FROM_EMAIL for production; free-tier testing may only allow one inbox until then.
            </p>
            <Button
              type="submit"
              variant="groobey"
              className="rounded-xl"
              disabled={sendingBill || !recentSales.length}
            >
              {sendingBill ? "Sending..." : "Send bill to customer email"}
            </Button>
          </form>
        </Panel>
      </div>
    </main>
  );
}
