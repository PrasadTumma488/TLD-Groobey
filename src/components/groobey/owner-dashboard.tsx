import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  ClipboardList,
  Download,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  Pencil,
  PackagePlus,
  Plus,
  ReceiptText,
  ShoppingBasket,
  Store,
  Trash2,
  UsersRound,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PRESET_GROCERY_NAMES } from "@/lib/groobey-preset-grocery-names";
import {
  DEFAULT_GROCERY_PACK,
  GROCERY_LIST_CATEGORY,
  GROCERY_PACK_SIZES,
  isKnownPackSize,
} from "@/lib/groobey-pack-sizes";
import { isTransientDatabaseError, retryTransient } from "@/lib/groobey-retry";
import { backfillMySaleBillIds, salesMissingBillId } from "@/lib/groobey-bill-backfill";
import { saleDisplayId, saleDisplayTime } from "@/lib/groobey-sale-display-id";
import { salesForPeriodAnalytics, salesForPipeline } from "@/lib/groobey-sales";
import {
  buildVerifiedSaleBillHtml,
  formatStaffBillLabel,
  openBillPrintGuarded,
  printCustomerOrderBill,
  resolveTradeMarginPercent,
  saleBillLinesForKind,
  sumMerchant,
  sumRetail,
  tradeBillLinesFromItems,
} from "@/lib/groobey-dual-bill";
import { backfillCustomerOrdersClient, ordersMissingBillId } from "@/lib/groobey-bill-backfill";
import {
  CUSTOMER_ORDER_SELECT,
  CUSTOMER_ORDER_SELECT_LEGACY,
  isMissingCustomerOrderShopIdError,
} from "@/lib/groobey-customer-order-columns";
import { GroobeyDashboardHeader } from "./groobey-brand-logo";
import { BillKindButtons } from "./groobey-bill-buttons";
import {
  createStaffAccount,
  deleteStaffAccount,
  ensureMyGroobeyCode,
  listStaffAccounts,
  setStaffAccountActive,
  syncGroobeyCodes,
  updateMyProfile,
  updateStaffAccount,
} from "@/lib/tldGroobey.functions";

import { AccountForm } from "./groobey-forms";
import { GroobeyExcelCatalogUpload } from "./groobey-excel-catalog-upload";
import { TradeMarginPanel, type MarginSaveResult } from "./groobey-trade-margin-panel";
import { parseCatalogExcelBuffer } from "@/lib/groobey-excel-catalog";
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

/** Rotates one sample per button click (same names reuse different clicks). */
const SAMPLE_GROCERY_TEMPLATES = [
  { name: "Rice", unit: "1 kg" as const, price: 52 },
  { name: "Wheat flour", unit: "1 kg" as const, price: 42 },
  { name: "Refined sugar", unit: "1 kg" as const, price: 45 },
];

export function OwnerDashboard() {
  const createAccount = useServerFn(createStaffAccount);
  const updateStaff = useServerFn(updateStaffAccount);
  const deleteStaff = useServerFn(deleteStaffAccount);
  const listStaff = useServerFn(listStaffAccounts);
  const setStaffActive = useServerFn(setStaffAccountActive);
  const syncCodes = useServerFn(syncGroobeyCodes);
  const ensureOwnCode = useServerFn(ensureMyGroobeyCode);
  const saveMyProfile = useServerFn(updateMyProfile);

  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<
    "all" | "pending" | "verified" | "rejected"
  >("all");
  const [activeTab, setActiveTab] = useState("overview");
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
  const [addName, setAddName] = useState("");
  const [addUnit, setAddUnit] = useState(DEFAULT_GROCERY_PACK);
  const [addPrice, setAddPrice] = useState("");
  const [savingGlobalMargin, setSavingGlobalMargin] = useState(false);
  const [addGroceryPickerOpen, setAddGroceryPickerOpen] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const addGroceryPickerRef = useRef<HTMLDivElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const sampleSeedIndex = useRef(0);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);
  const [editingOrderTakerMargin, setEditingOrderTakerMargin] = useState("0");
  const [staffFormResetNonce, setStaffFormResetNonce] = useState(0);
  const hasSyncedWorkspace = useRef(false);
  const saleBillBackfillAttempted = useRef(false);
  const customerOrderBillBackfillAttempted = useRef(false);
  const customerOrderShopIdReady = useRef(true);
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
                .select("id,name,unit,price,category,is_active,created_at,merchant_unit_price")
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

        let saleItemsRes = await supabase
          .from("sale_items")
          .select(SALE_ITEMS_SELECT_WITH_UNIT)
          .order("created_at", { ascending: false })
          .limit(800);
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
        setShops((shopsRes.data ?? []) as Shop[]);
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

        let customerOrdersRes = await supabase
          .from("customer_orders")
          .select(CUSTOMER_ORDER_SELECT)
          .order("created_at", { ascending: false })
          .limit(200);
        if (
          customerOrdersRes.error &&
          customerOrderShopIdReady.current &&
          isMissingCustomerOrderShopIdError(customerOrdersRes.error.message)
        ) {
          customerOrderShopIdReady.current = false;
          customerOrdersRes = await supabase
            .from("customer_orders")
            .select(CUSTOMER_ORDER_SELECT_LEGACY)
            .order("created_at", { ascending: false })
            .limit(200);
        }
        if (customerOrdersRes.error) {
          setNotice("");
          const hint = schemaSetupHint(customerOrdersRes.error.message);
          setError(
            hint ??
              (isTransientDatabaseError(customerOrdersRes.error.message) ?
                "Refreshing data. Please wait."
              : customerOrdersRes.error.message),
          );
          return;
        }
        const nextCustomerOrders = (customerOrdersRes.data ?? []) as CustomerOrder[];
        setCustomerOrders(nextCustomerOrders);
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
    const timer = window.setInterval(() => void loadWorkspace({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [loadWorkspace, session?.user]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (editingStaff?.role !== "order_taker") return;
    void supabase
      .from("profiles")
      .select("trade_margin_percent")
      .eq("user_id", editingStaff.userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) setEditingOrderTakerMargin(String(data?.trade_margin_percent ?? 0));
      });
  }, [editingStaff?.userId, editingStaff?.role]);

  useEffect(() => {
    if (!session?.user) return;
    if (
      activeTab === "shop-owners" ||
      activeTab === "staff" ||
      activeTab === "orders-team" ||
      activeTab === "create-logins"
    ) {
      void loadStaff();
    }
  }, [activeTab, loadStaff, session?.user]);

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
      // Prefer React state (auth listener / memory) then persisted session — they can diverge briefly.
      let accessToken = (session?.access_token || live?.access_token || "").trim();
      const refreshToken = (session?.refresh_token || live?.refresh_token || "").trim();
      // `refreshSession()` throws "Auth session missing!" if there is no refresh token — only call when we have one.
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
          password,
          role,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
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
      window.setTimeout(() => void loadStaff({ quietListError: true }), 2000);
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
      setEditingStaff(null);
      void loadWorkspace({ silent: true });
      void loadStaff();
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
      setEditingStaff((prev) => (prev?.userId === row.userId ? null : prev));
      setStaffRows((prev) => prev.filter((item) => item.userId !== row.userId));
      void loadStaff();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete staff.");
    }
  }

  async function seedProducts() {
    if (!session?.user) return;
    setError("");
    const idx = sampleSeedIndex.current % SAMPLE_GROCERY_TEMPLATES.length;
    sampleSeedIndex.current += 1;
    const template = SAMPLE_GROCERY_TEMPLATES[idx];
    const { data: row, error: seedError } = await supabase
      .from("products")
      .insert({
        name: template.name,
        category: GROCERY_LIST_CATEGORY,
        unit: template.unit,
        price: template.price,
        merchant_unit_price: template.price,
        default_quantity: 1,
        created_by: session.user.id,
      } as never)
      .select()
      .single();
    if (seedError) setError(seedError.message);
    else if (row) {
      setProducts((prev) => sortProductsByNameUnit([...prev, row]));
      setNotice(`Added one sample: ${template.name} (${template.unit}).`);
    }
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
          category: GROCERY_LIST_CATEGORY,
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
        `Excel import: ${parsed.rows.length} row(s) — ${created} added, ${updated} updated.${warn}`,
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
    const { data: row, error: productError } = await supabase
      .from("products")
      .insert({
        name,
        category: GROCERY_LIST_CATEGORY,
        unit,
        price: retail,
        merchant_unit_price: retail,
        default_quantity: 1,
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
      setAddGroceryPickerOpen(false);
      setNotice("Product added.");
    }
  }

  useEffect(() => {
    if (!addGroceryPickerOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (addGroceryPickerRef.current?.contains(e.target as Node)) return;
      setAddGroceryPickerOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [addGroceryPickerOpen]);

  async function updateProductFromForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const unitRaw = String(form.get("unit") || "").trim();
    const unit = isKnownPackSize(unitRaw) ? unitRaw : editingProduct.unit;
    const { data: updated, error: productError } = await supabase
      .from("products")
      .update({
        name: String(form.get("name") || "").trim(),
        unit,
        price: Number(form.get("price") || 0),
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

  async function bulkAdjustRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pct = Number(form.get("percent") || 0);
    if (!Number.isFinite(pct)) return;
    const factor = 1 + pct / 100;
    const targets = filteredProducts;
    const nextById = new Map(
      targets.map((p) => [p.id, Math.round(p.price * factor * 100) / 100] as const),
    );
    await Promise.all(
      [...nextById.entries()].map(([id, next]) =>
        supabase
          .from("products")
          .update({ price: next, merchant_unit_price: next } as never)
          .eq("id", id),
      ),
    );
    setProducts((prev) =>
      sortProductsByNameUnit(
        prev.map((p) => (nextById.has(p.id) ? { ...p, price: nextById.get(p.id)!, merchant_unit_price: nextById.get(p.id)! } : p)),
      ),
    );
    setNotice(`Adjusted rates by ${pct}% for ${targets.length} items.`);
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
      : "—";
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
    openBillPrintGuarded(html, kind);
  }

  function exportCustomerOrderBill(orderId: string, kind: "customer" | "merchant") {
    const order = customerOrders.find((row) => row.id === orderId);
    if (!order) return;
    const shop = order.shop_id ? shops.find((s) => s.id === order.shop_id) : undefined;
    const takerRow = staffRows.find((r) => r.userId === order.created_by);
    const displayName =
      staffNameByUserId.get(order.created_by) || takerRow?.displayName?.trim() || "Order taker";
    const orderTakerLabel = formatStaffBillLabel({
      displayName,
      groobeyCode: takerRow?.groobeyId ?? null,
    });
    const opened = printCustomerOrderBill({
      kind,
      order,
      shopName: shop?.name ?? null,
      orderTakerLabel,
    });
    if (opened && kind === "merchant") {
      setNotice("Settlement bill opened — same Bill ID as the customer copy.");
    }
  }

  async function archiveSale(saleId: string) {
    const sale = sales.find((row) => row.id === saleId);
    if (!sale || sale.status === "pending") return;
    const ok = window.confirm(
      "Remove this sale from the sales list?\n\n" +
        "• Weekly and monthly totals stay the same\n" +
        "• Bill numbers are kept for monthly settlement\n" +
        "• You can still export this month’s settlement below",
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

  function exportMonthSalesSettlement() {
    const month = new Date().toISOString().slice(0, 7);
    const monthVerified = sales.filter(
      (s) =>
        s.status === "verified" &&
        (s.sold_at || s.created_at || "").slice(0, 7) === month,
    );
    const header = [
      "bill_number",
      "sale_id",
      "shop_id",
      "status",
      "sold_date",
      "retail_total",
      "trade_total",
      "margin",
      "removed_from_list",
    ].join(",");
    const body = monthVerified.map((sale) => {
      const rows = saleItems.filter((row) => row.sale_id === sale.id);
      const marginPct = resolveTradeMarginPercent({
        saleApplied: sale.trade_margin_percent_applied,
        shopMargin: shops.find((s) => s.id === sale.shop_id)?.trade_margin_percent,
        items: rows,
      });
      const lines = tradeBillLinesFromItems(rows, marginPct);
      const retailT = sumRetail(lines);
      const tradeT = sumMerchant(lines);
      return [
        sale.bill_number ?? "",
        sale.id,
        sale.shop_id ?? "",
        sale.status,
        (sale.sold_at || sale.created_at || "").slice(0, 10),
        String(Math.round(retailT)),
        String(Math.round(tradeT)),
        String(Math.round(retailT - tradeT)),
        sale.deleted_at ? "yes" : "no",
      ].join(",");
    });
    const monthOrders = customerOrders.filter((o) => (o.created_at || "").slice(0, 7) === month);
    const orderHeader = [
      "source",
      "bill_number",
      "order_id",
      "shop_id",
      "status",
      "created_date",
      "retail_total",
      "trade_total",
      "margin",
    ].join(",");
    const orderBody = monthOrders.map((order) => {
      const retail = Math.round(Number(order.total_amount || 0));
      const trade = Math.round(Number(order.merchant_settlement_amount ?? retail));
      return [
        "order_taker",
        order.bill_number ?? "",
        order.id,
        order.shop_id ?? "",
        order.status,
        (order.created_at || "").slice(0, 10),
        String(retail),
        String(trade),
        String(retail - trade),
      ].join(",");
    });
    const combined = [header, ...body, ...(orderBody.length ? [orderHeader, ...orderBody] : [])].join(
      "\n",
    );
    const blob = new Blob([combined], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `groobey-sales-settlement-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      `Downloaded ${monthVerified.length} verified sale(s) and ${monthOrders.length} order-taker bill(s) for ${month}.`,
    );
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

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (!q) return true;
      const inName = p.name.toLowerCase().includes(q);
      const inUnit = p.unit.toLowerCase().includes(q);
      return inName || inUnit;
    });
  }, [products, productSearch]);

  const addPresetPickList = useMemo(() => {
    const q = addName.trim().toLowerCase();
    const list = !q
      ? [...PRESET_GROCERY_NAMES]
      : PRESET_GROCERY_NAMES.filter((n) => n.toLowerCase().includes(q));
    return list.slice(0, 200);
  }, [addName]);

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
  const pendingOrderTakerOrders = useMemo(
    () => customerOrders.filter((o) => o.status === "pending"),
    [customerOrders],
  );
  const monthOrderTakerOrders = useMemo(
    () => customerOrders.filter((o) => (o.created_at || "").slice(0, 7) === month),
    [customerOrders, month],
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
  const merchantStaffRows = staffRows.filter((row) => row.role === "merchant");
  const deliveryStaffRows = staffRows.filter((row) => row.role === "employee");
  const orderTakerRows = staffRows.filter((row) => row.role === "order_taker");
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
      <div className="space-y-3">
        <div className="grid gap-3 md:hidden">
          {rows.map((row) => (
            <div key={row.userId} className="rounded-2xl border border-border bg-card/70 p-3">
              <p className="text-base font-black leading-tight">{row.displayName || "-"}</p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                {roleLabel(row.role)}
              </p>
              <div className="mt-2 grid gap-1 text-sm">
                <p className="truncate">
                  <span className="font-semibold">Groobey ID:</span> {row.groobeyId ?? "-"}
                </p>
                <p className="truncate">
                  <span className="font-semibold">Email:</span> {row.email ?? "-"}
                </p>
                <p className="truncate">
                  <span className="font-semibold">Phone:</span> {row.phone ?? "-"}
                </p>
                {showLocation ? (
                  <p className="truncate">
                    <span className="font-semibold">Shop:</span>{" "}
                    {shopNameByOwnerId.get(row.userId) ?? "-"}
                  </p>
                ) : null}
                {showLocation ? (
                  <p className="truncate">
                    <span className="font-semibold">Location:</span>{" "}
                    {shopLocationByOwnerId.get(row.userId) ?? "-"}
                  </p>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant={row.isActive ? "outline" : "groobey"}
                  className="h-9 flex-1 rounded-lg text-xs"
                  onClick={() => void toggleStaff(row.userId, !row.isActive)}
                >
                  {row.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  type="button"
                  variant="calm"
                  className="h-9 flex-1 rounded-lg text-xs"
                  onClick={() => {
                    setEditingStaff(row);
                  }}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 flex-1 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => void handleDeleteStaff(row)}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              {showLocation ? (
                <>
                  <col className="w-[12%]" />
                  <col className="w-[9%]" />
                  <col className="w-[17%]" />
                  <col className="w-[18%]" />
                  <col className="w-[11%]" />
                  <col className="w-[14%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                </>
              ) : (
                <>
                  <col className="w-[17%]" />
                  <col className="w-[10%]" />
                  <col className="w-[24%]" />
                  <col className="w-[25%]" />
                  <col className="w-[10%]" />
                  <col className="w-[14%]" />
                </>
              )}
            </colgroup>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Role</th>
                <th className="py-2 pr-3 font-semibold">ID</th>
                <th className="py-2 pr-3 font-semibold">Email</th>
                <th className="py-2 pr-3 font-semibold">Phone</th>
                {showLocation ? <th className="py-2 pr-3 font-semibold">Shop Name</th> : null}
                {showLocation ? <th className="py-2 pr-3 font-semibold">Location</th> : null}
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b border-border/60">
                  <td className="truncate py-2 pr-3 font-semibold" title={row.displayName || "-"}>
                    {row.displayName || "-"}
                  </td>
                  <td className="truncate py-2 pr-3" title={roleLabel(row.role)}>
                    {roleLabel(row.role)}
                  </td>
                  <td className="truncate py-2 pr-3 font-mono text-xs" title={row.groobeyId ?? "-"}>
                    {row.groobeyId ?? "-"}
                  </td>
                  <td className="truncate py-2 pr-3" title={row.email ?? "-"}>
                    {row.email ?? "-"}
                  </td>
                  <td className="truncate py-2 pr-3" title={row.phone ?? "-"}>
                    {row.phone ?? "-"}
                  </td>
                  {showLocation ? (
                    <td
                      className="truncate py-2 pr-3"
                      title={shopNameByOwnerId.get(row.userId) ?? "-"}
                    >
                      {shopNameByOwnerId.get(row.userId) ?? "-"}
                    </td>
                  ) : null}
                  {showLocation ? (
                    <td
                      className="truncate py-2 pr-3"
                      title={shopLocationByOwnerId.get(row.userId) ?? "-"}
                    >
                      {shopLocationByOwnerId.get(row.userId) ?? "-"}
                    </td>
                  ) : null}
                  <td className="py-2">
                    <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                      <Button
                        type="button"
                        variant={row.isActive ? "outline" : "groobey"}
                        className="h-8 rounded-lg px-2 text-xs"
                        onClick={() => void toggleStaff(row.userId, !row.isActive)}
                      >
                        {row.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        variant="calm"
                        className="h-8 rounded-lg px-2 text-xs"
                        onClick={() => {
                          setEditingStaff(row);
                        }}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => void handleDeleteStaff(row)}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      <GroobeyDashboardHeader
        title={isProfileView ? "Platform Admin profile" : "Platform Admin dashboard"}
        subtitle={
          isProfileView
            ? "Your main admin identity and account details."
            : "Full company control - grocery catalog, staff, shops, sales, and attendance."
        }
        actions={
          <>
            <Button
              variant={activeTab === "profile" ? "outline" : "groobey"}
              className="min-h-11 rounded-xl"
              onClick={() => setActiveTab("overview")}
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === "profile" ? "groobey" : "outline"}
              className="min-h-11 rounded-xl"
              onClick={() => setActiveTab("profile")}
            >
              Profile
            </Button>
            <Button
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={() => supabase.auth.signOut()}
            >
              Logout
            </Button>
          </>
        }
      />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">

      {!isProfileView ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={PackagePlus} label="Products" value={String(products.length)} />
          <Stat
            icon={Store}
            label="Shops"
            value={String(shops.filter((s) => s.is_active).length)}
          />
          <Stat icon={ReceiptText} label="Sales (loaded)" value={String(sales.length)} />
          <Stat icon={ClipboardList} label="Attendance rows" value={String(attendance.length)} />
        </section>
      ) : null}

      <Message
        error=""
        notice=""
        loading={loading && !hasSyncedWorkspace.current}
        refreshing={loading && hasSyncedWorkspace.current}
        showAlerts={false}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {!isProfileView ? (
          <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 bg-muted/80 p-1 sm:grid-cols-3 lg:flex lg:max-w-full lg:flex-nowrap lg:overflow-x-auto lg:overflow-y-hidden">
          <TabsTrigger
            value="overview"
            className="min-h-10 gap-1 px-2 text-xs sm:text-sm lg:flex-shrink-0 lg:gap-1.5 lg:px-3"
          >
            <LayoutDashboard className="size-4 shrink-0" /> Overview
          </TabsTrigger>
          <TabsTrigger
            value="create-logins"
            className="min-h-10 gap-1 px-2 text-xs sm:text-sm lg:flex-shrink-0 lg:gap-1.5 lg:px-3"
          >
            <UsersRound className="size-4 shrink-0" /> Create Logins
          </TabsTrigger>
          <TabsTrigger
            value="shop-owners"
            className="min-h-10 gap-1 px-2 text-xs sm:text-sm lg:flex-shrink-0 lg:gap-1.5 lg:px-3"
          >
            <UsersRound className="size-4 shrink-0" /> Shop Owners
          </TabsTrigger>
          <TabsTrigger
            value="staff"
            className="min-h-10 gap-1 px-2 text-xs sm:text-sm lg:flex-shrink-0 lg:gap-1.5 lg:px-3"
          >
            <UsersRound className="size-4 shrink-0" /> Staff
          </TabsTrigger>
          <TabsTrigger
            value="orders-team"
            className="min-h-10 gap-1 px-2 text-xs sm:text-sm lg:flex-shrink-0 lg:gap-1.5 lg:px-3"
          >
            <UsersRound className="size-4 shrink-0" /> Orders Team
          </TabsTrigger>
          <TabsTrigger
            value="catalog"
            className="min-h-10 gap-1 px-2 text-xs sm:text-sm lg:flex-shrink-0 lg:gap-1.5 lg:px-3"
          >
            <IndianRupee className="size-4 shrink-0" /> Grocery
          </TabsTrigger>
          <TabsTrigger
            value="sales"
            className="min-h-10 gap-1 px-2 text-xs sm:text-sm lg:flex-shrink-0 lg:gap-1.5 lg:px-3"
          >
            <ReceiptText className="size-4 shrink-0" /> Sales
          </TabsTrigger>
          <TabsTrigger
            value="attendance"
            className="min-h-10 gap-1 px-2 text-xs sm:text-sm lg:flex-shrink-0 lg:gap-1.5 lg:px-3"
          >
            <ClipboardList className="size-4 shrink-0" /> Attendance
          </TabsTrigger>
          </TabsList>
        ) : null}

        <TabsContent value="profile" className="space-y-4">
          <InlineFeedback {...alertsFor("profile")} />
          <Panel title="Platform Admin profile" icon={UsersRound}>
            <div className="grid gap-4">
              <div className="min-w-0 rounded-2xl border border-border bg-gradient-to-r from-primary/20 via-card to-card p-4 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground">
                      {(profileDisplayName[0] || "P").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Platform Admin
                      </p>
                      <p className="break-words text-lg font-black text-foreground sm:text-xl">
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
          <div className="rounded-xl border border-border bg-card/70 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Needs attention
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg text-xs"
                onClick={() => {
                  setAttendanceFilter("pending");
                  setActiveTab("attendance");
                }}
              >
                Pending attendance: {pendingAttendance.length}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg text-xs"
                onClick={() => setActiveTab("sales")}
              >
                Pending sales: {pendingSales.length}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg text-xs"
                onClick={() => setActiveTab("sales")}
              >
                Order taker bills: {customerOrders.length}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg text-xs"
                onClick={() => setActiveTab("create-logins")}
              >
                Add shop owner / staff / order taker
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="groobey-card rounded-2xl border border-border p-4 transition duration-200">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Pending sales
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-primary">
                {pendingSales.length}
              </p>
            </div>
            <div className="groobey-card rounded-2xl border border-border p-4 transition duration-200">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Pending attendance
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-primary">
                {pendingAttendance.length}
              </p>
            </div>
            <div className="groobey-card rounded-2xl border border-border p-4 transition duration-200">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Active shops
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-primary">
                {shops.filter((s) => s.is_active).length}
              </p>
            </div>
            <div className="groobey-card rounded-2xl border border-primary/25 bg-primary/5 p-4 transition duration-200">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Groobey margin (all shops)
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-primary">{globalTradeMargin}%</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Set on Sales tab · off retail on trade / settlement bills
              </p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Quick approvals - attendance" icon={Bike}>
              <VerifyList
                title="Pending attendance"
                records={pendingAttendance.map((a) => ({
                  id: a.id,
                  label: `${a.work_date} · ${a.status} · ${formatPersonWithGroobeyId({
                    userId: a.worker_id,
                    displayName: staffNameByUserId.get(a.worker_id),
                    groobeyByUserId,
                  })}`,
                }))}
                onApprove={(id) => void updateAttendanceVerification(id, "verified")}
                onReject={(id) => void updateAttendanceVerification(id, "rejected")}
                emptyText="No pending attendance."
              />
            </Panel>
            <Panel title="Daily and monthly analytics" icon={LayoutDashboard}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Sales today
                  </p>
                  <p className="mt-1 text-2xl font-black text-primary">{todaySales.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Sales this month
                  </p>
                  <p className="mt-1 text-2xl font-black text-primary">{monthSales.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Staff updates today
                  </p>
                  <p className="mt-1 text-2xl font-black text-primary">{todayAttendance.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Staff updates this month
                  </p>
                  <p className="mt-1 text-2xl font-black text-primary">{monthAttendance.length}</p>
                </div>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="shop-owners" className="space-y-6">
          <InlineFeedback {...alertsFor("shop-owners")} />
          <Panel title="Shop Owners Directory" icon={UsersRound}>
            {renderStaffTable(merchantStaffRows, "No shop owner logins yet.", true)}
          </Panel>
          {editingStaff?.role === "merchant" ? (
            <Panel
              title="Edit Shop Owner login"
              icon={Pencil}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 rounded-xl text-sm"
                  onClick={() => setEditingStaff(null)}
                >
                  Cancel
                </Button>
              }
            >
              <form
                className="grid gap-3 md:max-w-xl"
                onSubmit={handleUpdateStaff}
                key={editingStaff.userId}
              >
                <Field
                  name="displayName"
                  label="Shop Owner name"
                  required
                  defaultValue={editingStaff.displayName}
                />
                <Field name="email" label="Login email" defaultValue={editingStaff.email ?? ""} />
                <Field
                  name="phone"
                  label="Login mobile number"
                  defaultValue={editingStaff.phone ?? ""}
                />
                <Field
                  name="shopName"
                  label="Shop name"
                  required
                  defaultValue={shopByOwnerId.get(editingStaff.userId)?.name ?? ""}
                />
                <Field
                  name="shopAddress"
                  label="Location"
                  required
                  defaultValue={shopByOwnerId.get(editingStaff.userId)?.address ?? ""}
                />
                <Field
                  name="tradeMarginPercent"
                  label="Groobey margin % (whole shop bill)"
                  type="number"
                  required
                  defaultValue={String(
                    shopByOwnerId.get(editingStaff.userId)?.trade_margin_percent ?? 0,
                  )}
                />
                <Button type="submit" variant="groobey" className="min-h-11 w-fit rounded-xl">
                  Save Shop Owner changes
                </Button>
              </form>
            </Panel>
          ) : null}
          {!staffLoading && merchantStaffRows.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No shop owners yet"
              text="Use Create Logins tab to add shop owner logins."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <InlineFeedback {...alertsFor("staff")} />
          <Panel title="Staff Directory" icon={UsersRound}>
            {renderStaffTable(deliveryStaffRows, "No delivery boy logins yet.")}
          </Panel>
          {editingStaff?.role === "employee" ? (
            <Panel
              title="Edit Delivery boy login"
              icon={Pencil}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 rounded-xl text-sm"
                  onClick={() => setEditingStaff(null)}
                >
                  Cancel
                </Button>
              }
            >
              <form
                className="grid gap-3 md:max-w-xl"
                onSubmit={handleUpdateStaff}
                key={editingStaff.userId}
              >
                <Field
                  name="displayName"
                  label="Delivery boy name"
                  required
                  defaultValue={editingStaff.displayName}
                />
                <Field name="email" label="Login email" defaultValue={editingStaff.email ?? ""} />
                <Field
                  name="phone"
                  label="Login mobile number"
                  defaultValue={editingStaff.phone ?? ""}
                />
                <Button type="submit" variant="groobey" className="min-h-11 w-fit rounded-xl">
                  Save Delivery boy changes
                </Button>
              </form>
            </Panel>
          ) : null}
          {!staffLoading && deliveryStaffRows.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No delivery boys yet"
              text="Use Create Logins tab to add users."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="orders-team" className="space-y-6">
          <InlineFeedback {...alertsFor("orders-team")} />
          <Panel title="Order Taker Directory" icon={UsersRound}>
            {renderStaffTable(orderTakerRows, "No order taker logins yet.")}
          </Panel>
          {editingStaff?.role === "order_taker" ? (
            <Panel
              title="Edit Order Taker login"
              icon={Pencil}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 rounded-xl text-sm"
                  onClick={() => setEditingStaff(null)}
                >
                  Cancel
                </Button>
              }
            >
              <form
                className="grid gap-3 md:max-w-xl"
                onSubmit={handleUpdateStaff}
                key={editingStaff.userId}
              >
                <Field
                  name="displayName"
                  label="Order taker name"
                  required
                  defaultValue={editingStaff.displayName}
                />
                <Field name="email" label="Login email" defaultValue={editingStaff.email ?? ""} />
                <Field
                  name="phone"
                  label="Login mobile number"
                  defaultValue={editingStaff.phone ?? ""}
                />
                <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                  Groobey margin % (whole order bill)
                  <input
                    name="tradeMarginPercent"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    required
                    value={editingOrderTakerMargin}
                    onChange={(e) => setEditingOrderTakerMargin(e.target.value)}
                    className="h-11 max-w-[10rem] rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                  />
                </label>
                <Button type="submit" variant="groobey" className="min-h-11 w-fit rounded-xl">
                  Save Order Taker changes
                </Button>
              </form>
            </Panel>
          ) : null}
          {!staffLoading && orderTakerRows.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No order takers yet"
              text="Use Create Logins tab to add order taker users."
            />
          ) : null}
        </TabsContent>

        <TabsContent value="create-logins" className="space-y-6">
          <InlineFeedback {...alertsFor("create-logins")} />
          <Panel title="Create shop owner, staff, or order taker login" icon={UsersRound}>
            <AccountForm onCreate={handleCreateStaff} resetNonce={staffFormResetNonce} />
          </Panel>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-6">
          <InlineFeedback {...alertsFor("catalog")} />
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm font-semibold text-muted-foreground">
            One grocery list: each row is an item with pack size, retail rate, and optional default
            qty. Upload Excel to bulk-fill the catalog, or add items one by one below.
          </div>
          <GroobeyExcelCatalogUpload
            importing={importingExcel}
            onImport={importProductsFromExcel}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="groobey"
              className="min-h-11 rounded-xl"
              onClick={() => void seedProducts()}
            >
              <Plus className="size-4" /> Add one sample item
            </Button>
          </div>
          <Panel title="Search catalog" icon={PackagePlus}>
            <label className="grid gap-1 text-sm font-semibold">
              Search
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="h-11 min-h-11 rounded-xl border border-input bg-card px-3 text-sm outline-none ring-ring focus:ring-2"
                placeholder="Name or pack size"
                autoComplete="off"
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              {productSearch.trim()
                ? `${filteredProducts.length} match${filteredProducts.length === 1 ? "" : "es"} (of ${products.length})`
                : `${products.length} items`}
            </p>
          </Panel>
          <Panel title="Bulk rate change (%)" icon={IndianRupee}>
            <form className="flex flex-wrap items-end gap-3" onSubmit={bulkAdjustRates}>
              <Field name="percent" label="Percent change (+/-)" type="number" required />
              <Button type="submit" variant="calm" className="h-11 rounded-xl">
                Apply to filtered list
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              Applies to retail rates on filtered items ({filteredProducts.length} items). Trade on settlement
              bills uses the Groobey margin % set on the Sales tab.
            </p>
          </Panel>
          <Panel title="Add product" icon={PackagePlus}>
            <form className="grid max-w-xl gap-3" onSubmit={addProduct}>
              <div ref={addGroceryPickerRef} className="relative grid gap-1.5">
                <span className="text-sm font-semibold text-foreground">Grocery item</span>
                <p className="text-xs font-semibold text-muted-foreground">
                  Predefined names - click or focus to open the list, or type to shorten it. Pick a
                  name, then set pack size and rate. You can also type any name that is not in the
                  list.
                </p>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => {
                    setAddName(e.target.value);
                    setAddGroceryPickerOpen(true);
                  }}
                  onFocus={() => setAddGroceryPickerOpen(true)}
                  className="h-11 min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
                  placeholder="Choose from predefined list or type a custom name"
                  autoComplete="off"
                />
                {addGroceryPickerOpen && addPresetPickList.length > 0 ? (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-lg groobey-scrollbar">
                    {addPresetPickList.map((presetName) => (
                      <button
                        key={presetName}
                        type="button"
                        className="w-full px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/80 active:bg-muted"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setAddName(presetName);
                          setAddGroceryPickerOpen(false);
                        }}
                      >
                        {presetName}
                      </button>
                    ))}
                  </div>
                ) : null}
                {addGroceryPickerOpen && addPresetPickList.length === 0 && addName.trim() ? (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-lg">
                    No predefined name matches - keep typing to use a custom name, or clear to see
                    the full list.
                  </div>
                ) : null}
              </div>
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Pack size
                <select
                  required
                  value={addUnit}
                  onChange={(e) => setAddUnit(e.target.value)}
                  className="groobey-select h-11 w-full"
                >
                  {GROCERY_PACK_SIZES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
              <Button variant="groobey" className="min-h-11 rounded-xl w-fit" type="submit">
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
                className="grid max-w-xl gap-3"
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
                  <select
                    name="unit"
                    required
                    defaultValue={
                      isKnownPackSize(editingProduct.unit)
                        ? editingProduct.unit
                        : DEFAULT_GROCERY_PACK
                    }
                    className="groobey-select h-11 w-full"
                  >
                    {GROCERY_PACK_SIZES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  name="price"
                  label="Retail rate"
                  type="number"
                  required
                  defaultValue={String(editingProduct.price)}
                />
                <Button variant="groobey" className="min-h-11 w-fit rounded-xl" type="submit">
                  Save changes
                </Button>
              </form>
            </Panel>
          )}
          <Panel title="Grocery catalog" icon={ShoppingBasket}>
            <div
              className={`space-y-2 pr-1 groobey-scrollbar ${
                sortedFilteredProducts.length > 8 ? "max-h-[60vh] overflow-y-auto" : ""
              }`}
            >
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
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <InlineFeedback {...alertsFor("sales")} />
          <TradeMarginPanel
            title="Groobey margin (all active shops)"
            description="One margin for every shop. New sales: trade = retail minus this % (e.g. 8% → ₹100 retail → ₹92 trade). Settlement bills use this %."
            marginPercent={globalTradeMargin}
            saving={savingGlobalMargin}
            onSave={saveGlobalTradeMargin}
          />
          <Panel title="Order taker bills" icon={ClipboardList}>
            <p className="mb-3 text-xs font-semibold text-muted-foreground">
              Bills created from the Orders dashboard sync here automatically ({monthOrderTakerOrders.length}{" "}
              this month, {pendingOrderTakerOrders.length} pending). Same Bill ID for customer and
              settlement copies.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 text-left">Customer</th>
                    <th className="py-2 text-left">Order taker</th>
                    <th className="py-2 text-left">Shop</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Created</th>
                    <th className="py-2 text-left">Totals</th>
                    <th className="py-2 text-left">Bill #</th>
                    <th className="py-2 text-left">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOrders.map((order) => {
                    const retail = Math.round(Number(order.total_amount || 0));
                    const trade = Math.round(Number(order.merchant_settlement_amount ?? retail));
                    const margin = retail - trade;
                    const shop = order.shop_id ? shops.find((s) => s.id === order.shop_id) : undefined;
                    const takerRow = staffRows.find((r) => r.userId === order.created_by);
                    const takerName =
                      staffNameByUserId.get(order.created_by) ||
                      takerRow?.displayName?.trim() ||
                      "Order taker";
                    return (
                      <tr key={order.id} className="border-b border-border/60">
                        <td className="py-2 text-xs font-semibold">{order.customer_name}</td>
                        <td className="py-2 text-xs">{takerName}</td>
                        <td className="py-2 text-xs">{shop?.name ?? "—"}</td>
                        <td className="py-2 text-xs">
                          {orderStatusLabel[order.status] ?? order.status}
                        </td>
                        <td className="py-2 text-xs">{order.created_at?.slice(0, 16)}</td>
                        <td className="py-2 text-xs font-semibold">
                          <div>₹{retail} retail</div>
                          <div className="text-[11px] font-semibold text-muted-foreground">
                            ₹{trade} trade · ₹{margin} margin
                          </div>
                        </td>
                        <td className="py-2 font-mono text-xs">{order.bill_number || "—"}</td>
                        <td className="py-2">
                          <BillKindButtons
                            compact
                            onPrint={(kind) => exportCustomerOrderBill(order.id, kind)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {customerOrders.length === 0 && (
                <EmptyState
                  icon={ClipboardList}
                  title="No order taker bills yet"
                  text="When order takers create bills on the Orders dashboard, they appear here."
                />
              )}
            </div>
          </Panel>
          <Panel title="Monthly settlement export" icon={Download}>
            <p className="text-sm font-semibold text-muted-foreground">
              Verified merchant sales plus order-taker bills for {month} — for monthly Groobey settlement.
            </p>
            <Button
              type="button"
              variant="calm"
              className="mt-3 h-11 rounded-xl"
              onClick={exportMonthSalesSettlement}
            >
              <Download className="size-4" />
              Export {month} settlement CSV
            </Button>
          </Panel>
          <Panel title="Sales pipeline" icon={ReceiptText}>
            <p className="mb-3 text-xs font-semibold text-muted-foreground">
              Remove hides a sale from this list only. Overview today/month counts still include it.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 text-left">ID</th>
                    <th className="py-2 text-left">Destination</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Created</th>
                    <th className="py-2 text-left">Totals</th>
                    <th className="py-2 text-left">Bill #</th>
                    <th className="py-2 text-left">Print</th>
                    <th className="py-2 text-left">Remove</th>
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
                    <tr key={sale.id} className="border-b border-border/60">
                      <td className="py-2 font-mono text-xs">
                        Sale *{saleDisplayId(sale, sales)}
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          {saleDisplayTime(sale)}
                        </div>
                      </td>
                      <td className="py-2">{sale.destination_type}</td>
                      <td className="py-2">{sale.status}</td>
                      <td className="py-2 text-xs">{sale.created_at?.slice(0, 16)}</td>
                      <td className="py-2 text-xs font-semibold">
                        <div>₹{Math.round(retailT)} retail</div>
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          ₹{Math.round(merchantT)} trade · ₹{margin} margin
                        </div>
                      </td>
                      <td className="py-2 font-mono text-xs">{sale.bill_number || "—"}</td>
                      <td className="py-2">
                        <BillKindButtons
                          compact
                          onPrint={(kind) => exportSaleBill(sale.id, kind)}
                        />
                      </td>
                      <td className="py-2">
                        {sale.status === "verified" || sale.status === "rejected" ?
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => void archiveSale(sale.id)}
                          >
                            <Trash2 className="size-3.5" />
                            Remove
                          </Button>
                        : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {pipelineSales.length === 0 && (
                <EmptyState
                  icon={ReceiptText}
                  title="No sales yet"
                  text="Merchants will submit sales here."
                />
              )}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <InlineFeedback {...alertsFor("attendance")} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={exportCsv}>
              <Download className="size-4" /> Export CSV
            </Button>
            <div
              className="inline-flex overflow-hidden rounded-xl border border-border bg-card/70 p-1"
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
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
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
            <div className="grid gap-3 md:hidden">
              {filteredAttendance.map((row) => (
                <div key={row.id} className="rounded-2xl border border-border bg-card/70 p-3 shadow-soft">
                  {(() => {
                    const details = parseAttendanceNotes(row.notes);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-black leading-tight">
                            {staffNameByUserId.get(row.worker_id) ?? "Staff"}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${verificationBadgeClass(
                              row.verification_status,
                            )}`}
                          >
                            {verificationLabel(row.verification_status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-mono text-muted-foreground">
                          {row.work_date} · {groobeyIdForUser(row.worker_id, groobeyByUserId)}
                        </p>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <p>
                            <span className="font-semibold text-foreground">Destination:</span>{" "}
                            {details.destination}
                          </p>
                          <p className="break-words">
                            <span className="font-semibold text-foreground">Items:</span>{" "}
                            {details.items}
                          </p>
                          <p>
                            <span className="font-semibold text-foreground">Time:</span>{" "}
                            {details.time}
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select
                            className="groobey-select groobey-select--sm w-auto min-w-[7.5rem]"
                            value={row.status}
                            onChange={(e) =>
                              void updateAttendanceStatus(
                                row.id,
                                e.target.value as Database["public"]["Enums"]["attendance_status"],
                              )
                            }
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="half_day">Half day</option>
                          </select>
                          {row.verification_status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="calm"
                                className="h-8 rounded-lg text-xs"
                                onClick={() =>
                                  void updateAttendanceVerification(row.id, "verified")
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg text-xs"
                                onClick={() =>
                                  void updateAttendanceVerification(row.id, "rejected")
                                }
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 text-left">Date</th>
                    <th className="py-2 text-left">Worker</th>
                    <th className="py-2 text-left">Destination</th>
                    <th className="py-2 text-left">Items</th>
                    <th className="py-2 text-left">Time</th>
                    <th className="py-2 text-left">Day status</th>
                    <th className="py-2 text-left">Verification</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.map((row) => {
                    const details = parseAttendanceNotes(row.notes);
                    return (
                      <tr key={row.id} className="border-b border-border/60 align-middle">
                        <td className="py-2 font-semibold">{row.work_date}</td>
                        <td className="py-2 text-xs">
                          <span className="font-semibold">
                            {formatPersonWithGroobeyId({
                              userId: row.worker_id,
                              displayName: staffNameByUserId.get(row.worker_id),
                              groobeyByUserId,
                            })}
                          </span>
                        </td>
                        <td className="max-w-[170px] truncate py-2 text-xs" title={details.destination}>
                          {details.destination}
                        </td>
                        <td className="max-w-[260px] truncate py-2 text-xs" title={details.items}>
                          {details.items}
                        </td>
                        <td className="py-2 text-xs">{details.time}</td>
                        <td className="py-2">
                          <select
                            className="groobey-select groobey-select--sm w-full min-w-[7.5rem] max-w-[11rem]"
                            value={row.status}
                            onChange={(e) =>
                              void updateAttendanceStatus(
                                row.id,
                                e.target.value as Database["public"]["Enums"]["attendance_status"],
                              )
                            }
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="half_day">Half day</option>
                          </select>
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${verificationBadgeClass(
                              row.verification_status,
                            )}`}
                          >
                            {verificationLabel(row.verification_status)}
                          </span>
                        </td>
                        <td className="py-2">
                          {row.verification_status === "pending" ? (
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="calm"
                                className="h-8 rounded-lg text-xs"
                                onClick={() => void updateAttendanceVerification(row.id, "verified")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg text-xs"
                                onClick={() => void updateAttendanceVerification(row.id, "rejected")}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">
                              {attendanceStatusLabel(row.status)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredAttendance.length === 0 && (
                <EmptyState
                  icon={ClipboardList}
                  title="No attendance"
                  text="Delivery staff submit attendance from their portal."
                />
              )}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}