// Per-store wishlist kept in localStorage.

export type WishlistItem = {
  productId: string;
  name: string;
  price: number;
  image: string | null;
};

const key = (slug: string) => `wishlist:${slug}`;

export function readWishlist(slug: string): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

export function writeWishlist(slug: string, items: WishlistItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(slug), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("wishlist-changed", { detail: { slug } }));
}

export function toggleWishlist(slug: string, item: WishlistItem): boolean {
  const items = readWishlist(slug);
  const idx = items.findIndex((i) => i.productId === item.productId);
  if (idx >= 0) {
    items.splice(idx, 1);
    writeWishlist(slug, items);
    return false;
  }
  items.push(item);
  writeWishlist(slug, items);
  return true;
}

export function isInWishlist(slug: string, productId: string): boolean {
  return readWishlist(slug).some((i) => i.productId === productId);
}

export function wishlistCount(slug: string): number {
  return readWishlist(slug).length;
}
