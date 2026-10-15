// Reconcile the locally-stored cart against live product data.
// Prices are snapshotted at add-to-cart time, so before the shopper pays we
// refresh the price, cap quantity at available stock and drop products that
// are gone or unavailable.
import { readCart, writeCart, type CartItem } from "./cart";
import { isStockless } from "./product-stock";

export type LiveProduct = {
  id: string;
  name?: string | null;
  price: number | string | null;
  stock?: number | null;
  status?: string | null;
  product_type?: string | null;
};

export type CartNotice =
  | { kind: "price"; productId: string; name: string; from: number; to: number }
  | { kind: "stock"; productId: string; name: string; to: number }
  | { kind: "removed"; productId: string; name: string };

export function reconcileCartItems(
  items: CartItem[],
  products: LiveProduct[],
): { items: CartItem[]; notices: CartNotice[]; changed: boolean } {
  if (!items.length || !products.length) return { items, notices: [], changed: false };
  const byId = new Map(products.map((p) => [p.id, p]));
  const notices: CartNotice[] = [];
  const next: CartItem[] = [];

  for (const i of items) {
    const p = byId.get(i.productId);
    if (!p) {
      // Product not returned by the live query -> removed or draft.
      notices.push({ kind: "removed", productId: i.productId, name: i.name });
      continue;
    }
    const stockless = isStockless(p.product_type);
    const stock = Number(p.stock ?? 0);
    if (!stockless && stock <= 0) {
      notices.push({ kind: "removed", productId: i.productId, name: p.name ?? i.name });
      continue;
    }
    let item = i;
    const livePrice = Number(p.price ?? i.price);
    if (!(i as any).variantId && Number.isFinite(livePrice) && livePrice !== i.price) {
      notices.push({
        kind: "price",
        productId: i.productId,
        name: p.name ?? i.name,
        from: i.price,
        to: livePrice,
      });
      item = { ...item, price: livePrice };
    }
    if (!stockless && item.qty > stock) {
      notices.push({ kind: "stock", productId: i.productId, name: p.name ?? i.name, to: stock });
      item = { ...item, qty: stock };
    }
    next.push(item);
  }

  return { items: next, notices, changed: notices.length > 0 };
}

/** Reconcile and persist back to localStorage when something changed. */
export function reconcileStoredCart(slug: string, products: LiveProduct[]): CartNotice[] {
  const current = readCart(slug);
  const { items, notices, changed } = reconcileCartItems(current, products);
  if (changed) writeCart(slug, items);
  return notices;
}
