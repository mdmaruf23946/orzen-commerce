// Landing page offer model.
//
// One landing page sells ONE main product, optionally combined with secondary
// products from the merchant's own catalog. The offer describes *intent only*
// — what is included and how it is priced. Real prices always come from the
// product rows, both in the merchant UI and on the server at order time, so
// the displayed price and the charged price can never diverge.

export const OFFER_TYPES = [
  { id: "single", name: "Single Product", desc: "One product, one price." },
  { id: "addon", name: "Main + Add-ons", desc: "Main product with optional extra products." },
  { id: "combo", name: "Combo / Bundle", desc: "Several products sold together at a bundle price." },
  { id: "quantity", name: "Buy 1 / 2 / 3", desc: "Same product in different quantities, cheaper per unit." },
  { id: "bxgy", name: "Buy X Get Y", desc: "Buy a quantity, get another product free." },
  { id: "discount", name: "Quantity Discount", desc: "Bigger quantity, bigger percentage off." },
  { id: "tiered", name: "Tiered Pricing", desc: "Good / Better / Best packages." },
  { id: "upsell", name: "Upsell / Cross-sell", desc: "Main product with a recommended upgrade." },
  { id: "choose", name: "Choose Your Bundle", desc: "Customer picks the combination they want." },
  { id: "premium", name: "Premium Package", desc: "Standard vs premium upgrade package." },
] as const;

export type OfferType = (typeof OFFER_TYPES)[number]["id"];

export const OFFER_TYPES_WITH_SECONDARY: OfferType[] = [
  "addon",
  "combo",
  "bxgy",
  "tiered",
  "upsell",
  "choose",
  "premium",
];

export type OfferRole = "addon" | "gift" | "upgrade";

/** A secondary product picked from the store catalog. */
export type OfferProduct = {
  productId: string;
  name: string;
  price: number;
  image: string;
  role: OfferRole;
};

export type OfferPricingMode = "fixed" | "percent" | "amount" | "none";

/** One purchasable option shown to the buyer. */
export type OfferTier = {
  id: string;
  label: string;
  badge: string;
  /** Quantity of the MAIN product in this tier. */
  quantity: number;
  /** Secondary products included in this tier. */
  items: { productId: string; qty: number; free: boolean }[];
  pricingMode: OfferPricingMode;
  /** Fixed price, percentage off, or amount off — depending on pricingMode. */
  value: number;
  featured: boolean;
};

export type LandingOffer = {
  enabled: boolean;
  type: OfferType;
  title: string;
  subtitle: string;
  /** Secondary products available to this offer. */
  products: OfferProduct[];
  tiers: OfferTier[];
};

export type OfferPrice = {
  tierId: string;
  label: string;
  badge: string;
  quantity: number;
  /** Undiscounted value of everything included. */
  original: number;
  /** What the buyer actually pays for the goods (delivery excluded). */
  price: number;
  savings: number;
  savingsPct: number;
  featured: boolean;
  /** Everything in the basket, main product first. */
  lines: { productId: string; name: string; qty: number; unitPrice: number; free: boolean }[];
};

export function emptyOffer(): LandingOffer {
  return { enabled: false, type: "single", title: "", subtitle: "", products: [], tiers: [] };
}

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max);

export function normalizeOffer(raw: unknown): LandingOffer {
  const o = (raw ?? {}) as Record<string, unknown>;
  const type = (OFFER_TYPES.find((t) => t.id === o["type"])?.id ?? "single") as OfferType;
  const products: OfferProduct[] = Array.isArray(o["products"])
    ? (o["products"] as unknown[])
        .map((p) => {
          const r = (p ?? {}) as Record<string, unknown>;
          const role = (["addon", "gift", "upgrade"] as const).includes(r["role"] as OfferRole)
            ? (r["role"] as OfferRole)
            : "addon";
          return {
            productId: str(r["productId"], 40),
            name: str(r["name"], 120),
            price: Math.max(0, num(r["price"])),
            image: str(r["image"], 500),
            role,
          };
        })
        .filter((p) => p.productId)
        .slice(0, 12)
    : [];

  const tiers: OfferTier[] = Array.isArray(o["tiers"])
    ? (o["tiers"] as unknown[])
        .map((t, i) => {
          const r = (t ?? {}) as Record<string, unknown>;
          const mode = (["fixed", "percent", "amount", "none"] as const).includes(
            r["pricingMode"] as OfferPricingMode,
          )
            ? (r["pricingMode"] as OfferPricingMode)
            : "none";
          return {
            id: str(r["id"], 40) || `tier-${i + 1}`,
            label: str(r["label"], 60),
            badge: str(r["badge"], 40),
            quantity: Math.min(50, Math.max(1, Math.round(num(r["quantity"], 1)))),
            items: Array.isArray(r["items"])
              ? (r["items"] as unknown[])
                  .map((it) => {
                    const x = (it ?? {}) as Record<string, unknown>;
                    return {
                      productId: str(x["productId"], 40),
                      qty: Math.min(50, Math.max(1, Math.round(num(x["qty"], 1)))),
                      free: Boolean(x["free"]),
                    };
                  })
                  .filter((it) => it.productId)
                  .slice(0, 12)
              : [],
            pricingMode: mode,
            value: Math.max(0, num(r["value"])),
            featured: Boolean(r["featured"]),
          };
        })
        .slice(0, 8)
    : [];

  return {
    enabled: Boolean(o["enabled"]) && tiers.length > 0,
    type,
    title: str(o["title"], 80),
    subtitle: str(o["subtitle"], 200),
    products,
    tiers,
  };
}

export function newTier(index: number, quantity = index + 1): OfferTier {
  return {
    id: `tier-${Date.now().toString(36)}-${index}`,
    label: "",
    badge: "",
    quantity,
    items: [],
    pricingMode: "none",
    value: 0,
    featured: index === 1,
  };
}

/** Default tiers proposed for an offer type — the merchant edits them after. */
export function defaultTiers(type: OfferType): OfferTier[] {
  if (type === "quantity" || type === "discount") {
    return [0, 1, 2].map((i) => newTier(i, i + 1));
  }
  if (type === "tiered" || type === "premium") {
    return [0, 1].map((i) => newTier(i, 1));
  }
  return [newTier(0, 1)];
}

export type PriceBook = {
  main: { productId: string; name: string; price: number };
  /** productId → { name, price } for every secondary product. */
  others: Record<string, { name: string; price: number }>;
};

/** Pure pricing calculator — the single source of truth for every surface. */
export function computeTierPrice(tier: OfferTier, book: PriceBook): OfferPrice {
  const lines: OfferPrice["lines"] = [
    {
      productId: book.main.productId,
      name: book.main.name,
      qty: tier.quantity,
      unitPrice: book.main.price,
      free: false,
    },
  ];

  for (const it of tier.items) {
    const p = book.others[it.productId];
    if (!p) continue;
    lines.push({ productId: it.productId, name: p.name, qty: it.qty, unitPrice: p.price, free: it.free });
  }

  const original = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const payable = lines.reduce((sum, l) => sum + (l.free ? 0 : l.unitPrice * l.qty), 0);

  let price = payable;
  if (tier.pricingMode === "fixed") price = tier.value;
  else if (tier.pricingMode === "percent") price = payable * (1 - Math.min(90, tier.value) / 100);
  else if (tier.pricingMode === "amount") price = payable - tier.value;

  price = Math.max(0, Math.round(price));
  const savings = Math.max(0, Math.round(original - price));

  return {
    tierId: tier.id,
    label: tier.label,
    badge: tier.badge,
    quantity: tier.quantity,
    original: Math.round(original),
    price,
    savings,
    savingsPct: original > 0 ? Math.round((savings / original) * 100) : 0,
    featured: tier.featured,
    lines,
  };
}

export function computeOfferPrices(offer: LandingOffer, book: PriceBook): OfferPrice[] {
  return offer.tiers.map((t) => computeTierPrice(t, book));
}

/** True when the offer can actually be shown to a buyer. */
export function offerIsUsable(offer: LandingOffer | null | undefined): offer is LandingOffer {
  return Boolean(offer?.enabled && offer.tiers.length > 0);
}

export function offerTypeName(type: OfferType): string {
  return OFFER_TYPES.find((t) => t.id === type)?.name ?? "Single Product";
}

/** Human-readable label used when the merchant left one blank. */
export function tierLabel(price: OfferPrice, mainName: string): string {
  if (price.label) return price.label;
  if (price.quantity > 1) return `${price.quantity} × ${mainName}`;
  return mainName;
}
