import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DELIVERY_CHARGE_OPTIONS,
  DELIVERY_MINUTE_SLOTS,
  type DeliveryDestinationKind,
  deliveryHourOptions,
} from "@/lib/groobey-delivery-order-fields";
import type { GroceryProduct } from "@/lib/groobey-grocery-cart";
import {
  defaultQuantityForProduct,
  filterProductsByQuery,
  formatProductOptionLabel,
} from "@/lib/groobey-product-catalog";

type Shop = { id: string; name: string };

export function CustomerOrderDeliveryFields({
  shops,
  products,
  resetNonce = 0,
  disabled = false,
  cartItemsSummary = "",
  onDeliveryChargeChange,
}: {
  shops: Shop[];
  products: GroceryProduct[];
  resetNonce?: number;
  disabled?: boolean;
  cartItemsSummary?: string;
  onDeliveryChargeChange?: (amount: number) => void;
}) {
  const [destination, setDestination] = useState<DeliveryDestinationKind>("shop");
  const [workFromShopId, setWorkFromShopId] = useState("");
  const [pickedProductId, setPickedProductId] = useState("");
  const [pickedQty, setPickedQty] = useState("1");
  const [productQuery, setProductQuery] = useState("");
  const [deliveredLines, setDeliveredLines] = useState<Array<{ productId: string; quantity: number }>>(
    [],
  );
  const [deliveryHour, setDeliveryHour] = useState("");
  const [deliveryMinute, setDeliveryMinute] =
    useState<(typeof DELIVERY_MINUTE_SLOTS)[number]>("00");
  const [deliveryCharge, setDeliveryCharge] = useState<string>("0");
  const [otherDestination, setOtherDestination] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const filteredProducts = useMemo(
    () => filterProductsByQuery(products, productQuery),
    [products, productQuery],
  );
  const hourOptions = useMemo(() => deliveryHourOptions(), []);

  useEffect(() => {
    setDestination("shop");
    setWorkFromShopId("");
    setPickedProductId("");
    setPickedQty("1");
    setProductQuery("");
    setDeliveredLines([]);
    setDeliveryHour("");
    setDeliveryMinute("00");
    setDeliveryCharge("0");
    setOtherDestination("");
    setCustomerAddress("");
  }, [resetNonce]);

  useEffect(() => {
    if (destination !== "shop") setWorkFromShopId("");
  }, [destination]);

  useEffect(() => {
    onDeliveryChargeChange?.(Math.max(0, Number(deliveryCharge) || 0));
  }, [deliveryCharge, onDeliveryChargeChange]);

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
    const fromPicker = deliveredLines
      .map((row) => {
        const product = products.find((p) => p.id === row.productId);
        if (!product) return null;
        return `${product.name} (${product.unit}) × ${row.quantity}`;
      })
      .filter(Boolean)
      .join("; ");
    return fromPicker || cartItemsSummary.trim();
  }, [deliveredLines, products, cartItemsSummary]);

  const deliveryTimeSlot =
    deliveryHour !== "" ?
      `${String(Number(deliveryHour)).padStart(2, "0")}:${deliveryMinute}`
    : "";

  return (
    <div className="grid gap-4 border-t border-border pt-4">
      <p className="text-sm font-bold text-foreground">Delivery details</p>

      <input type="hidden" name="destination" value={destination} readOnly />
      <input type="hidden" name="workFromShopId" value={workFromShopId} readOnly />
      <input type="hidden" name="itemsDelivered" value={itemsDeliveredSummary} readOnly />
      <input type="hidden" name="deliveryTimeSlot" value={deliveryTimeSlot} readOnly />
      <input type="hidden" name="deliveryCharge" value={deliveryCharge} readOnly />
      <input type="hidden" name="otherDestination" value={otherDestination} readOnly />
      <input type="hidden" name="customerAddress" value={customerAddress} readOnly />

      <div className="grid gap-1.5 text-sm font-semibold text-foreground">
        <span>Delivery destination</span>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["shop", "Shop"],
              ["self", "Self"],
              ["other", "Other"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={destination === value ? "groobey" : "outline"}
              className="h-11 rounded-xl text-sm"
              disabled={disabled}
              onClick={() => setDestination(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {destination === "shop" && (
        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          Work from shop
          <Select
            value={workFromShopId || undefined}
            onValueChange={setWorkFromShopId}
            disabled={disabled || !shops.length}
          >
            <SelectTrigger className="h-12 text-base">
              <SelectValue placeholder={shops.length ? "Choose shop" : "No shops"} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {shops.map((shop) => (
                <SelectItem key={shop.id} value={shop.id} className="py-2.5 text-base">
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}

      {destination === "other" && (
        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          Other destination
          <input
            value={otherDestination}
            onChange={(e) => setOtherDestination(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
            placeholder="Building, area, landmark…"
            disabled={disabled}
            required
          />
        </label>
      )}

      {destination !== "other" && (
        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          Customer address (optional)
          <input
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
            placeholder="Delivery address if needed"
            disabled={disabled}
          />
        </label>
      )}

      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Delivery charge
        <select
          value={deliveryCharge}
          onChange={(e) => setDeliveryCharge(e.target.value)}
          className="groobey-select h-11 w-full"
          disabled={disabled}
        >
          <option value="0">No delivery charge</option>
          {DELIVERY_CHARGE_OPTIONS.map((amt) => (
            <option key={amt} value={String(amt)}>
              ₹{amt}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-2">
        <span className="text-sm font-semibold text-foreground">Items delivered</span>
        <input
          type="search"
          value={productQuery}
          onChange={(e) => setProductQuery(e.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
          placeholder="Search grocery item"
          autoComplete="off"
          disabled={disabled}
        />
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Select
            value={pickedProductId || undefined}
            onValueChange={(value) => {
              setPickedProductId(value);
              const p = products.find((item) => item.id === value);
              setPickedQty(String(p ? defaultQuantityForProduct(p) : 1));
            }}
            disabled={disabled || !products.length}
          >
            <SelectTrigger className="h-12 w-full text-base sm:flex-1">
              <SelectValue placeholder="Choose item" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {filteredProducts.map((p) => (
                <SelectItem key={p.id} value={p.id} className="py-2.5 text-base">
                  {formatProductOptionLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="number"
            min={1}
            value={pickedQty}
            onChange={(e) => setPickedQty(e.target.value)}
            className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold sm:w-24"
            disabled={disabled}
            aria-label="Quantity"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl sm:w-auto"
            onClick={addDeliveredLine}
            disabled={disabled || !pickedProductId}
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
                  <span className="min-w-0 flex-1 font-semibold">
                    {product.name} ({product.unit}) × {row.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2"
                    disabled={disabled}
                    onClick={() =>
                      setDeliveredLines((prev) => prev.filter((r) => r.productId !== row.productId))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : cartItemsSummary.trim() ? (
          <p className="text-xs font-semibold text-muted-foreground">
            Cart items will be used on the bill: {cartItemsSummary}
          </p>
        ) : (
          <p className="text-xs font-semibold text-muted-foreground">
            Add items or build the cart above first.
          </p>
        )}
      </div>

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
              disabled={disabled}
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
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-muted-foreground sm:w-[7.5rem]">
            Minutes
            <select
              value={deliveryMinute}
              onChange={(e) =>
                setDeliveryMinute(e.target.value as (typeof DELIVERY_MINUTE_SLOTS)[number])
              }
              className="groobey-select h-11 w-full"
              disabled={disabled}
            >
              {DELIVERY_MINUTE_SLOTS.map((m) => (
                <option key={m} value={m}>
                  :{m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}