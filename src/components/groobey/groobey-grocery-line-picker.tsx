import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  groceryCartRetailTotal,
  type GroceryCartLine,
  type GroceryProduct,
} from "@/lib/groobey-grocery-cart";
import { abbreviatePackUnitForBill } from "@/lib/groobey-bill-qty";
import {
  filterProductsByQuery,
  formatProductOptionLabel,
} from "@/lib/groobey-product-catalog";
import { cn } from "@/lib/utils";

function mergeCartLine(
  lines: GroceryCartLine[],
  productId: string,
  quantity: number,
): GroceryCartLine[] {
  const idx = lines.findIndex((row) => row.productId === productId);
  if (idx === -1) return [...lines, { productId, quantity }];
  const next = [...lines];
  next[idx] = { ...next[idx], quantity };
  return next;
}

export function GroobeyGroceryLinePicker({
  products,
  lines,
  onLinesChange,
  disabled,
  title = "Grocery items",
  linesLabel = "Order lines",
  id: idProp,
  editableQuantities = false,
  className,
  scrollableLines = false,
}: {
  products: GroceryProduct[];
  lines: GroceryCartLine[];
  onLinesChange: (lines: GroceryCartLine[]) => void;
  disabled?: boolean;
  title?: string;
  linesLabel?: string;
  id?: string;
  editableQuantities?: boolean;
  className?: string;
  /** Cap sale-line list height so totals / submit stay on screen. */
  scrollableLines?: boolean;
}) {
  const autoId = useId();
  const baseId = idProp ?? `grocery-picker-${autoId}`;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addQty, setAddQty] = useState("1");
  const [productQuery, setProductQuery] = useState("");
  const searchAreaRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(
    () => filterProductsByQuery(products, productQuery),
    [products, productQuery],
  );
  const cartTotal = useMemo(() => groceryCartRetailTotal(lines, products), [lines, products]);
  const selectedCount = selectedIds.size;
  const searchActive = productQuery.trim().length > 0;

  const closeSearchPanel = useCallback((clearQuery = false) => {
    setSearchPanelOpen(false);
    if (clearQuery) setProductQuery("");
  }, []);

  useEffect(() => {
    if (!searchPanelOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchAreaRef.current?.contains(target)) return;
      closeSearchPanel(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSearchPanel(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [searchPanelOpen, closeSearchPanel]);

  const toggleSelected = useCallback((productId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  function selectAllVisible() {
    setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
  }

  function clearCatalogSelection() {
    setSelectedIds(new Set());
  }

  function addSelectedLines(closePopover: boolean) {
    if (disabled || selectedCount === 0) return;
    const qty = Number(addQty || 1);
    if (!Number.isFinite(qty) || qty <= 0) return;
    let next = [...lines];
    for (const productId of selectedIds) {
      next = mergeCartLine(next, productId, qty);
    }
    onLinesChange(next);
    clearCatalogSelection();
    setAddQty("1");
    if (closePopover) setPickerOpen(false);
    else closeSearchPanel(false);
  }

  function removeLine(productId: string) {
    onLinesChange(lines.filter((row) => row.productId !== productId));
  }

  function clearAllLines() {
    onLinesChange([]);
  }

  function updateLineQty(productId: string, raw: string) {
    const qty = Number(raw || 1);
    if (!Number.isFinite(qty) || qty <= 0) return;
    onLinesChange(
      lines.map((row) => (row.productId === productId ? { ...row, quantity: qty } : row)),
    );
  }

  const qtyFieldLabel = useMemo(() => {
    if (selectedCount !== 1) return "Quantity for selected items";
    const p = products.find((item) => item.id === [...selectedIds][0]);
    if (!p) return "Quantity";
    const abbrev = abbreviatePackUnitForBill(p.unit);
    if (abbrev === "K" || abbrev === "GS" || abbrev === "L" || abbrev === "ML") {
      return "Qty (same as KGS on bill)";
    }
    return "Quantity";
  }, [products, selectedCount, selectedIds]);

  const triggerLabel =
    !products.length ? "Add grocery catalog first"
    : selectedCount > 0 ? `${selectedCount} item${selectedCount === 1 ? "" : "s"} selected in list`
    : lines.length > 0 ? `${lines.length} on bill - open to add more`
    : "Choose grocery items";

  function renderCatalogPicker(closePopoverOnAdd: boolean, idPrefix: string) {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg text-xs"
            disabled={!filteredProducts.length}
            onClick={selectAllVisible}
          >
            Select all shown
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg text-xs"
            disabled={selectedCount === 0}
            onClick={clearCatalogSelection}
          >
            Clear selection
          </Button>
        </div>

        <div
          className="max-h-48 overflow-y-auto rounded-xl border border-border groobey-scrollbar"
          role="group"
          aria-label="Grocery items"
        >
          {!filteredProducts.length ?
            <p className="px-3 py-4 text-xs font-semibold text-muted-foreground">
              {searchActive ? "No items match your search." : "No items in catalog."}
            </p>
          : (
            <ul className="divide-y divide-border/60">
              {filteredProducts.map((p) => {
                const checked = selectedIds.has(p.id);
                const checkboxId = `${baseId}-${idPrefix}-item-${p.id}`;
                return (
                  <li key={p.id}>
                    <label
                      htmlFor={checkboxId}
                      className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(v) => toggleSelected(p.id, v === true)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                        {formatProductOptionLabel(p)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-[5rem_1fr] sm:items-end">
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            {qtyFieldLabel}
            <input
              type="number"
              min={1}
              step="any"
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold"
              aria-label={qtyFieldLabel}
            />
          </label>
          <Button
            type="button"
            variant="groobey"
            className="h-10 rounded-xl"
            onClick={() => addSelectedLines(closePopoverOnAdd)}
            disabled={selectedCount === 0}
          >
            <Plus className="size-4" aria-hidden />
            Add selected{selectedCount ? ` (${selectedCount})` : ""}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <fieldset
      disabled={disabled}
      className={cn("grid gap-3 border-0 p-0 min-w-0", className)}
      aria-labelledby={`${baseId}-legend`}
    >
      <legend id={`${baseId}-legend`} className="text-sm font-semibold text-foreground">
        {title}
      </legend>

      <div ref={searchAreaRef} className="grid gap-2">
        <label className="grid gap-1 text-sm font-semibold text-foreground" htmlFor={`${baseId}-search`}>
          Search catalog
          <input
            id={`${baseId}-search`}
            type="search"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            onFocus={() => setSearchPanelOpen(true)}
            onClick={() => setSearchPanelOpen(true)}
            disabled={disabled || !products.length}
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm font-semibold outline-none ring-ring focus:ring-2 disabled:opacity-60"
            placeholder="Type name, category, pack, or price"
            autoComplete="off"
          />
        </label>

        {searchPanelOpen ?
          <div
            className="rounded-2xl border-2 border-border bg-card p-3 shadow-sm"
            aria-label="Search results"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-foreground">
                {searchActive ? `${filteredProducts.length} match${filteredProducts.length === 1 ? "" : "es"}` : "All items"}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-lg"
                onClick={() => closeSearchPanel(true)}
                aria-label="Close search results"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            {renderCatalogPicker(false, "search")}
          </div>
        : null}
      </div>

      <Popover
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (open) closeSearchPanel(false);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !products.length}
            className={cn(
              "groobey-select-trigger h-11 min-h-11 w-full justify-between rounded-2xl border-2 border-input bg-card px-3 text-left text-sm font-semibold shadow-sm",
              pickerOpen && "ring-2 ring-ring",
            )}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            aria-controls={`${baseId}-panel`}
            id={`${baseId}-trigger`}
          >
            <span className="min-w-0 truncate">{triggerLabel}</span>
            <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          id={`${baseId}-panel`}
          align="start"
          sideOffset={6}
          className="z-[100] w-[min(100vw-2rem,var(--radix-popover-trigger-width))] max-w-none rounded-2xl border-2 border-border bg-card p-3 shadow-[var(--shadow-soft)]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {renderCatalogPicker(true, "dropdown")}
        </PopoverContent>
      </Popover>

      {lines.length ?
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-foreground">{linesLabel}</p>
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-lg px-2 text-xs text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={clearAllLines}
              aria-label={`Remove all ${lines.length} ${linesLabel.toLowerCase()}`}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Clear all
            </Button>
          </div>
          <div className={cn(scrollableLines && "groobey-cart-lines-scroll groobey-scrollbar mt-2")}>
            <ul className={cn("space-y-2", !scrollableLines && "mt-2")} aria-label={linesLabel}>
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
                    {product.name} · {product.unit}
                    {editableQuantities ? null : <> × {row.quantity}</>}
                  </span>
                  {editableQuantities ?
                    <>
                      <label className="sr-only" htmlFor={`${baseId}-qty-${row.productId}`}>
                        Quantity for {product.name}
                      </label>
                      <input
                        id={`${baseId}-qty-${row.productId}`}
                        type="number"
                        min={1}
                        step="any"
                        value={String(row.quantity)}
                        onChange={(e) => updateLineQty(row.productId, e.target.value)}
                        className="h-8 w-20 rounded-md border border-input bg-card px-2 text-xs font-semibold"
                        disabled={disabled}
                      />
                    </>
                  : null}
                  <span className="text-sm font-black text-primary">₹{lineTotal}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg p-0"
                    disabled={disabled}
                    onClick={() => removeLine(row.productId)}
                    aria-label={`Remove ${product.name} from ${linesLabel.toLowerCase()}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
          </div>
          <p className="mt-3 border-t border-border/60 pt-3 text-right text-lg font-black text-primary">
            Bill total: ₹{cartTotal}
          </p>
        </div>
      : (
        <p className="text-xs font-semibold text-muted-foreground">
          Tap search to open the list (close with X or tap outside), or open the dropdown for the
          full catalog. Set quantity, then Add selected.
        </p>
      )}
    </fieldset>
  );
}
