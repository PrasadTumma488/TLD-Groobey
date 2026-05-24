import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Pencil,
  Mail,
  Phone,
  Plus,
  ReceiptText,
  Store,
  Trash2,
  UserCheck,
  UserCog,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { GroobeySelect } from "@/components/groobey/groobey-select-field";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { BillKindButtons } from "@/components/groobey/groobey-bill-buttons";
import { GroobeyGroceryLinePicker } from "@/components/groobey/groobey-grocery-line-picker";
import { GroobeyShopSelfOtherFieldset } from "@/components/groobey/groobey-shop-self-other-fieldset";
import {
  groceryCartRetailTotal,
  groceryCartSummaryText,
  type GroceryCartLine,
} from "@/lib/groobey-grocery-cart";
import { cn } from "@/lib/utils";
import {
  isMissingSaleItemsProductUnitError,
  saleItemInsertWithoutPackUnit,
} from "@/lib/groobey-sale-items-columns";
import {
  clampMarginPercent,
  fetchShopTradeMarginPercent,
  tradeAmountFromRetail,
  tradeUnitFromRetail,
} from "@/lib/groobey-trade-margin";
import {
  customerBillLinesFromItems,
  resolveTradeMarginPercent,
  sumMerchant,
  sumRetail,
  tradeBillLinesFromItems,
} from "@/lib/groobey-dual-bill";
import { salesForPeriodAnalytics, salesForPipeline } from "@/lib/groobey-sales";
import { saleDisplayId, saleDisplayTime } from "@/lib/groobey-sale-display-id";

import { StaffIdentityCard } from "./staff-identity-card";
import { Field, GroobeyWorkspaceFormCard, PasswordField } from "./workspace-ui";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Sale = Database["public"]["Tables"]["sales"]["Row"];
type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

const staffRoleLabels: Record<"merchant" | "employee" | "order_taker", string> = {
  merchant: "Shop Owner",
  employee: "Delivery boy",
  order_taker: "Order Taker",
};

/** 24 rows: 12 AM … 11 PM (12-hour labels); value is hour 0–23. */
function deliveryHourOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    const isPm = h >= 12;
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    const label = `${h12} ${isPm ? "PM" : "AM"}`;
    out.push({ value: String(h), label });
  }
  return out;
}

const DELIVERY_MINUTE_SLOTS = ["00", "10", "20", "30", "40", "50"] as const;

export function AccountForm({
  onCreate,
  resetNonce = 0,
}: {
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  resetNonce?: number;
}) {
  const [selectedRole, setSelectedRole] = useState<"" | "merchant" | "employee" | "order_taker">("");
  const roleChosen =
    selectedRole === "merchant" || selectedRole === "employee" || selectedRole === "order_taker";
  useEffect(() => {
    setSelectedRole("");
  }, [resetNonce]);

  return (
    <form className="groobey-workspace-form space-y-3" onSubmit={onCreate}>
        <p className="text-center text-xs font-semibold text-muted-foreground sm:text-left">
          Select staff type first, then fill name, login, and password. New logins appear in the
          matching directory tab.
        </p>

        <GroobeyWorkspaceFormCard>
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold text-foreground">
              Login role
              <input type="hidden" name="role" value={selectedRole} />
              <GroobeySelect
                value={selectedRole || "__choose_role__"}
                onValueChange={(v) =>
                  setSelectedRole(
                    v === "__choose_role__" ? "" : (v as "merchant" | "employee" | "order_taker"),
                  )
                }
                options={[
                  { value: "__choose_role__", label: "Choose role" },
                  { value: "merchant", label: "Shop Owner" },
                  { value: "employee", label: "Delivery boy" },
                  { value: "order_taker", label: "Order Taker" },
                ]}
              />
            </label>

            {!roleChosen ?
              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-xs font-semibold text-muted-foreground">
                Choose Shop Owner, Delivery boy, or Order Taker to show the login fields.
              </p>
            : <>
                {selectedRole === "merchant" ?
                  <div className="grid gap-3 border-t border-border/60 pt-4">
                    <Field name="shopName" label="Shop name" icon={Store} required />
                    <Field name="shopOwnerName" label="Shop Owner name" icon={UserCog} required />
                    <Field name="shopPhone" label="Shop mobile number" icon={Phone} required />
                    <Field name="address" label="Shop address" required />
                  </div>
                : null}
                {selectedRole === "employee" ?
                  <div className="border-t border-border/60 pt-4">
                    <Field name="displayName" label="Delivery boy name" icon={UserCog} required />
                  </div>
                : null}
                {selectedRole === "order_taker" ?
                  <div className="border-t border-border/60 pt-4">
                    <Field name="displayName" label="Order taker name" icon={UserCog} required />
                  </div>
                : null}
                <div className="grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
                  <Field
                    name="email"
                    label="Login email"
                    icon={Mail}
                    required={
                      selectedRole === "merchant" ||
                      selectedRole === "employee" ||
                      selectedRole === "order_taker"
                    }
                  />
                  <Field
                    name="phone"
                    label="Login mobile number"
                    icon={Phone}
                    required={selectedRole === "merchant"}
                  />
                </div>
                <PasswordField name="newPassword" label="Temporary password" required />
                <Button variant="groobey" className="min-h-11 w-full rounded-xl">
                  <Plus className="size-4 shrink-0" /> Create{" "}
                  {selectedRole ? staffRoleLabels[selectedRole] : "role"} login
                </Button>
              </>
            }
          </div>
        </GroobeyWorkspaceFormCard>
      </form>
  );
}

export function OwnerSetupForm({
  onCreate,
}: {
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-warning bg-warning/15 p-3 text-sm font-semibold text-warning-foreground">
        First create the Platform Admin login. Public signup is disabled.
      </div>
      <form className="grid gap-3" onSubmit={onCreate}>
        <input type="hidden" name="role" value="main_admin" />
        <Field name="displayName" label="Platform Admin name" required />
        <Field name="email" label="Platform Admin email" icon={Mail} />
        <Field name="phone" label="Platform Admin mobile" icon={Phone} />
        <PasswordField name="newPassword" label="Platform Admin password" required />
        <Button variant="groobey" className="rounded-xl">
          Create Platform Admin login
        </Button>
      </form>
    </div>
  );
}

export function MerchantWorkspace({
  products,
  assignedShop,
  ownerName,
  ownerProfile,
  userId,
  submittedSales,
  saleItems,
  marginPanel,
  onEditSale,
  onVerifySale,
  onDownloadBill,
  onArchiveSale,
  onSaleSubmitted,
  onDone,
  onError,
}: {
  products: Product[];
  assignedShop: Shop | null;
  ownerName: string;
  ownerProfile: Profile | null;
  userId: string;
  submittedSales: Sale[];
  saleItems: SaleItem[];
  marginPanel?: ReactNode;
  onEditSale: (saleId: string, rows: Array<{ itemId: string; quantity: number }>) => Promise<void>;
  onVerifySale: (
    saleId: string,
    status: Database["public"]["Enums"]["verification_status"],
  ) => Promise<void>;
  onDownloadBill: (saleId: string, kind: "customer" | "merchant") => void;
  onArchiveSale: (saleId: string) => void;
  onSaleSubmitted?: (saleId: string) => Promise<void> | void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const todaySales = salesForPeriodAnalytics(submittedSales, today, "day");
  const monthSales = salesForPeriodAnalytics(submittedSales, month, "month");
  const pipelineSales = salesForPipeline(submittedSales);
  const pendingCount = pipelineSales.filter((sale) => sale.status === "pending").length;
  const todayAmount = todaySales.reduce((sum, sale) => {
    const rows = saleItems.filter((item) => item.sale_id === sale.id);
    return (
      sum +
      rows.reduce((line, row) => line + Number(row.quantity || 0) * Number(row.unit_price || 0), 0)
    );
  }, 0);
  const monthAmount = monthSales.reduce((sum, sale) => {
    const rows = saleItems.filter((item) => item.sale_id === sale.id);
    return (
      sum +
      rows.reduce((line, row) => line + Number(row.quantity || 0) * Number(row.unit_price || 0), 0)
    );
  }, 0);

  return (
    <div className="merchant-shop-workspace space-y-6">
      <div className="merchant-shop-overview-split">
        <StaffIdentityCard
          title="Your shop & login details"
          icon={Store}
          subtitle="Managed by Platform Admin - contact admin to update shop or login details."
          rows={[
            { label: "Shop name", value: assignedShop?.name?.trim() || "-" },
            { label: "Shop Owner name", value: ownerName?.trim() || "-" },
            { label: "Email", value: ownerProfile?.email?.trim() || "-" },
            { label: "Groobey ID", value: ownerProfile?.groobey_code?.trim() || "-" },
            { label: "Mobile", value: ownerProfile?.phone?.trim() || "-" },
            {
              label: "Groobey margin",
              value: `${Number(assignedShop?.trade_margin_percent ?? 0)}% off retail on trade bills`,
            },
          ]}
        />

        <div className="merchant-shop-stat-steps flex min-w-0 flex-col gap-3">
          <div className="merchant-shop-stat-tile rounded-2xl border border-border bg-card/80 p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Today
            </p>
            <p className="mt-1 text-xl font-black tabular-nums text-primary sm:text-2xl">
              ₹{Math.round(todayAmount)}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {todaySales.length} bill{todaySales.length === 1 ? "" : "s"}
            </p>
          </div>
          <div
            className={cn(
              "merchant-shop-stat-tile rounded-2xl border border-border bg-card/80 p-3 shadow-sm sm:p-4",
              pendingCount > 0 && "border-amber-200/80 bg-amber-50/50",
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Pending Review
            </p>
            <p
              className={cn(
                "mt-1 text-xl font-black tabular-nums sm:text-2xl",
                pendingCount > 0 ? "text-amber-800" : "text-foreground",
              )}
            >
              {pendingCount}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {pendingCount === 1 ? "sale awaits you" : "sales await you"}
            </p>
          </div>
          <div className="merchant-shop-stat-tile rounded-2xl border border-border bg-card/80 p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              This Month
            </p>
            <p className="mt-1 text-xl font-black tabular-nums text-primary sm:text-2xl">
              ₹{Math.round(monthAmount)}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {monthSales.length} bill{monthSales.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      {marginPanel ?
        <div className="merchant-shop-margin-band">{marginPanel}</div>
      : null}

      <div className="merchant-shop-workspace-grid grid gap-5 lg:items-start">
        <section className="groobey-card min-w-0 rounded-2xl border border-border p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
            <ReceiptText className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-lg font-black leading-tight">New sale</h2>
              <p className="text-xs font-semibold text-muted-foreground">
                Add items and submit for verification
              </p>
            </div>
          </div>
          <WorkForm
            products={products}
            assignedShop={assignedShop}
            userId={userId}
            onSaleSubmitted={onSaleSubmitted}
            onDone={onDone}
            onError={onError}
          />
        </section>

        <section className="groobey-card min-w-0 rounded-2xl border border-border p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 border-b border-border/60 pb-3">
            <FileText className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-lg font-black leading-tight">Submitted sales</h2>
              <p className="text-xs font-semibold text-muted-foreground">
                Approve, reject, print bills, or email
              </p>
            </div>
          </div>
          <SalesCards
            submittedSales={pipelineSales}
            saleItems={saleItems}
            shopTradeMarginPercent={Number(assignedShop?.trade_margin_percent ?? 0)}
            onEditSale={onEditSale}
            onVerifySale={onVerifySale}
            onDownloadBill={onDownloadBill}
            onArchiveSale={onArchiveSale}
            embedded
          />
        </section>
      </div>
    </div>
  );
}

export function EmployeeWorkspace({
  profile,
  shops,
  products,
  resetNonce = 0,
  onSubmitWork,
  submitting = false,
  mode = "staff",
}: {
  profile: Profile | null;
  shops: Shop[];
  products: Product[];
  resetNonce?: number;
  onSubmitWork: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  /** Delivery portal: daily delivery log only (no shop/self/other work location). */
  mode?: "staff" | "delivery";
}) {
  const isDelivery = mode === "delivery";
  const [selectedShopId, setSelectedShopId] = useState("");
  const [destination, setDestination] = useState<"shop" | "self" | "other">("shop");
  const [deliveredLines, setDeliveredLines] = useState<GroceryCartLine[]>([]);
  const [deliveryHour, setDeliveryHour] = useState("");
  const [deliveryMinute, setDeliveryMinute] =
    useState<(typeof DELIVERY_MINUTE_SLOTS)[number]>("00");

  useEffect(() => {
    setDeliveredLines([]);
    setSelectedShopId("");
    setDestination("shop");
    setDeliveryHour("");
    setDeliveryMinute("00");
  }, [resetNonce]);

  useEffect(() => {
    if (destination !== "shop") setSelectedShopId("");
  }, [destination]);

  const itemsDeliveredSummary = useMemo(
    () => groceryCartSummaryText(deliveredLines, products),
    [deliveredLines, products],
  );

  const destinationNeedsShop = destination === "shop";
  const hourOptions = useMemo(() => deliveryHourOptions(), []);
  const deliveredAtValue =
    deliveryHour !== "" ? `${String(Number(deliveryHour)).padStart(2, "0")}:${deliveryMinute}` : "";

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-border bg-card/70 p-3 text-sm font-semibold leading-relaxed">
        <div className="flex items-center gap-2">
          <UserCheck className="size-4 text-primary" /> Your details
        </div>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">
          Name, email, and mobile are managed by{" "}
          <span className="text-foreground">Platform Admin</span> only. Contact admin to update
          them.
        </p>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-muted-foreground">Staff name</dt>
            <dd className="font-semibold text-foreground">
              {profile?.display_name?.trim() || "-"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-muted-foreground">Email</dt>
            <dd className="break-all font-semibold text-foreground">
              {profile?.email?.trim() || "-"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-muted-foreground">Groobey ID</dt>
            <dd className="break-all font-mono font-semibold text-foreground">
              {profile?.groobey_code?.trim() || "-"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-muted-foreground">Mobile</dt>
            <dd className="font-semibold text-foreground">{profile?.phone?.trim() || "-"}</dd>
          </div>
        </dl>
      </div>
      <form
        className={cn("grid gap-3", isDelivery && "max-w-xl lg:max-w-2xl")}
        onSubmit={onSubmitWork}
      >
        {!isDelivery ?
          <>
            <input type="hidden" name="destination" value={destination} readOnly />
            <GroobeyShopSelfOtherFieldset
              idPrefix="work-location"
              value={destination}
              onChange={setDestination}
              legend="Work location"
              radiogroupLabel="Work location"
              hint="Where you completed this work (shop visit, self, or other). Not the same as customer delivery routing."
            />
            {destination === "shop" && (
              <label className="grid gap-1.5 text-sm font-semibold text-foreground">
                Work from shop
                <input type="hidden" name="shopId" value={selectedShopId} readOnly />
                <GroobeySelect
                  value={selectedShopId || "__choose_shop__"}
                  onValueChange={(v) => setSelectedShopId(v === "__choose_shop__" ? "" : v)}
                  placeholder={shops.length ? "Choose shop" : "No active shops available"}
                  options={[
                    {
                      value: "__choose_shop__",
                      label: shops.length ? "Choose shop" : "No active shops",
                    },
                    ...shops.map((shop) => ({ value: shop.id, label: shop.name })),
                  ]}
                />
              </label>
            )}
            {destination === "other" && (
              <Field name="otherShop" label="Other destination name" required />
            )}
          </>
        : null}
        <input type="hidden" name="itemsDelivered" value={itemsDeliveredSummary} readOnly />
        <GroobeyGroceryLinePicker
          id="employee-items-delivered"
          title="Items delivered"
          linesLabel="Delivered items"
          products={products}
          lines={deliveredLines}
          onLinesChange={setDeliveredLines}
          className={isDelivery ? "delivery-work-field" : undefined}
        />
        <input type="hidden" name="deliveredAt" value={deliveredAtValue} readOnly />
        <div
          className={cn(
            "grid gap-1.5",
            isDelivery && "max-w-md grid-cols-1 sm:grid-cols-2 sm:items-end",
          )}
        >
          <span
            className={cn(
              "flex items-center gap-2 text-sm font-semibold text-foreground",
              isDelivery && "sm:col-span-2",
            )}
          >
            <CheckCircle2 className="size-4 text-muted-foreground" />
            Delivered time (every 10 minutes)
          </span>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted-foreground">
            Hour
            <GroobeySelect
              value={deliveryHour || "__choose_hour__"}
              onValueChange={(v) => setDeliveryHour(v === "__choose_hour__" ? "" : v)}
              options={[{ value: "__choose_hour__", label: "Choose hour" }, ...hourOptions]}
            />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted-foreground">
            Minutes
            <GroobeySelect
              value={deliveryMinute}
              onValueChange={(v) =>
                setDeliveryMinute(v as (typeof DELIVERY_MINUTE_SLOTS)[number])
              }
              options={DELIVERY_MINUTE_SLOTS.map((m) => ({
                value: m,
                label: `:${m}`,
              }))}
            />
          </label>
          <span
            className={cn(
              "text-xs font-semibold text-muted-foreground",
              isDelivery && "sm:col-span-2",
            )}
          >
            Pick hour (12 AM–11 PM), then minutes :00 :10 :20 :30 :40 :50
          </span>
        </div>
        <Button
          variant="groobey"
          className="rounded-xl"
          disabled={
            submitting ||
            (!isDelivery &&
              ((destinationNeedsShop && shops.length === 0) ||
                (destinationNeedsShop && !selectedShopId))) ||
            !deliveredLines.length ||
            deliveryHour === ""
          }
        >
          <CheckCircle2 className="size-4" /> {submitting ? "Submitting..." : "Submit work update"}
        </Button>
      </form>
    </div>
  );
}

export function ShopDetailsForm({
  onSubmit,
  buttonText,
  disabled = false,
  defaultValues,
  formKey,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  buttonText: string;
  disabled?: boolean;
  defaultValues?: {
    shopName?: string;
    contactName?: string;
    shopPhone?: string;
    address?: string;
  };
  /** Remount form when switching edit target */
  formKey?: string;
}) {
  return (
    <form key={formKey} className="grid gap-3" onSubmit={onSubmit}>
      <Field
        name="shopName"
        label="Shop name"
        icon={Store}
        required
        disabled={disabled}
        defaultValue={defaultValues?.shopName}
      />
      <Field
        name="contactName"
        label="Contact person"
        icon={UserCog}
        disabled={disabled}
        defaultValue={defaultValues?.contactName}
      />
      <Field
        name="shopPhone"
        label="Shop mobile number"
        icon={Phone}
        disabled={disabled}
        defaultValue={defaultValues?.shopPhone}
      />
      <Field
        name="address"
        label="Shop address"
        disabled={disabled}
        defaultValue={defaultValues?.address}
      />
      <Button variant="groobey" className="min-h-11 rounded-xl" disabled={disabled} type="submit">
        <Store className="size-4" /> {buttonText}
      </Button>
    </form>
  );
}

export function WorkForm({
  products,
  assignedShop,
  userId,
  onSaleSubmitted,
  onDone,
  onError,
}: {
  products: Product[];
  assignedShop: Shop | null;
  userId: string;
  onSaleSubmitted?: (saleId: string) => Promise<void> | void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [cartItems, setCartItems] = useState<GroceryCartLine[]>([]);

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!assignedShop)
      return onError("No shop is mapped to this Shop Owner. Ask Platform Admin to assign one.");
    const rows = [...cartItems];
    if (!rows.length) return onError("Add at least one grocery item.");
    let marginPct: number;
    try {
      marginPct = await fetchShopTradeMarginPercent(assignedShop.id);
    } catch (e) {
      return onError(e instanceof Error ? e.message : "Could not load shop margin.");
    }
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        created_by: userId,
        destination_type: "shop",
        shop_id: assignedShop.id,
        other_shop_name: null,
        notes: null,
        status: "pending",
        verified_by: null,
        verified_at: null,
        trade_margin_percent_applied: marginPct,
      } as never)
      .select("id")
      .single();
    if (saleError || !sale) return onError(saleError?.message || "Unable to submit sale.");
    const saleRows = rows
      .map((row) => {
        const product = products.find((item) => item.id === row.productId);
        if (!product) return null;
        const retail = Number(product.price || 0);
        const trade = tradeUnitFromRetail(retail, marginPct);
        return {
          sale_id: sale.id,
          product_id: product.id,
          product_name: product.name,
          product_unit: product.unit,
          quantity: Number(row.quantity || 1),
          unit_price: retail,
          merchant_unit_price: trade,
        };
      })
      .filter(Boolean) as Database["public"]["Tables"]["sale_items"]["Insert"][];
    let itemError = (await supabase.from("sale_items").insert(saleRows as never)).error;
    if (itemError?.message && isMissingSaleItemsProductUnitError(itemError.message)) {
      const legacyRows = saleRows.map((row) => saleItemInsertWithoutPackUnit(row));
      itemError = (await supabase.from("sale_items").insert(legacyRows as never)).error;
    }
    if (itemError) return onError(itemError.message);
    await onSaleSubmitted?.(sale.id);
    formElement.reset();
    setCartItems([]);
    onDone();
  }

  const marginPctPreview = clampMarginPercent(Number(assignedShop?.trade_margin_percent ?? 0));
  const cartTotal = useMemo(
    () => groceryCartRetailTotal(cartItems, products),
    [cartItems, products],
  );
  const cartTradeTotal = useMemo(
    () => tradeAmountFromRetail(cartTotal, marginPctPreview),
    [cartTotal, marginPctPreview],
  );

  return (
    <form className="merchant-sale-form grid gap-3" onSubmit={submitSale}>
      <GroobeyGroceryLinePicker
        id="merchant-sale-cart"
        title="Grocery items"
        linesLabel="Sale lines"
        products={products}
        lines={cartItems}
        onLinesChange={setCartItems}
        editableQuantities
        scrollableLines
      />
      {!assignedShop ?
        <p className="text-xs font-semibold text-muted-foreground">
          No shop is mapped to this Shop Owner. Ask Platform Admin to create or link your shop.
        </p>
      : null}
      <div className="merchant-sale-form-footer grid gap-3">
        {assignedShop && cartItems.length > 0 ?
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs font-semibold">
            <p>
              Retail total: <span className="font-black text-primary">₹{Math.round(cartTotal)}</span>
            </p>
            <p className="mt-1 font-semibold text-foreground">
              Trade total at {marginPctPreview}% Groobey margin:{" "}
              <span className="font-black text-primary">₹{Math.round(cartTradeTotal)}</span>{" "}
              <span className="text-muted-foreground">(saved on submit)</span>
            </p>
          </div>
        : null}
        <Button
          variant="groobey"
          className="min-h-11 w-full rounded-xl"
          disabled={!products.length || !assignedShop}
        >
          <ReceiptText className="size-4 shrink-0" /> Submit sale
        </Button>
      </div>
    </form>
  );
}

function SalesCards({
  submittedSales,
  saleItems,
  shopTradeMarginPercent,
  onEditSale,
  onVerifySale,
  onDownloadBill,
  onArchiveSale,
  embedded = false,
}: {
  submittedSales: Sale[];
  saleItems: SaleItem[];
  shopTradeMarginPercent: number;
  onEditSale: (saleId: string, rows: Array<{ itemId: string; quantity: number }>) => Promise<void>;
  onVerifySale: (
    saleId: string,
    status: Database["public"]["Enums"]["verification_status"],
  ) => Promise<void>;
  onDownloadBill: (saleId: string, kind: "customer" | "merchant") => void;
  onArchiveSale: (saleId: string) => void;
  embedded?: boolean;
}) {
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [draftRows, setDraftRows] = useState<Array<{ itemId: string; quantity: number }>>([]);

  const list = submittedSales.slice(0, 12);
  if (!list.length) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-3 text-sm font-semibold text-muted-foreground">
        No submitted sales yet.
      </div>
    );
  }
  return (
    <div className={cn("space-y-3", embedded && "merchant-shop-sales-list")}>
      {!embedded ?
        <p className="text-sm font-black">Submitted sales</p>
      : null}
      <div className={cn("grid gap-3", embedded ? "grid-cols-1" : "md:grid-cols-2")}>
        {list.map((sale) => {
          const rows = saleItems.filter((item) => item.sale_id === sale.id);
          const marginPct = resolveTradeMarginPercent({
            saleApplied: sale.trade_margin_percent_applied,
            shopMargin: shopTradeMarginPercent,
            items: rows,
          });
          const retailLines = customerBillLinesFromItems(rows);
          const tradeLines = tradeBillLinesFromItems(rows, marginPct);
          const totalRetail = sumRetail(retailLines);
          const totalMerchant = sumMerchant(tradeLines);
          const margin = Math.round(totalRetail - totalMerchant);
          const isEditing = editingSaleId === sale.id;
          return (
            <div key={sale.id} className="rounded-2xl border border-border bg-card/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black">
                    Sale {sale.bill_number?.trim() || `*${saleDisplayId(sale, submittedSales)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <CalendarDays className="mr-1 inline size-3.5" />
                    {saleDisplayTime(sale)}
                  </p>
                  {sale.bill_number ?
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      Bill {sale.bill_number} · Groobey margin {marginPct}%
                    </p>
                  : null}
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {sale.status === "verified"
                    ? "Verified"
                    : sale.status === "rejected"
                      ? "Rejected"
                      : "Pending review"}
                </span>
              </div>
              <div className="mt-2 overflow-hidden rounded-xl border border-border bg-muted/30">
                <div className="grid grid-cols-2 gap-2 border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground sm:grid-cols-[1.7fr_0.8fr_1fr_1fr]">
                  <p className="col-span-2 sm:col-span-1">Item</p>
                  <p className="text-right">Qty</p>
                  <p className="text-right">Rate</p>
                  <p className="text-right">Amount</p>
                </div>
                <div className="divide-y divide-border/60">
                  {(isEditing
                    ? draftRows
                    : rows.map((r) => ({ itemId: r.id, quantity: r.quantity }))
                  ).map((row) => {
                    const original = rows.find((r) => r.id === row.itemId);
                    if (!original) return null;
                    return (
                      <div
                        key={row.itemId}
                        className="grid grid-cols-2 items-center gap-2 px-3 py-2 text-sm sm:grid-cols-[1.7fr_0.8fr_1fr_1fr]"
                      >
                        <p className="col-span-2 break-words text-xs font-semibold leading-snug sm:col-span-1 sm:text-sm" title={original.product_name}>
                          {original.product_name}
                        </p>
                        {isEditing ? (
                          <input
                            type="number"
                            min={1}
                            step="any"
                            value={String(row.quantity)}
                            onChange={(e) =>
                              setDraftRows((prev) =>
                                prev.map((item) =>
                                  item.itemId === row.itemId
                                    ? { ...item, quantity: Number(e.target.value || 1) || 1 }
                                    : item,
                                ),
                              )
                            }
                            className="h-8 w-full rounded-md border border-input bg-card px-2 text-right text-xs font-semibold"
                          />
                        ) : (
                          <p className="text-right text-xs font-semibold">{row.quantity}</p>
                        )}
                        <p className="text-right text-xs font-semibold">₹{original.unit_price}</p>
                        <p className="text-right text-xs font-black text-primary">
                          ₹{Math.round(Number(row.quantity || 0) * Number(original.unit_price || 0))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 space-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Retail total
                  </p>
                  <p className="text-base font-black text-primary">₹{Math.round(totalRetail)}</p>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Trade total</span>
                  <span>₹{Math.round(totalMerchant)}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Margin (retail − trade)</span>
                  <span>₹{margin}</span>
                </div>
              </div>
              {sale.status === "pending" ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800">
                  Verify after checking items, quantities, rates, and total.
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {isEditing ? (
                  <>
                    <Button
                      type="button"
                      variant="groobey"
                      className="h-8 rounded-lg px-2 text-xs"
                      onClick={async () => {
                        await onEditSale(sale.id, draftRows);
                        setEditingSaleId(null);
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-lg px-2 text-xs"
                      onClick={() => setEditingSaleId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="calm"
                    className="h-8 rounded-lg px-2 text-xs"
                    onClick={() => {
                      setEditingSaleId(sale.id);
                      setDraftRows(rows.map((row) => ({ itemId: row.id, quantity: row.quantity })));
                    }}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                )}
                <BillKindButtons
                  compact
                  onPrint={(kind) => onDownloadBill(sale.id, kind)}
                />
                {sale.status !== "pending" ?
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => onArchiveSale(sale.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                : null}
              </div>
              {sale.status === "pending" ?
                <div className="mt-2 flex w-full flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="groobey"
                    className="h-8 min-w-[104px] rounded-lg px-2 text-xs"
                    onClick={() => void onVerifySale(sale.id, "verified")}
                  >
                    Approve sale
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 min-w-[104px] rounded-lg px-2 text-xs"
                    onClick={() => void onVerifySale(sale.id, "rejected")}
                  >
                    Reject sale
                  </Button>
                </div>
              : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
