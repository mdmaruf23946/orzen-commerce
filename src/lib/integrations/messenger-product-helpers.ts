// Product URL/image/identity helpers for Messenger replies. Extracted verbatim.
import { stringifyField } from "@/lib/integrations/messenger-intents";
import { publicOrigin, type ProductRow } from "@/lib/integrations/messenger-types";

export function publicImageUrl(value: string | null | undefined) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/img/")) return `${publicOrigin()}${value}`;
  const clean = value.replace(/^\/+/, "");
  return `${publicOrigin()}/api/img/${clean}`;
}

export function productPageUrl(storeSlug: string | null | undefined, product: ProductRow) {
  const slug = storeSlug || "store";
  return `${publicOrigin()}/store/${slug}/product/${product.id}`;
}

export function firstProductImage(product: ProductRow) {
  if (product.primary_image_url) return publicImageUrl(product.primary_image_url);
  const gallery = Array.isArray(product.gallery) ? product.gallery : [];
  return publicImageUrl(gallery.find(Boolean));
}

export function productImages(product: ProductRow, limit = 4) {
  const values = [product.primary_image_url, ...(Array.isArray(product.gallery) ? product.gallery : [])]
    .map((value) => publicImageUrl(value))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(values)).slice(0, limit);
}

export function productIdentityText(product: ProductRow, categoryName = "") {
  return [
    product.name,
    product.brand,
    categoryName,
    product.sku,
    product.product_code,
    product.short_description,
    product.description,
    stringifyField(product.features),
    stringifyField(product.specifications),
    stringifyField(product.variants),
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 900);
}
