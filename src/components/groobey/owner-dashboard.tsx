import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  ChevronRight,
  ClipboardList,
  Download,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  Pencil,
  PackagePlus,
  Percent,
  Plus,
  ReceiptText,
  ShoppingBasket,
  Store,
  Trash2,
  UsersRound,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { GroobeySelect } from "@/components/groobey/groobey-select-field";
import {
  GroobeySheetDialogBody,
  GroobeySheetDialogContent,
  GroobeySheetDialogFooter,
  GroobeySheetDialogHeader,
} from "@/components/groobey/groobey-sheet-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import {
  ADMIN_CUSTOMER_ORDERS_FOCUS,
  isAdminPlatformTab,
  normalizeAdminPlatformTab,
  SHOW_ATTENDANCE,
  SHOW_SETTLEMENT_BILLS,
} from "@/lib/groobey-site-visibility";
import { GroceryOrderItemsList } from "@/components/groobey/grocery-order-items-list";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_GROCERY_PACK,
  GROCERY_LIST_CATEGORY,
  isKnownPackSize,
  mergePackSizeOptions,
} from "@/lib/groobey-pack-sizes";
import { filterProductsByQuery } from "@/lib/groobey-product-catalog";
import { filterProductsByHomeCategory } from "@/lib/groobey-home-category-filter";
import { SHOP_COMBOS_CATEGORY_ID } from "@/lib/groobey-shop-browse";
import { isTransientDatabaseError, retryTransient } from "@/lib/groobey-retry";
import { setGroobeyNotificationNavigate } from "@/lib/groobey-notification-nav";
import { groobeySignOut } from "@/lib/groobey-auth-logout";
import { useGroobeyWorkspaceNotifications } from "@/lib/groobey-workspace-notifications";
import { backfillMySaleBillIds, salesMissingBillId } from "@/lib/groobey-bill-backfill";
import { formatGroobeyDateTime } from "@/lib/groobey-datetime";
import { BULLET, EM_DASH, formatInr, MIDDLE_DOT } from "@/lib/groobey-currency";
import { saleDisplayId, saleDisplayTime } from "@/lib/groobey-sale-display-id";
import { salesForPeriodAnalytics, salesForPipeline } from "@/lib/groobey-sales";
import {
  isOrderPipelineActive,
  orderNeedsDeliveryAssignment,
  ordersCompletedOnDay,
  sortActivePipelineOrders,
} from "@/lib/groobey-order-pipeline";
import {
  buildVerifiedSaleBillHtml,
  customerOrderBillEmailOrderBill,
  formatStaffBillLabel,
  openBillPrintGuarded,
  printCustomerOrderBill,
  resolveTradeMarginPercent,
  saleBillLinesForKind,
  sumMerchant,
  sumRetail,
  tradeBillLinesFromItems,
} from "@/lib/groobey-dual-bill";
import type {
  BillPreviewEmailResult,
  BillPreviewShowOptions,
} from "@/lib/groobey-bill-preview-bridge";
import {
  buildShopOwnerEmailByShopId,
  shopOwnerEmailForOrder,
} from "@/lib/groobey-shop-owner-email";
import { backfillCustomerOrdersClient, ordersMissingBillId } from "@/lib/groobey-bill-backfill";
import { formatCalendarMonthLabel } from "@/lib/groobey-order-month";
import {
  CUSTOMER_ORDER_SELECT,
  CUSTOMER_ORDER_SELECT_LEGACY,
  CUSTOMER_ORDER_SELECT_WITHOUT_DELIVERY_EXTRA,
  isMissingCustomerOrderShopIdError,
} from "@/lib/groobey-customer-order-columns";
import {
  isMissingCustomerOrderDeliveryFieldsError,
  supabaseErrorMessage,
} from "@/lib/groobey-delivery-order-fields";
import { GroobeyDashboardHeader } from "./groobey-brand-logo";
import { AdminCustomerInbox, type AdminCustomerRow } from "./groobey-admin-customer-inbox";
import { AdminCombosPanel, AdminCatalogCategoryRail } from "./groobey-admin-combos-panel";
import { GroobeyNotificationBell } from "./groobey-notification-bell";
import { GroobeyServiceRoleSetupPanel } from "./groobey-service-role-setup-panel";
import { BillKindButtons } from "./groobey-bill-buttons";
import {
  createStaffAccount,
  deleteStaffAccount,
  ensureMyGroobeyCode,
  getSetupStatus,
  listStaffAccounts,
  sendCustomerBillEmail,
  setStaffAccountActive,
  syncGroobeyCodes,
  updateMyProfile,
  updateStaffAccount,
} from "@/lib/tldGroobey.functions";

import { AccountForm } from "./groobey-forms";
import { GroobeyExcelCatalogUpload } from "./groobey-excel-catalog-upload";
import { TradeMarginPanel, type MarginSaveResult } from "./groobey-trade-margin-panel";
import {
  downloadGroceryCatalogExport,
  parseCatalogExcelBuffer,
} from "@/lib/groobey-excel-catalog";
import {
  buildGroobeyIdByUserId,
  formatPersonWithGroobeyId,
  groobeyIdForUser,
} from "@/lib/groobey-identity";
import { productCatalogKey } from "@/lib/groobey-product-catalog";
import { allocateSaleBillNumber, asBillRpcClient } from "@/lib/groobey-bill-id";
import {
  enrichSaleItemsWithPackUnit,
  isMissingSaleItemsProductUnitError,
  SALE_ITEMS_SELECT_LEGACY,
  SALE_ITEMS_SELECT_WITH_UNIT,
} from "@/lib/groobey-sale-items-columns";
import { clampMarginPercent, schemaSetupHint } from "@/lib/groobey-trade-margin";
import {
  EmptyState,
  Field,
  InlineFeedback,
  Message,
  Panel,
  ProductRow,
  Stat,
  VerifyList,
} from "./workspace-ui";

const ADMIN_PEOPLE_MODAL_TABS = [
  "shop-owners",
  "staff",
  "orders-team",
  "attendance",
] as const;
type AdminPeopleModalTab = (typeof ADMIN_PEOPLE_MODAL_TABS)[number];

function isAdminPeopleModalTab(value: string): value is AdminPeopleModalTab {
  return (ADMIN_PEOPLE_MODAL_TABS as readonly string[]).includes(value);
}

type AppRole = Database["public"]["Enums"]["app_role"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];
type Sale = Database["public"]["Tables"]["sales"]["Row"];
type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

const orderStatusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const DELIVERY_BOY_UNASSIGNED = "__unassigned__";

function customerOrderKey(order: Pick<CustomerOrder, "customer_phone" | "customer_name" | "id">): string {
  return (order.customer_phone || order.customer_name || order.id).trim().toLowerCase();
}

const orderStatusClass: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  packed: "bg-indigo-100 text-indigo-800",
  out_for_delivery: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

/** Order taker bills - make shop + bill ID easy to scan (mobile + desktop). */
const orderBillShopHighlightClass =
  "owner-admin-order-bill-highlight-shop inline-flex max-w-full truncate rounded-lg border border-sky-300/80 bg-sky-50 px-2 py-0.5 text-xs font-black text-sky-950 shadow-sm";
const orderBillIdHighlightClass =
  "owner-admin-order-bill-highlight-id inline-flex max-w-full truncate rounded-lg border border-emerald-400/70 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-950 shadow-sm";

function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold leading-none ${orderStatusClass[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {orderStatusLabel[status] ?? status}
    </span>
  );
}

function OrderBillLabeledHighlight({
  label,
  value,
  pillClassName,
  className,
}: {
  label: string;
  value: string;
  pillClassName: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "owner-admin-order-bill-labeled flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5",
        className,
      )}
    >
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={pillClassName}>{value}</span>
    </div>
  );
}

type StaffRow = {
  userId: string;
  role: AppRole;
  displayName: string;
  email: string | null;
  phone: string | null;
  groobeyId: string | null;
  isActive: boolean;
  joinedAt: string | null;
};

function sortProductsByNameUnit(list: Product[]): Product[] {
  return [...list].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a.unit.localeCompare(b.unit);
  });
}

export function OwnerDashboard() {
  const createAccount = useServerFn(createStaffAccount);
  const updateStaff = useServerFn(updateStaffAccount);
  const deleteStaff = useServerFn(deleteStaffAccount);
  const listStaff = useServerFn(listStaffAccounts);
  const setStaffActive = useServerFn(setStaffAccountActive);
  const syncCodes = useServerFn(syncGroobeyCodes);
  const ensureOwnCode = useServerFn(ensureMyGroobeyCode);
  const saveMyProfile = useServerFn(updateMyProfile);
  const sendBillEmail = useServerFn(sendCustomerBillEmail);
  const fetchSetupStatus = useServerFn(getSetupStatus);
  const customerBillOnly = !SHOW_SETTLEMENT_BILLS;

  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [settlementCustomerOrders, setSettlementCustomerOrders] = useState<CustomerOrder[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [shopOwnerProfileEmailByUserId, setShopOwnerProfileEmailByUserId] = useState<
    Map<string, string>
  >(() => new Map());
  const [attendanceFilter, setAttendanceFilter] = useState<
    "all" | "pending" | "verified" | "rejected"
  >("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [ordersCustomerFilter, setOrdersCustomerFilter] = useState<string | null>(null);
  const [serverSetup, setServerSetup] = useState<{ hasServiceRoleKey: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(false);
  const [tabAlerts, setTabAlerts] = useState<
    Record<string, { error?: string; notice?: string }>
  >({});
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const setError = (msg: string) => {
    const tab = activeTabRef.current;
    setTabAlerts((prev) => ({ ...prev, [tab]: { error: msg, notice: undefined } }));
  };
  const setNotice = (msg: string) => {
    const tab = activeTabRef.current;
    setTabAlerts((prev) => ({ ...prev, [tab]: { notice: msg, error: undefined } }));
  };
  function alertsFor(tab: string) {
    return tabAlerts[tab] ?? {};
  }
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingOwnProfile, setEditingOwnProfile] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [addName, setAddName] = useState("");
  const [addUnit, setAddUnit] = useState(DEFAULT_GROCERY_PACK);
  const [addPrice, setAddPrice] = useState("");
  const [addDefaultQty, setAddDefaultQty] = useState("1");
  const [savingGlobalMargin, setSavingGlobalMargin] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editPackUnit, setEditPackUnit] = useState(DEFAULT_GROCERY_PACK);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [staffDetailEditing, setStaffDetailEditing] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffRow | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  const [editingOrderTakerMargin, setEditingOrderTakerMargin] = useState("0");
  const [staffFormResetNonce, setStaffFormResetNonce] = useState(0);
  const hasSyncedWorkspace = useRef(false);
  const saleBillBackfillAttempted = useRef(false);
  const customerOrderBillBackfillAttempted = useRef(false);
  const customerOrderShopIdReady = useRef(true);
  const customerOrderDeliveryFieldsReady = useRef(true);
  const [assigningDeliveryOrderId, setAssigningDeliveryOrderId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomerRow | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const hasSyncedGroobeyCodes = useRef(false);
  const hasEnsuredOwnGroobeyCode = useRef(false);
  const workspaceLoadInFlight = useRef(false);

  const loadWorkspace = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      if (workspaceLoadInFlight.current) return;
      workspaceLoadInFlight.current = true;
      const silent = opts?.silent ?? false;
      if (!silent && !hasSyncedWorkspace.current) setLoading(true);
      setError("");
      try {
        const [productsRes, shopsRes, salesRes, attendanceRes, profileRes] = await retryTransient(
          () =>
            Promise.all([
              supabase
                .from("products")
                .select(
                  "id,name,unit,price,category,is_active,created_at,merchant_unit_price,default_quantity",
                )
                .order("name"),
              supabase
                .from("shops")
                .select(
                  "id,name,address,contact_name,phone,created_by,is_active,trade_margin_percent",
                )
                .order("name"),
              supabase
                .from("sales")
                .select(
                  "id,shop_id,created_by,status,created_at,sold_at,bill_number,destination_type,trade_margin_percent_applied,deleted_at",
                )
                .order("created_at", { ascending: false })
                .limit(200),
              supabase
                .from("attendance")
                .select(
                  "id,worker_id,work_date,status,verification_status,check_in,check_out,notes,created_at",
                )
                .order("work_date", { ascending: false })
                .limit(200),
              supabase
                .from("profiles")
                .select("user_id,display_name,email,phone,groobey_code,is_active,created_at")
                .eq("user_id", session.user.id)
                .maybeSingle(),
            ]),
          (responses) => responses.map((r) => r.error?.message).find(Boolean),
        );

        const [saleItemsResFirst, customerOrdersResFirst, settlementOrdersResFirst] =
          await Promise.all([
          supabase
            .from("sale_items")
            .select(SALE_ITEMS_SELECT_WITH_UNIT)
            .order("created_at", { ascending: false })
            .limit(800),
          supabase
            .from("customer_orders")
            .select(CUSTOMER_ORDER_SELECT)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("customer_orders")
            .select(CUSTOMER_ORDER_SELECT)
            .order("created_at", { ascending: false })
            .limit(500),
        ]);

        let saleItemsRes = saleItemsResFirst;
        if (
          saleItemsRes.error?.message &&
          isMissingSaleItemsProductUnitError(saleItemsRes.error.message)
        ) {
          saleItemsRes = await supabase
            .from("sale_items")
            .select(SALE_ITEMS_SELECT_LEGACY)
            .order("created_at", { ascending: false })
            .limit(800);
        }

        const workspaceError = [productsRes, shopsRes, salesRes, saleItemsRes, attendanceRes, profileRes]
          .map((r) => r.error?.message)
          .find(Boolean);
        if (workspaceError) {
          setNotice("");
          const hint = schemaSetupHint(workspaceError);
          setError(
            hint ??
              (isTransientDatabaseError(workspaceError) ?
                "Refreshing data. Please wait."
              : workspaceError),
          );
          if (isTransientDatabaseError(workspaceError))
            window.setTimeout(() => void loadWorkspace({ silent: true }), 900);
          return;
        }
        hasSyncedWorkspace.current = true;
        setProducts((productsRes.data ?? []) as Product[]);
        const nextShops = (shopsRes.data ?? []) as Shop[];
        setShops(nextShops);
        const ownerIds = [
          ...new Set(
            nextShops.map((shop) => shop.created_by).filter((id): id is string => Boolean(id?.trim())),
          ),
        ];
        if (ownerIds.length) {
          const ownerProfilesRes = await supabase
            .from("profiles")
            .select("user_id,email")
            .in("user_id", ownerIds);
          if (!ownerProfilesRes.error) {
            setShopOwnerProfileEmailByUserId(
              new Map(
                (ownerProfilesRes.data ?? [])
                  .map((row) => {
                    const email = row.email?.trim();
                    return email ? ([row.user_id, email] as const) : null;
                  })
                  .filter((entry): entry is readonly [string, string] => entry != null),
              ),
            );
          }
        } else {
          setShopOwnerProfileEmailByUserId(new Map());
        }
        const nextSales = (salesRes.data ?? []) as Sale[];
        setSales(nextSales);
        const catalogForUnits = (productsRes.data ?? []) as Product[];
        setSaleItems(
          enrichSaleItemsWithPackUnit(
            (saleItemsRes.data ?? []) as SaleItem[],
            catalogForUnits,
          ) as SaleItem[],
        );
        const missingSaleBills = salesMissingBillId(nextSales);
        if (missingSaleBills.length > 0 && !saleBillBackfillAttempted.current) {
          saleBillBackfillAttempted.current = true;
          void backfillMySaleBillIds(supabase, missingSaleBills).then((result) => {
            if (result.count > 0 && !result.error) void loadWorkspace({ silent: true });
          });
        }

        let customerOrdersRes = customerOrdersResFirst;
        const customerOrdersErrText = supabaseErrorMessage(customerOrdersRes.error);
        if (
          customerOrdersRes.error &&
          customerOrderShopIdReady.current &&
          isMissingCustomerOrderShopIdError(customerOrdersErrText)
        ) {
          customerOrderShopIdReady.current = false;
          customerOrdersRes = await supabase
            .from("customer_orders")
            .select(CUSTOMER_ORDER_SELECT_LEGACY)
            .order("created_at", { ascending: false })
            .limit(200);
        }
        const customerOrdersErrText2 = supabaseErrorMessage(customerOrdersRes.error);
        if (
          customerOrdersRes.error &&
          isMissingCustomerOrderDeliveryFieldsError(customerOrdersErrText2)
        ) {
          customerOrderDeliveryFieldsReady.current = false;
          const fallbackSelect = customerOrderShopIdReady.current
            ? CUSTOMER_ORDER_SELECT_WITHOUT_DELIVERY_EXTRA
            : CUSTOMER_ORDER_SELECT_LEGACY;
          customerOrdersRes = await supabase
            .from("customer_orders")
            .select(fallbackSelect)
            .order("created_at", { ascending: false })
            .limit(200);
        }
        if (customerOrdersRes.error) {
          const errMsg = supabaseErrorMessage(customerOrdersRes.error);
          setNotice("");
          const hint = schemaSetupHint(errMsg);
          setError(
            hint ??
              (isTransientDatabaseError(errMsg) ?
                "Refreshing data. Please wait."
              : errMsg),
          );
          return;
        }
        const nextCustomerOrders = (customerOrdersRes.data ?? []) as CustomerOrder[];
        setCustomerOrders(nextCustomerOrders);
        if (!settlementOrdersResFirst.error) {
          setSettlementCustomerOrders((settlementOrdersResFirst.data ?? []) as CustomerOrder[]);
        } else {
          setSettlementCustomerOrders(nextCustomerOrders);
        }
        const missingOrderBills = ordersMissingBillId(nextCustomerOrders);
        if (missingOrderBills.length > 0 && !customerOrderBillBackfillAttempted.current) {
          customerOrderBillBackfillAttempted.current = true;
          void backfillCustomerOrdersClient(supabase, missingOrderBills).then((result) => {
            if (result.count > 0 && !result.error) void loadWorkspace({ silent: true });
          });
        }

        setAttendance((attendanceRes.data ?? []) as Attendance[]);
        setAdminProfile((profileRes.data ?? null) as Profile | null);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unable to load dashboard workspace.";
        setNotice("");
        setError(message);
      } finally {
        workspaceLoadInFlight.current = false;
        setLoading(false);
      }
    },
    [session?.user],
  );

  const loadStaff = useCallback(
    async (opts?: { quietListError?: boolean }) => {
      setStaffLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let token = (sessionData.session?.access_token ?? "").trim();
        if (!token && session?.access_token) token = session.access_token.trim();
        if (!token) {
          setStaffRows([]);
          return;
        }
        const result = await listStaff({
          data: { requesterToken: token },
          headers: { Authorization: `Bearer ${token}` },
        });
        setStaffRows(result.staff);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to load staff.";
        if (opts?.quietListError) {
          console.warn("[groobey] loadStaff (quiet):", msg);
        } else {
          setNotice("");
          setError(msg);
        }
      } finally {
        setStaffLoading(false);
      }
    },
    [listStaff, session?.access_token],
  );

  useEffect(() => {
    void fetchSetupStatus()
      .then((status) => setServerSetup(status))
      .catch(() => setServerSetup({ hasServiceRoleKey: false }));
  }, [fetchSetupStatus]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    hasSyncedWorkspace.current = false;
  }, [session?.user?.id]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);
  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setInterval(() => void loadWorkspace({ silent: true }), 60_000);
    return () => window.clearInterval(timer);
  }, [loadWorkspace, session?.user]);

  const adminNotifications = useGroobeyWorkspaceNotifications({
    userId: session?.user?.id,
    mode: "admin",
    onRefresh: () => void loadWorkspace({ silent: true }),
  });

  useEffect(() => {
    setGroobeyNotificationNavigate((action) => {
      if (action.dashboard !== "admin") return;
      if (action.tab) setActiveTab(normalizeAdminPlatformTab(action.tab));
      window.requestAnimationFrame(() => {
        document.querySelector(".groobey-dashboard-body")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
    return () => setGroobeyNotificationNavigate(null);
  }, []);

  useEffect(() => {
    if (!ADMIN_CUSTOMER_ORDERS_FOCUS) return;
    if (!isAdminPlatformTab(activeTab)) setActiveTab("overview");
  }, [activeTab]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (!editingProduct) return;
    setEditPackUnit(
      isKnownPackSize(editingProduct.unit) ? editingProduct.unit : DEFAULT_GROCERY_PACK,
    );
  }, [editingProduct?.id, editingProduct?.unit]);

  useEffect(() => {
    const orderTakerId =
      staffDetailEditing ? editingStaff?.userId : selectedStaff?.userId;
    const isOrderTaker =
      staffDetailEditing
        ? editingStaff?.role === "order_taker"
        : selectedStaff?.role === "order_taker";
    if (!orderTakerId || !isOrderTaker) return;
    void supabase
      .from("profiles")
      .select("trade_margin_percent")
      .eq("user_id", orderTakerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) setEditingOrderTakerMargin(String(data?.trade_margin_percent ?? 0));
      });
  }, [
    staffDetailEditing,
    editingStaff?.userId,
    editingStaff?.role,
    selectedStaff?.userId,
    selectedStaff?.role,
  ]);

  useEffect(() => {
    if (!session?.user) return;
    if (
      isAdminPeopleModalTab(activeTab) ||
      activeTab === "create-logins"
    ) {
      void loadStaff();
    }
  }, [activeTab, loadStaff, session?.user]);

  useEffect(() => {
    if (!selectedStaff || staffDetailEditing) return;
    const fresh = staffRows.find((r) => r.userId === selectedStaff.userId);
    if (!fresh) return;
    setSelectedStaff((prev) => {
      if (!prev || prev.userId !== fresh.userId) return fresh;
      if (
        prev.displayName === fresh.displayName &&
        prev.email === fresh.email &&
        prev.phone === fresh.phone &&
        prev.isActive === fresh.isActive &&
        prev.groobeyId === fresh.groobeyId &&
        prev.role === fresh.role
      ) {
        return prev;
      }
      return fresh;
    });
  }, [staffRows, selectedStaff?.userId, staffDetailEditing]);

  function openStaffDetail(row: StaffRow) {
    setSelectedStaff(row);
    setEditingStaff(null);
    setStaffDetailEditing(false);
  }

  function closeStaffDetail() {
    setSelectedStaff(null);
    setEditingStaff(null);
    setStaffDetailEditing(false);
  }

  function startStaffDetailEdit() {
    if (!selectedStaff) return;
    setEditingStaff(selectedStaff);
    setStaffDetailEditing(true);
  }

  function cancelStaffDetailEdit() {
    setEditingStaff(null);
    setStaffDetailEditing(false);
  }

  function openAttendanceDetail(row: Attendance) {
    setSelectedAttendance(row);
  }

  function closeAttendanceDetail() {
    setSelectedAttendance(null);
  }

  useEffect(() => {
    if (!session?.access_token || hasSyncedGroobeyCodes.current) return;
    hasSyncedGroobeyCodes.current = true;
    void syncCodes({ data: { requesterToken: session.access_token } })
      .then(() => void loadWorkspace({ silent: true }))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Unable to sync Groobey IDs.");
      });
  }, [loadWorkspace, session?.access_token, syncCodes]);

  useEffect(() => {
    if (!session?.access_token) return;
    if (adminProfile?.groobey_code?.trim()) return;
    if (hasEnsuredOwnGroobeyCode.current) return;
    hasEnsuredOwnGroobeyCode.current = true;
    void ensureOwnCode({ data: { requesterToken: session.access_token } })
      .then(() => void loadWorkspace({ silent: true }))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Unable to generate your Groobey ID.");
      });
  }, [adminProfile?.groobey_code, ensureOwnCode, loadWorkspace, session?.access_token]);

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const role = String(form.get("role")) as AppRole;
    const shopOwnerName = String(form.get("shopOwnerName") || "").trim();
    const displayName =
      role === "merchant" ? shopOwnerName : String(form.get("displayName") || "").trim();
    const email = String(form.get("email") || "");
    const phone = String(form.get("phone") || "");
    const password = String(form.get("newPassword") || "");
    const shopName = String(form.get("shopName") || "").trim();
    const shopPhone = String(form.get("shopPhone") || "").trim();
    const shopAddress = String(form.get("address") || "").trim();
    if (role === "merchant" && (!shopName || !shopOwnerName || !shopPhone || !shopAddress)) {
      setError("Shop Owner login requires all shop fields.");
      return;
    }
    try {
      const { data: sessionData, error: sessionReadError } = await supabase.auth.getSession();
      if (sessionReadError) {
        setError(sessionReadError.message);
        return;
      }
      const live = sessionData.session;
      // Prefer React state (auth listener / memory) then persisted session -- they can diverge briefly.
      let accessToken = (session?.access_token || live?.access_token || "").trim();
      const refreshToken = (session?.refresh_token || live?.refresh_token || "").trim();
      // `refreshSession()` throws "Auth session missing!" if there is no refresh token -- only call when we have one.
      if (!accessToken && refreshToken) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          const msg = refreshError.message || "";
          if (/session missing|auth session missing/i.test(msg)) {
            setError("Your session expired. Please log in again.");
          } else {
            setError(msg);
          }
          return;
        }
        accessToken = (refreshed.session?.access_token ?? "").trim();
      }
      if (!accessToken) {
        setError(
          "Could not read your login session. Open the app from the same browser tab where you signed in, or sign out and sign in again.",
        );
        return;
      }
      const result = await createAccount({
        data: {
          requesterToken: accessToken,
          displayName,
          email,
          phone,
          password: role === "employee" ? "" : password,
          role,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if ("pendingSignup" in result && result.pendingSignup) {
        setNotice(
          `Delivery boy assigned for ${result.email}. Ask them to create an account at Register on the website, then sign in.`,
        );
        formElement.reset();
        setStaffFormResetNonce((prev) => prev + 1);
        await loadStaff({ quietListError: true });
        return;
      }
      const optimisticRow: StaffRow = {
        userId: result.userId,
        role,
        displayName,
        email: email || null,
        phone: phone || null,
        groobeyId: result.groobeyId ?? null,
        isActive: true,
        joinedAt: new Date().toISOString(),
      };
      setStaffRows((prev) => [
        optimisticRow,
        ...prev.filter((row) => row.userId !== optimisticRow.userId),
      ]);
      if (role === "merchant") {
        const { error: shopError } = await supabase.from("shops").insert({
          name: shopName,
          contact_name: shopOwnerName,
          phone: shopPhone,
          address: shopAddress,
          created_by: result.userId,
          is_active: true,
        } as never);
        if (shopError) {
          throw new Error(`Login created but shop save failed: ${shopError.message}`);
        }
      }
      setNotice("Staff login created.");
      formElement.reset();
      setStaffFormResetNonce((prev) => prev + 1);
      await loadStaff({ quietListError: true });
      window.setTimeout(() => void loadStaff({ quietListError: true }), 1000);
    } catch (accountError) {
      setNotice("");
      setError(accountError instanceof Error ? accountError.message : "Unable to create account.");
    }
  }

  async function toggleStaff(userId: string, next: boolean) {
    if (!session?.access_token) return;
    setError("");
    try {
      await setStaffActive({
        data: { requesterToken: session.access_token, userId, isActive: next },
      });
      setNotice(next ? "Account activated." : "Account deactivated.");
      void loadStaff();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update staff.");
    }
  }

  async function handleUpdateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token || !editingStaff) return;
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await updateStaff({
        data: {
          requesterToken: session.access_token,
          userId: editingStaff.userId,
          displayName: String(form.get("displayName") || ""),
          email: String(form.get("email") || ""),
          phone: String(form.get("phone") || ""),
        },
      });
      if (editingStaff.role === "order_taker") {
        const pct = clampMarginPercent(Number(form.get("tradeMarginPercent") || 0));
        const { error: marginErr } = await supabase
          .from("profiles")
          .update({ trade_margin_percent: pct } as never)
          .eq("user_id", editingStaff.userId);
        if (marginErr) throw new Error(marginErr.message);
      }
      if (editingStaff.role === "merchant") {
        const shopName = String(form.get("shopName") || "").trim();
        const shopAddress = String(form.get("shopAddress") || "").trim();
        const existingShop = shopByOwnerId.get(editingStaff.userId);
        if (existingShop) {
          const marginRaw = form.get("tradeMarginPercent");
          const shopPatch: Record<string, unknown> = {
            name: shopName || existingShop.name,
            address: shopAddress || existingShop.address,
          };
          if (marginRaw != null && String(marginRaw).trim() !== "") {
            shopPatch.trade_margin_percent = clampMarginPercent(Number(marginRaw));
          }
          const { error: shopError } = await supabase
            .from("shops")
            .update(shopPatch as never)
            .eq("id", existingShop.id);
          if (shopError) throw new Error(shopError.message);
        } else {
          const { error: shopInsertError } = await supabase.from("shops").insert({
            name:
              shopName || `${String(form.get("displayName") || "").trim() || "Shop Owner"} Shop`,
            contact_name: String(form.get("displayName") || "").trim() || null,
            phone: String(form.get("phone") || "").trim() || null,
            address: shopAddress || null,
            created_by: editingStaff.userId,
            is_active: true,
          } as never);
          if (shopInsertError) throw new Error(shopInsertError.message);
        }
      }
      setNotice("Staff login updated.");
      setStaffDetailEditing(false);
      setEditingStaff(null);
      void loadWorkspace({ silent: true });
      void loadStaff({ quietListError: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update staff.");
    }
  }

  async function handleSaveMyProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token) return;
    setError("");
    setSavingProfile(true);
    const form = new FormData(event.currentTarget);
    try {
      await saveMyProfile({
        data: {
          requesterToken: session.access_token,
          displayName: String(form.get("displayName") || "").trim(),
          email: String(form.get("email") || "").trim(),
          phone: String(form.get("phone") || "").trim(),
        },
      });
      setNotice("Profile updated.");
      setEditingOwnProfile(false);
      void loadWorkspace({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteStaff(row: StaffRow) {
    if (!session?.access_token) return;
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`Delete ${row.displayName || "this staff account"}?`)
        : false;
    if (!ok) return;
    setError("");
    try {
      await deleteStaff({
        data: { requesterToken: session.access_token, userId: row.userId },
      });
      setNotice("Staff login deleted.");
      if (selectedStaff?.userId === row.userId) closeStaffDetail();
      else setEditingStaff((prev) => (prev?.userId === row.userId ? null : prev));
      setStaffRows((prev) => prev.filter((item) => item.userId !== row.userId));
      void loadStaff();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete staff.");
    }
  }

  function exportCatalogExcel() {
    if (!products.length) {
      setError("Catalog is empty. Add items or upload Excel first.");
      return;
    }
    downloadGroceryCatalogExport(
      products.map((p) => ({
        name: p.name,
        unit: p.unit,
        price: Number(p.price || 0),
        default_quantity: p.default_quantity,
        category: p.category,
      })),
    );
    setNotice(`Downloaded ${products.length} grocery line(s) as TLD GROOBY Excel.`);
  }

  async function importProductsFromExcel(file: File) {
    if (!session?.user) return;
    setError("");
    setImportingExcel(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseCatalogExcelBuffer(buffer);
      if (!parsed.rows.length) {
        setError(parsed.errors.join(" ") || "No valid rows in the spreadsheet.");
        return;
      }
      const byKey = new Map(products.map((p) => [productCatalogKey(p.name, p.unit), p]));
      let created = 0;
      let updated = 0;
      const nextProducts = [...products];

      for (const row of parsed.rows) {
        const key = productCatalogKey(row.name, row.unit);
        const existing = byKey.get(key);
        const payload = {
          name: row.name,
          unit: row.unit,
          price: row.price,
          merchant_unit_price: row.price,
          default_quantity: row.defaultQuantity,
          category: row.category?.trim() || GROCERY_LIST_CATEGORY,
        };
        if (existing) {
          const { data: updatedRow, error: updErr } = await supabase
            .from("products")
            .update(payload as never)
            .eq("id", existing.id)
            .select()
            .single();
          if (updErr) {
            setError(updErr.message);
            return;
          }
          if (updatedRow) {
            const idx = nextProducts.findIndex((p) => p.id === existing.id);
            if (idx >= 0) nextProducts[idx] = updatedRow as Product;
            byKey.set(key, updatedRow as Product);
            updated++;
          }
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from("products")
            .insert({ ...payload, created_by: session.user.id } as never)
            .select()
            .single();
          if (insErr) {
            setError(insErr.message);
            return;
          }
          if (inserted) {
            nextProducts.push(inserted as Product);
            byKey.set(key, inserted as Product);
            created++;
          }
        }
      }

      setProducts(sortProductsByNameUnit(nextProducts));
      const warn =
        parsed.errors.length ? ` ${parsed.errors.slice(0, 3).join(" ")}` : "";
      setNotice(
        `Excel import (${parsed.format === "tld_groobey" ? "TLD GROOBY" : "standard"}): ${parsed.rows.length} catalog line(s) ${EM_DASH} ${created} added, ${updated} updated.${warn}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Excel import failed.");
    } finally {
      setImportingExcel(false);
    }
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = addName.trim();
    if (!name) {
      setError("Choose or type a grocery item name.");
      return;
    }
    setError("");
    const unit = isKnownPackSize(addUnit) ? addUnit : DEFAULT_GROCERY_PACK;
    const retail = Number(addPrice || 0);
    const defaultQty = Math.max(1, Math.round(Number(addDefaultQty || 1)));
    const { data: row, error: productError } = await supabase
      .from("products")
      .insert({
        name,
        category: GROCERY_LIST_CATEGORY,
        unit,
        price: retail,
        merchant_unit_price: retail,
        default_quantity: defaultQty,
        created_by: session?.user.id,
      } as never)
      .select()
      .single();
    if (productError) setError(productError.message);
    else if (row) {
      setProducts((prev) => sortProductsByNameUnit([...prev, row]));
      setAddName("");
      setAddUnit(DEFAULT_GROCERY_PACK);
      setAddPrice("");
      setAddDefaultQty("1");
      setNotice("Product added.");
    }
  }

  async function updateProductFromForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const unitRaw = String(form.get("unit") || "").trim();
    const unit = isKnownPackSize(unitRaw) ? unitRaw : editingProduct.unit;
    const defaultQty = Math.max(1, Math.round(Number(form.get("default_quantity") || 1)));
    const { data: updated, error: productError } = await supabase
      .from("products")
      .update({
        name: String(form.get("name") || "").trim(),
        unit,
        price: Number(form.get("price") || 0),
        merchant_unit_price: Number(form.get("price") || 0),
        default_quantity: defaultQty,
        category: GROCERY_LIST_CATEGORY,
      } as never)
      .eq("id", editingProduct.id)
      .select()
      .single();
    if (productError) setError(productError.message);
    else if (updated) {
      setProducts((prev) =>
        sortProductsByNameUnit(prev.map((p) => (p.id === updated.id ? updated : p))),
      );
      setEditingProduct(null);
      setNotice("Product updated.");
    }
  }

  async function updateRate(productId: string, nextPrice: number) {
    const { data: updated, error: productError } = await supabase
      .from("products")
      .update({ price: nextPrice, merchant_unit_price: nextPrice } as never)
      .eq("id", productId)
      .select()
      .single();
    if (productError) setError(productError.message);
    else if (updated) {
      setProducts((prev) =>
        sortProductsByNameUnit(prev.map((p) => (p.id === productId ? updated : p))),
      );
      setNotice("Retail rate updated.");
    }
  }

  async function saveGlobalTradeMargin(nextPercent: number): Promise<MarginSaveResult> {
    setSavingGlobalMargin(true);
    const pct = clampMarginPercent(nextPercent);
    let shopIds = shops.map((s) => s.id).filter(Boolean);
    if (shopIds.length === 0) {
      const { data: shopRows, error: listErr } = await supabase.from("shops").select("id");
      if (listErr) {
        setSavingGlobalMargin(false);
        return { error: listErr.message };
      }
      shopIds = (shopRows ?? []).map((s) => s.id);
    }
    if (shopIds.length === 0) {
      setSavingGlobalMargin(false);
      return { error: "No shops yet. Create a shop owner with a shop first." };
    }
    const { data: updated, error: shopError } = await supabase
      .from("shops")
      .update({ trade_margin_percent: pct } as never)
      .in("id", shopIds)
      .select("id");
    setSavingGlobalMargin(false);
    if (shopError) {
      const hint = schemaSetupHint(shopError.message);
      return { error: hint ?? shopError.message };
    }
    const count = updated?.length ?? 0;
    setShops((prev) => prev.map((s) => ({ ...s, trade_margin_percent: pct })));
    return {
      notice: `Groobey margin set to ${pct}% on ${count} shop${count === 1 ? "" : "s"}. New sales use this % on every line.`,
    };
  }

  async function deleteProduct(productId: string) {
    const { error: productError } = await supabase.from("products").delete().eq("id", productId);
    if (productError) setError(productError.message);
    else {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      if (editingProduct?.id === productId) setEditingProduct(null);
      setNotice("Product removed.");
    }
  }

  async function updateSaleVerification(
    saleId: string,
    status: Database["public"]["Enums"]["verification_status"],
  ) {
    if (!session?.user) return;
    setError("");
    const patch: Record<string, unknown> = {
      status,
      verified_by: session.user.id,
      verified_at: new Date().toISOString(),
    };
    if (status === "verified") {
      const { data: fresh, error: selErr } = await supabase
        .from("sales")
        .select("bill_number")
        .eq("id", saleId)
        .maybeSingle();
      if (selErr) {
        setError(selErr.message);
        return;
      }
      if (!fresh?.bill_number) {
        const { billNo: nextBill, error: rpcError } = await allocateSaleBillNumber(
          asBillRpcClient(supabase),
        );
        if (rpcError) {
          setError(rpcError.message);
          return;
        }
        if (!nextBill) {
          setError("Could not assign bill number.");
          return;
        }
        patch.bill_number = nextBill;
      }
    }
    const { error: saleError } = await supabase
      .from("sales")
      .update(patch as never)
      .eq("id", saleId);
    if (saleError) setError(saleError.message);
    else {
      setNotice(`Sale ${status}.`);
      void loadWorkspace({ silent: true });
    }
  }

  const shopOwnerEmailByShopId = useMemo(() => {
    const profileEmailByUserId = new Map(shopOwnerProfileEmailByUserId);
    for (const row of staffRows) {
      const email = row.email?.trim();
      if (email && !profileEmailByUserId.has(row.userId)) {
        profileEmailByUserId.set(row.userId, email);
      }
    }
    return buildShopOwnerEmailByShopId(shops, profileEmailByUserId);
  }, [shopOwnerProfileEmailByUserId, shops, staffRows]);

  const adminBillActorLabel = useMemo(
    () =>
      formatStaffBillLabel({
        displayName:
          adminProfile?.display_name?.trim() ||
          String(session?.user?.user_metadata?.display_name || "").trim() ||
          "Platform Admin",
        groobeyCode: adminProfile?.groobey_code ?? null,
      }),
    [adminProfile?.display_name, adminProfile?.groobey_code, session?.user?.user_metadata?.display_name],
  );

  function saleEmailItemRows(sale: Sale) {
    return saleItems
      .filter((item) => item.sale_id === sale.id)
      .map((row) => ({
        name: row.product_name,
        quantity: Number(row.quantity || 0),
        packUnit: row.product_unit ?? undefined,
        unitPrice: Number(row.unit_price || 0),
        merchantUnitPrice: Number(row.merchant_unit_price ?? row.unit_price ?? 0),
      }));
  }

  async function sendAdminSaleCustomerBillEmail(
    sale: Sale,
    customerEmail: string,
  ): Promise<BillPreviewEmailResult> {
    if (!session?.access_token) return { error: "Not signed in." };
    const trimmed = customerEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: "Enter a valid customer email address." };
    }
    const shop = shops.find((item) => item.id === sale.shop_id);
    try {
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail: trimmed,
          subject:
            sale.bill_number ?
              `Bill ${sale.bill_number} - ${GROOBEY_APP_NAME}`
            : `Bill - ${GROOBEY_APP_NAME}`,
          shopName: shop?.name ?? GROOBEY_APP_NAME,
          ownerName: adminBillActorLabel,
          billDate: (sale.sold_at || sale.created_at || "").slice(0, 16),
          billKind: "customer",
          billNumber: sale.bill_number?.trim() || undefined,
          items: saleEmailItemRows(sale),
        },
      });
      return { notice: `Customer bill emailed to ${result.deliveredTo}.` };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unable to send bill email." };
    }
  }

  async function sendAdminSaleTradeBillEmail(
    sale: Sale,
    shopOwnerEmail: string,
  ): Promise<BillPreviewEmailResult> {
    if (!session?.access_token) return { error: "Not signed in." };
    const shop = shops.find((item) => item.id === sale.shop_id);
    if (!shop?.id) {
      return { error: "Link this sale to a shop before emailing the trade bill." };
    }
    const trimmed = shopOwnerEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: "Enter a valid shop owner email address." };
    }
    try {
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail: trimmed,
          shopId: shop.id,
          subject:
            sale.bill_number ?
              `Settlement bill ${sale.bill_number} - ${shop.name}`
            : `Settlement bill - ${shop.name}`,
          shopName: shop.name,
          ownerName: adminBillActorLabel,
          billDate: (sale.sold_at || sale.created_at || "").slice(0, 16),
          billKind: "merchant",
          billNumber: sale.bill_number?.trim() || undefined,
          items: saleEmailItemRows(sale),
        },
      });
      return { notice: `Trade bill emailed to ${result.deliveredTo}.` };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unable to send trade bill email." };
    }
  }

  function saleBillPreviewOptions(
    sale: Sale,
    kind: "customer" | "merchant",
  ): BillPreviewShowOptions | undefined {
    if (!session?.access_token) return undefined;
    if (kind === "customer") {
      return {
        email: {
          defaultEmail: "",
          send: (customerEmail) => sendAdminSaleCustomerBillEmail(sale, customerEmail),
        },
      };
    }
    const shopId = sale.shop_id?.trim();
    return {
      settlementEmail: {
        defaultEmail: shopId ? shopOwnerEmailByShopId.get(shopId) ?? "" : "",
        shopId,
        send: (shopOwnerEmail) => sendAdminSaleTradeBillEmail(sale, shopOwnerEmail),
      },
    };
  }

  function shopMarginPercentForOrder(order: CustomerOrder) {
    if (order.shop_id) {
      const shop = shops.find((item) => item.id === order.shop_id);
      return clampMarginPercent(
        Number(shop?.trade_margin_percent ?? order.trade_margin_percent_applied ?? 0),
      );
    }
    return clampMarginPercent(Number(order.trade_margin_percent_applied ?? 0));
  }

  async function sendAdminOrderCustomerBillEmail(
    order: CustomerOrder,
    customerEmail: string,
  ): Promise<BillPreviewEmailResult> {
    if (!session?.access_token) return { error: "Not signed in." };
    const trimmed = customerEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: "Enter a valid customer email address." };
    }
    const shopName = order.shop_id ? shops.find((item) => item.id === order.shop_id)?.name : undefined;
    try {
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail: trimmed,
          subject: `Bill ${order.bill_number || ""} - ${GROOBEY_APP_NAME}`.trim(),
          shopName: GROOBEY_APP_NAME,
          ownerName: adminBillActorLabel,
          billDate: (order.created_at || "").slice(0, 16),
          billKind: "customer",
          billNumber: order.bill_number?.trim() || undefined,
          orderBill: customerOrderBillEmailOrderBill(order, shopName),
        },
      });
      return { notice: `Customer bill emailed to ${result.deliveredTo}.` };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unable to send bill email." };
    }
  }

  async function sendAdminOrderTradeBillEmail(
    order: CustomerOrder,
    shopOwnerEmail: string,
  ): Promise<BillPreviewEmailResult> {
    if (!session?.access_token) return { error: "Not signed in." };
    if (!order.shop_id?.trim()) {
      return { error: "Link this order to a shop before emailing the trade bill." };
    }
    const trimmed = shopOwnerEmail.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: "Enter a valid shop owner email address." };
    }
    const shopName = shops.find((item) => item.id === order.shop_id)?.name ?? "Shop";
    try {
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail: trimmed,
          shopId: order.shop_id,
          subject: `Settlement bill ${order.bill_number || ""} - ${shopName}`.trim(),
          shopName,
          ownerName: adminBillActorLabel,
          billDate: (order.created_at || "").slice(0, 16),
          billKind: "merchant",
          billNumber: order.bill_number?.trim() || undefined,
          orderBill: customerOrderBillEmailOrderBill(order, shopName, {
            forMerchant: true,
            shopMarginPercent: shopMarginPercentForOrder(order),
          }),
        },
      });
      return { notice: `Trade bill emailed to ${result.deliveredTo}.` };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Unable to send trade bill email." };
    }
  }

  function orderBillPreviewOptions(
    order: CustomerOrder,
    kind: "customer" | "merchant",
  ): BillPreviewShowOptions | undefined {
    if (!session?.access_token) return undefined;
    const defaultCustomerEmail =
      order.customer_phone?.includes("@") ? order.customer_phone.trim() : "";
    if (kind === "customer") {
      return {
        email: {
          defaultEmail: defaultCustomerEmail,
          send: (customerEmail) => sendAdminOrderCustomerBillEmail(order, customerEmail),
        },
      };
    }
    return {
      settlementEmail: {
        defaultEmail: shopOwnerEmailForOrder(order, shopOwnerEmailByShopId),
        shopId: order.shop_id?.trim() || undefined,
        send: (shopOwnerEmail) => sendAdminOrderTradeBillEmail(order, shopOwnerEmail),
      },
    };
  }

  function exportSaleBill(saleId: string, kind: "customer" | "merchant") {
    const sale = sales.find((row) => row.id === saleId);
    if (!sale) return;
    const rows = saleItems.filter((item) => item.sale_id === saleId);
    const shop = shops.find((item) => item.id === sale.shop_id);
    const creatorId = sale.created_by;
    const staffRow = creatorId ? staffRows.find((r) => r.userId === creatorId) : undefined;
    const displayName =
      (creatorId && staffNameByUserId.get(creatorId)) ||
      staffRow?.displayName?.trim() ||
      "Shop staff";
    const ownerOrShopLabel =
      creatorId ?
        formatStaffBillLabel({
          displayName,
          groobeyCode: staffRow?.groobeyId ?? null,
        })
      : EM_DASH;
    const marginPct = resolveTradeMarginPercent({
      saleApplied: sale.trade_margin_percent_applied,
      shopMargin: shop?.trade_margin_percent,
      items: rows,
    });
    const lines = saleBillLinesForKind(rows, kind, marginPct);
    const html = buildVerifiedSaleBillHtml({
      kind,
      billNumber: sale.bill_number ?? null,
      shopName: shop?.name ?? "Shop",
      ownerOrShopLabel,
      dateLabel: (sale.sold_at || sale.created_at || "").slice(0, 16),
      lines,
      appliedGroobeyMarginPercent: kind === "merchant" ? marginPct : undefined,
    });
    openBillPrintGuarded(html, kind, saleBillPreviewOptions(sale, kind));
  }

  async function assignOrderDeliveryBoy(orderId: string, deliveryUserId: string) {
    if (!customerOrderDeliveryFieldsReady.current) {
      setError("Run the latest database migration to assign delivery boys.");
      return;
    }
    setAssigningDeliveryOrderId(orderId);
    const { error } = await supabase
      .from("customer_orders")
      .update({ assigned_delivery_user_id: deliveryUserId || null } as never)
      .eq("id", orderId);
    setAssigningDeliveryOrderId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setCustomerOrders((prev) =>
      prev.map((row) =>
        row.id === orderId ?
          { ...row, assigned_delivery_user_id: deliveryUserId || null }
        : row,
      ),
    );
    setNotice("Delivery boy assigned for this order.");
  }

  function exportCustomerOrderBill(orderId: string, kind: "customer" | "merchant") {
    const effectiveKind = customerBillOnly ? "customer" : kind;
    const order = customerOrders.find((row) => row.id === orderId);
    if (!order) return;
    const shop = order.shop_id ? shops.find((s) => s.id === order.shop_id) : undefined;
    const takerRow = staffRows.find((r) => r.userId === order.created_by);
    const displayName =
      staffNameByUserId.get(order.created_by) ||
      takerRow?.displayName?.trim() ||
      (ADMIN_CUSTOMER_ORDERS_FOCUS ? "Online customer" : "Order taker");
    const orderTakerLabel = formatStaffBillLabel({
      displayName,
      groobeyCode: takerRow?.groobeyId ?? null,
    });
    const opened = printCustomerOrderBill({
      kind: effectiveKind,
      order,
      shopName: shop?.name ?? null,
      orderTakerLabel,
      shopMarginPercent: shopMarginPercentForOrder(order),
      preview: orderBillPreviewOptions(order, effectiveKind),
    });
    if (opened && effectiveKind === "merchant") {
      setNotice(`Settlement bill opened ${EM_DASH} same Bill ID as the customer copy.`);
    }
  }

  async function archiveCustomerOrder(orderId: string) {
    const order = customerOrders.find((row) => row.id === orderId);
    if (!order) return;
    const ok = window.confirm(
      "Remove this order bill from the list?\n\n" +
        `${BULLET} Monthly settlement export still includes it\n` +
        `${BULLET} Bill ID is kept for records`,
    );
    if (!ok) return;
    setError("");
    const { error: rpcError } = await supabase.rpc("archive_customer_order", {
      p_order_id: orderId,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNotice("Order bill removed from list. It still counts in monthly settlement.");
    void loadWorkspace({ silent: true });
  }

  async function archiveSale(saleId: string) {
    const sale = sales.find((row) => row.id === saleId);
    if (!sale || sale.status === "pending") return;
    const ok = window.confirm(
      "Remove this sale from the sales list?\n\n" +
        `${BULLET} Weekly and monthly totals stay the same\n` +
        `${BULLET} Bill numbers are kept for monthly settlement\n` +
        `${BULLET} You can still export this month's settlement below`,
    );
    if (!ok) return;
    setError("");
    const { error: rpcError } = await supabase.rpc("archive_sale", { p_sale_id: saleId });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNotice("Sale removed from list. It still counts in period analytics.");
    void loadWorkspace({ silent: true });
  }

  async function exportMonthSalesSettlement() {
    const month = new Date().toISOString().slice(0, 7);
    const monthLabel = formatCalendarMonthLabel(month);
    const shopNameById = new Map(shops.map((s) => [s.id, s.name]));
    const shopMarginById = new Map(shops.map((s) => [s.id, s.trade_margin_percent]));
    const monthVerified = sales.filter(
      (s) =>
        s.status === "verified" &&
        (s.sold_at || s.created_at || "").slice(0, 7) === month,
    );
    const monthOrders = settlementCustomerOrders.filter(
      (o) => (o.created_at || "").slice(0, 7) === month,
    );
    try {
      const { exportSettlementMonthExcel } = await import("@/lib/groobey-excel-exports");
      await exportSettlementMonthExcel({
        monthKey: month,
        monthLabel,
        sales: monthVerified,
        saleItems,
        orders: monthOrders,
        shopNameById,
        shopMarginById,
      });
      setNotice(
        `Downloaded ${monthLabel} settlement Excel - ${monthVerified.length} merchant sale(s) and ${monthOrders.length} order-taker bill(s), including removed-from-list rows. Times are 12-hour AM/PM.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to export settlement Excel.");
    }
  }

  async function updateAttendanceVerification(
    attendanceId: string,
    status: Database["public"]["Enums"]["verification_status"],
  ) {
    if (!session?.user) return;
    const verifiedAt = new Date().toISOString();
    const { error: attendanceError } = await supabase
      .from("attendance")
      .update({
        verification_status: status,
        verified_by: session.user.id,
        verified_at: verifiedAt,
      } as never)
      .eq("id", attendanceId);
    if (attendanceError) setError(attendanceError.message);
    else {
      setAttendance((prev) =>
        prev.map((row) =>
          row.id === attendanceId
            ? {
                ...row,
                verification_status: status,
                verified_by: session.user.id,
                verified_at: verifiedAt,
              }
            : row,
        ),
      );
      setNotice(`Attendance ${status}.`);
    }
  }

  async function updateAttendanceStatus(
    attendanceId: string,
    status: Database["public"]["Enums"]["attendance_status"],
  ) {
    const { error: attendanceError } = await supabase
      .from("attendance")
      .update({ status } as never)
      .eq("id", attendanceId);
    if (attendanceError) setError(attendanceError.message);
    else {
      setAttendance((prev) =>
        prev.map((row) => (row.id === attendanceId ? { ...row, status } : row)),
      );
      setNotice("Attendance status updated.");
    }
  }

  function exportCsv() {
    const rows = [
      ["work_date", "groobey_id", "worker_name", "status", "verification", "notes"].join(","),
      ...attendance.map((a) =>
        [
          a.work_date,
          groobeyIdForUser(a.worker_id, groobeyByUserId),
          (staffNameByUserId.get(a.worker_id) ?? "").replace(/,/g, " "),
          a.status,
          a.verification_status,
          (a.notes ?? "").replace(/,/g, " "),
        ].join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Attendance CSV downloaded.");
  }

  const packSizeSelectOptions = useMemo(
    () => mergePackSizeOptions(products.map((p) => p.unit)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    let list = filterProductsByQuery(products, productSearch);
    if (catalogCategory !== "all" && catalogCategory !== SHOP_COMBOS_CATEGORY_ID) {
      list = filterProductsByHomeCategory(list, catalogCategory);
    }
    return list;
  }, [products, productSearch, catalogCategory]);

  const sortedFilteredProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;
      return a.unit.localeCompare(b.unit);
    });
  }, [filteredProducts]);

  const pipelineSales = useMemo(() => salesForPipeline(sales), [sales]);
  const pendingSales = pipelineSales.filter((s) => s.status === "pending");
  const pendingAttendance = attendance.filter((a) => a.verification_status === "pending");
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const merchantStaffRows = staffRows.filter((row) => row.role === "merchant");
  const deliveryStaffRows = staffRows.filter((row) => row.role === "employee");
  const orderTakerRows = staffRows.filter((row) => row.role === "order_taker");
  const orderTakerUserIds = useMemo(
    () => new Set(orderTakerRows.map((row) => row.userId)),
    [orderTakerRows],
  );
  const pipelineCustomerOrders = useMemo(() => {
    if (!ADMIN_CUSTOMER_ORDERS_FOCUS) return customerOrders;
    return customerOrders.filter((order) => !orderTakerUserIds.has(order.created_by));
  }, [customerOrders, orderTakerUserIds]);
  const customerDirectory = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        phone: string;
        address: string;
        count: number;
        pending: number;
        active: number;
        lastOrder: string;
      }
    >();
    for (const order of pipelineCustomerOrders) {
      const key = customerOrderKey(order);
      const existing = map.get(key);
      const isPending = order.status === "pending";
      const isActive = isOrderPipelineActive(order.status);
      if (existing) {
        existing.count += 1;
        if (isPending) existing.pending += 1;
        if (isActive) existing.active += 1;
        if ((order.created_at || "") > existing.lastOrder) {
          existing.lastOrder = order.created_at || "";
        }
      } else {
        map.set(key, {
          key,
          name: order.customer_name?.trim() || "Customer",
          phone: order.customer_phone?.trim() || EM_DASH,
          address: order.delivery_address?.trim() || EM_DASH,
          count: 1,
          pending: isPending ? 1 : 0,
          active: isActive ? 1 : 0,
          lastOrder: order.created_at || "",
        });
      }
    }
    return [...map.values()].sort((a, b) => b.lastOrder.localeCompare(a.lastOrder));
  }, [pipelineCustomerOrders]);
  const selectedCustomerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return pipelineCustomerOrders
      .filter((order) => customerOrderKey(order) === selectedCustomer.key)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [pipelineCustomerOrders, selectedCustomer]);
  const pendingOrderTakerOrders = useMemo(
    () => pipelineCustomerOrders.filter((o) => o.status === "pending"),
    [pipelineCustomerOrders],
  );
  const activeOrderTakerOrders = useMemo(
    () =>
      sortActivePipelineOrders(
        pipelineCustomerOrders.filter((o) => isOrderPipelineActive(o.status)),
      ),
    [pipelineCustomerOrders],
  );
  const unassignedHandoffOrders = useMemo(
    () => activeOrderTakerOrders.filter((o) => orderNeedsDeliveryAssignment(o)),
    [activeOrderTakerOrders],
  );
  const completedOrderTakerOrdersToday = useMemo(
    () => ordersCompletedOnDay(pipelineCustomerOrders, today),
    [pipelineCustomerOrders, today],
  );
  const orderMatchesCustomerFilter = useCallback(
    (order: CustomerOrder) =>
      !ordersCustomerFilter || customerOrderKey(order) === ordersCustomerFilter,
    [ordersCustomerFilter],
  );
  const filteredActiveOrderTakerOrders = useMemo(
    () => activeOrderTakerOrders.filter(orderMatchesCustomerFilter),
    [activeOrderTakerOrders, orderMatchesCustomerFilter],
  );
  const filteredUnassignedHandoffOrders = useMemo(
    () => unassignedHandoffOrders.filter(orderMatchesCustomerFilter),
    [unassignedHandoffOrders, orderMatchesCustomerFilter],
  );
  const filteredCompletedOrderTakerOrdersToday = useMemo(
    () => completedOrderTakerOrdersToday.filter(orderMatchesCustomerFilter),
    [completedOrderTakerOrdersToday, orderMatchesCustomerFilter],
  );
  const ordersCustomerFilterLabel = useMemo(() => {
    if (!ordersCustomerFilter) return null;
    return customerDirectory.find((c) => c.key === ordersCustomerFilter)?.name ?? "Customer";
  }, [ordersCustomerFilter, customerDirectory]);
  const salesActiveOrders = filteredActiveOrderTakerOrders;
  const salesUnassignedOrders = filteredUnassignedHandoffOrders;
  const salesCompletedToday = filteredCompletedOrderTakerOrdersToday;
  const outForDeliveryOrderTakerOrders = useMemo(
    () => pipelineCustomerOrders.filter((o) => o.status === "out_for_delivery"),
    [pipelineCustomerOrders],
  );
  const monthOrderTakerOrders = useMemo(
    () => pipelineCustomerOrders.filter((o) => (o.created_at || "").slice(0, 7) === month),
    [pipelineCustomerOrders, month],
  );
  const todaySales = useMemo(
    () => salesForPeriodAnalytics(sales, today, "day"),
    [sales, today],
  );
  const monthSales = useMemo(
    () => salesForPeriodAnalytics(sales, month, "month"),
    [sales, month],
  );
  const todayAttendance = attendance.filter((a) => (a.work_date || "").slice(0, 10) === today);
  const monthAttendance = attendance.filter((a) => (a.work_date || "").slice(0, 7) === month);
  const deliveryBoySelectOptions = useMemo(
    () => [
      { value: DELIVERY_BOY_UNASSIGNED, label: "Unassigned" },
      ...deliveryStaffRows
        .filter((r) => r.isActive)
        .map((boy) => ({
          value: boy.userId,
          label: `${boy.displayName}${boy.groobeyId ? ` (${boy.groobeyId})` : ""}`,
        })),
    ],
    [deliveryStaffRows],
  );
  const attendanceStatusOptions = useMemo(
    () => [
      { value: "present", label: "Present" },
      { value: "absent", label: "Absent" },
      { value: "half_day", label: "Half day" },
    ],
    [],
  );
  const roleLabel = (role: AppRole) =>
    role === "merchant"
      ? "Shop Owner"
      : role === "employee"
        ? "Delivery boy"
        : role === "order_taker"
          ? "Order Taker"
          : role;
  const parseAttendanceNotes = useCallback((notes: string | null) => {
    const text = notes ?? "";
    const destination = /Destination:\s*(.+)/i.exec(text)?.[1]?.trim() ?? "-";
    const items = /Items:\s*(.+)/i.exec(text)?.[1]?.trim() ?? "-";
    const time = /Time:\s*(.+)/i.exec(text)?.[1]?.trim() ?? "-";
    return { destination, items, time };
  }, []);
  const verificationBadgeClass = (status: Attendance["verification_status"]) =>
    status === "verified"
      ? "bg-emerald-100 text-emerald-700"
      : status === "rejected"
        ? "bg-rose-100 text-rose-700"
        : "bg-amber-100 text-amber-700";
  const verificationLabel = (status: Attendance["verification_status"]) =>
    status === "verified" ? "Verified" : status === "rejected" ? "Rejected" : "Pending";
  const attendanceStatusLabel = (status: Attendance["status"]) =>
    status === "half_day" ? "Half day" : status === "present" ? "Present" : "Absent";
  const staffNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of staffRows) {
      const name = (row.displayName || "").trim();
      if (name) map.set(row.userId, name);
    }
    return map;
  }, [staffRows]);
  const groobeyByUserId = useMemo(() => {
    const map = buildGroobeyIdByUserId(staffRows);
    const own = adminProfile?.groobey_code?.trim();
    if (session?.user?.id && own) map.set(session.user.id, own);
    return map;
  }, [staffRows, session?.user?.id, adminProfile?.groobey_code]);
  const filteredAttendance = useMemo(() => {
    if (attendanceFilter === "all") return attendance;
    return attendance.filter((row) => row.verification_status === attendanceFilter);
  }, [attendance, attendanceFilter]);
  const profileDisplayName =
    adminProfile?.display_name?.trim() ||
    String(session?.user?.user_metadata?.display_name || "").trim() ||
    "Platform Admin";
  const profileEmail =
    adminProfile?.email?.trim() || session?.user?.email?.trim() || "Not set";
  const profilePhone =
    adminProfile?.phone?.trim() || String(session?.user?.phone || "").trim() || "Not set";
  const profileGroobeyId = adminProfile?.groobey_code?.trim() || "Not generated yet";
  const profileJoinedAt = (
    adminProfile?.created_at ||
    session?.user?.created_at ||
    ""
  ).toString();
  const profileJoinedLabel = profileJoinedAt
    ? new Date(profileJoinedAt).toLocaleString()
    : "Not available";
  const shopByOwnerId = useMemo(() => {
    const map = new Map<string, Shop>();
    for (const shop of shops) {
      if (!shop.created_by) continue;
      if (!map.has(shop.created_by)) map.set(shop.created_by, shop);
    }
    return map;
  }, [shops]);
  const globalTradeMargin = useMemo(() => {
    const active = shops.filter((s) => s.is_active);
    if (!active.length) return 0;
    return Number(active[0]?.trade_margin_percent ?? 0);
  }, [shops]);
  const shopLocationByOwnerId = useMemo(() => {
    const map = new Map<string, string>();
    for (const shop of shops) {
      if (!shop.created_by) continue;
      const location = (shop.address || shop.name || "").trim();
      if (!location) continue;
      if (!map.has(shop.created_by)) map.set(shop.created_by, location);
    }
    return map;
  }, [shops]);
  const shopNameByOwnerId = useMemo(() => {
    const map = new Map<string, string>();
    for (const shop of shops) {
      if (!shop.created_by) continue;
      const name = (shop.name || "").trim();
      if (!name) continue;
      if (!map.has(shop.created_by)) map.set(shop.created_by, name);
    }
    return map;
  }, [shops]);
  const isProfileView = activeTab === "profile";

  function openCustomerOrders(customerKey: string) {
    setOrdersCustomerFilter(customerKey);
    setActiveTab("sales");
  }

  function openCustomerDetail(customer: AdminCustomerRow) {
    setSelectedCustomer(customer);
  }

  function closeCustomerDetail() {
    setSelectedCustomer(null);
  }

  function renderCustomerDetailDialogContent() {
    if (!selectedCustomer) return null;
    const customer = selectedCustomer;
    const last = customer.lastOrder ? formatGroobeyDateTime(customer.lastOrder) : EM_DASH;
    return (
      <div className="space-y-4">
        <div className="groobey-admin-customer-detail-hero">
          <span className="groobey-admin-inbox-avatar size-10 text-sm" aria-hidden>
            {(customer.name[0] || "C").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-base font-black leading-tight">{customer.name}</p>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              {customer.count} order{customer.count === 1 ? "" : "s"}
              {customer.pending > 0 ? ` ${MIDDLE_DOT} ${customer.pending} pending` : ""}
              {customer.active > 0 ? ` ${MIDDLE_DOT} ${customer.active} active` : ""}
            </p>
          </div>
        </div>
        <div className="groobey-admin-customer-detail-grid">
          <div className="groobey-admin-customer-detail-field">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Phone</p>
            <p className="mt-0.5 text-sm font-semibold">{customer.phone}</p>
          </div>
          <div className="groobey-admin-customer-detail-field">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Last order</p>
            <p className="mt-0.5 text-sm font-semibold">{last}</p>
          </div>
          <div className="groobey-admin-customer-detail-field sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Address</p>
            <p className="mt-0.5 text-sm font-semibold leading-snug">{customer.address || EM_DASH}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-xl text-xs font-bold"
          onClick={() => {
            openCustomerOrders(customer.key);
            closeCustomerDetail();
          }}
        >
          Open in Orders tab
        </Button>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Orders & bills
          </p>
          {selectedCustomerOrders.length === 0 ?
            <p className="text-sm font-semibold text-muted-foreground">No orders for this shopper yet.</p>
          : selectedCustomerOrders.map((order) => {
              const retail = Math.round(Number(order.total_amount || 0));
              const status = order.status as OrderStatus;
              return (
                <div key={order.id} className="groobey-admin-customer-order-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <OrderBillLabeledHighlight
                        label="Bill ID"
                        value={order.bill_number || EM_DASH}
                        pillClassName={orderBillIdHighlightClass}
                      />
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <OrderStatusPill status={status} />
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {formatGroobeyDateTime(order.created_at)}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-black tabular-nums">{formatInr(retail)}</span>
                  </div>
                  <BillKindButtons
                    compact
                    layout="equal"
                    className="w-full"
                    customerOnly={customerBillOnly}
                    onPrint={(kind) => exportCustomerOrderBill(order.id, kind)}
                  />
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }

  function directoryShellClass(wide = false) {
    return cn("groobey-centered-workspace", wide && "groobey-centered-workspace--wide");
  }

  function renderStaffTable(rows: StaffRow[], emptyText: string, showLocation = false) {
    if (staffLoading) {
      return (
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="size-4 animate-spin" /> Loading staff…
        </div>
      );
    }
    if (rows.length === 0) {
      return <p className="text-sm font-semibold text-muted-foreground">{emptyText}</p>;
    }
    return (
      <div className="owner-admin-directory space-y-3">
        <p className="text-center text-xs font-semibold text-muted-foreground sm:text-left">
          Tap a person to view details and manage their login.
        </p>
        <div
          className={cn(
            "grid gap-2.5 lg:hidden",
            showLocation ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          {rows.map((row) => (
            <button
              key={row.userId}
              type="button"
              className="owner-admin-people-card"
              onClick={() => openStaffDetail(row)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black leading-tight">{row.displayName || "-"}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                  {showLocation
                    ? (shopNameByOwnerId.get(row.userId) ?? "No shop")
                    : roleLabel(row.role)}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                  {row.groobeyId ?? "-"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    row.isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {row.isActive ? "Active" : "Off"}
                </span>
                <ChevronRight className="size-4 text-primary" aria-hidden />
              </div>
            </button>
          ))}
        </div>
        <div className="owner-admin-directory-table-wrap hidden lg:block">
          <table className="text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                {showLocation ? (
                  <th className="px-4 py-2.5 font-semibold">Shop</th>
                ) : (
                  <th className="px-4 py-2.5 font-semibold">Role</th>
                )}
                <th className="px-4 py-2.5 font-semibold">Groobey ID</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="w-12 px-2 py-2.5" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.userId}
                  className="border-b border-border/50 last:border-0"
                  onClick={() => openStaffDetail(row)}
                >
                  <td className="max-w-[12rem] truncate px-4 py-3 font-semibold">
                    {row.displayName || "-"}
                  </td>
                  {showLocation ? (
                    <td className="max-w-[10rem] truncate px-4 py-3 text-sm">
                      {shopNameByOwnerId.get(row.userId) ?? "-"}
                    </td>
                  ) : (
                    <td className="truncate px-4 py-3 text-sm">{roleLabel(row.role)}</td>
                  )}
                  <td className="truncate px-4 py-3 font-mono text-xs">{row.groobeyId ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        row.isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.isActive ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-primary">
                    <ChevronRight className="size-4" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderStaffEditForm() {
    if (!staffDetailEditing || !editingStaff) return null;
    const row = editingStaff;
    if (row.role === "merchant") {
      return (
        <form className="grid gap-3" onSubmit={handleUpdateStaff} key={row.userId}>
          <Field name="displayName" label="Shop Owner name" required defaultValue={row.displayName} />
          <Field name="email" label="Login email" defaultValue={row.email ?? ""} />
          <Field name="phone" label="Login mobile number" defaultValue={row.phone ?? ""} />
          <Field name="shopName" label="Shop name" required defaultValue={shopByOwnerId.get(row.userId)?.name ?? ""} />
          <Field name="shopAddress" label="Location" required defaultValue={shopByOwnerId.get(row.userId)?.address ?? ""} />
          <Field name="tradeMarginPercent" label="Groobey margin % (whole shop bill)" type="number" required defaultValue={String(shopByOwnerId.get(row.userId)?.trade_margin_percent ?? 0)} />
          <Button type="submit" variant="groobey" className="min-h-11 w-fit rounded-xl">Save changes</Button>
        </form>
      );
    }
    if (row.role === "employee") {
      return (
        <form className="grid gap-3" onSubmit={handleUpdateStaff} key={row.userId}>
          <Field name="displayName" label="Delivery boy name" required defaultValue={row.displayName} />
          <Field name="email" label="Login email" defaultValue={row.email ?? ""} />
          <Field name="phone" label="Login mobile number" defaultValue={row.phone ?? ""} />
          <Button type="submit" variant="groobey" className="min-h-11 w-fit rounded-xl">Save changes</Button>
        </form>
      );
    }
    return (
      <form className="grid gap-3" onSubmit={handleUpdateStaff} key={row.userId}>
        <Field name="displayName" label="Order taker name" required defaultValue={row.displayName} />
        <Field name="email" label="Login email" defaultValue={row.email ?? ""} />
        <Field name="phone" label="Login mobile number" defaultValue={row.phone ?? ""} />
        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          Groobey margin % (whole order bill)
          <input name="tradeMarginPercent" type="number" min={0} max={100} step="0.01" required value={editingOrderTakerMargin} onChange={(e) => setEditingOrderTakerMargin(e.target.value)} className="h-11 max-w-[10rem] rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2" />
        </label>
        <Button type="submit" variant="groobey" className="min-h-11 w-fit rounded-xl">Save changes</Button>
      </form>
    );
  }

  function renderStaffDetailDialogContent() {
    if (!selectedStaff) return null;
    const row = selectedStaff;
    const shop = shopByOwnerId.get(row.userId);
    return (
      <div className="space-y-5">
        <div
          className="grid gap-3 rounded-2xl border border-border bg-muted/25 p-4 sm:grid-cols-2"
          aria-label="Login details"
        >
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Name</p><p className="mt-0.5 font-black">{row.displayName || EM_DASH}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Role</p><p className="mt-0.5 font-semibold">{roleLabel(row.role)}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Groobey ID</p><p className="mt-0.5 font-mono text-sm font-semibold">{row.groobeyId ?? EM_DASH}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Status</p><p className="mt-0.5 font-semibold">{row.isActive ? "Active" : "Inactive"}</p></div>
          <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Email</p><p className="mt-0.5 break-all font-semibold">{row.email ?? EM_DASH}</p></div>
          <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Phone</p><p className="mt-0.5 font-semibold">{row.phone ?? EM_DASH}</p></div>
          {row.role === "merchant" ? (
            <>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Shop</p><p className="mt-0.5 font-semibold">{shopNameByOwnerId.get(row.userId) ?? EM_DASH}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Location</p><p className="mt-0.5 font-semibold">{shopLocationByOwnerId.get(row.userId) ?? EM_DASH}</p></div>
              <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Groobey margin %</p><p className="mt-0.5 font-semibold tabular-nums">{shop?.trade_margin_percent ?? 0}%</p></div>
            </>
          ) : null}
          {row.role === "order_taker" ? (
            <div className="sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Groobey margin %</p>
              <p className="mt-0.5 font-semibold tabular-nums">{editingOrderTakerMargin}%</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={row.isActive ? "outline" : "groobey"} className="min-h-10 rounded-xl" onClick={() => void toggleStaff(row.userId, !row.isActive)}>
            {row.isActive ? "Deactivate login" : "Activate login"}
          </Button>
          <Button type="button" variant="outline" className="min-h-10 rounded-xl text-destructive hover:bg-destructive/10" onClick={() => void handleDeleteStaff(row)}>
            <Trash2 className="size-4" /> Delete login
          </Button>
        </div>
        <div className="border-t border-border pt-4">
          {!staffDetailEditing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-muted-foreground">
                Tap Edit to change name, login, or shop details.
              </p>
              <Button
                type="button"
                variant="outline"
                className="min-h-10 gap-1.5 rounded-xl"
                aria-expanded={staffDetailEditing}
                aria-controls="staff-detail-edit-panel"
                onClick={startStaffDetailEdit}
              >
                <Pencil className="size-4" aria-hidden />
                Edit details
              </Button>
            </div>
          ) : (
            <div id="staff-detail-edit-panel" className="space-y-3" role="region" aria-label="Edit login details">
              <p className="text-sm font-black text-foreground">Edit details</p>
              {renderStaffEditForm()}
              <Button
                type="button"
                variant="outline"
                className="min-h-10 rounded-xl"
                onClick={cancelStaffDetailEdit}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderAttendanceDetailDialogContent() {
    if (!selectedAttendance) return null;
    const row = selectedAttendance;
    const details = parseAttendanceNotes(row.notes);
    return (
      <div className="space-y-5">
        <div className="grid gap-3 rounded-2xl border border-border bg-muted/25 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Worker</p>
            <p className="mt-0.5 font-black">{staffNameByUserId.get(row.worker_id) ?? "Staff"}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{groobeyIdForUser(row.worker_id, groobeyByUserId)}</p>
          </div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Work date</p><p className="mt-0.5 font-semibold">{row.work_date}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Verification</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${verificationBadgeClass(row.verification_status)}`}>{verificationLabel(row.verification_status)}</span></div>
          <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Destination</p><p className="mt-0.5 font-semibold">{details.destination}</p></div>
          <div className="sm:col-span-2">
            <GroceryOrderItemsList text={details.items === "-" ? "" : details.items} />
          </div>
          <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Time</p><p className="mt-0.5 font-semibold">{details.time}</p></div>
        </div>
        <label className="grid gap-1.5 text-sm font-semibold">
          Day status
          <GroobeySelect
            size="sm"
            value={row.status}
            onValueChange={(v) =>
              void updateAttendanceStatus(
                row.id,
                v as Database["public"]["Enums"]["attendance_status"],
              )
            }
            options={attendanceStatusOptions}
          />
        </label>
        {row.verification_status === "pending" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="calm" className="min-h-10 rounded-xl" onClick={() => void updateAttendanceVerification(row.id, "verified")}>Approve attendance</Button>
            <Button variant="outline" className="min-h-10 rounded-xl" onClick={() => void updateAttendanceVerification(row.id, "rejected")}>Reject attendance</Button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderAttendancePanel() {
    return (
      <div className={cn(directoryShellClass(true), "space-y-4")}>
        <div className="owner-admin-attendance-toolbar">
          <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={exportCsv}>
            <Download className="size-4" /> Export CSV
          </Button>
          <div
            className="flex w-full flex-wrap gap-1 rounded-xl border border-border bg-card/70 p-1 sm:inline-flex sm:w-auto sm:flex-nowrap"
            role="tablist"
            aria-label="Attendance verification filter"
          >
            {(
              [
                ["all", `All (${attendance.length})`],
                [
                  "pending",
                  `Pending (${attendance.filter((r) => r.verification_status === "pending").length})`,
                ],
                [
                  "verified",
                  `Verified (${attendance.filter((r) => r.verification_status === "verified").length})`,
                ],
                [
                  "rejected",
                  `Rejected (${attendance.filter((r) => r.verification_status === "rejected").length})`,
                ],
              ] as const
            ).map(([value, label]) => {
              const active = attendanceFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`h-9 rounded-lg px-3 text-xs font-semibold transition sm:text-sm ${
                    active ?
                      "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setAttendanceFilter(value)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <Panel title="Attendance records" icon={ClipboardList}>
          <div className="owner-admin-directory space-y-3">
            <p className="text-center text-xs font-semibold text-muted-foreground sm:text-left">
              Tap a record to review details and approve or reject.
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
            {filteredAttendance.map((row) => (
              <button
                key={row.id}
                type="button"
                className="owner-admin-attendance-card"
                onClick={() => openAttendanceDetail(row)}
              >
                {(() => {
                  const details = parseAttendanceNotes(row.notes);
                  return (
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-black leading-tight">
                            {staffNameByUserId.get(row.worker_id) ?? "Staff"}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${verificationBadgeClass(
                              row.verification_status,
                            )}`}
                          >
                            {verificationLabel(row.verification_status)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          {row.work_date} · {attendanceStatusLabel(row.status)}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {details.destination}
                        </p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    </div>
                  );
                })()}
              </button>
            ))}
          </div>
          <div className="owner-admin-directory-table-wrap hidden lg:block">
            <table className="text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Worker</th>
                  <th className="px-4 py-2.5 font-semibold">Destination</th>
                  <th className="px-4 py-2.5 font-semibold">Verification</th>
                  <th className="w-12 px-2 py-2.5" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.map((row) => {
                  const details = parseAttendanceNotes(row.notes);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 last:border-0"
                      onClick={() => openAttendanceDetail(row)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-semibold">{row.work_date}</td>
                      <td className="max-w-[9rem] truncate px-4 py-3 text-sm font-semibold">
                        {staffNameByUserId.get(row.worker_id) ?? "Staff"}
                      </td>
                      <td
                        className="max-w-[14rem] truncate px-4 py-3 text-sm text-muted-foreground"
                        title={details.destination}
                      >
                        {details.destination}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${verificationBadgeClass(
                            row.verification_status,
                          )}`}
                        >
                          {verificationLabel(row.verification_status)}
                        </span>
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
          {filteredAttendance.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title="No attendance"
              text="Delivery staff submit attendance from their portal."
            />
          )}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <>
      <GroobeyDashboardHeader
        title={isProfileView ? "Admin profile" : "Admin dashboard"}
        subtitle={
          isProfileView
            ? "Your account details."
            : ADMIN_CUSTOMER_ORDERS_FOCUS
              ? "Catalog, online customers, orders, and delivery."
              : "Catalog, staff, shops, sales, and attendance."
        }
        actions={
          <>
            <GroobeyNotificationBell
              compact
              items={adminNotifications.items}
              unreadCount={adminNotifications.unreadCount}
              onMarkAllRead={adminNotifications.markAllRead}
              onMarkRead={adminNotifications.markRead}
              onClearAll={adminNotifications.clearAll}
            />
            <Button
              variant={activeTab === "profile" ? "outline" : "groobey"}
              className="groobey-dashboard-action-btn"
              onClick={() => setActiveTab("overview")}
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === "profile" ? "groobey" : "outline"}
              className="groobey-dashboard-action-btn"
              onClick={() => setActiveTab("profile")}
            >
              Profile
            </Button>
            <Button
              variant="outline"
              className="groobey-dashboard-action-btn groobey-dashboard-action-btn--muted"
              disabled={signingOut}
              onClick={() => {
                if (signingOut) return;
                setSigningOut(true);
                void groobeySignOut();
              }}
            >
              {signingOut ?
                <>
                  <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                  <span className="hidden sm:inline">Logging out</span>
                </>
              : "Logout"}
            </Button>
          </>
        }
      />
      <div className="groobey-dashboard-body owner-admin-dashboard-body mx-auto flex min-w-0 flex-col gap-5 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-10">

      {serverSetup && !serverSetup.hasServiceRoleKey ? <GroobeyServiceRoleSetupPanel /> : null}

      {!isProfileView && activeTab === "overview" ?
        <section className="owner-admin-quick-stats">
          <Stat
            icon={PackagePlus}
            label="Products"
            value={String(products.length)}
            onClick={() => setActiveTab("catalog")}
          />
          {ADMIN_CUSTOMER_ORDERS_FOCUS ?
            <Stat
              icon={UsersRound}
              label="Customers"
              value={String(customerDirectory.length)}
              onClick={() => setActiveTab("customers")}
            />
          : <Stat
              icon={Store}
              label="Shops"
              value={String(shops.filter((s) => s.is_active).length)}
              onClick={() => setActiveTab("shop-owners")}
            />
          }
          <Stat
            icon={ReceiptText}
            label={ADMIN_CUSTOMER_ORDERS_FOCUS ? "Orders (loaded)" : "Sales (loaded)"}
            value={String(ADMIN_CUSTOMER_ORDERS_FOCUS ? pipelineCustomerOrders.length : sales.length)}
            onClick={() => setActiveTab("sales")}
          />
          {SHOW_ATTENDANCE ?
            <Stat
              icon={ClipboardList}
              label="Attendance rows"
              value={String(attendance.length)}
              onClick={() => setActiveTab("attendance")}
            />
          : ADMIN_CUSTOMER_ORDERS_FOCUS ?
            <Stat
              icon={UsersRound}
              label="Delivery team"
              value={String(deliveryStaffRows.length)}
              onClick={() => setActiveTab("staff")}
            />
          : null}
        </section>
      : null}

      <Message
        error=""
        notice=""
        loading={loading && !hasSyncedWorkspace.current}
        refreshing={loading && hasSyncedWorkspace.current}
        showAlerts={false}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 w-full">
        {!isProfileView ? (
          <TabsList className="owner-admin-tabs owner-admin-tab-grid !mb-5 !grid h-auto min-h-0 w-full rounded-2xl p-2">
            <TabsTrigger value="overview" className="owner-admin-tab-trigger">
              <LayoutDashboard className="size-4 shrink-0 opacity-90" aria-hidden />
              <span>Overview</span>
            </TabsTrigger>
            {ADMIN_CUSTOMER_ORDERS_FOCUS ?
              <TabsTrigger value="customers" className="owner-admin-tab-trigger">
                <UsersRound className="size-4 shrink-0 opacity-90" aria-hidden />
                <span>Customers</span>
              </TabsTrigger>
            : null}
            {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
              <>
                <TabsTrigger value="create-logins" className="owner-admin-tab-trigger">
                  <UsersRound className="size-4 shrink-0 opacity-90" aria-hidden />
                  <span>Create logins</span>
                </TabsTrigger>
                <TabsTrigger value="shop-owners" className="owner-admin-tab-trigger">
                  <UsersRound className="size-4 shrink-0 opacity-90" aria-hidden />
                  <span>Shop owners</span>
                </TabsTrigger>
              </>
            : null}
            <TabsTrigger value="staff" className="owner-admin-tab-trigger">
              <UsersRound className="size-4 shrink-0 opacity-90" aria-hidden />
              <span>{ADMIN_CUSTOMER_ORDERS_FOCUS ? "Delivery" : "Staff"}</span>
            </TabsTrigger>
            {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
              <TabsTrigger value="orders-team" className="owner-admin-tab-trigger">
                <UsersRound className="size-4 shrink-0 opacity-90" aria-hidden />
                <span>Orders team</span>
              </TabsTrigger>
            : null}
            <TabsTrigger value="catalog" className="owner-admin-tab-trigger">
              <IndianRupee className="size-4 shrink-0 opacity-90" aria-hidden />
              <span>Grocery</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="owner-admin-tab-trigger">
              <ReceiptText className="size-4 shrink-0 opacity-90" aria-hidden />
              <span>{ADMIN_CUSTOMER_ORDERS_FOCUS ? "Orders" : "Sales"}</span>
            </TabsTrigger>
            {SHOW_ATTENDANCE ?
              <TabsTrigger value="attendance" className="owner-admin-tab-trigger">
                <ClipboardList className="size-4 shrink-0 opacity-90" aria-hidden />
                <span>Attendance</span>
              </TabsTrigger>
            : null}
          </TabsList>
        ) : null}

        <TabsContent value="profile" className="space-y-4">
          <InlineFeedback {...alertsFor("profile")} />
          <Panel title="Platform Admin profile" icon={UsersRound}>
            <div className="grid gap-4">
              <div className="min-w-0 rounded-2xl border border-border bg-gradient-to-r from-primary/15 via-card to-card p-3.5 shadow-soft sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-base font-black text-primary-foreground">
                      {(profileDisplayName[0] || "P").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Platform Admin
                      </p>
                      <p className="break-words text-base font-black text-foreground sm:text-lg">
                        {profileDisplayName}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0 max-w-full rounded-xl border border-border bg-card/80 px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Groobey ID
                    </p>
                    <p className="break-all font-mono text-xs font-black text-foreground sm:text-sm">
                      {profileGroobeyId}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 rounded-xl border border-border bg-card/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Name
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-foreground">
                    {profileDisplayName}
                  </p>
                </div>
                <div className="min-w-0 rounded-xl border border-border bg-card/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Login email
                  </p>
                  <p className="mt-1 break-all text-sm font-semibold text-foreground">{profileEmail}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-border bg-card/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Mobile
                  </p>
                  <p className="mt-1 break-all text-sm font-semibold text-foreground">{profilePhone}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-border bg-card/70 p-3 sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Profile created
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-foreground">
                    {profileJoinedLabel}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card/70 p-3">
                {!editingOwnProfile ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Need to update your name/email/mobile?
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-lg text-xs"
                      onClick={() => setEditingOwnProfile(true)}
                    >
                      Edit profile
                    </Button>
                  </div>
                ) : (
                  <form className="grid gap-3 md:max-w-xl" onSubmit={handleSaveMyProfile}>
                    <Field
                      name="displayName"
                      label="Name"
                      required
                      defaultValue={profileDisplayName}
                    />
                    <Field name="email" label="Login email" defaultValue={profileEmail === "Not set" ? "" : profileEmail} />
                    <Field
                      name="phone"
                      label="Mobile"
                      defaultValue={profilePhone === "Not set" ? "" : profilePhone}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="submit"
                        variant="groobey"
                        className="h-10 rounded-lg text-xs"
                        disabled={savingProfile}
                      >
                        {savingProfile ? "Saving..." : "Save profile"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-lg text-xs"
                        onClick={() => setEditingOwnProfile(false)}
                        disabled={savingProfile}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <InlineFeedback {...alertsFor("overview")} />
          <section className="owner-admin-needs-attention p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Needs attention
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground/90">
              Jump to work that needs a decision or follow-up.
            </p>
            <div className="owner-admin-needs-attention-actions mt-4">
              {SHOW_ATTENDANCE ?
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-12 w-full justify-start gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold leading-snug shadow-sm hover:bg-card"
                  onClick={() => {
                    setAttendanceFilter("pending");
                    setActiveTab("attendance");
                  }}
                >
                  <ClipboardList className="size-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    Pending attendance
                    <span className="mt-0.5 block text-xs font-bold text-primary tabular-nums">
                      {pendingAttendance.length}
                    </span>
                  </span>
                </Button>
              : null}
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 w-full justify-start gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold leading-snug shadow-sm hover:bg-card"
                onClick={() => setActiveTab("sales")}
              >
                <ReceiptText className="size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  {ADMIN_CUSTOMER_ORDERS_FOCUS ? "Pending orders" : "Pending sales"}
                  <span className="mt-0.5 block text-xs font-bold text-primary tabular-nums">
                    {ADMIN_CUSTOMER_ORDERS_FOCUS ? pendingOrderTakerOrders.length : pendingSales.length}
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 w-full justify-start gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold leading-snug shadow-sm hover:bg-card"
                onClick={() => setActiveTab("sales")}
              >
                <ShoppingBasket className="size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  {ADMIN_CUSTOMER_ORDERS_FOCUS ? "Active customer orders" : "Order taker bills"}
                  <span className="mt-0.5 block text-xs font-bold text-primary tabular-nums">
                    {activeOrderTakerOrders.length}
                  </span>
                </span>
              </Button>
              {ADMIN_CUSTOMER_ORDERS_FOCUS ?
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-12 w-full justify-start gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold leading-snug shadow-sm hover:bg-card"
                  onClick={() => setActiveTab("customers")}
                >
                  <UsersRound className="size-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    Registered shoppers
                    <span className="mt-0.5 block text-xs font-bold text-primary tabular-nums">
                      {customerDirectory.length}
                    </span>
                  </span>
                </Button>
              : <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-12 w-full justify-start gap-2 rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold leading-snug shadow-sm hover:bg-card"
                  onClick={() => setActiveTab("create-logins")}
                >
                  <UsersRound className="size-5 shrink-0 text-primary" aria-hidden />
                  <span>Add shop owner / staff / order taker</span>
                </Button>
              }
            </div>
          </section>
          <div className="owner-admin-quick-stats">
            <Stat
              icon={ReceiptText}
              label="Pending orders"
              value={String(pendingOrderTakerOrders.length)}
              onClick={() => setActiveTab("sales")}
            />
            <Stat
              icon={ShoppingBasket}
              label="Active pipeline"
              value={String(activeOrderTakerOrders.length)}
              onClick={() => setActiveTab("sales")}
            />
            <Stat
              icon={UsersRound}
              label="Customers"
              value={String(customerDirectory.length)}
              onClick={() => setActiveTab("customers")}
            />
            <Stat
              icon={UsersRound}
              label="Delivery team"
              value={String(deliveryStaffRows.length)}
              onClick={() => setActiveTab("staff")}
            />
          </div>
        </TabsContent>

        {ADMIN_CUSTOMER_ORDERS_FOCUS ?
          <TabsContent value="customers" className="space-y-3">
            <InlineFeedback {...alertsFor("customers")} />
            <Panel title="Customer directory" icon={UsersRound}>
              <AdminCustomerInbox
                customers={customerDirectory}
                onOpenCustomer={openCustomerDetail}
              />
            </Panel>
          </TabsContent>
        : null}

        {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
          <>
            <TabsContent value="create-logins" className="space-y-6">
              <InlineFeedback {...alertsFor("create-logins")} />
              <div className={directoryShellClass()}>
                <Panel title="Create shop owner, staff, or order taker login" icon={UsersRound}>
                  <AccountForm onCreate={handleCreateStaff} resetNonce={staffFormResetNonce} />
                </Panel>
              </div>
            </TabsContent>

            <TabsContent value="shop-owners" className="space-y-6">
              <InlineFeedback {...alertsFor("shop-owners")} />
              <div className={directoryShellClass(true)}>
                <Panel title="Shop Owners Directory" icon={UsersRound}>
                  {renderStaffTable(merchantStaffRows, "No shop owner logins yet.", true)}
                </Panel>
                {!staffLoading && merchantStaffRows.length === 0 ? (
                  <EmptyState icon={UsersRound} title="No shop owners yet" text="Use Create Logins tab to add shop owner logins." />
                ) : null}
              </div>
            </TabsContent>
          </>
        : null}

        <TabsContent value="staff" className="space-y-6">
          <InlineFeedback {...alertsFor("staff")} />
          {ADMIN_CUSTOMER_ORDERS_FOCUS ?
            <div className={directoryShellClass()}>
              <Panel title="Assign delivery boy" icon={UsersRound}>
                <AccountForm
                  onCreate={handleCreateStaff}
                  resetNonce={staffFormResetNonce}
                  deliveryOnly
                />
              </Panel>
            </div>
          : null}
          <div className={directoryShellClass()}>
            <Panel title="Delivery Staff Directory" icon={UsersRound}>
              {renderStaffTable(deliveryStaffRows, "No delivery boy logins yet.")}
            </Panel>
            {!staffLoading && deliveryStaffRows.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="No delivery boys yet"
                text={
                  ADMIN_CUSTOMER_ORDERS_FOCUS ?
                    "Use the form above to assign a delivery boy email."
                  : "Use Create Logins tab to add users."
                }
              />
            ) : null}
          </div>
        </TabsContent>

        {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
          <TabsContent value="orders-team" className="space-y-6">
            <InlineFeedback {...alertsFor("orders-team")} />
            <div className={directoryShellClass()}>
              <Panel title="Order Taker Directory" icon={UsersRound}>
                {renderStaffTable(orderTakerRows, "No order taker logins yet.")}
              </Panel>
              {!staffLoading && orderTakerRows.length === 0 ? (
                <EmptyState icon={UsersRound} title="No order takers yet" text="Use Create Logins tab to add order taker users." />
              ) : null}
            </div>
          </TabsContent>
        : null}

        {SHOW_ATTENDANCE ?
          <TabsContent value="attendance" className="space-y-4">
            <InlineFeedback {...alertsFor("attendance")} />
            {renderAttendancePanel()}
          </TabsContent>
        : null}

        <TabsContent value="catalog" className="groobey-admin-catalog-tab space-y-6">
          <InlineFeedback {...alertsFor("catalog")} />
          <AdminCatalogCategoryRail activeId={catalogCategory} onSelect={setCatalogCategory} />
          {catalogCategory === SHOP_COMBOS_CATEGORY_ID ?
            <AdminCombosPanel
              embedded
              sessionUserId={session?.user.id}
              requesterToken={session?.access_token}
              onNotice={(message) => setNotice(message)}
              onError={(message) => setError(message)}
            />
          : <>
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm font-semibold text-muted-foreground">
            Upload your <strong>TLD GROOBY</strong> Excel (S.No, CATEGORY, PRODUCT, any gram/kg price
            columns, MRP), or add items one by one. You can add columns like 50G, 1.5KG, up to 10KG - each
            filled price becomes a catalog line. Remove old rows in the list if you no longer need them.
          </div>
          <GroobeyExcelCatalogUpload
            importing={importingExcel}
            catalogCount={products.length}
            onImport={importProductsFromExcel}
            onExportCatalog={exportCatalogExcel}
          />
          <div className="groobey-centered-workspace space-y-6">
            <Panel title="Add product" icon={PackagePlus}>
              <form className="grid w-full gap-3" onSubmit={addProduct}>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Grocery item name
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="h-11 min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                  placeholder="e.g. Rice, Toor dal, Sugar"
                  autoComplete="off"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Pack size
                <GroobeySelect
                  value={addUnit}
                  onValueChange={setAddUnit}
                  options={packSizeSelectOptions.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Retail rate
                <input
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  className="h-11 min-h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Default qty
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={addDefaultQty}
                  onChange={(e) => setAddDefaultQty(e.target.value)}
                  className="h-11 min-h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                />
              </label>
              <Button variant="groobey" className="min-h-11 w-full rounded-xl sm:w-fit" type="submit">
                <Plus className="size-4" /> Add item
              </Button>
              </form>
            </Panel>
            {editingProduct && (
            <Panel
              title="Edit grocery item"
              icon={Pencil}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 rounded-xl text-sm"
                  onClick={() => setEditingProduct(null)}
                >
                  Cancel
                </Button>
              }
            >
              <form
                className="grid w-full gap-3"
                key={editingProduct.id}
                onSubmit={updateProductFromForm}
              >
                <Field
                  name="name"
                  label="Grocery item"
                  required
                  defaultValue={editingProduct.name}
                />
                <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                  Pack size
                  <input type="hidden" name="unit" value={editPackUnit} />
                  <GroobeySelect
                    value={editPackUnit}
                    onValueChange={setEditPackUnit}
                    options={packSizeSelectOptions.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                  />
                </label>
                <Field
                  name="price"
                  label="Retail rate"
                  type="number"
                  required
                  defaultValue={String(editingProduct.price)}
                />
                <Field
                  name="default_quantity"
                  label="Default qty"
                  type="number"
                  required
                  defaultValue={String(editingProduct.default_quantity ?? 1)}
                />
                <Button variant="groobey" className="min-h-11 w-full rounded-xl sm:w-fit" type="submit">
                  Save changes
                </Button>
              </form>
            </Panel>
          )}
          </div>
          <div className="groobey-admin-catalog-grocery-panel">
          <Panel title="Grocery catalog" icon={ShoppingBasket}>
            <label className="mb-3 grid gap-1 text-sm font-semibold">
              Search
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="h-11 min-h-11 rounded-xl border border-input bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
                placeholder="Search name, category, pack, or price"
                autoComplete="off"
              />
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              {productSearch.trim()
                ? `${filteredProducts.length} match${filteredProducts.length === 1 ? "" : "es"} (of ${products.length})`
                : `${products.length} items`}
            </p>
            <div className="groobey-admin-grocery-list groobey-scrollbar">
              {sortedFilteredProducts.map((item) => (
                <ProductRow
                  key={item.id}
                  item={item}
                  canEdit
                  onRateUpdate={updateRate}
                  onEdit={() => {
                    setEditingProduct(item);
                    setError("");
                  }}
                  onDelete={(id) => void deleteProduct(id)}
                />
              ))}
              {filteredProducts.length === 0 && (
                <EmptyState
                  icon={ShoppingBasket}
                  title="No matching items"
                  text="Adjust search or add products."
                />
              )}
            </div>
          </Panel>
          </div>
          </>}
        </TabsContent>

        <TabsContent value="sales" className="space-y-3">
          <InlineFeedback {...alertsFor("sales")} />
          {ordersCustomerFilter && ordersCustomerFilterLabel ?
            <div className="groobey-admin-filter-chip">
              <span>
                Showing orders for <strong>{ordersCustomerFilterLabel}</strong>
              </span>
              <Button
                type="button"
                variant="outline"
                className="groobey-dashboard-action-btn"
                onClick={() => setOrdersCustomerFilter(null)}
              >
                Show all
              </Button>
            </div>
          : null}
          {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
            <TradeMarginPanel
              title="Groobey margin (all active shops)"
              description={`One margin for every shop. New sales: trade = retail minus this % (e.g. 8% \u2192 ${formatInr(100)} retail \u2192 ${formatInr(92)} trade). Settlement bills use this %.`}
              marginPercent={globalTradeMargin}
              saving={savingGlobalMargin}
              onSave={saveGlobalTradeMargin}
            />
          : null}
          <Panel
            title={
              ADMIN_CUSTOMER_ORDERS_FOCUS ?
                "Customer orders - active pipeline"
              : "Order taker bills - active pipeline"
            }
            icon={ClipboardList}
          >
            <div className="min-w-0 overflow-x-hidden">
            <p className="mb-3 text-xs font-semibold text-muted-foreground">
              Pending {EM_DASH} Confirmed {EM_DASH} Packed {EM_DASH} Out for delivery only. Assign a
              delivery boy before handoff
              {salesUnassignedOrders.length ?
                ` (${salesUnassignedOrders.length} need assignment now)`
              : ""}
              .
              {ADMIN_CUSTOMER_ORDERS_FOCUS ?
                " Print customer bill only."
              : " Same Bill ID for customer and settlement copies."}
              {salesCompletedToday.length ?
                ` ${salesCompletedToday.length} completed today - see panel below.`
              : ""}
            </p>
            {salesUnassignedOrders.length ?
              <p className="mb-3 rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                Assign delivery boy on highlighted rows before the order leaves your desk.
              </p>
            : null}

            <div className="space-y-3 lg:hidden">
              {salesActiveOrders.map((order) => {
                const retail = Math.round(Number(order.total_amount || 0));
                const trade = Math.round(Number(order.merchant_settlement_amount ?? retail));
                const margin = retail - trade;
                const shop = order.shop_id ? shops.find((s) => s.id === order.shop_id) : undefined;
                const takerRow = staffRows.find((r) => r.userId === order.created_by);
                const takerName =
                  staffNameByUserId.get(order.created_by) ||
                  takerRow?.displayName?.trim() ||
                  "Order taker";
                const assignedBoy = deliveryStaffRows.find(
                  (r) => r.userId === order.assigned_delivery_user_id,
                );
                const status = order.status as OrderStatus;
                const needsAssign = orderNeedsDeliveryAssignment(order);
                return (
                  <div
                    key={order.id}
                    className={cn(
                      "rounded-2xl border bg-card/80 p-3 shadow-sm",
                      needsAssign ?
                        "border-amber-400/90 ring-1 ring-amber-300/50"
                      : "border-border",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black leading-tight">{order.customer_name}</p>
                        {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
                          <OrderBillLabeledHighlight
                            className="mt-1.5"
                            label="Shop"
                            value={shop?.name ?? EM_DASH}
                            pillClassName={orderBillShopHighlightClass}
                          />
                        : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <OrderStatusPill status={status} />
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {ADMIN_CUSTOMER_ORDERS_FOCUS ?
                              `${order.customer_phone || EM_DASH}${MIDDLE_DOT} ${formatGroobeyDateTime(order.created_at)}`
                            : `${takerName}${MIDDLE_DOT} ${formatGroobeyDateTime(order.created_at)}`}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs font-bold leading-snug">
                        <div>{formatInr(retail)}{ADMIN_CUSTOMER_ORDERS_FOCUS ? " total" : " retail"}</div>
                        {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
                          <div className="text-[11px] font-semibold text-muted-foreground">
                            {formatInr(trade)} trade {MIDDLE_DOT} {formatInr(margin)} margin
                          </div>
                        : null}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Delivery boy
                        <GroobeySelect
                          size="sm"
                          value={order.assigned_delivery_user_id || DELIVERY_BOY_UNASSIGNED}
                          disabled={
                            assigningDeliveryOrderId === order.id ||
                            !customerOrderDeliveryFieldsReady.current
                          }
                          onValueChange={(v) =>
                            void assignOrderDeliveryBoy(
                              order.id,
                              v === DELIVERY_BOY_UNASSIGNED ? "" : v,
                            )
                          }
                          options={deliveryBoySelectOptions}
                        />
                      </label>
                      {assignedBoy ?
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          {assignedBoy.email ?? EM_DASH}
                        </p>
                      : null}
                      <div className="space-y-2 border-t border-border/60 pt-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <OrderStatusPill status={status} />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Bill & print
                          </span>
                        </div>
                        <OrderBillLabeledHighlight
                          label="Bill ID"
                          value={order.bill_number || EM_DASH}
                          pillClassName={orderBillIdHighlightClass}
                        />
                        <BillKindButtons
                          compact
                          layout="equal"
                          className="w-full"
                          customerOnly={customerBillOnly}
                          onPrint={(kind) => exportCustomerOrderBill(order.id, kind)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full rounded-xl text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => void archiveCustomerOrder(order.id)}
                        >
                          <Trash2 className="size-3.5" />
                          Remove from list
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mb-3 hidden flex-wrap items-center gap-2 lg:flex">
              <span className="rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-bold text-foreground">
                {salesActiveOrders.length} active bill
                {salesActiveOrders.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                {salesCompletedToday.length} completed today
              </span>
            </div>
            <div className="owner-admin-bills-table-wrap owner-admin-bills-table-wrap--order-takers hidden lg:block">
              <div className="owner-admin-bills-table-scroll groobey-scrollbar">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">Customer</th>
                      <th className="text-left">{ADMIN_CUSTOMER_ORDERS_FOCUS ? "Order" : "Bill"}</th>
                      <th className="text-left">{ADMIN_CUSTOMER_ORDERS_FOCUS ? "Total" : "Totals"}</th>
                      <th className="owner-admin-bills-col-delivery text-left">Delivery</th>
                      <th className="owner-admin-bills-col-print text-left">Print</th>
                      <th className="text-left">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesActiveOrders.map((order) => {
                      const retail = Math.round(Number(order.total_amount || 0));
                      const trade = Math.round(Number(order.merchant_settlement_amount ?? retail));
                      const margin = retail - trade;
                      const shop = order.shop_id ? shops.find((s) => s.id === order.shop_id) : undefined;
                      const takerRow = staffRows.find((r) => r.userId === order.created_by);
                      const takerName =
                        staffNameByUserId.get(order.created_by) ||
                        takerRow?.displayName?.trim() ||
                        "Order taker";
                      const status = order.status as OrderStatus;
                      const needsAssign = orderNeedsDeliveryAssignment(order);
                      return (
                        <tr
                          key={order.id}
                          className={needsAssign ? "bg-amber-50/80" : undefined}
                        >
                          <td className="max-w-[10rem]">
                            <span className="block truncate font-bold">{order.customer_name}</span>
                            {ADMIN_CUSTOMER_ORDERS_FOCUS ?
                              <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
                                {order.customer_phone || EM_DASH}
                              </span>
                            : null}
                          </td>
                          <td className="min-w-0 max-w-[14rem]">
                            {ADMIN_CUSTOMER_ORDERS_FOCUS ?
                              <>
                                <p className="truncate text-xs font-semibold text-muted-foreground">
                                  {formatGroobeyDateTime(order.created_at)}
                                </p>
                                <p className="mt-1">
                                  <OrderStatusPill status={status} />
                                </p>
                                <OrderBillLabeledHighlight
                                  className="mt-1"
                                  label="Bill ID"
                                  value={order.bill_number || EM_DASH}
                                  pillClassName={orderBillIdHighlightClass}
                                />
                              </>
                            : <>
                                <p className="truncate text-sm font-semibold text-foreground">{takerName}</p>
                                <OrderBillLabeledHighlight
                                  className="mt-1"
                                  label="Shop"
                                  value={shop?.name ?? EM_DASH}
                                  pillClassName={orderBillShopHighlightClass}
                                />
                                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                                  {formatGroobeyDateTime(order.created_at)}
                                </p>
                                <p className="mt-1">
                                  <OrderStatusPill status={status} />
                                </p>
                                <OrderBillLabeledHighlight
                                  className="mt-1"
                                  label="Bill ID"
                                  value={order.bill_number || EM_DASH}
                                  pillClassName={orderBillIdHighlightClass}
                                />
                              </>
                            }
                          </td>
                          <td className="owner-admin-bills-cell-nowrap">
                            <span className="text-sm font-bold tabular-nums">{formatInr(retail)}</span>
                            {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
                              <span className="block text-[11px] font-semibold tabular-nums text-muted-foreground">
                                {formatInr(trade)} trade {MIDDLE_DOT} {formatInr(margin)} mrg
                              </span>
                            : null}
                          </td>
                          <td className="owner-admin-bills-col-delivery">
                            <GroobeySelect
                              size="sm"
                              fullWidth={false}
                              className="w-[11rem]"
                              value={order.assigned_delivery_user_id || DELIVERY_BOY_UNASSIGNED}
                              disabled={
                                assigningDeliveryOrderId === order.id ||
                                !customerOrderDeliveryFieldsReady.current
                              }
                              onValueChange={(v) =>
                                void assignOrderDeliveryBoy(
                                  order.id,
                                  v === DELIVERY_BOY_UNASSIGNED ? "" : v,
                                )
                              }
                              options={deliveryBoySelectOptions}
                            />
                          </td>
                          <td className="owner-admin-bills-col-print">
                            <BillKindButtons
                              compact
                              layout="compact"
                              customerOnly={customerBillOnly}
                              onPrint={(kind) => exportCustomerOrderBill(order.id, kind)}
                            />
                          </td>
                          <td>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => void archiveCustomerOrder(order.id)}
                            >
                              <Trash2 className="size-3.5" />
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {salesActiveOrders.length === 0 ?
                <EmptyState
                  icon={ClipboardList}
                  title={ADMIN_CUSTOMER_ORDERS_FOCUS ? "No active customer orders" : "No active order bills"}
                  text={
                    ADMIN_CUSTOMER_ORDERS_FOCUS ?
                      "New orders from the online shop appear here until delivery is completed."
                    : "New bills from the Orders dashboard appear here until delivery is completed."
                  }
                />
              : null}
            </div>
            {salesActiveOrders.length === 0 ?
              <div className="lg:hidden">
                <EmptyState
                  icon={ClipboardList}
                  title={ADMIN_CUSTOMER_ORDERS_FOCUS ? "No active customer orders" : "No active order bills"}
                  text={
                    ADMIN_CUSTOMER_ORDERS_FOCUS ?
                      "New orders from the online shop appear here until delivery is completed."
                    : "New bills from the Orders dashboard appear here until delivery is completed."
                  }
                />
              </div>
            : null}
            </div>
          </Panel>
          <Panel title={`Completed today (${salesCompletedToday.length})`} icon={ClipboardList}>
              <p className="mb-3 text-xs font-semibold text-muted-foreground">
                End of day: skim this list and Remove any mistakes. Clears automatically tomorrow morning.
                {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
                  " Monthly settlement export above keeps every bill for the month."
                : null}
              </p>
              {salesCompletedToday.length === 0 ?
                <p className="text-sm font-semibold text-muted-foreground">
                  No completed bills yet today. Finished orders will appear here until tomorrow.
                </p>
              : <ul className="space-y-2">
                {salesCompletedToday.map((order) => {
                  const shop = order.shop_id ? shops.find((s) => s.id === order.shop_id) : undefined;
                  const status = order.status as OrderStatus;
                  return (
                    <li
                      key={order.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card/70 p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{order.customer_name}</p>
                        <p className="font-mono text-sm font-bold text-primary">
                          {order.bill_number || EM_DASH}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ADMIN_CUSTOMER_ORDERS_FOCUS ?
                            <>
                              {order.customer_phone || EM_DASH} {MIDDLE_DOT}{" "}
                              <OrderStatusPill status={status} />
                            </>
                          : <>
                              {shop?.name ?? EM_DASH} {MIDDLE_DOT}{" "}
                              <OrderStatusPill status={status} />
                            </>
                          }
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <BillKindButtons
                          compact
                          layout="compact"
                          customerOnly={customerBillOnly}
                          onPrint={(kind) => exportCustomerOrderBill(order.id, kind)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => void archiveCustomerOrder(order.id)}
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              }
          </Panel>
          {!ADMIN_CUSTOMER_ORDERS_FOCUS ?
            <>
          <Panel title="Monthly settlement export" icon={Download}>
            <p className="text-sm font-semibold text-muted-foreground">
              Full month totals for Groobey settlement {EM_DASH} includes verified merchant sales and all
              order-taker bills (even if removed from today&apos;s list). Use this for accounting, not the
              daily Completed today panel.
            </p>
            <Button
              type="button"
              variant="calm"
              className="mt-3 h-11 rounded-xl"
              onClick={exportMonthSalesSettlement}
            >
              <Download className="size-4" />
              Export {month} settlement Excel
            </Button>
          </Panel>
          <Panel title="Sales pipeline" icon={ReceiptText}>
            <p className="mb-3 text-xs font-semibold text-muted-foreground">
              Remove hides a sale from this list only. Overview today/month counts still include it.
            </p>

            <div className="space-y-3 lg:hidden">
              {pipelineSales.map((sale) => {
                const rows = saleItems.filter((row) => row.sale_id === sale.id);
                const marginPct = resolveTradeMarginPercent({
                  saleApplied: sale.trade_margin_percent_applied,
                  shopMargin: shops.find((s) => s.id === sale.shop_id)?.trade_margin_percent,
                  items: rows,
                });
                const lines = tradeBillLinesFromItems(rows, marginPct);
                const retailT = sumRetail(lines);
                const merchantT = sumMerchant(lines);
                const margin = Math.round(retailT - merchantT);
                return (
                  <div
                    key={sale.id}
                    className="rounded-2xl border border-border bg-card/80 p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-black">
                          Sale *{saleDisplayId(sale, sales)}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                          {saleDisplayTime(sale)}
                          {MIDDLE_DOT} {sale.destination_type}
                          {MIDDLE_DOT} {formatGroobeyDateTime(sale.created_at)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold capitalize">
                        {sale.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold">
                      {formatInr(Math.round(retailT))} retail {MIDDLE_DOT}{" "}
                      {formatInr(Math.round(merchantT))} trade {MIDDLE_DOT} {formatInr(margin)} margin
                    </p>
                    <p className="mt-1 font-mono text-[11px] font-bold text-muted-foreground">
                      Bill {sale.bill_number || EM_DASH}
                    </p>
                    <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
                      <BillKindButtons
                        compact
                        layout="equal"
                        className="w-full"
                        onPrint={(kind) => exportSaleBill(sale.id, kind)}
                      />
                      {sale.status === "verified" || sale.status === "rejected" ?
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full rounded-xl text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => void archiveSale(sale.id)}
                        >
                          <Trash2 className="size-3.5" />
                          Remove from list
                        </Button>
                      : null}
                    </div>
                  </div>
                );
              })}
              {pipelineSales.length === 0 ?
                <EmptyState
                  icon={ReceiptText}
                  title="No sales yet"
                  text="Merchants will submit sales here."
                />
              : null}
            </div>

            <div className="owner-admin-bills-table-wrap hidden lg:block">
              <div className="owner-admin-bills-table-scroll groobey-scrollbar">
                <table>
                  <thead>
                    <tr>
                      <th className="text-left">ID</th>
                      <th className="text-left">Destination</th>
                      <th className="text-left">Status</th>
                      <th className="text-left">Created</th>
                      <th className="text-left">Totals</th>
                      <th className="text-left">Bill #</th>
                      <th className="text-left">Print</th>
                      <th className="text-left">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineSales.map((sale) => {
                      const rows = saleItems.filter((row) => row.sale_id === sale.id);
                      const marginPct = resolveTradeMarginPercent({
                        saleApplied: sale.trade_margin_percent_applied,
                        shopMargin: shops.find((s) => s.id === sale.shop_id)?.trade_margin_percent,
                        items: rows,
                      });
                      const lines = tradeBillLinesFromItems(rows, marginPct);
                      const retailT = sumRetail(lines);
                      const merchantT = sumMerchant(lines);
                      const margin = Math.round(retailT - merchantT);
                      return (
                        <tr key={sale.id}>
                          <td className="font-mono text-xs whitespace-nowrap">
                            <span className="font-bold">Sale *{saleDisplayId(sale, sales)}</span>
                            <div className="text-[11px] font-semibold text-muted-foreground">
                              {saleDisplayTime(sale)}
                            </div>
                          </td>
                          <td className="text-sm font-semibold capitalize">{sale.destination_type}</td>
                          <td>
                            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold capitalize">
                              {sale.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-sm font-semibold tabular-nums text-muted-foreground">
                            {formatGroobeyDateTime(sale.created_at)}
                          </td>
                          <td className="whitespace-nowrap">
                            <div className="text-sm font-bold">{formatInr(Math.round(retailT))} retail</div>
                            <div className="text-[11px] font-semibold text-muted-foreground">
                              {formatInr(Math.round(merchantT))} trade {MIDDLE_DOT}{" "}
                              {formatInr(margin)} margin
                            </div>
                          </td>
                          <td className="font-mono text-xs font-bold whitespace-nowrap">
                            {sale.bill_number || EM_DASH}
                          </td>
                          <td>
                            <BillKindButtons
                              compact
                              layout="stack"
                              onPrint={(kind) => exportSaleBill(sale.id, kind)}
                            />
                          </td>
                          <td className="whitespace-nowrap">
                            {sale.status === "verified" || sale.status === "rejected" ?
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-lg px-2.5 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => void archiveSale(sale.id)}
                              >
                                <Trash2 className="size-3.5" />
                                Remove
                              </Button>
                            : <span className="text-xs text-muted-foreground">{EM_DASH}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pipelineSales.length === 0 ?
                <EmptyState
                  icon={ReceiptText}
                  title="No sales yet"
                  text="Merchants will submit sales here."
                />
              : null}
            </div>
          </Panel>
            </>
          : null}
        </TabsContent>

        <Dialog
          open={selectedCustomer != null}
          onOpenChange={(open) => !open && closeCustomerDetail()}
        >
          <GroobeySheetDialogContent>
            {selectedCustomer ?
              <>
                <GroobeySheetDialogHeader
                  title={selectedCustomer.name}
                  description={`${selectedCustomer.phone}${MIDDLE_DOT} ${selectedCustomer.count} order${selectedCustomer.count === 1 ? "" : "s"}`}
                  onClose={closeCustomerDetail}
                />
                <GroobeySheetDialogBody>{renderCustomerDetailDialogContent()}</GroobeySheetDialogBody>
                <GroobeySheetDialogFooter onClose={closeCustomerDetail} />
              </>
            : null}
          </GroobeySheetDialogContent>
        </Dialog>

        <Dialog open={selectedStaff != null} onOpenChange={(open) => !open && closeStaffDetail()}>
          <GroobeySheetDialogContent>
            {selectedStaff ?
              <>
                <GroobeySheetDialogHeader
                  title={selectedStaff.displayName || "Staff login"}
                  description={`${roleLabel(selectedStaff.role)}${selectedStaff.groobeyId ? ` ${MIDDLE_DOT} ${selectedStaff.groobeyId}` : ""}`}
                  onClose={closeStaffDetail}
                />
                <GroobeySheetDialogBody>{renderStaffDetailDialogContent()}</GroobeySheetDialogBody>
                <GroobeySheetDialogFooter onClose={closeStaffDetail} />
              </>
            : null}
          </GroobeySheetDialogContent>
        </Dialog>

        <Dialog
          open={selectedAttendance != null}
          onOpenChange={(open) => !open && closeAttendanceDetail()}
        >
          <GroobeySheetDialogContent>
            {selectedAttendance ?
              <>
                <GroobeySheetDialogHeader
                  title={`Attendance ${MIDDLE_DOT} ${selectedAttendance.work_date}`}
                  description={
                    staffNameByUserId.get(selectedAttendance.worker_id) ?? "Delivery staff"
                  }
                  onClose={closeAttendanceDetail}
                />
                <GroobeySheetDialogBody>{renderAttendanceDetailDialogContent()}</GroobeySheetDialogBody>
                <GroobeySheetDialogFooter onClose={closeAttendanceDetail} />
              </>
            : null}
          </GroobeySheetDialogContent>
        </Dialog>

      </Tabs>
    </div>
    </>
  );
}
