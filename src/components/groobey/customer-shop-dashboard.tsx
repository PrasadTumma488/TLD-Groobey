import { Link } from "@tanstack/react-router";
import { ShoppingCart, UserRound } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { GroobeyMemberChrome } from "@/components/groobey/groobey-member-chrome";
import {
  ShopAuthPrompt,
  ShopCartLineItemsBox,
  ShopCatalogSkeleton,
  ShopCatalogToolbar,
  ShopCheckoutCartSummary,
  ShopDeliveryPicker,
  ShopEmptyCategory,
  ShopFlowHeader,
  ShopLineItemsList,
  ShopOrderEmailNotice,
  ShopPanel,
  ShopProductCard,
  ShopSavingButton,
  ShopCartActionBar,
  ShopSummaryCard,
  type ShopStep,
} from "@/components/groobey/groobey-shop-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, InlineFeedback } from "@/components/groobey/workspace-ui";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { allocateCustomerOrderBillNumber, asBillRpcClient } from "@/lib/groobey-bill-id";
import { GROOBEY_APP_NAME } from "@/lib/groobey-brand";
import {
  customerProfileSnapshot,
  isCustomerProfileComplete,
  saveCustomerProfile,
} from "@/lib/groobey-customer-profile";
import { isValidCustomerMobile } from "@/lib/groobey-delivery-order-fields";
import { customerOrderBillEmailOrderBill, printCustomerOrderBill } from "@/lib/groobey-dual-bill";
import { getBillEmailDeliveryInfo, sendCustomerBillEmail } from "@/lib/tldGroobey.functions";
import { ensureMyShopSlug } from "@/lib/groobey-ensure-shop-slug";
import {
  filterProductsByHomeCategory,
  isValidHomeCategoryId,
} from "@/lib/groobey-home-category-filter";
import { HOME_CATEGORIES } from "@/lib/groobey-home-categories";
import {
  type GroceryCartLine,
  groceryCartRetailTotal,
  groceryCartSummaryText,
} from "@/lib/groobey-grocery-cart";
import {
  clearGuestShopCart,
  loadGuestShopCart,
  saveGuestShopCart,
  shopLoginHref,
  shopProfileEditHref,
  shopSignupHref,
} from "@/lib/groobey-guest-shop-cart";
import { defaultQuantityForProduct } from "@/lib/groobey-product-catalog";
import { flyProductToCart } from "@/lib/groobey-shop-fly-to-cart";
import { clampMarginPercent, schemaSetupHint, tradeAmountFromRetail } from "@/lib/groobey-trade-margin";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type CustomerOrder = Database["public"]["Tables"]["customer_orders"]["Row"];
type Shop = Database["public"]["Tables"]["shops"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export function CustomerShopDashboard({
  initialCategoryId = null,
  resumeCheckout = false,
}: {
  initialCategoryId?: string | null;
  resumeCheckout?: boolean;
}) {
  const ensureSlug = useServerFn(ensureMyShopSlug);
  const sendOrderEmail = useServerFn(sendCustomerBillEmail);
  const getEmailInfo = useServerFn(getBillEmailDeliveryInfo);
  const navigate = useNavigate();
  const shopPath = useRouterState({
    select: (state) => {
      const pathname = state.location.pathname;
      if (pathname.startsWith("/my/")) return pathname;
      return "/shop";
    },
  });

  const [session, setSession] =
    useState<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formResetNonce, setFormResetNonce] = useState(0);
  const [cartLines, setCartLines] = useState<GroceryCartLine[]>([]);
  const [alert, setAlert] = useState<{ error?: string; notice?: string }>({});
  const [emailNotice, setEmailNotice] = useState<{
    billNumber: string;
    customerEmail: string;
    fromAddress: string;
    fromHeader: string;
  } | null>(null);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<CustomerOrder | null>(null);
  const [activeCategory, setActiveCategory] = useState(
    isValidHomeCategoryId(initialCategoryId) ? initialCategoryId : "all",
  );
  const [step, setStep] = useState<ShopStep>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const cartFlyTargetRef = useRef<HTMLDivElement>(null);

  const isSignedIn = Boolean(session?.user);
  const profileReady = isCustomerProfileComplete(profile, session?.user?.email);
  const profileSnap = customerProfileSnapshot(profile, session?.user?.email);

  useEffect(() => {
    if (isValidHomeCategoryId(initialCategoryId)) {
      setActiveCategory(initialCategoryId);
    }
  }, [initialCategoryId]);

  useEffect(() => {
    const saved = loadGuestShopCart();
    if (saved?.lines.length) {
      setCartLines(saved.lines);
    }
    if (saved?.category && isValidHomeCategoryId(saved.category)) {
      setActiveCategory(saved.category);
    }
    if (resumeCheckout && saved?.lines.length) {
      setStep("checkout");
    } else if (saved?.step && saved.lines.length) {
      setStep(saved.step);
    }
    setCartHydrated(true);
  }, [resumeCheckout]);

  useEffect(() => {
    if (!cartHydrated) return;
    saveGuestShopCart({
      lines: cartLines,
      step,
      category: activeCategory,
    });
  }, [cartLines, step, activeCategory, cartHydrated]);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;

    if (!user) {
      const [prod, shopRows] = await Promise.all([
        supabase.from("products").select("*").eq("is_active", true).order("name"),
        supabase.from("shops").select("*").eq("is_active", true).order("name"),
      ]);
      setSession(null);
      setProfile(null);
      setProducts(prod.data ?? []);
      setShops(shopRows.data ?? []);
      setLoading(false);
      return;
    }

    setSession(sess.session);
    if (sess.session?.access_token) {
      try {
        await ensureSlug({ data: { requesterToken: sess.session.access_token } });
      } catch {
        /* slug is best-effort */
      }
    }

    const [prof, prod, shopRows] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("shops").select("*").eq("is_active", true).order("name"),
    ]);

    setProfile((prof.data as Profile | null) ?? null);
    setProducts(prod.data ?? []);
    setShops(shopRows.data ?? []);
    setLoading(false);
  }, [ensureSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => listener.subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    if (!resumeCheckout || !isSignedIn || cartLines.length === 0) return;
    setStep("checkout");
  }, [resumeCheckout, isSignedIn, cartLines.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    if (!emailNotice) return;
    const timer = window.setTimeout(() => setEmailNotice(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [emailNotice]);

  const activeCategoryMeta = useMemo(() => {
    if (activeCategory === "all") return { id: "all", label: "All categories", subtitle: "" };
    return HOME_CATEGORIES.find((cat) => cat.id === activeCategory) ?? HOME_CATEGORIES[0];
  }, [activeCategory]);

  const visibleProducts = useMemo(() => {
    const categoryId = activeCategory === "all" ? null : activeCategory;
    let list = filterProductsByHomeCategory(products, categoryId);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((product) => product.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, searchQuery]);
  const cartTotal = useMemo(
    () => groceryCartRetailTotal(cartLines, products),
    [cartLines, products],
  );
  const orderItemsText = useMemo(
    () => groceryCartSummaryText(cartLines, products),
    [cartLines, products],
  );
  const cartCount = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantity, 0),
    [cartLines],
  );

  const displayName =
    isSignedIn ?
      profile?.display_name?.trim() || session?.user?.email?.split("@")[0] || "there"
    : "Shop";
  const authOptions = { checkout: true, category: activeCategory };
  const loginHref = shopLoginHref(authOptions);
  const signupHref = shopSignupHref(authOptions);
  const profileEditHref = shopProfileEditHref(authOptions);

  function selectCategory(categoryId: string) {
    setActiveCategory(categoryId);
    if (categoryId === "all") {
      void navigate({ to: shopPath, search: {}, replace: true });
      return;
    }
    void navigate({
      to: shopPath,
      search: { category: categoryId },
      replace: true,
    });
  }

  function goToStep(next: ShopStep) {
    if (!isSignedIn && next === "checkout") {
      saveGuestShopCart({ lines: cartLines, step: "checkout", category: activeCategory });
      setStep("checkout");
      return;
    }
    setStep(next);
  }

  function triggerFlyToCart(sourceEl: HTMLElement) {
    const target = cartFlyTargetRef.current;
    if (!target) return;
    flyProductToCart(sourceEl, target);
    setCartBump(true);
    window.setTimeout(() => setCartBump(false), 420);
  }

  function addToCart(productId: string, sourceEl?: HTMLElement) {
    const product = products.find((p) => p.id === productId);
    const qty = product ? defaultQuantityForProduct(product) : 1;
    setCartLines((lines) => {
      const idx = lines.findIndex((row) => row.productId === productId);
      if (idx === -1) return [...lines, { productId, quantity: qty }];
      const next = [...lines];
      next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
      return next;
    });
    setAlert({});
    if (sourceEl) triggerFlyToCart(sourceEl);
  }

  function updateQty(productId: string, delta: number, sourceEl?: HTMLElement) {
    if (delta > 0 && sourceEl) triggerFlyToCart(sourceEl);
    setCartLines((lines) =>
      lines
        .map((line) =>
          line.productId === productId ?
            { ...line, quantity: Math.max(0, line.quantity + delta) }
          : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  const lineItems = useMemo(
    () =>
      cartLines
        .map((line) => {
          const product = products.find((p) => p.id === line.productId);
          if (!product) return null;
          return {
            key: line.productId,
            name: product.name,
            unitPrice: product.price,
            unit: product.unit,
            quantity: line.quantity,
            onUpdateQty: (delta: number, sourceEl?: HTMLElement) =>
              updateQty(line.productId, delta, sourceEl),
          };
        })
        .filter(Boolean) as React.ComponentProps<typeof ShopLineItemsList>["items"],
    [cartLines, products],
  );

  function viewOrderBill(order: CustomerOrder) {
    const shopName = shops.find((s) => s.id === order.shop_id)?.name ?? null;
    printCustomerOrderBill({
      kind: "customer",
      order,
      shopName,
      orderTakerLabel: "Online order",
    });
  }

  async function handlePlaceOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.user) return;

    setSaving(true);
    setAlert({});
    const form = new FormData(event.currentTarget);
    const notes = String(form.get("notes") || "").trim();

    let snap = customerProfileSnapshot(profile, session.user.email);

    if (isCustomerProfileComplete(profile, session.user.email)) {
      const deliveryMode = String(form.get("deliveryMode") || "saved");
      if (deliveryMode === "alternate") {
        const customerName = String(form.get("customerName") || "").trim();
        const customerPhone = String(form.get("customerPhone") || "").trim();
        const customerAddress = String(form.get("customerAddress") || "").trim();
        const customerEmail = String(form.get("customerEmail") || snap.email).trim();

        if (!customerName || !customerPhone || !customerAddress) {
          setSaving(false);
          setAlert({
            error: "Enter recipient name, mobile, and full address for this delivery.",
          });
          return;
        }
        if (!isValidCustomerMobile(customerPhone)) {
          setSaving(false);
          setAlert({ error: "Enter a valid 10-digit mobile number for delivery contact." });
          return;
        }

        snap = {
          name: customerName,
          email: customerEmail || snap.email,
          phone: customerPhone,
          address: customerAddress,
        };
      }
    } else {
      const customerName = String(form.get("customerName") || snap.name).trim();
      const customerEmail = String(form.get("customerEmail") || snap.email).trim();
      const customerPhone = String(form.get("customerPhone") || snap.phone).trim();
      const customerAddress = String(form.get("customerAddress") || snap.address).trim();

      if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
        setSaving(false);
        setAlert({ error: "Name, email, mobile, and address are required to deliver your order." });
        return;
      }
      if (!isValidCustomerMobile(customerPhone)) {
        setSaving(false);
        setAlert({ error: "Enter a valid 10-digit mobile number." });
        return;
      }

      const { error: profileErr } = await saveCustomerProfile(supabase, {
        displayName: customerName,
        email: customerEmail,
        phone: customerPhone,
        defaultAddress: customerAddress,
      });
      if (profileErr) {
        setSaving(false);
        setAlert({ error: profileErr.message });
        return;
      }

      snap = {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        address: customerAddress,
      };
    }

    if (!orderItemsText) {
      setSaving(false);
      setAlert({ error: "Add at least one item to your cart." });
      return;
    }

    const resolvedShopId = shops[0]?.id ?? "";
    const shopName = shops.find((s) => s.id === resolvedShopId)?.name ?? null;
    const grocery = Math.max(0, cartTotal);
    const deliveryCharge = 0;
    const retail = grocery;
    const marginPct = clampMarginPercent(
      Number(shops.find((s) => s.id === resolvedShopId)?.trade_margin_percent ?? 0),
    );
    const trade = tradeAmountFromRetail(grocery, marginPct);

    const { billNo, error: rpcErr } = await allocateCustomerOrderBillNumber(asBillRpcClient(supabase));
    if (rpcErr || !billNo) {
      setSaving(false);
      setAlert({ error: schemaSetupHint(rpcErr?.message ?? "") ?? "Could not assign bill number." });
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("customer_orders")
      .insert({
        created_by: session.user.id,
        customer_name: snap.name,
        customer_phone: snap.phone,
        delivery_address: snap.address,
        order_items: orderItemsText,
        grocery_subtotal: grocery,
        delivery_charge: deliveryCharge,
        delivery_destination: "shop",
        work_from_shop_id: resolvedShopId || null,
        shop_id: resolvedShopId || null,
        items_delivered_text: orderItemsText,
        delivery_time_slot: null,
        total_amount: retail,
        merchant_settlement_amount: trade,
        trade_margin_percent_applied: marginPct,
        bill_number: billNo,
        notes: notes || (snap.email ? `customer_email=${snap.email}` : null),
        status: "pending",
      } as never)
      .select("*")
      .single();

    if (insertError || !inserted) {
      setSaving(false);
      setAlert({ error: insertError?.message ?? "Could not place order." });
      return;
    }

    let emailSent = false;
    if (session.access_token && snap.email.includes("@")) {
      try {
        const info = await getEmailInfo({ data: { requesterToken: session.access_token } });
        await sendOrderEmail({
          data: {
            requesterToken: session.access_token,
            orderId: inserted.id,
            customerEmail: snap.email,
            subject: `Order confirmed — Bill ${billNo} — ${GROOBEY_APP_NAME}`,
            shopName: GROOBEY_APP_NAME,
            ownerName: "Online order",
            billDate: (inserted.created_at || new Date().toISOString()).slice(0, 16),
            billKind: "customer",
            billNumber: billNo,
            orderBill: customerOrderBillEmailOrderBill(inserted, shopName),
          },
        });
        emailSent = true;
        setEmailNotice({
          billNumber: billNo,
          customerEmail: snap.email,
          fromAddress: info.fromAddress,
          fromHeader: info.fromHeader,
        });
      } catch {
        /* order stands; email is best-effort */
      }
    }

    clearGuestShopCart();
    setCartLines([]);
    setFormResetNonce((n) => n + 1);
    setStep("browse");
    setSaving(false);
    setLastPlacedOrder(inserted);
    printCustomerOrderBill({
      kind: "customer",
      order: inserted,
      shopName,
      orderTakerLabel: "Online order",
    });
    setAlert({
      notice:
        emailSent ?
          `Order placed — Bill ${billNo}, total ₹${Math.round(retail)}.`
        : `Order placed — Bill ${billNo}, total ₹${Math.round(retail)}. Bill email could not be sent — use View bill below.`,
    });
    void load();
  }

  const canCheckout = step === "checkout" && isSignedIn && cartCount > 0;
  const showCartBar = cartCount > 0 && !loading;
  const cartBarLabel =
    step === "checkout" ?
      canCheckout ? "Place order"
      : "Sign in to order"
    : step === "cart" ? "Checkout"
    : "View cart";

  return (
    <GroobeyMemberChrome className="groobey-shop-page pb-10">
      <div className="groobey-shop-wrap">
        {step === "browse" ?
          <header className="groobey-shop-topbar groobey-shop-topbar--compact">
            <h1 className="groobey-shop-topbar-title">
              {isSignedIn ? displayName : "Shop"}
            </h1>
            <div className="groobey-shop-topbar-actions">
              {cartCount > 0 ?
                <button
                  type="button"
                  className="groobey-shop-topbar-cart"
                  onClick={() => goToStep("cart")}
                  aria-label={`Open cart, ${cartCount} items`}
                >
                  <ShoppingCart className="size-4" aria-hidden />
                  <span className="groobey-shop-topbar-cart-badge">{cartCount}</span>
                </button>
              : null}
              {isSignedIn ?
                <Link to="/profile" className="groobey-shop-profile-link">
                  <UserRound className="size-4" />
                  <span className="groobey-shop-profile-link-text">Profile</span>
                </Link>
              : null}
            </div>
          </header>
        : <ShopFlowHeader
            title={step === "cart" ? "Your cart" : "Checkout"}
            backLabel={step === "checkout" ? "Cart" : "Shop"}
            onBack={() => goToStep(step === "checkout" ? "cart" : "browse")}
          />
        }

        {showCartBar ?
          <ShopCartActionBar
            cartCount={cartCount}
            subtotal={cartTotal}
            label={cartBarLabel}
            formId={canCheckout ? "groobey-shop-checkout-form" : undefined}
            actionType={canCheckout ? "submit" : "button"}
            saving={canCheckout ? saving : false}
            disabled={step === "checkout" && !isSignedIn}
            flyTargetRef={cartFlyTargetRef}
            bumped={cartBump}
            onAction={
              step === "browse" ? () => goToStep("cart")
              : step === "cart" ? () => goToStep("checkout")
              : !isSignedIn ? () => goToStep("checkout")
              : undefined
            }
          />
        : null}

        <InlineFeedback {...alert} />

        {emailNotice ?
          <ShopOrderEmailNotice
            billNumber={emailNotice.billNumber}
            customerEmail={emailNotice.customerEmail}
            fromAddress={emailNotice.fromAddress}
            fromHeader={emailNotice.fromHeader}
            onDismiss={() => setEmailNotice(null)}
            onViewBill={
              lastPlacedOrder ?
                () => viewOrderBill(lastPlacedOrder)
              : undefined
            }
          />
        : null}

        {loading ?
          <ShopCatalogSkeleton />
        : <>
            {step === "browse" ?
              <section className="groobey-shop-browse">
                <ShopCatalogToolbar
                  categories={HOME_CATEGORIES}
                  activeId={activeCategory}
                  onCategoryChange={selectCategory}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  resultCount={visibleProducts.length}
                />

                <div className="groobey-shop-catalog-head groobey-shop-catalog-head--browse">
                  <h2 className="groobey-shop-catalog-title">{activeCategoryMeta.label}</h2>
                  {activeCategoryMeta.subtitle ?
                    <p className="groobey-shop-catalog-sub">{activeCategoryMeta.subtitle}</p>
                  : null}
                </div>

                {visibleProducts.length === 0 ?
                  <ShopEmptyCategory
                    categoryLabel={
                      searchQuery.trim() ?
                        `“${searchQuery.trim()}”`
                      : activeCategoryMeta.label
                    }
                  />
                : <div className="groobey-shop-product-catalog">
                    {visibleProducts.map((product) => {
                      const inCart = cartLines.find((l) => l.productId === product.id);
                      return (
                        <ShopProductCard
                          key={product.id}
                          product={product}
                          quantity={inCart?.quantity ?? 0}
                          onAdd={(sourceEl) => addToCart(product.id, sourceEl)}
                          onUpdateQty={(delta, sourceEl) => updateQty(product.id, delta, sourceEl)}
                        />
                      );
                    })}
                  </div>
                }

              </section>
            : null}

            {step === "cart" ?
              <div className="groobey-shop-two-col groobey-shop-two-col--cart">
                <ShopPanel>
                  {cartLines.length === 0 ?
                    <div className="groobey-shop-cart-empty">
                      <p>Your cart is empty.</p>
                      <Button
                        type="button"
                        variant="groobey"
                        className="rounded-xl"
                        onClick={() => goToStep("browse")}
                      >
                        Browse items
                      </Button>
                    </div>
                  : <div className="groobey-shop-cart-stage">
                      <ShopCartLineItemsBox items={lineItems} />
                      <div className="groobey-shop-cart-actions">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => goToStep("browse")}
                        >
                          Add more items
                        </Button>
                        <Button
                          type="button"
                          variant="groobey"
                          className="groobey-shop-summary-cta groobey-shop-cart-actions-checkout rounded-xl"
                          onClick={() => goToStep("checkout")}
                        >
                          Continue to checkout
                        </Button>
                      </div>
                    </div>
                  }
                </ShopPanel>

                {cartLines.length > 0 ?
                  <ShopSummaryCard
                    cartCount={cartCount}
                    subtotal={cartTotal}
                    lineItems={lineItems}
                    compact
                    showSidebarItems
                  >
                    <Button
                      type="button"
                      variant="groobey"
                      className="groobey-shop-summary-cta mt-4 w-full rounded-xl"
                      onClick={() => goToStep("checkout")}
                    >
                      Continue to checkout
                    </Button>
                  </ShopSummaryCard>
                : null}
              </div>
            : null}

            {step === "checkout" && cartCount > 0 ?
              <div className="groobey-shop-two-col groobey-shop-two-col--checkout">
                {!isSignedIn ?
                  <ShopPanel title="Checkout">
                    <ShopAuthPrompt loginHref={loginHref} signupHref={signupHref} />
                  </ShopPanel>
                : <ShopPanel>
                    <form
                      id="groobey-shop-checkout-form"
                      className="groobey-shop-checkout-form"
                      onSubmit={handlePlaceOrder}
                      key={formResetNonce}
                    >
                      <div className="groobey-shop-checkout-items-mobile">
                        <ShopCartLineItemsBox
                          items={lineItems}
                          title="Order items"
                          readOnly
                        />
                      </div>
                      {profileReady ?
                        <ShopDeliveryPicker
                          name={profileSnap.name}
                          phone={profileSnap.phone}
                          email={profileSnap.email}
                          address={profileSnap.address}
                          editHref={profileEditHref}
                        />
                      : <>
                          <p className="groobey-shop-profile-prompt">
                            Confirm your delivery details once — saved for next time.
                          </p>
                          <Field
                            name="customerName"
                            label="Your name"
                            required
                            defaultValue={profileSnap.name}
                          />
                          <Field
                            name="customerEmail"
                            label="Email"
                            type="email"
                            required
                            defaultValue={profileSnap.email}
                          />
                          <Field
                            name="customerPhone"
                            label="Mobile number"
                            type="tel"
                            required
                            defaultValue={profileSnap.phone}
                          />
                          <Field
                            name="customerAddress"
                            label="Delivery address"
                            required
                            defaultValue={profileSnap.address}
                          />
                        </>
                      }
                      <ShopCheckoutCartSummary
                        cartCount={cartCount}
                        subtotal={cartTotal}
                        onEditCart={() => goToStep("cart")}
                      />
                      <Field name="notes" label="Order note (optional)" />
                      <div className="groobey-shop-checkout-actions">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => goToStep("cart")}
                        >
                          Back to cart
                        </Button>
                        <ShopSavingButton
                          saving={saving}
                          label="Place order"
                          className="min-h-11 flex-1 rounded-xl sm:flex-none"
                        />
                      </div>
                    </form>
                  </ShopPanel>
                }

                <ShopSummaryCard
                  cartCount={cartCount}
                  subtotal={cartTotal}
                  lineItems={lineItems}
                  compact
                  showSidebarItems
                >
                  {canCheckout ?
                    <ShopSavingButton
                      saving={saving}
                      label="Place order"
                      formId="groobey-shop-checkout-form"
                      className="groobey-shop-summary-cta mt-4 w-full rounded-xl"
                    />
                  : null}
                </ShopSummaryCard>
              </div>
            : null}

          </>
        }
      </div>

    </GroobeyMemberChrome>
  );
}
