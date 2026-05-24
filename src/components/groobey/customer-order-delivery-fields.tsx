import { useEffect, useMemo, useState } from "react";

import { GroobeyGroceryLinePicker } from "@/components/groobey/groobey-grocery-line-picker";
import { GroobeySelect } from "@/components/groobey/groobey-select-field";
import { GroobeyShopSelfOtherFieldset } from "@/components/groobey/groobey-shop-self-other-fieldset";
import {
  DELIVERY_CHARGE_OPTIONS,
  type DeliveryDestinationKind,
} from "@/lib/groobey-delivery-order-fields";
import type { GroceryCartLine, GroceryProduct } from "@/lib/groobey-grocery-cart";
import { groceryCartSummaryText } from "@/lib/groobey-grocery-cart";
import { cn } from "@/lib/utils";

type Shop = { id: string; name: string };

export function CustomerOrderDeliveryFields({
  shops,
  products,
  resetNonce = 0,
  disabled = false,
  cartItemsSummary = "",
  onDeliveryChargeChange,
  orderTakerMode = false,
}: {
  shops: Shop[];
  products: GroceryProduct[];
  resetNonce?: number;
  disabled?: boolean;
  cartItemsSummary?: string;
  onDeliveryChargeChange?: (amount: number) => void;
  /** Order taker quick order: order type + delivery charge (customer address is on the main form). */
  orderTakerMode?: boolean;
}) {
  const [destination, setDestination] = useState<DeliveryDestinationKind>("shop");
  const [workFromShopId, setWorkFromShopId] = useState("");
  const [deliveredLines, setDeliveredLines] = useState<GroceryCartLine[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState<string>("0");
  const [otherDestination, setOtherDestination] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const deliveryChargeSelectOptions = useMemo(
    () => [
      { value: "0", label: "No delivery charge" },
      ...DELIVERY_CHARGE_OPTIONS.map((amt) => ({
        value: String(amt),
        label: `₹${amt}`,
      })),
    ],
    [],
  );

  useEffect(() => {
    setDestination("shop");
    setWorkFromShopId("");
    setDeliveredLines([]);
    setDeliveryCharge("0");
    setOtherDestination("");
    setCustomerAddress("");
  }, [resetNonce]);

  useEffect(() => {
    if (destination !== "shop") setWorkFromShopId("");
  }, [destination]);

  useEffect(() => {
    if (
      orderTakerMode &&
      destination === "shop" &&
      shops.length === 1 &&
      !workFromShopId
    ) {
      setWorkFromShopId(shops[0]!.id);
    }
  }, [orderTakerMode, destination, shops, workFromShopId]);

  useEffect(() => {
    onDeliveryChargeChange?.(Math.max(0, Number(deliveryCharge) || 0));
  }, [deliveryCharge, onDeliveryChargeChange]);

  const itemsDeliveredSummary = useMemo(() => {
    const fromPicker = groceryCartSummaryText(deliveredLines, products);
    return fromPicker || cartItemsSummary.trim();
  }, [deliveredLines, products, cartItemsSummary]);

  return (
    <div
      className={cn(
        "grid gap-4",
        !orderTakerMode && "border-t border-border pt-4",
      )}
    >
      {!orderTakerMode ?
        <p className="text-sm font-bold text-foreground">Staff delivery log</p>
      : null}

      <input type="hidden" name="destination" value={destination} readOnly />
      <input type="hidden" name="workFromShopId" value={workFromShopId} readOnly />
      <input type="hidden" name="itemsDelivered" value={itemsDeliveredSummary} readOnly />
      <input type="hidden" name="deliveryTimeSlot" value="" readOnly />
      <input type="hidden" name="deliveryCharge" value={deliveryCharge} readOnly />
      <input type="hidden" name="otherDestination" value={otherDestination} readOnly />
      {!orderTakerMode ?
        <input type="hidden" name="customerAddress" value={customerAddress} readOnly />
      : null}

      <GroobeyShopSelfOtherFieldset
        idPrefix={orderTakerMode ? "order-type" : "deliver-to"}
        value={destination}
        onChange={setDestination}
        disabled={disabled}
        legend={orderTakerMode ? "Order type" : "Deliver to"}
        radiogroupLabel={orderTakerMode ? "Order type" : "Deliver to"}
        hint={
          orderTakerMode ?
            "Shop = linked to a shop. Self = customer pickup. Other = different drop-off note. Customer address is entered above - this is not the courier route."
          : "Where this delivery is going (staff log)."
        }
      />

      {destination === "shop" ?
        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          {orderTakerMode ? "Shop for this order" : "Work from shop"}
          <GroobeySelect
            value={workFromShopId || "__choose_shop__"}
            onValueChange={(v) => setWorkFromShopId(v === "__choose_shop__" ? "" : v)}
            disabled={disabled || !shops.length}
            placeholder={shops.length ? "Choose shop" : "No shops"}
            options={[
              { value: "__choose_shop__", label: shops.length ? "Choose shop" : "No shops" },
              ...shops.map((shop) => ({ value: shop.id, label: shop.name })),
            ]}
          />
        </label>
      : null}

      {destination === "other" ?
        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          {orderTakerMode ? "Other location (short note)" : "Other destination"}
          <input
            value={otherDestination}
            onChange={(e) => setOtherDestination(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
            placeholder={orderTakerMode ? "Landmark, building, area…" : "Building, area, landmark…"}
            disabled={disabled}
            required={!orderTakerMode}
          />
        </label>
      : null}

      {!orderTakerMode && destination !== "other" ?
        <label className="grid gap-1.5 text-sm font-semibold text-foreground">
          Customer address
          <input
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2"
            placeholder="Delivery address"
            disabled={disabled}
            required
          />
        </label>
      : null}

      <label className="grid gap-1.5 text-sm font-semibold text-foreground">
        Delivery charge
        <GroobeySelect
          value={deliveryCharge}
          onValueChange={setDeliveryCharge}
          disabled={disabled}
          options={deliveryChargeSelectOptions}
        />
      </label>

      {!orderTakerMode ?
        <GroobeyGroceryLinePicker
          id="items-delivered"
          title="Items delivered"
          linesLabel="Delivered items"
          products={products}
          lines={deliveredLines}
          onLinesChange={setDeliveredLines}
          disabled={disabled}
        />
      : null}
    </div>
  );
}
