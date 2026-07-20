// Per-store cart kept in localStorage.

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  qty: number;
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
  const idx = items.findIndex((i) => i.productId === item.productId);
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
