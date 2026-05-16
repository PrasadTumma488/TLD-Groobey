import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defaultQtyForProduct,
  groceryCartRetailTotal,
  type GroceryCartLine,
  type GroceryProduct,
} from "@/lib/groobey-grocery-cart";
import { abbreviatePackUnitForBill } from "@/lib/groobey-bill-qty";
import {
  filterProductsByQuery,
  formatProductOptionLabel,
} from "@/lib/groobey-product-catalog";

export function GroobeyGroceryLinePicker({
  products,
  lines,
  onLinesChange,
  disabled,
}: {
  products: GroceryProduct[];
  lines: GroceryCartLine[];
  onLinesChange: (lines: GroceryCartLine[]) => void;
  disabled?: boolean;
}) {
  const [pickedProductId, setPickedProductId] = useState("");
  const [pickedQty, setPickedQty] = useState("1");
  const [productQuery, setProductQuery] = useState("");

  const filteredProducts = useMemo(
    () => filterProductsByQuery(products, productQuery),
    [products, productQuery],
  );
  const cartTotal = useMemo(() => groceryCartRetailTotal(lines, products), [lines, products]);
  const pickedProduct = useMemo(
    () => products.find((p) => p.id === pickedProductId),
    [products, pickedProductId],
  );
  const qtyFieldLabel = useMemo(() => {
    if (!pickedProduct) return "Quantity";
    const abbrev = abbreviatePackUnitForBill(pickedProduct.unit);
    if (abbrev === "K" || abbrev === "GS" || abbrev === "L" || abbrev === "ML") {
      return "Qty (same as KGS on bill)";
    }
    return "Quantity";
  }, [pickedProduct]);

  function addLine() {
    if (!pickedProductId || disabled) return;
    const qty = Number(pickedQty || 1);
    if (!Number.isFinite(qty) || qty <= 0) return;
    onLinesChange(
      (() => {
        const idx = lines.findIndex((row) => row.productId === pickedProductId);
        if (idx === -1) return [...lines, { productId: pickedProductId, quantity: qty }];
        const next = [...lines];
        next[idx] = { ...next[idx], quantity: qty };
        return next;
      })(),
    );
    setPickedQty("1");
  }

  function removeLine(productId: string) {
    onLinesChange(lines.filter((row) => row.productId !== productId));
  }

  return (
    <div className="grid gap-3">
      <input
        type="search"
        value={productQuery}
        onChange={(e) => setProductQuery(e.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2 disabled:opacity-60"
        placeholder="Search grocery item, pack size, or price"
        autoComplete="off"
      />
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Select
          value={pickedProductId || undefined}
          onValueChange={(value) => {
            setPickedProductId(value);
            const p = products.find((item) => item.id === value);
            setPickedQty(String(defaultQtyForProduct(p)));
          }}
          disabled={disabled || !products.length}
        >
          <SelectTrigger className="h-12 w-full text-base sm:min-w-0 sm:flex-1">
            <SelectValue
              placeholder={
                products.length ? "Choose grocery item" : "Platform Admin must add grocery catalog first"
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
          disabled={disabled}
          className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold sm:w-24"
          aria-label={qtyFieldLabel}
          title={qtyFieldLabel}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          onClick={addLine}
          disabled={disabled || !pickedProductId}
        >
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {lines.length ?
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-sm font-bold text-foreground">Order lines</p>
          <ul className="mt-2 space-y-2">
            {lines.map((row) => {
              const product = products.find((p) => p.id === row.productId);
              if (!product) return null;
              const lineTotal = Math.round(Number(product.price) * row.quantity);
              return (
                <li
                  key={row.productId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-2 py-1.5"
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {product.name} · {product.unit} × {row.quantity}
                  </span>
                  <span className="text-sm font-black text-primary">₹{lineTotal}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg p-0"
                    disabled={disabled}
                    onClick={() => removeLine(row.productId)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-right text-lg font-black text-primary">
            Bill total: ₹{cartTotal}
          </p>
        </div>
      : (
        <p className="text-xs font-semibold text-muted-foreground">
          Add items from the catalog dropdown — total updates automatically.
        </p>
      )}
    </div>
  );
}
