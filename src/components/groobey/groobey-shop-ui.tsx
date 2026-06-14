import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import {
  ArrowRight,
  ChevronLeft,
  FileText,
  Loader2,
  Calendar,
  LogIn,
  Mail,
  MapPin,
  Minus,
  Package,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  UserPlus,
} from "lucide-react";

import type { HomeCategory } from "@/lib/groobey-home-categories";
import { homeCategoryIcon } from "@/lib/groobey-home-category-icons";
import { parseComboItems } from "@/lib/groobey-shop-browse";
import type { OrderStatus } from "@/lib/groobey-order-pipeline";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  GroobeySheetDialogBody,
  GroobeySheetDialogContent,
  GroobeySheetDialogHeader,
} from "@/components/groobey/groobey-sheet-dialog";
import { Field } from "@/components/groobey/workspace-ui";

export type ShopStep = "browse" | "cart" | "checkout";

/** Circular category tiles — wrapped grid, no horizontal scroll. */
export function ShopCategoryRail({
  categories,
  activeId,
  onSelect,
}: {
  categories: HomeCategory[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const active = rail.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeId]);

  return (
    <div
      ref={railRef}
      className="groobey-shop-category-rail"
      role="tablist"
      aria-label="Shop categories"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeId === "all"}
        className={cn("groobey-shop-category-tile", activeId === "all" && "is-active")}
        onClick={() => onSelect("all")}
      >
        <span className="groobey-shop-category-tile-media">
          <ShoppingBasket className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="groobey-shop-category-tile-text">
          <span className="groobey-shop-category-tile-label">All</span>
          <span className="groobey-shop-category-tile-sub">Browse everything</span>
        </span>
      </button>
      {categories.map((category) => {
        const PlaceholderIcon = homeCategoryIcon(category.id);
        const isCombos = category.id === "combos";
        return (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={activeId === category.id}
            className={cn(
              "groobey-shop-category-tile",
              isCombos && "groobey-shop-category-tile--combos",
              activeId === category.id && "is-active",
            )}
            onClick={() => onSelect(category.id)}
          >
            <span className="groobey-shop-category-tile-media">
              {category.image ?
                <img
                  src={category.image}
                  alt=""
                  className="groobey-shop-category-tile-img"
                  loading="lazy"
                  decoding="async"
                />
              : <PlaceholderIcon className="size-5" strokeWidth={1.75} aria-hidden />
              }
            </span>
            <span className="groobey-shop-category-tile-text">
              <span className="groobey-shop-category-tile-label">{category.label}</span>
              <span className="groobey-shop-category-tile-sub">{category.subtitle}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** @deprecated use ShopCategoryRail */
export const ShopCategoryGrid = ShopCategoryRail;


/** @deprecated Combos are a category tile — no separate mode switch. */
export function ShopBrowseModeSwitch(_props: {
  mode: "items" | "combos";
  onModeChange: (mode: "items" | "combos") => void;
}) {
  return null;
}

/** Search + image category rail. */
export function ShopCatalogToolbar({
  categories,
  activeId,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  resultCount,
  browseMode = "items",
}: {
  categories: HomeCategory[];
  activeId: string;
  onCategoryChange: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount?: number;
  browseMode?: "items" | "combos";
}) {
  return (
    <div className="groobey-shop-catalog-toolbar">
      <label className="groobey-shop-search-field">
        <Search className="size-4 shrink-0" aria-hidden />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={browseMode === "combos" ? "Search combos…" : "Search products…"}
          className="groobey-shop-search-input"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      <ShopCategoryRail
        categories={categories}
        activeId={activeId}
        onSelect={onCategoryChange}
      />
      {typeof resultCount === "number" ?
        <p className="groobey-shop-catalog-count" aria-live="polite">
          {resultCount} {browseMode === "combos" ? "combo" : "item"}
          {resultCount === 1 ? "" : "s"}
        </p>
      : null}
    </div>
  );
}

/** Shop → Cart → Checkout progress (always visible while shopping). */
export function ShopFlowStepper({
  step,
  cartCount,
  onStepChange,
}: {
  step: ShopStep;
  cartCount: number;
  onStepChange: (step: ShopStep) => void;
}) {
  const steps: { id: ShopStep; label: string; icon: typeof ShoppingBag }[] = [
    { id: "browse", label: "Shop", icon: ShoppingBag },
    { id: "cart", label: "Cart", icon: ShoppingCart },
    { id: "checkout", label: "Checkout", icon: Receipt },
  ];
  const stepIndex = steps.findIndex((item) => item.id === step);

  return (
    <nav className="groobey-shop-stepper" aria-label="Shop progress">
      {steps.map((item, index) => {
        const Icon = item.icon;
        const isActive = step === item.id;
        const isComplete = stepIndex > index;
        const cartBlocked = item.id !== "browse" && cartCount === 0;
        const disabled = cartBlocked && !isActive;
        const showLine = index < steps.length - 1;

        return (
          <div key={item.id} className="groobey-shop-stepper-item">
            <button
              type="button"
              className={cn(
                "groobey-shop-step",
                isActive && "is-active",
                isComplete && "is-complete",
                disabled && "is-disabled",
              )}
              disabled={disabled}
              aria-current={isActive ? "step" : undefined}
              onClick={() => {
                if (disabled) return;
                onStepChange(item.id);
              }}
            >
              <span className="groobey-shop-step-icon">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="groobey-shop-step-label">{item.label}</span>
              {item.id === "cart" && cartCount > 0 ?
                <span className="groobey-shop-step-badge">{cartCount}</span>
              : null}
            </button>
            {showLine ?
              <span
                className={cn("groobey-shop-stepper-line", isComplete && "is-complete")}
                aria-hidden
              />
            : null}
          </div>
        );
      })}
    </nav>
  );
}

/** Back navigation for cart / checkout. */
export function ShopFlowHeader({
  title,
  onBack,
  backLabel = "Back",
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <header className="groobey-shop-flow-header">
      <button type="button" className="groobey-shop-flow-back" onClick={onBack}>
        <ChevronLeft className="size-5" aria-hidden />
        <span>{backLabel}</span>
      </button>
      <h2 className="groobey-shop-flow-title">{title}</h2>
    </header>
  );
}

/** @deprecated use ShopCatalogToolbar */
export function ShopCategoryBar({
  categories,
  activeId,
  onSelect,
}: {
  categories: HomeCategory[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ShopCatalogToolbar
      categories={categories}
      activeId={activeId}
      onCategoryChange={onSelect}
      searchQuery=""
      onSearchChange={() => undefined}
      browseMode="items"
    />
  );
}

type ShopProduct = {
  id: string;
  name: string;
  price: number;
  unit: string;
};

export type ShopComboCardItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
};

function shopProductFlySource(event: MouseEvent<HTMLElement>): HTMLElement {
  return event.currentTarget.closest<HTMLElement>(".groobey-shop-product, .groobey-shop-combo-card") ?? event.currentTarget;
}

export function ShopComboCard({
  combo,
  quantity,
  onAdd,
  onUpdateQty,
  onOpenDetail,
}: {
  combo: ShopComboCardItem;
  quantity: number;
  onAdd: (sourceEl: HTMLElement) => void;
  onUpdateQty: (delta: number, sourceEl?: HTMLElement) => void;
  onOpenDetail?: () => void;
}) {
  const inCart = quantity > 0;
  const previewItems = parseComboItems(combo.description).slice(0, 3);

  return (
    <article className={cn("groobey-shop-combo-card", inCart && "is-in-cart")}>
      <button
        type="button"
        className="groobey-shop-combo-card-hit"
        onClick={onOpenDetail}
        aria-label={`View ${combo.name} details`}
      >
        <div className="groobey-shop-combo-card-media">
          {combo.imageUrl ?
            <img
              src={combo.imageUrl}
              alt=""
              className="groobey-shop-combo-card-img"
              loading="lazy"
              decoding="async"
            />
          : <span className="groobey-shop-combo-card-placeholder" aria-hidden>
              <ShoppingBag className="size-8 opacity-35" strokeWidth={1.5} />
            </span>
          }
          <span className="groobey-shop-combo-card-tag">Combo</span>
        </div>
        <div className="groobey-shop-combo-card-body">
          <h3 className="groobey-shop-combo-card-name">{combo.name}</h3>
          {previewItems.length > 0 ?
            <ul className="groobey-shop-combo-card-items">
              {previewItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          : combo.description ?
            <p className="groobey-shop-combo-card-desc">{combo.description}</p>
          : null}
          <p className="groobey-shop-combo-card-price">₹{combo.price}</p>
          <span className="groobey-shop-combo-card-view">View pack details</span>
        </div>
      </button>
      <div className="groobey-shop-combo-card-actions">
          {inCart ?
            <div className="groobey-shop-qty-pill">
              <button
                type="button"
                className="groobey-shop-qty-pill-btn"
                aria-label={`Decrease ${combo.name}`}
                onClick={() => onUpdateQty(-1)}
              >
                <Minus className="size-3.5" />
              </button>
              <span className="groobey-shop-qty-pill-value">{quantity}</span>
              <button
                type="button"
                className="groobey-shop-qty-pill-btn"
                aria-label={`Increase ${combo.name}`}
                onClick={(event) => onUpdateQty(1, shopProductFlySource(event))}
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          : <button
              type="button"
              className="groobey-shop-add-pill"
              onClick={(event) => onAdd(shopProductFlySource(event))}
            >
              ADD COMBO
            </button>
          }
      </div>
    </article>
  );
}

export function ShopComboDetailSheet({
  combo,
  quantity,
  open,
  onOpenChange,
  onAdd,
  onUpdateQty,
}: {
  combo: ShopComboCardItem | null;
  quantity: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (sourceEl: HTMLElement) => void;
  onUpdateQty: (delta: number, sourceEl?: HTMLElement) => void;
}) {
  if (!combo) return null;
  const items = parseComboItems(combo.description);
  const inCart = quantity > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <GroobeySheetDialogContent className="groobey-shop-combo-detail-sheet">
        <GroobeySheetDialogHeader
          title={combo.name}
          description="Combo pack details"
          onClose={() => onOpenChange(false)}
        />
        <GroobeySheetDialogBody>
          <div className="groobey-shop-combo-detail">
            <div className="groobey-shop-combo-detail-media">
              {combo.imageUrl ?
                <img src={combo.imageUrl} alt="" className="groobey-shop-combo-detail-img" />
              : <span className="groobey-shop-combo-detail-placeholder">
                  <ShoppingBag className="size-12 opacity-35" aria-hidden />
                </span>
              }
            </div>
            <p className="groobey-shop-combo-detail-price">₹{combo.price}</p>
            <div className="groobey-shop-combo-detail-items">
              <h4 className="groobey-shop-combo-detail-items-title">What&apos;s inside</h4>
              {items.length > 0 ?
                <ul className="groobey-shop-combo-detail-list">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              : combo.description ?
                <p className="groobey-shop-combo-detail-fallback">{combo.description}</p>
              : <p className="groobey-shop-combo-detail-fallback">Ask the shop for pack contents.</p>
              }
            </div>
          </div>
        </GroobeySheetDialogBody>
        <div className="groobey-shop-combo-detail-footer">
          {inCart ?
            <div className="groobey-shop-qty-pill groobey-shop-qty-pill--wide">
              <button
                type="button"
                className="groobey-shop-qty-pill-btn"
                aria-label={`Decrease ${combo.name}`}
                onClick={() => onUpdateQty(-1)}
              >
                <Minus className="size-4" />
              </button>
              <span className="groobey-shop-qty-pill-value">{quantity}</span>
              <button
                type="button"
                className="groobey-shop-qty-pill-btn"
                aria-label={`Increase ${combo.name}`}
                onClick={(event) => onUpdateQty(1, shopProductFlySource(event))}
              >
                <Plus className="size-4" />
              </button>
            </div>
          : <button
              type="button"
              className="groobey-shop-add-pill groobey-shop-add-pill--wide"
              onClick={(event) => {
                onAdd(shopProductFlySource(event));
                onOpenChange(false);
              }}
            >
              ADD COMBO TO CART
            </button>
          }
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full rounded-xl text-sm font-bold"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </GroobeySheetDialogContent>
    </Dialog>
  );
}

export function ShopComboCatalogSkeleton() {
  return (
    <div className="groobey-shop-combo-catalog groobey-shop-catalog-skeleton" aria-busy="true" aria-label="Loading combos">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="groobey-shop-combo-card groobey-shop-combo-card--skeleton" />
      ))}
    </div>
  );
}

/** Toolbar + catalog placeholders while shop data loads. */
export function ShopBrowseSkeleton({ combos = false }: { combos?: boolean }) {
  return (
    <div className="groobey-shop-browse-loading" aria-busy="true" aria-label="Loading shop">
      <div className="groobey-shop-toolbar-skeleton">
        <div className="groobey-shop-search-skeleton" />
        <div className="groobey-shop-category-rail-skeleton">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="groobey-shop-category-tile-skeleton" />
          ))}
        </div>
      </div>
      <div className="groobey-shop-head-skeleton">
        <div className="groobey-shop-head-skeleton-title" />
        <div className="groobey-shop-head-skeleton-sub" />
      </div>
      {combos ?
        <ShopComboCatalogSkeleton />
      : <ShopCatalogSkeleton />}
    </div>
  );
}

export function ShopProductCard({
  product,
  quantity,
  onAdd,
  onUpdateQty,
}: {
  product: ShopProduct;
  quantity: number;
  onAdd: (sourceEl: HTMLElement) => void;
  onUpdateQty: (delta: number, sourceEl?: HTMLElement) => void;
}) {
  const inCart = quantity > 0;

  return (
    <article className={cn("groobey-shop-product", inCart && "is-in-cart")}>
      <div className="groobey-shop-product-body">
        <h3 className="groobey-shop-product-name">{product.name}</h3>
        <p className="groobey-shop-product-price">
          <span className="groobey-shop-product-amount">₹{product.price}</span>
          <span className="groobey-shop-product-unit">/ {product.unit}</span>
        </p>
      </div>
      <div className="groobey-shop-product-actions">
        {inCart ?
          <div className="groobey-shop-qty-pill">
            <button
              type="button"
              className="groobey-shop-qty-pill-btn"
              aria-label={`Decrease ${product.name}`}
              onClick={() => onUpdateQty(-1)}
            >
              <Minus className="size-3.5" />
            </button>
            <span className="groobey-shop-qty-pill-value">{quantity}</span>
            <button
              type="button"
              className="groobey-shop-qty-pill-btn"
              aria-label={`Increase ${product.name}`}
              onClick={(event) => onUpdateQty(1, shopProductFlySource(event))}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        : <button
            type="button"
            className="groobey-shop-add-pill"
            onClick={(event) => onAdd(shopProductFlySource(event))}
          >
            ADD
          </button>
        }
      </div>
    </article>
  );
}

export function ShopLineItemRow({
  name,
  unitPrice,
  unit,
  quantity,
  lineTotal,
  onUpdateQty,
  readOnly = false,
}: {
  name: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  lineTotal: number;
  onUpdateQty?: (delta: number) => void;
  readOnly?: boolean;
}) {
  return (
    <li className="groobey-shop-line-item">
      <div className="groobey-shop-line-item-body">
        <p className="groobey-shop-line-item-name">{name}</p>
        <p className="groobey-shop-line-item-meta">
          ₹{unitPrice} · {unit}
        </p>
      </div>
      {readOnly || !onUpdateQty ?
        <div className="groobey-shop-line-item-end">
          <span className="groobey-shop-line-item-qty">× {quantity}</span>
          <span className="groobey-shop-line-item-total">₹{Math.round(lineTotal)}</span>
        </div>
      : <div className="groobey-shop-line-item-end">
          <div className="groobey-shop-qty-pill groobey-shop-qty-pill--sm">
            <button
              type="button"
              className="groobey-shop-qty-pill-btn"
              aria-label={`Decrease ${name}`}
              onClick={() => onUpdateQty(-1)}
            >
              <Minus className="size-3.5" />
            </button>
            <span className="groobey-shop-qty-pill-value">{quantity}</span>
            <button
              type="button"
              className="groobey-shop-qty-pill-btn"
              aria-label={`Increase ${name}`}
              onClick={() => onUpdateQty(1)}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <span className="groobey-shop-line-item-total">₹{Math.round(lineTotal)}</span>
        </div>
      }
    </li>
  );
}

/** @deprecated use ShopLineItemRow */
export function ShopCartLineRow(props: {
  name: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  onUpdateQty: (delta: number) => void;
}) {
  return (
    <ShopLineItemRow
      {...props}
      lineTotal={props.quantity * props.unitPrice}
      onUpdateQty={props.onUpdateQty}
    />
  );
}

export type ShopCartLineItem = {
  key: string;
  name: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  onUpdateQty?: (delta: number) => void;
};

/** Cart lines in a bordered panel; list scrolls inside the box (not the whole page). */
export function ShopCartLineItemsBox({
  items,
  title = "Your items",
  readOnly = false,
}: {
  items: ShopCartLineItem[];
  title?: string;
  readOnly?: boolean;
}) {
  const listItems =
    readOnly ? items.map((item) => ({ ...item, onUpdateQty: undefined })) : items;
  const manyItems = items.length > 3;

  return (
    <section
      className={cn("groobey-shop-cart-items-panel", manyItems && "groobey-shop-cart-items-panel--many")}
      aria-label={title}
    >
      <header className="groobey-shop-cart-items-panel-head">
        <h3 className="groobey-shop-cart-items-panel-title">{title}</h3>
        <span className="groobey-shop-cart-items-panel-count">
          {items.reduce((sum, item) => sum + item.quantity, 0)} pcs · {items.length} line
          {items.length === 1 ? "" : "s"}
        </span>
      </header>
      <div
        className="groobey-shop-cart-items-panel-body"
        tabIndex={manyItems ? 0 : undefined}
        aria-label={`${title}, scroll for more`}
      >
        <ShopLineItemsList items={listItems} />
      </div>
      {manyItems ?
        <p className="groobey-shop-cart-items-panel-hint" aria-hidden>
          Scroll inside the box for more items
        </p>
      : null}
    </section>
  );
}

/** @deprecated use ShopCartLineItemsBox */
export function ShopCartCompactList({ items }: { items: ShopCartLineItem[] }) {
  return <ShopCartLineItemsBox items={items} />;
}

export function ShopCheckoutCartSummary({
  cartCount,
  subtotal,
  onEditCart,
}: {
  cartCount: number;
  subtotal: number;
  onEditCart: () => void;
}) {
  return (
    <div className="groobey-shop-checkout-strip">
      <p className="groobey-shop-checkout-strip-value">
        {cartCount} item{cartCount === 1 ? "" : "s"} · ₹{Math.round(subtotal)}
      </p>
      <button type="button" className="groobey-shop-checkout-strip-edit" onClick={onEditCart}>
        <Pencil className="size-3.5" aria-hidden />
        Edit cart
      </button>
    </div>
  );
}

export function ShopLineItemsList({
  items,
}: {
  items: {
    key: string;
    name: string;
    unitPrice: number;
    unit: string;
    quantity: number;
    onUpdateQty?: (delta: number) => void;
  }[];
}) {
  return (
    <ul className="groobey-shop-line-items">
      {items.map((item) => (
        <ShopLineItemRow
          key={item.key}
          name={item.name}
          unitPrice={item.unitPrice}
          unit={item.unit}
          quantity={item.quantity}
          lineTotal={item.quantity * item.unitPrice}
          onUpdateQty={item.onUpdateQty}
          readOnly={!item.onUpdateQty}
        />
      ))}
    </ul>
  );
}

export function ShopDeliveryPicker({
  name,
  phone,
  email,
  address,
  editHref,
}: {
  name: string;
  phone: string;
  email: string;
  address: string;
  editHref: string;
}) {
  const [mode, setMode] = useState<"saved" | "alternate">("saved");

  return (
    <div className="groobey-shop-delivery-picker">
      <input type="hidden" name="deliveryMode" value={mode} />
      <p className="groobey-shop-delivery-picker-lead">Where should we deliver this order?</p>
      <div className="groobey-shop-delivery-mode" role="radiogroup" aria-label="Delivery address choice">
        <label
          className={cn(
            "groobey-shop-delivery-mode-option",
            mode === "saved" && "is-active",
          )}
        >
          <input
            type="radio"
            name="deliveryModeChoice"
            value="saved"
            checked={mode === "saved"}
            onChange={() => setMode("saved")}
          />
          <span className="groobey-shop-delivery-mode-body">
            <span className="groobey-shop-delivery-mode-title">My saved address</span>
            <span className="groobey-shop-delivery-mode-sub">{name} · {phone}</span>
            <span className="groobey-shop-delivery-mode-address">{address}</span>
          </span>
          <Link to={editHref} className="groobey-shop-delivery-mode-edit" onClick={(e) => e.stopPropagation()}>
            Edit profile
          </Link>
        </label>
        <label
          className={cn(
            "groobey-shop-delivery-mode-option",
            mode === "alternate" && "is-active",
          )}
        >
          <input
            type="radio"
            name="deliveryModeChoice"
            value="alternate"
            checked={mode === "alternate"}
            onChange={() => setMode("alternate")}
          />
          <span className="groobey-shop-delivery-mode-body">
            <span className="groobey-shop-delivery-mode-title">Another address</span>
            <span className="groobey-shop-delivery-mode-sub">
              Parents, family, gift — deliver somewhere else
            </span>
          </span>
        </label>
      </div>
      {mode === "alternate" ?
        <div className="groobey-shop-delivery-alt-fields">
          <Field name="customerName" label="Recipient name" required placeholder="Who receives the order?" />
          <Field name="customerPhone" label="Contact mobile" type="tel" required placeholder="10-digit mobile" />
          <Field
            name="customerAddress"
            label="Delivery address"
            required
            placeholder="Full address with landmark"
          />
          <input type="hidden" name="customerEmail" value={email} />
        </div>
      : <>
          <input type="hidden" name="customerName" value={name} />
          <input type="hidden" name="customerPhone" value={phone} />
          <input type="hidden" name="customerEmail" value={email} />
          <input type="hidden" name="customerAddress" value={address} />
        </>
      }
    </div>
  );
}

export function ShopDeliveryCard({
  name,
  phone,
  email,
  address,
  editHref,
}: {
  name: string;
  phone: string;
  email: string;
  address: string;
  editHref: string;
}) {
  return (
    <div className="groobey-shop-delivery-card">
      <div className="groobey-shop-delivery-card-head">
        <p className="groobey-shop-delivery-card-label">Delivering to</p>
        <Link to={editHref} className="groobey-shop-delivery-card-edit">
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Link>
      </div>
      <p className="groobey-shop-delivery-card-name">{name}</p>
      <p className="groobey-shop-delivery-card-line">
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        {address}
      </p>
      <p className="groobey-shop-delivery-card-meta">
        <span>
          <Phone className="size-3.5" aria-hidden />
          {phone}
        </span>
        <span>
          <Mail className="size-3.5" aria-hidden />
          {email}
        </span>
      </p>
    </div>
  );
}

export function ShopSummaryCard({
  cartCount,
  subtotal,
  lineItems,
  compact = false,
  showSidebarItems = false,
  children,
}: {
  cartCount: number;
  subtotal: number;
  lineItems?: React.ComponentProps<typeof ShopLineItemsList>["items"];
  /** Totals only — no duplicate item list (use on cart/checkout sidebars). */
  compact?: boolean;
  /** Scrollable item list in the desktop sidebar. */
  showSidebarItems?: boolean;
  children?: React.ReactNode;
}) {
  const sidebarItems =
    showSidebarItems && lineItems && lineItems.length > 0 ?
      lineItems.map((item) => ({ ...item, onUpdateQty: undefined }))
    : null;

  return (
    <aside className={cn("groobey-shop-summary", compact && "groobey-shop-summary--compact")}>
      <h2 className="groobey-shop-summary-title">Order summary</h2>
      {!compact && lineItems && lineItems.length > 0 ?
        <ShopLineItemsList items={lineItems.map((i) => ({ ...i, onUpdateQty: undefined }))} />
      : null}
      {sidebarItems ?
        <div
          className={cn(
            "groobey-shop-summary-items",
            sidebarItems.length > 4 && "groobey-shop-summary-items--scroll",
          )}
        >
          <ShopLineItemsList items={sidebarItems} />
        </div>
      : null}
      <dl className="groobey-shop-summary-rows">
        <div className="groobey-shop-summary-row">
          <dt>Items</dt>
          <dd>{cartCount}</dd>
        </div>
        <div className="groobey-shop-summary-row groobey-shop-summary-row--total">
          <dt>Total</dt>
          <dd>₹{Math.round(subtotal)}</dd>
        </div>
      </dl>
      <p className="groobey-shop-summary-note">Pay on delivery · Bill emailed after order</p>
      {children}
    </aside>
  );
}

export function ShopItemsCard({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="groobey-shop-items-card">
      {label ?
        <p className="groobey-shop-items-card-label">{label}</p>
      : null}
      <div className="groobey-shop-items-card-body">{children}</div>
    </div>
  );
}

export function ShopOrderEmailNotice({
  customerEmail,
  fromAddress,
  fromHeader,
  billNumber,
  onDismiss,
  onViewBill,
}: {
  customerEmail: string;
  fromAddress: string;
  fromHeader: string;
  billNumber: string;
  onDismiss?: () => void;
  onViewBill?: () => void;
}) {
  const fromLabel = fromHeader.trim() || fromAddress.trim();

  return (
    <div className="groobey-shop-email-notice" role="status" aria-live="polite">
      <span className="groobey-shop-email-notice-icon" aria-hidden>
        <Mail className="size-5" />
      </span>
      <div className="groobey-shop-email-notice-body">
        <p className="groobey-shop-email-notice-title">Order placed — check your email</p>
        <p className="groobey-shop-email-notice-text">
          Bill <strong>{billNumber}</strong> was sent to <strong>{customerEmail}</strong>.
        </p>
        <p className="groobey-shop-email-notice-text">
          Kindly check your Gmail inbox, <strong>Spam</strong>, and <strong>Promotions</strong>{" "}
          folders for 10 seconds.
        </p>
        {fromLabel ?
          <p className="groobey-shop-email-notice-from">
            From: <strong>{fromLabel}</strong>
          </p>
        : null}
        {onViewBill ?
          <button type="button" className="groobey-shop-email-notice-bill" onClick={onViewBill}>
            View &amp; download bill
          </button>
        : null}
      </div>
      {onDismiss ?
        <button type="button" className="groobey-shop-email-notice-close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      : null}
    </div>
  );
}

/** Cart strip below shop header / navbar (mobile + desktop). */
export function ShopCartActionBar({
  cartCount,
  subtotal,
  label,
  onAction,
  formId,
  saving = false,
  disabled = false,
  actionType = "button",
  flyTargetRef,
  bumped = false,
}: {
  cartCount: number;
  subtotal: number;
  label: string;
  onAction?: () => void;
  formId?: string;
  saving?: boolean;
  disabled?: boolean;
  actionType?: "button" | "submit";
  flyTargetRef?: RefObject<HTMLDivElement | null>;
  bumped?: boolean;
}) {
  return (
    <div
      className={cn("groobey-shop-cart-bar", bumped && "groobey-shop-cart-bar--bump")}
      role="region"
      aria-label="Cart total and next step"
    >
      <div className="groobey-shop-cart-bar-inner">
        <div
          ref={flyTargetRef}
          className="groobey-shop-cart-fly-target groobey-shop-cart-bar-meta"
        >
          <span className="groobey-shop-cart-bar-count">
            {cartCount} item{cartCount === 1 ? "" : "s"}
          </span>
          <span className="groobey-shop-cart-bar-amount">₹{Math.round(subtotal)}</span>
        </div>
        <button
          type={actionType}
          form={formId}
          className="groobey-shop-cart-bar-btn"
          disabled={disabled || saving}
          onClick={onAction}
        >
          {saving ?
            <Loader2 className="size-4 animate-spin" aria-hidden />
          : null}
          <span>{label}</span>
          {!saving && actionType === "button" ?
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          : null}
        </button>
      </div>
    </div>
  );
}

/** @deprecated use ShopCartActionBar */
export const ShopStickyActionBar = ShopCartActionBar;

export function ShopCartFloat({
  cartCount,
  cartTotal,
  onOpenCart,
}: {
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
}) {
  if (cartCount === 0) return null;

  return (
    <div className="groobey-shop-cart-float">
      <button type="button" className="groobey-shop-cart-float-btn" onClick={onOpenCart}>
        <span className="groobey-shop-cart-float-badge">{cartCount}</span>
        <ShoppingCart className="size-5 shrink-0" aria-hidden />
        <span className="groobey-shop-cart-float-text">
          View cart · <strong>₹{Math.round(cartTotal)}</strong>
        </span>
        <ArrowRight className="groobey-shop-cart-float-arrow size-4" aria-hidden />
      </button>
    </div>
  );
}

export function ShopEmptyCategory({ categoryLabel }: { categoryLabel: string }) {
  return (
    <div className="groobey-shop-empty">
      <div className="groobey-shop-empty-icon" aria-hidden>
        <ShoppingBasket className="size-8" strokeWidth={1.5} />
      </div>
      <p className="groobey-shop-empty-title">No matches for {categoryLabel}</p>
      <p className="groobey-shop-empty-text">
        Try a different search or category.
      </p>
    </div>
  );
}

export function ShopCatalogSkeleton() {
  return (
    <div className="groobey-shop-product-catalog groobey-shop-catalog-skeleton" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="groobey-shop-product groobey-shop-product--skeleton" />
      ))}
    </div>
  );
}

const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: "groobey-shop-order-status--pending",
  confirmed: "groobey-shop-order-status--confirmed",
  packed: "groobey-shop-order-status--packed",
  out_for_delivery: "groobey-shop-order-status--delivery",
  delivered: "groobey-shop-order-status--delivered",
  cancelled: "groobey-shop-order-status--cancelled",
};

export function formatOrderStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ShopOrderStatusBadge({ status }: { status: OrderStatus | string }) {
  const key = status as OrderStatus;
  return (
    <span className={cn("groobey-shop-order-status", ORDER_STATUS_CLASS[key] ?? "")}>
      {formatOrderStatusLabel(status)}
    </span>
  );
}

export function ShopAuthPrompt({
  loginHref,
  signupHref,
  title = "Almost there",
  lead = "Sign in or create a free account to place your order. Your cart is saved.",
}: {
  loginHref: string;
  signupHref: string;
  title?: string;
  lead?: string;
}) {
  return (
    <div className="groobey-shop-auth-prompt">
      <div className="groobey-shop-auth-prompt-icon" aria-hidden>
        <ShoppingBag className="size-7" strokeWidth={1.75} />
      </div>
      <h3 className="groobey-shop-auth-prompt-title">{title}</h3>
      <p className="groobey-shop-auth-prompt-lead">{lead}</p>
      <div className="groobey-shop-auth-prompt-actions">
        <Link to={loginHref} className="groobey-shop-auth-btn groobey-shop-auth-btn--primary">
          <LogIn className="size-4" />
          Sign in
        </Link>
        <Link to={signupHref} className="groobey-shop-auth-btn groobey-shop-auth-btn--secondary">
          <UserPlus className="size-4" />
          Create account
        </Link>
      </div>
    </div>
  );
}

export function parseOrderItemsLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function ProfileOrderHistoryCard({
  billLabel,
  total,
  createdAt,
  onViewBill,
}: {
  billLabel: string;
  total: number;
  createdAt: string | null;
  onViewBill?: () => void;
}) {
  const when = createdAt ? new Date(createdAt) : null;
  const dateLabel =
    when && !Number.isNaN(when.getTime()) ?
      when.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <li className="groobey-profile-order-card">
      <div className="groobey-profile-order-card-main">
        <div className="groobey-profile-order-card-head">
          <Receipt className="groobey-profile-order-card-icon size-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="groobey-profile-order-card-bill">{billLabel}</span>
        </div>
        <div className="groobey-profile-order-card-meta">
          {dateLabel ?
            <span className="groobey-profile-order-card-date">
              <Calendar className="size-3.5" aria-hidden />
              {dateLabel}
            </span>
          : null}
          <span className="groobey-profile-order-card-total">₹{Math.round(total)}</span>
        </div>
      </div>
      {onViewBill ?
        <button type="button" className="groobey-profile-order-view-bill-btn" onClick={onViewBill}>
          <FileText className="size-4 shrink-0" aria-hidden />
          View bill
        </button>
      : null}
    </li>
  );
}

export function ShopPanel({
  title,
  children,
  className,
}: {
  title?: string;
  icon?: typeof ShoppingBag;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("groobey-shop-panel", className)}>
      {title ?
        <header className="groobey-shop-panel-header">
          <h2 className="groobey-shop-panel-title">{title}</h2>
        </header>
      : null}
      <div className="groobey-shop-panel-body">{children}</div>
    </section>
  );
}

export function ShopSavingButton({
  saving,
  label,
  className,
  formId,
}: {
  saving: boolean;
  label: string;
  className?: string;
  formId?: string;
}) {
  return (
    <Button
      type="submit"
      form={formId}
      variant="groobey"
      className={cn("groobey-shop-place-order-inline", className)}
      disabled={saving}
    >
      {saving ?
        <Loader2 className="size-4 animate-spin" />
      : <Package className="size-4" />}
      {label}
    </Button>
  );
}
