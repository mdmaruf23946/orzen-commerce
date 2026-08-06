// Global per-store product defaults, applied only when creating a new product.
// Stored on stores.product_defaults (jsonb).

export type ProductTypeKey = "physical" | "digital" | "service" | "subscription";

export type DefaultVisibility = "public" | "draft" | "hidden";
export type DefaultStatus = "active" | "inactive";

export type TypeDefaults = {
  footer: string;
  tags: string;
  visibility: DefaultVisibility;
  status: DefaultStatus;
  /** Physical only */
  warranty?: string;
  return_policy?: string;
};

export type ProductDefaults = {
  per_type: Record<ProductTypeKey, TypeDefaults>;
};

export const PRODUCT_TYPE_KEYS: ProductTypeKey[] = [
  "physical",
  "digital",
  "service",
  "subscription",
];

export const PRODUCT_TYPE_LABELS: Record<ProductTypeKey, string> = {
  physical: "Physical",
  digital: "Digital",
  service: "Service",
  subscription: "Subscription",
};

/** Warranty & return policy defaults only make sense for physical goods. */
export function supportsWarranty(type: ProductTypeKey) {
  return type === "physical";
}

export function emptyTypeDefaults(): TypeDefaults {
  return { footer: "", tags: "", visibility: "public", status: "active" };
}

/**
 * Read-time migration: accepts the legacy flat shape
 * `{ warranty, return_policy, shipping_info }` and returns the nested shape.
 * `shipping_info` is intentionally discarded — shipping lives in its own module.
 */
export function normalizeProductDefaults(raw: any): ProductDefaults {
  const per: any = raw?.per_type ?? {};
  const legacyWarranty = typeof raw?.warranty === "string" ? raw.warranty : "";
  const legacyReturn = typeof raw?.return_policy === "string" ? raw.return_policy : "";

  const out = {} as Record<ProductTypeKey, TypeDefaults>;
  for (const key of PRODUCT_TYPE_KEYS) {
    const b = per[key] ?? {};
    const base: TypeDefaults = {
      footer: typeof b.footer === "string" ? b.footer : "",
      tags: typeof b.tags === "string" ? b.tags : "",
      visibility: (["public", "draft", "hidden"] as const).includes(b.visibility)
        ? b.visibility
        : "public",
      status: b.status === "inactive" ? "inactive" : "active",
    };
    if (supportsWarranty(key)) {
      base.warranty = typeof b.warranty === "string" ? b.warranty : legacyWarranty;
      base.return_policy = typeof b.return_policy === "string" ? b.return_policy : legacyReturn;
    }
    out[key] = base;
  }
  return { per_type: out };
}

export function defaultsForType(raw: any, type: ProductTypeKey): TypeDefaults {
  return normalizeProductDefaults(raw).per_type[type];
}

/** Product status enum value implied by the visibility/status defaults. */
export function resolveDefaultStatus(d: TypeDefaults): "active" | "draft" {
  if (d.status === "inactive") return "draft";
  return d.visibility === "public" ? "active" : "draft";
}

/** Append the description footer to a fresh (empty) description. */
export function applyDescriptionFooter(description: string, footer?: string) {
  const f = (footer ?? "").trim();
  if (!f) return description;
  return description.trim() ? `${description.trim()}\n\n${f}` : f;
}

/** Merge default tags into an SEO keywords string without duplicates. */
export function mergeTags(existing: string | undefined, tags: string | undefined) {
  const list = [...(existing ?? "").split(","), ...(tags ?? "").split(",")]
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of list) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.join(", ");
}
