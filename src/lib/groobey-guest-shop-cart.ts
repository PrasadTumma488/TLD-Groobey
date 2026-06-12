import type { ShopStep } from "@/components/groobey/groobey-shop-ui";
import type { GroceryCartLine } from "@/lib/groobey-grocery-cart";

const STORAGE_KEY = "groobey-guest-shop-v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type GuestShopCartState = {
  lines: GroceryCartLine[];
  step?: ShopStep;
  category?: string;
  savedAt: number;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadGuestShopCart(): GuestShopCartState | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestShopCartState;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGuestShopCart(state: {
  lines: GroceryCartLine[];
  step?: ShopStep;
  category?: string;
}) {
  if (!canUseStorage()) return;
  const payload: GuestShopCartState = {
    lines: state.lines,
    step: state.step,
    category: state.category,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearGuestShopCart() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Build /login or /signup URL that returns to shop with cart + checkout preserved. */
export function shopAuthReturnPath(options?: { checkout?: boolean; category?: string }) {
  const params = new URLSearchParams();
  if (options?.category) params.set("category", options.category);
  if (options?.checkout) params.set("checkout", "1");
  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}

export function shopLoginHref(options?: { checkout?: boolean; category?: string }) {
  const returnTo = shopAuthReturnPath(options);
  return `/login?redirect=${encodeURIComponent(returnTo)}`;
}

export function shopSignupHref(options?: { checkout?: boolean; category?: string }) {
  const returnTo = shopAuthReturnPath(options);
  return `/signup?redirect=${encodeURIComponent(returnTo)}`;
}

export function shopProfileEditHref(options?: { checkout?: boolean; category?: string }) {
  const returnTo = shopAuthReturnPath(options);
  return `/profile?redirect=${encodeURIComponent(returnTo)}`;
}

export const CUSTOMER_ORDER_HISTORY_DAYS = 7;

export function safeInternalRedirect(path?: string | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

/** Split an internal path like `/shop?checkout=1` for TanStack Router navigate(). */
export function parseInternalPath(path: string): { pathname: string; search: Record<string, string> } {
  const [pathname, query = ""] = path.split("?");
  const search: Record<string, string> = {};
  new URLSearchParams(query).forEach((value, key) => {
    search[key] = value;
  });
  return { pathname, search };
}
