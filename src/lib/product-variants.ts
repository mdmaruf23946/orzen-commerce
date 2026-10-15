// Shared (browser + server) helpers for reading a product's saved variants.
export type PublicVariant = {
  id: string;
  options: Record<string, string>;
  price?: number | null;
  discount?: number | null;
  stock?: number | null;
  image?: string | null;
  sku?: string | null;
};

export function readVariants(raw: any): { options: { name: string; values: string[] }[]; items: PublicVariant[] } {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.options) || !Array.isArray(raw.items)) {
    return { options: [], items: [] };
  }
  const options = raw.options
    .filter((o: any) => o && typeof o.name === "string" && Array.isArray(o.values) && o.values.length)
    .map((o: any) => ({ name: String(o.name), values: o.values.map(String) }));
  const items = raw.items.filter((i: any) => i && typeof i.id === "string" && i.options && typeof i.options === "object");
  return { options, items };
}

/** Price a customer pays for a variant: offer price, else variant price, else the product price. */
export function variantPrice(v: PublicVariant, productPrice: number): number {
  const d = Number(v.discount);
  if (Number.isFinite(d) && d > 0) return d;
  const p = Number(v.price);
  if (Number.isFinite(p) && p > 0) return p;
  return productPrice;
}

export function variantLabel(v: PublicVariant): string {
  return Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(", ");
}
