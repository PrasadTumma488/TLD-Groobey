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
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { BillKindButtons } from "@/components/groobey/groobey-bill-buttons";
import {
  defaultQuantityForProduct,
  filterProductsByQuery,
  formatProductOptionLabel,
} from "@/lib/groobey-product-catalog";
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
import { Field, PasswordField } from "./workspace-ui";

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
    <form className="grid gap-3" onSubmit={onCreate}>
      <div className="rounded-xl border border-border bg-muted/60 p-3 text-sm font-semibold leading-6 text-muted-foreground">
        Platform Admin can create shop owner, staff, and order taker logins.
      </div>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Login role
        <select
          name="role"
          className="groobey-select h-11 w-full"
          value={selectedRole}
          onChange={(event) =>
            setSelectedRole(event.target.value as "" | "merchant" | "employee" | "order_taker")
          }
          required
        >
          <option value="" disabled>
            Choose role
          </option>
          <option value="merchant">Shop Owner</option>
          <option value="employee">Delivery boy</option>
          <option value="order_taker">Order Taker</option>
        </select>
      </label>
      {!roleChosen ? (
        <p className="text-xs font-semibold text-muted-foreground">
          Select staff type first, then fill name, login, and password.
        </p>
      ) : null}
      {roleChosen ? (
        <>
          {selectedRole === "merchant" ? (
            <>
              <Field name="shopName" label="Shop name" icon={Store} required />
              <Field name="shopOwnerName" label="Shop Owner name" icon={UserCog} required />
              <Field name="shopPhone" label="Shop mobile number" icon={Phone} required />
              <Field name="address" label="Shop address" required />
            </>
          ) : null}
          {selectedRole === "employee" ? (
            <Field name="displayName" label="Delivery boy name" icon={UserCog} required />
          ) : null}
          {selectedRole === "order_taker" ? (
            <Field name="displayName" label="Order taker name" icon={UserCog} required />
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
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
          <Button variant="groobey" className="rounded-xl">
            <Plus className="size-4" /> Create {selectedRole ? staffRoleLabels[selectedRole] : "role"} login
          </Button>
        </>
      ) : null}
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
  onEditSale,
  onVerifySale,
  onDownloadBill,
  onArchiveSale,
  onEmailBill,
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
  onEditSale: (saleId: string, rows: Array<{ itemId: string; quantity: number }>) => Promise<void>;
  onVerifySale: (
    saleId: string,
    status: Database["public"]["Enums"]["verification_status"],
  ) => Promise<void>;
  onDownloadBill: (saleId: string, kind: "customer" | "merchant") => void;
  onArchiveSale: (saleId: string) => void;
  onEmailBill: (saleId: string) => Promise<void>;
  onSaleSubmitted?: (saleId: string) => Promise<void> | void;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const todaySales = salesForPeriodAnalytics(submittedSales, today, "day");
  const monthSales = salesForPeriodAnalytics(submittedSales, month, "month");
  const pipelineSales = salesForPipeline(submittedSales);
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
    <div className="grid gap-5">
      <StaffIdentityCard
        title="Your shop & login details"
        icon={Store}
        subtitle="Shop and your login details are managed by Platform Admin only. Contact admin to update them."
        rows={[
          { label: "Shop name", value: assignedShop?.name?.trim() || "—" },
          { label: "Shop Owner name", value: ownerName?.trim() || "—" },
          { label: "Email", value: ownerProfile?.email?.trim() || "—" },
          { label: "Groobey ID", value: ownerProfile?.groobey_code?.trim() || "—" },
          { label: "Mobile", value: ownerProfile?.phone?.trim() || "—" },
          {
            label: "Groobey margin",
            value: `${Number(assignedShop?.trade_margin_percent ?? 0)}% off retail on trade bills`,
          },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/70 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Today sales
          </p>
          <p className="mt-1 text-2xl font-black text-primary">₹{Math.round(todayAmount)}</p>
          <p className="text-xs text-muted-foreground">{todaySales.length} bill(s)</p>
        </div>
        <div className="rounded-2xl border border-border bg-card/70 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Month sales
          </p>
          <p className="mt-1 text-2xl font-black text-primary">₹{Math.round(monthAmount)}</p>
          <p className="text-xs text-muted-foreground">{monthSales.length} bill(s)</p>
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
      <SalesCards
        submittedSales={pipelineSales}
        saleItems={saleItems}
        shopTradeMarginPercent={Number(assignedShop?.trade_margin_percent ?? 0)}
        onEditSale={onEditSale}
        onVerifySale={onVerifySale}
        onDownloadBill={onDownloadBill}
        onArchiveSale={onArchiveSale}
        onEmailBill={onEmailBill}
      />
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
}: {
  profile: Profile | null;
  shops: Shop[];
  products: Product[];
  resetNonce?: number;
  onSubmitWork: (event: FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
}) {
  const [selectedShopId, setSelectedShopId] = useState("");
  const [destination, setDestination] = useState<"shop" | "self" | "other">("shop");
  const [pickedProductId, setPickedProductId] = useState("");
  const [pickedQty, setPickedQty] = useState("1");
  const [productQuery, setProductQuery] = useState("");
  const filteredProducts = useMemo(
    () => filterProductsByQuery(products, productQuery),
    [products, productQuery],
  );
  const [deliveredLines, setDeliveredLines] = useState<
    Array<{ productId: string; quantity: number }>
  >([]);
  const [deliveryHour, setDeliveryHour] = useState("");
  const [deliveryMinute, setDeliveryMinute] =
    useState<(typeof DELIVERY_MINUTE_SLOTS)[number]>("00");

  useEffect(() => {
    setDeliveredLines([]);
    setPickedProductId("");
    setPickedQty("1");
    setSelectedShopId("");
    setDestination("shop");
    setDeliveryHour("");
    setDeliveryMinute("00");
  }, [resetNonce]);

  useEffect(() => {
    if (destination !== "shop") setSelectedShopId("");
  }, [destination]);

  function addDeliveredLine() {
    if (!pickedProductId) return;
    const qty = Number(pickedQty || 1);
    if (!Number.isFinite(qty) || qty <= 0) return;
    setDeliveredLines((prev) => {
      const idx = prev.findIndex((row) => row.productId === pickedProductId);
      if (idx === -1) return [...prev, { productId: pickedProductId, quantity: qty }];
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: qty };
      return next;
    });
    setPickedQty("1");
  }

  const itemsDeliveredSummary = useMemo(() => {
    return deliveredLines
      .map((row) => {
        const product = products.find((p) => p.id === row.productId);
        if (!product) return null;
        return `${product.name} (${product.unit}) × ${row.quantity}`;
      })
      .filter(Boolean)
      .join("; ");
  }, [deliveredLines, products]);

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
              {profile?.display_name?.trim() || "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-muted-foreground">Email</dt>
            <dd className="break-all font-semibold text-foreground">
              {profile?.email?.trim() || "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-muted-foreground">Groobey ID</dt>
            <dd className="break-all font-mono font-semibold text-foreground">
              {profile?.groobey_code?.trim() || "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-muted-foreground">Mobile</dt>
            <dd className="font-semibold text-foreground">{profile?.phone?.trim() || "—"}</dd>
          </div>
        </dl>
      </div>
      <form className="grid gap-3" onSubmit={onSubmitWork}>
        <div className="grid gap-1.5 text-sm font-semibold text-foreground">
          <span>Delivery destination</span>
          <input type="hidden" name="destination" value={destination} readOnly />
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["shop", "Shop"],
                ["self", "Self"],
                ["other", "Other"],
              ] as const
            ).map(([value, label]) => {
              const active = destination === value;
              return (
                <Button
                  key={value}
                  type="button"
                  variant={active ? "groobey" : "outline"}
                  className="h-11 rounded-xl text-sm"
                  onClick={() => setDestination(value)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
        {destination === "shop" && (
          <label className="grid gap-1.5 text-sm font-semibold text-foreground">
            Work from shop
            <input type="hidden" name="shopId" value={selectedShopId} readOnly />
            <Select value={selectedShopId || undefined} onValueChange={setSelectedShopId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={shops.length ? "Choose shop" : "No active shops available"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {shops.map((shop) => (
                  <SelectItem
                    key={shop.id}
                    value={shop.id}
                    className="whitespace-normal py-2.5 text-base leading-snug"
                  >
                    {shop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {destination === "other" && (
          <Field name="otherShop" label="Other destination name" required />
        )}
        <input type="hidden" name="itemsDelivered" value={itemsDeliveredSummary} readOnly />
        <div className="grid gap-2">
          <span className="text-sm font-semibold text-foreground">Items delivered</span>
          <input
            type="search"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
            placeholder="Search grocery item, pack, or price"
            autoComplete="off"
          />
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Select
              value={pickedProductId || undefined}
              onValueChange={(value) => {
                setPickedProductId(value);
                const p = products.find((item) => item.id === value);
                setPickedQty(String(p ? defaultQuantityForProduct(p) : 1));
              }}
              disabled={!products.length}
            >
              <SelectTrigger className="h-12 w-full text-base sm:min-w-0 sm:flex-1">
                <SelectValue
                  placeholder={
                    products.length
                      ? "Choose grocery item"
                      : "No grocery items (Platform Admin catalog)"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {filteredProducts.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    className="whitespace-normal py-2.5 text-base leading-snug"
                  >
                    {formatProductOptionLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="number"
              min={1}
              step="any"
              value={pickedQty}
              onChange={(e) => setPickedQty(e.target.value)}
              className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold sm:w-24 sm:px-2"
              aria-label="Quantity"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl sm:w-auto sm:shrink-0"
              onClick={addDeliveredLine}
              disabled={!pickedProductId}
            >
              <Plus className="size-4" /> Add
            </Button>
          </div>
          {deliveredLines.length ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
              {deliveredLines.map((row) => {
                const product = products.find((p) => p.id === row.productId);
                if (!product) return null;
                return (
                  <div key={row.productId} className="flex items-center gap-2 text-sm">
                    <ReceiptText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 font-semibold">
                      {product.name} ({product.unit}) × {row.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 shrink-0 px-2"
                      onClick={() =>
                        setDeliveredLines((prev) =>
                          prev.filter((r) => r.productId !== row.productId),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs font-semibold text-muted-foreground">
              Add one or more items from the dropdown.
            </p>
          )}
        </div>
        <input type="hidden" name="deliveredAt" value={deliveredAtValue} readOnly />
        <div className="grid gap-1.5">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            Delivered time (every 10 minutes)
          </span>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted-foreground sm:flex-1">
              Hour
              <select
                value={deliveryHour}
                onChange={(e) => setDeliveryHour(e.target.value)}
                className="groobey-select h-11 w-full"
                required
              >
                <option value="" disabled>
                  Choose hour
                </option>
                {hourOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted-foreground sm:w-[7.5rem] sm:shrink-0">
              Minutes
              <select
                value={deliveryMinute}
                onChange={(e) =>
                  setDeliveryMinute(e.target.value as (typeof DELIVERY_MINUTE_SLOTS)[number])
                }
                className="groobey-select h-11 w-full"
              >
                {DELIVERY_MINUTE_SLOTS.map((m) => (
                  <option key={m} value={m}>
                    :{m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            Pick hour (12 AM–11 PM), then minutes :00 :10 :20 :30 :40 :50
          </span>
        </div>
        <Button
          variant="groobey"
          className="rounded-xl"
          disabled={
            submitting ||
            (destinationNeedsShop && shops.length === 0) ||
            (destinationNeedsShop && !selectedShopId) ||
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
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [productQuery, setProductQuery] = useState("");
  const [cartItems, setCartItems] = useState<Array<{ productId: string; quantity: number }>>([]);
  const filteredProducts = useMemo(
    () => filterProductsByQuery(products, productQuery),
    [products, productQuery],
  );
  const selectedProduct = products.find((item) => item.id === selectedProductId) ?? null;
  const cleanUnitLabel = (rawUnit?: string | null) => {
    const unit = (rawUnit ?? "").trim();
    if (!unit) return "unit";
    // Some units are stored like "1 kg"; remove leading quantity to avoid "11 kg" display.
    return unit.replace(/^\d+(?:\.\d+)?\s*/u, "").trim() || unit;
  };
  const selectedUnit = cleanUnitLabel(selectedProduct?.unit);

  async function submitSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!assignedShop)
      return onError("No shop is mapped to this Shop Owner. Ask Platform Admin to assign one.");
    let rows = [...cartItems];
    if (!rows.length && selectedProduct) {
      rows = [{ productId: selectedProduct.id, quantity: Number(quantity || 1) || 1 }];
    }
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
    setSelectedProductId("");
    setQuantity("1");
    setCartItems([]);
    onDone();
  }

  function addCurrentToCart() {
    if (!selectedProduct) return;
    const qty = Number(quantity || 1);
    if (!Number.isFinite(qty) || qty <= 0) return;
    setCartItems((prev) => {
      const idx = prev.findIndex((row) => row.productId === selectedProduct.id);
      if (idx === -1) return [...prev, { productId: selectedProduct.id, quantity: qty }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], quantity: qty };
      return copy;
    });
    setQuantity("1");
  }

  const marginPctPreview = clampMarginPercent(Number(assignedShop?.trade_margin_percent ?? 0));
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, row) => {
      const product = products.find((item) => item.id === row.productId);
      if (!product) return sum;
      return sum + Number(row.quantity) * Number(product.price || 0);
    }, 0);
  }, [cartItems, products]);
  const cartTradeTotal = useMemo(
    () => tradeAmountFromRetail(cartTotal, marginPctPreview),
    [cartTotal, marginPctPreview],
  );

  return (
    <form className="grid gap-3" onSubmit={submitSale}>
      <p className="text-sm font-bold text-foreground">New sale</p>
      <input type="hidden" name="productId" value={selectedProductId} readOnly />
      <input
        type="search"
        value={productQuery}
        onChange={(e) => setProductQuery(e.target.value)}
        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
        placeholder="Search item, pack size, or price"
        autoComplete="off"
      />
      <Select
        value={selectedProductId || undefined}
        onValueChange={(value) => {
          setSelectedProductId(value);
          const p = products.find((item) => item.id === value);
          setQuantity(String(p ? defaultQuantityForProduct(p) : 1));
        }}
        disabled={!products.length}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              products.length ? "Choose grocery item" : "Platform Admin must add grocery list first"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {filteredProducts.map((product) => (
            <SelectItem
              key={product.id}
              value={product.id}
              className="whitespace-normal py-2.5 text-sm leading-snug"
            >
              {formatProductOptionLabel(product)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedProduct ? (
        <p className="text-xs font-semibold text-muted-foreground">
          ₹{selectedProduct.price} per {selectedUnit} · line total ₹
          {Math.round(Number(selectedProduct.price) * (Number(quantity) || 1))}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="rounded-xl"
        onClick={addCurrentToCart}
        disabled={!selectedProduct}
      >
        <Plus className="size-4" /> Add item
      </Button>
      {cartItems.length ? (
        <div className="rounded-xl border border-border bg-card/70 p-3">
          <p className="text-sm font-bold">Selected items</p>
          <div className="mt-2 space-y-2">
            {cartItems.map((row) => {
              const product = products.find((item) => item.id === row.productId);
              if (!product) return null;
              return (
                <div
                  key={row.productId}
                  className="flex items-center gap-2 rounded-lg border border-border/70 px-2 py-1.5"
                >
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{product.name}</p>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    value={String(row.quantity)}
                    onChange={(event) =>
                      setCartItems((prev) =>
                        prev.map((item) =>
                          item.productId === row.productId
                            ? { ...item, quantity: Number(event.target.value || 1) || 1 }
                            : item,
                        ),
                      )
                    }
                    className="h-8 w-20 rounded-md border border-input bg-card px-2 text-xs font-semibold"
                  />
                  <span className="text-xs text-muted-foreground">
                    ₹{Math.round(Number(product.price) * Number(row.quantity))}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-md px-2"
                    onClick={() =>
                      setCartItems((prev) =>
                        prev.filter((item) => item.productId !== row.productId),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-sm font-black">Estimated total: ₹{Math.round(cartTotal)}</p>
        </div>
      ) : null}
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Selected grocery name
        <span className="flex h-11 min-h-11 items-center gap-2 rounded-xl border border-input bg-muted/50 px-3">
          <input
            value={selectedProduct?.name ?? ""}
            readOnly
            placeholder="Select grocery to auto-fill"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </span>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Quantity
        <span className="flex h-11 min-h-11 items-center gap-2 rounded-xl border border-input bg-card px-3 ring-ring transition focus-within:ring-2">
          <input
            name="quantity"
            type="number"
            min={1}
            step="any"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="text-xs font-semibold text-muted-foreground">{selectedUnit}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {selectedProduct
            ? `${quantity || "1"} ${selectedUnit}`
            : "Select grocery to show quantity unit"}
        </span>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Retail rate
        <span className="flex h-11 min-h-11 items-center gap-2 rounded-xl border border-input bg-muted/50 px-3">
          <input
            value={selectedProduct ? `₹${selectedProduct.price}/${selectedUnit}` : ""}
            readOnly
            placeholder="Select grocery to auto-fill"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </span>
      </label>
      {!assignedShop && (
        <p className="text-xs font-semibold text-muted-foreground">
          No shop is mapped to this Shop Owner. Ask Platform Admin to create or link your shop.
        </p>
      )}
      {assignedShop && cartItems.length > 0 ?
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold">
          <p>
            Retail total: <span className="font-black text-primary">₹{Math.round(cartTotal)}</span>
          </p>
          <p className="mt-1 text-muted-foreground">
            Trade total at {marginPctPreview}% Groobey margin: ₹{Math.round(cartTradeTotal)} (saved on
            submit)
          </p>
        </div>
      : null}
      <Button variant="groobey" className="rounded-xl" disabled={!products.length || !assignedShop}>
        <ReceiptText className="size-4" /> Submit sale
      </Button>
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
  onEmailBill,
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
  onEmailBill: (saleId: string) => Promise<void>;
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
    <div className="space-y-3">
      <p className="text-sm font-black">Submitted sales</p>
      <div className="grid gap-3 md:grid-cols-2">
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
                <div className="grid grid-cols-[1.4fr_0.8fr_1fr_1fr] gap-2 border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground sm:grid-cols-[1.7fr_0.8fr_1fr_1fr]">
                  <p>Item</p>
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
                        className="grid grid-cols-[1.4fr_0.8fr_1fr_1fr] items-center gap-2 px-3 py-2 text-sm sm:grid-cols-[1.7fr_0.8fr_1fr_1fr]"
                      >
                        <p className="break-words text-xs font-semibold leading-snug sm:text-sm" title={original.product_name}>
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
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
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
                  showEmail
                  emailDisabled={sale.status !== "verified"}
                  onPrint={(kind) => onDownloadBill(sale.id, kind)}
                  onEmail={() => void onEmailBill(sale.id)}
                />
                {sale.status === "pending" ? (
                  <>
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
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => onArchiveSale(sale.id)}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
