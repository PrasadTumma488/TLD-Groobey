import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShoppingBasket } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { GroobeyDashboardHeader } from "@/components/groobey/groobey-brand-logo";
import { MerchantWorkspace } from "@/components/groobey/groobey-forms";
import { TradeMarginPanel } from "@/components/groobey/groobey-trade-margin-panel";
import { InlineFeedback, Message, Panel, Stat } from "@/components/groobey/workspace-ui";
import type { MarginSaveResult } from "@/components/groobey/groobey-trade-margin-panel";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import { allocateSaleBillNumber, asBillRpcClient } from "@/lib/groobey-bill-id";
import { backfillMySaleBillIds, salesMissingBillId } from "@/lib/groobey-bill-backfill";
import { clampMarginPercent, schemaSetupHint } from "@/lib/groobey-trade-margin";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isTransientDatabaseError, retryTransient } from "@/lib/groobey-retry";
import {
  buildVerifiedSaleBillHtml,
  formatStaffBillLabel,
  openBillPrintGuarded,
  resolveTradeMarginPercent,
  saleBillLinesForKind,
} from "@/lib/groobey-dual-bill";
import type { BillPreviewEmailResult, BillPreviewShowOptions } from "@/lib/groobey-bill-preview-bridge";
import { sendCustomerBillEmail, sendWorkConfirmationEmail } from "@/lib/tldGroobey.functions";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ShopRow = Database["public"]["Tables"]["shops"]["Row"];
type SaleRow = Database["public"]["Tables"]["sales"]["Row"];
type SaleItemRow = Database["public"]["Tables"]["sale_items"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function MerchantDashboard() {
  const sendBillEmail = useServerFn(sendCustomerBillEmail);
  const sendWorkMail = useServerFn(sendWorkConfirmationEmail);
  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceAlert, setWorkspaceAlert] = useState<{ error?: string; notice?: string }>({});
  const [savingMargin, setSavingMargin] = useState(false);
  const hasLoaded = useRef(false);
  const loadInFlight = useRef(false);
  const saleBillBackfillAttempted = useRef(false);

  const load = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (!hasLoaded.current) setLoading(true);
    try {
      const [p, prof, s, saleRows] = await retryTransient(
        () =>
          Promise.all([
            supabase.from("products").select("id,name,unit,price").order("name"),
            supabase
              .from("profiles")
              .select("user_id,display_name,email,phone,groobey_code")
              .eq("user_id", session.user.id)
              .maybeSingle(),
            supabase
              .from("shops")
              .select("id,name,created_by,is_active,trade_margin_percent")
              .order("name"),
            supabase
              .from("sales")
              .select(
                "id,shop_id,created_by,status,created_at,sold_at,bill_number,trade_margin_percent_applied,deleted_at",
              )
              .eq("created_by", session.user.id)
              .order("created_at", { ascending: false })
              .limit(50),
          ]),
        (responses) => responses.map((r) => r.error?.message).find(Boolean),
      );
      const saleIds = (saleRows.data ?? []).map((row) => row.id);
      const saleItemRows =
        saleIds.length > 0 ?
          await supabase
            .from("sale_items")
            .select(
              "id,sale_id,product_id,product_name,quantity,unit_price,merchant_unit_price,created_at",
            )
            .in("sale_id", saleIds)
        : { data: [] as SaleItemRow[], error: null };
      const err =
        p.error?.message ||
        prof.error?.message ||
        s.error?.message ||
        saleRows.error?.message ||
        saleItemRows.error?.message;
      if (err) {
        const hint = schemaSetupHint(err);
        setWorkspaceAlert({
          error: hint ?? (isTransientDatabaseError(err) ? "Refreshing…" : err),
        });
        if (!hint && isTransientDatabaseError(err)) window.setTimeout(() => void load(), 800);
        return;
      }
      setProducts((p.data ?? []) as ProductRow[]);
      if (!prof.error) setProfile((prof.data ?? null) as ProfileRow | null);
      setShops((s.data ?? []) as ShopRow[]);
      const nextSales = (saleRows.data ?? []) as SaleRow[];
      setSales(nextSales);
      setSaleItems((saleItemRows.data ?? []) as SaleItemRow[]);
      hasLoaded.current = true;

      const missingSaleBills = salesMissingBillId(nextSales);
      if (missingSaleBills.length > 0 && !saleBillBackfillAttempted.current) {
        saleBillBackfillAttempted.current = true;
        void backfillMySaleBillIds(supabase, missingSaleBills).then((result) => {
          if (result.count > 0 && !result.error) void load();
        });
      }
    } catch (e) {
      setWorkspaceAlert({
        error: e instanceof Error ? e.message : "Unable to load workspace.",
      });
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

  const assignedShop = useMemo(
    () => shops.find((shop) => shop.created_by === session?.user?.id && shop.is_active) ?? null,
    [shops, session?.user?.id],
  );
  const ownerName = useMemo(() => {
    const fromProfile = profile?.display_name?.trim();
    if (fromProfile) return fromProfile;
    const fromMeta = String(session?.user?.user_metadata?.display_name || "").trim();
    if (fromMeta) return fromMeta;
    return session?.user?.email || session?.user?.phone || "Shop Owner";
  }, [
    profile?.display_name,
    session?.user?.email,
    session?.user?.phone,
    session?.user?.user_metadata?.display_name,
  ]);
  const filteredSaleItems = useMemo(() => {
    const saleIds = new Set(sales.map((s) => s.id));
    return saleItems.filter((item) => saleIds.has(item.sale_id));
  }, [sales, saleItems]);

  async function handleEditSaleItems(
    saleId: string,
    rows: Array<{ itemId: string; quantity: number }>,
  ) {
    const updates = rows.map((row) =>
      supabase
        .from("sale_items")
        .update({ quantity: Number(row.quantity || 1) } as never)
        .eq("id", row.itemId)
        .eq("sale_id", saleId),
    );
    const result = await Promise.all(updates);
    const err = result.map((r) => r.error?.message).find(Boolean);
    if (err) {
      setWorkspaceAlert({ error: err });
      return;
    }
    setWorkspaceAlert({ notice: "Sale updated." });
    void load();
  }

  async function saveShopMargin(nextPercent: number): Promise<MarginSaveResult> {
    if (!assignedShop) return { error: "No shop assigned." };
    setSavingMargin(true);
    const pct = clampMarginPercent(nextPercent);
    const { error: shopError } = await supabase
      .from("shops")
      .update({ trade_margin_percent: pct } as never)
      .eq("id", assignedShop.id)
      .eq("created_by", session?.user?.id ?? "");
    setSavingMargin(false);
    if (shopError) {
      const hint = schemaSetupHint(shopError.message);
      return { error: hint ?? shopError.message };
    }
    setShops((prev) =>
      prev.map((shop) => (shop.id === assignedShop.id ? { ...shop, trade_margin_percent: pct } : shop)),
    );
    void load();
    return {
      notice: `Groobey margin set to ${pct}%. Submit a new sale — trade lines use this % (loaded fresh from the server).`,
    };
  }

  async function sendSaleCustomerBillEmail(
    sale: SaleRow,
    customerEmail: string,
  ): Promise<BillPreviewEmailResult> {
    if (!session?.access_token || !assignedShop) return { error: "Not signed in." };
    const trimmed = customerEmail.trim();
    if (!trimmed) {
      return { error: "Enter the customer's email address before sending the bill." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: "Invalid customer email." };
    }
    const rows = filteredSaleItems
      .filter((item) => item.sale_id === sale.id)
      .map((row) => ({
        name: row.product_name,
        quantity: Number(row.quantity || 0),
        packUnit: row.product_unit ?? undefined,
        unitPrice: Number(row.unit_price || 0),
        merchantUnitPrice: Number(row.merchant_unit_price ?? row.unit_price ?? 0),
      }));
    try {
      const result = await sendBillEmail({
        data: {
          requesterToken: session.access_token,
          customerEmail: trimmed,
          subject:
            sale.bill_number ?
              `Bill ${sale.bill_number} — ${GROOBEY_APP_NAME}`
            : `Bill — ${GROOBEY_APP_NAME}`,
          shopName: GROOBEY_APP_NAME,
          ownerName,
          billDate: (sale.sold_at || sale.created_at || "").slice(0, 16),
          billKind: "customer",
          billNumber: sale.bill_number?.trim() || undefined,
          items: rows,
        },
      });
      return { notice: `Bill email sent to ${result.deliveredTo}.` };
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Unable to send bill email.",
      };
    }
  }

  function saleBillPreviewOptions(sale: SaleRow): BillPreviewShowOptions | undefined {
    if (!session?.access_token) return undefined;
    return {
      email: {
        defaultEmail: "",
        send: (customerEmail) => sendSaleCustomerBillEmail(sale, customerEmail),
      },
    };
  }

  function printSaleBill(sale: SaleRow, kind: "customer" | "merchant", billNumber?: string | null) {
    if (!session?.user || !assignedShop) return;
    const rows = filteredSaleItems.filter((item) => item.sale_id === sale.id);
    const ownerOrShopLabel = formatStaffBillLabel({
      displayName: ownerName,
      groobeyCode: profile?.groobey_code ?? null,
    });
    const marginPct = resolveTradeMarginPercent({
      saleApplied: sale.trade_margin_percent_applied,
      shopMargin: assignedShop.trade_margin_percent,
      items: rows,
    });
    const lines = saleBillLinesForKind(rows, kind, marginPct);
    const html = buildVerifiedSaleBillHtml({
      kind,
      billNumber: billNumber ?? sale.bill_number ?? null,
      shopName: assignedShop.name,
      ownerOrShopLabel,
      dateLabel: (sale.sold_at || sale.created_at || "").slice(0, 16),
      lines,
      appliedGroobeyMarginPercent: kind === "merchant" ? marginPct : undefined,
    });
    openBillPrintGuarded(
      html,
      kind,
      kind === "customer" ? saleBillPreviewOptions(sale) : undefined,
    );
  }

  async function handleVerifySale(
    saleId: string,
    status: Database["public"]["Enums"]["verification_status"],
  ) {
    if (!session?.user) return;
    setWorkspaceAlert({});
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
        setWorkspaceAlert({ error: selErr.message });
        return;
      }
      if (!fresh?.bill_number) {
        const { billNo: nextBill, error: rpcError } = await allocateSaleBillNumber(
          asBillRpcClient(supabase),
        );
        if (rpcError) {
          setWorkspaceAlert({ error: rpcError.message });
          return;
        }
        if (!nextBill) {
          setWorkspaceAlert({ error: "Could not assign bill number." });
          return;
        }
        patch.bill_number = nextBill;
      }
    }
    const { error: saleError } = await supabase
      .from("sales")
      .update(patch as never)
      .eq("id", saleId)
      .eq("created_by", session.user.id);
    if (saleError) {
      setWorkspaceAlert({ error: saleError.message });
      return;
    }
    const billNo =
      typeof patch.bill_number === "string" ? patch.bill_number : undefined;
    setWorkspaceAlert({
      notice:
        status === "verified" ?
          "Sale approved. Opening trade settlement bill…"
        : "Sale rejected.",
    });
    if (status === "verified") {
      const sale = sales.find((row) => row.id === saleId);
      if (sale) {
        printSaleBill(
          {
            ...sale,
            status: "verified",
            bill_number: billNo ?? sale.bill_number,
          },
          "merchant",
          billNo ?? sale.bill_number,
        );
      }
    }
    void load();
  }

  function handleDownloadBill(saleId: string, kind: "customer" | "merchant") {
    const sale = sales.find((row) => row.id === saleId);
    if (!sale) return;
    printSaleBill(sale, kind);
  }

  async function handleArchiveSale(saleId: string) {
    const sale = sales.find((row) => row.id === saleId);
    if (!sale || sale.status === "pending") return;
    const ok = window.confirm(
      "Remove this sale from your list?\n\nWeekly and monthly totals stay the same. Bill numbers are kept for settlement.",
    );
    if (!ok) return;
    setWorkspaceAlert({});
    const { error: rpcError } = await supabase.rpc("archive_sale", { p_sale_id: saleId });
    if (rpcError) {
      setWorkspaceAlert({ error: rpcError.message });
      return;
    }
    setWorkspaceAlert({ notice: "Sale removed from list. It still counts in your month totals." });
    void load();
  }

  function handleEmailBill(saleId: string) {
    const sale = sales.find((row) => row.id === saleId);
    if (!sale) return;
    printSaleBill(sale, "customer");
  }

  async function handleSaleConfirmationMail(saleId: string) {
    if (!session?.access_token) return;
    await sendWorkMail({
      data: {
        requesterToken: session.access_token,
        subject: "Sale submitted for owner verification - Groobey",
        message: `Your sale ${saleId.slice(0, 8)} is submitted and pending owner verification.`,
      },
    });
  }

  if (!session?.user) return null;

  return (
    <main className="groobey-shell min-h-screen text-foreground">
      <GroobeyDashboardHeader
        title="Shop Owner dashboard"
        subtitle="Shops and sales from owner rates"
        actions={
          <Button variant="calm" className="rounded-xl" onClick={() => supabase.auth.signOut()}>
            Logout
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <section className="grid gap-3 sm:grid-cols-2">
          <Stat icon={ShoppingBasket} label="Grocery items" value={String(products.length)} />
          <Stat icon={ShoppingBasket} label="My shop" value={assignedShop?.name || "-"} />
        </section>
        <Message
          error=""
          notice=""
          loading={loading && !hasLoaded.current}
          refreshing={loading && hasLoaded.current}
          showAlerts={false}
        />
        {assignedShop && hasLoaded.current ?
          <TradeMarginPanel
            title="Your shop Groobey margin"
            description="One margin for your whole shop. Trade bill lines use retail minus this % on every item when you submit a sale."
            marginPercent={Number(assignedShop.trade_margin_percent ?? 0)}
            saving={savingMargin}
            onSave={saveShopMargin}
          />
        : null}
        <Panel
          title="Shop Owner workspace"
          icon={ShoppingBasket}
          feedback={workspaceAlert}
          feedbackPlacement="bottom"
        >
          {loading && !hasLoaded.current ?
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          : (
            <MerchantWorkspace
              products={products}
              assignedShop={assignedShop}
              ownerName={ownerName}
              ownerProfile={profile}
              userId={session.user.id}
              submittedSales={sales}
              saleItems={filteredSaleItems}
              onEditSale={handleEditSaleItems}
              onVerifySale={handleVerifySale}
              onDownloadBill={handleDownloadBill}
              onArchiveSale={(saleId) => void handleArchiveSale(saleId)}
              onEmailBill={async (saleId) => {
                await handleEmailBill(saleId);
              }}
              onSaleSubmitted={handleSaleConfirmationMail}
              onDone={load}
              onError={(msg) => setWorkspaceAlert({ error: msg })}
            />
          )}
        </Panel>
      </div>
    </main>
  );
}
