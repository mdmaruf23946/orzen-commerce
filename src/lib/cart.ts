// Per-store cart kept in localStorage.

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  qty: number;
  variantId?: string;
  variantLabel?: string;
};

const key = (slug: string) => `cart:${slug}`;

export function readCart(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(slug: string, items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(slug), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cart-changed", { detail: { slug } }));
}

export function addToCart(slug: string, item: CartItem) {
  const items = readCart(slug);
  const idx = items.findIndex((i) => i.productId === item.productId && (i.variantId ?? "") === (item.variantId ?? ""));
  if (idx >= 0) items[idx].qty += item.qty;
  else items.push(item);
  writeCart(slug, items);
  // Fire Meta AddToCart (browser + CAPI)
  import("./fb-track").then(({ fbTrack }) =>
    fbTrack("AddToCart", {
      content_ids: [item.productId],
      content_type: "product",
      contents: [{ id: item.productId, quantity: item.qty, item_price: item.price }],
      value: item.price * item.qty,
      currency: "BDT",
    }),
  ).catch(() => {});
}

export function updateQty(slug: string, productId: string, qty: number) {
  const items = readCart(slug)
    .map((i) => (i.productId === productId ? { ...i, qty } : i))
    .filter((i) => i.qty > 0);
  writeCart(slug, items);
}

export function removeItem(slug: string, productId: string) {
  writeCart(
    slug,
    readCart(slug).filter((i) => i.productId !== productId),
  );
}

export function clearCart(slug: string) {
  writeCart(slug, []);
}

export function cartCount(slug: string): number {
  return readCart(slug).reduce((acc, i) => acc + i.qty, 0);
}

export function cartTotal(slug: string): number {
  return readCart(slug).reduce((acc, i) => acc + i.qty * i.price, 0);
}

// ---- Checkout selection -------------------------------------------------
// Only one product type can be checked out at a time (physical / digital /
// service / subscription). The cart page stores the chosen product ids here
// and the checkout page honours them.

const selKey = (slug: string) => `cart-selection:${slug}`;

export function readSelection(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(selKey(slug));
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function writeSelection(slug: string, ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(selKey(slug), JSON.stringify(ids));
}

export function clearSelection(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(selKey(slug));
}

/** Remove only the checked-out items, keeping the rest of the cart intact. */
export function removeSelected(slug: string, ids: string[]) {
  const keep = readCart(slug).filter((i) => !ids.includes(i.productId));
  writeCart(slug, keep);
  clearSelection(slug);
}

