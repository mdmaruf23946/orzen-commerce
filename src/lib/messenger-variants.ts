// Step-by-step variant picker for the Messenger "Buy Now" flow (client/server safe).
// Option order follows the product's own option list (e.g. Color, then Size).

export type VariantOption = { name: string; values: string[] };
export type VariantItem = { options: Record<string, string>; price: number | null; stock: number | null };

export function parseVariants(raw: any): { options: VariantOption[]; items: VariantItem[] } {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const options: VariantOption[] = (Array.isArray(src.options) ? src.options : [])
    .map((o: any) => ({
      name: String(o?.name ?? "").trim(),
      values: (Array.isArray(o?.values) ? o.values : []).map((v: any) => String(v).trim()).filter(Boolean),
    }))
    .filter((o: VariantOption) => o.name && o.values.length);
  const items: VariantItem[] = (Array.isArray(src.items) ? src.items : []).map((i: any) => ({
    options: (i?.options && typeof i.options === "object" ? i.options : {}) as Record<string, string>,
    price: i?.price == null || i.price === "" ? null : Number(i.price),
    stock: i?.stock == null || i.stock === "" ? null : Number(i.stock),
  }));
  return { options, items };
}

function matches(item: VariantItem, sel: Record<string, string>) {
  return Object.entries(sel).every(([k, v]) => String(item.options?.[k] ?? "") === v);
}

/** Next option still to choose, with only values that are in stock for the current picks. */
export function nextVariantStep(raw: any, sel: Record<string, string>) {
  const { options, items } = parseVariants(raw);
  const opt = options.find((o) => !sel[o.name]);
  if (!opt) return null;
  const values = opt.values.filter((v) => {
    if (!items.length) return true;
    const pool = items.filter((i) => matches(i, { ...sel, [opt.name]: v }));
    if (!pool.length) return false;
    return pool.some((i) => i.stock == null || i.stock > 0);
  });
  return { name: opt.name, values };
}

/** The exact variant row for a complete selection (price/stock override). */
export function selectedVariant(raw: any, sel: Record<string, string>) {
  const { items } = parseVariants(raw);
  return items.find((i) => matches(i, sel)) ?? null;
}

export function variantLabel(sel: Record<string, string> | null | undefined) {
  return Object.entries(sel ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ");
}

const BN: Record<string, string> = { color: "কালার", colour: "কালার", size: "সাইজ" };
export function optionLabelBn(name: string) {
  return BN[name.toLowerCase()] ?? name;
}

export function variantPayload(productId: string, name: string, value: string) {
  return `VAR|${productId}|${encodeURIComponent(name)}|${encodeURIComponent(value)}`;
}

export function parseVariantPayload(p: string) {
  const m = /^VAR\|([0-9a-f-]{36})\|([^|]+)\|([^|]+)$/i.exec(p);
  if (!m) return null;
  try {
    return { productId: m[1], name: decodeURIComponent(m[2]), value: decodeURIComponent(m[3]) };
  } catch {
    return null;
  }
}
