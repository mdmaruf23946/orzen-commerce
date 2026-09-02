// Shared, client-safe types + defaults for the Landing Page builder.
// A landing page keeps its OWN snapshot of product content; the store product
// is never mutated and never auto-syncs into a page.
//
// The content model is section-based and FIXED:
//   Header → Hero → Product → Description → FAQ → Reviews → Order form → Footer
// Merchants edit text only; the design is owned by the system template.

import { DEFAULT_SECTION_ORDER, REQUIRED_SECTION_KEYS, sectionSpec, sectionRank } from "./landing-sections";

export type LPFeature = { icon: string; title: string; text: string };
export type LPPoint = { title: string; text: string; icon: string };
export type LPBenefit = LPPoint;
export type LPSpec = { label: string; value: string };
export type LPReview = { name: string; location: string; rating: number; text: string; photo: string };
export type LPFaq = { q: string; a: string };
export type LPLink = { label: string; url: string };

export type LandingContent = {
  header: {
    storeName: string;
    buttonText: string;
    showButton: boolean;
    /** Square brand mark for this landing page. "" = none. */
    iconLogo: string;
    /** Wordmark / name logo image for this landing page. "" = none. */
    nameLogo: string;
  };
  hero: {
    headline: string;
    subheadline: string;
    offerText: string;
    ctaText: string;
    /** Chosen from the product's existing images (or uploaded). */
    image: string;
  };
  pricing: { price: number; oldPrice: number | null; note: string };
  product: {
    enabled: boolean;
    title: string;
    subtitle: string;
    showFeatures: boolean;
    showSpecs: boolean;
    /** Snapshot data from the product system. */
    images: string[];
    /** Subset of `images` actually displayed. Empty = show all. */
    selectedImages: string[];
    features: LPFeature[];
    specs: LPSpec[];
  };
  description: {
    enabled: boolean;
    title: string;
    text: string;
    points: LPPoint[];
  };
  faq: { enabled: boolean; title: string; items: LPFaq[] };
  reviews: { enabled: boolean; title: string; items: LPReview[] };
  order: { title: string; subtitle: string; successMessage: string };
  footer: {
    text: string;
    contactText: string;
    copyright: string;
    /** Square brand mark for this landing page. "" = none. */
    iconLogo: string;
    /** Wordmark / name logo image for this landing page. "" = none. */
    nameLogo: string;
    storeName: string;
    phone: string;
    email: string;
    address: string;
    hours: string;
    website?: string;
    facebook: string;
    instagram: string;
    youtube: string;
    tiktok: string;
    whatsapp: string;
    linkedin?: string;
    telegram?: string;
    messenger?: string;
    twitter?: string;
    pinterest?: string;
    snapchat?: string;
    threads?: string;
    links: LPLink[];
  };
  /** Section keys in the order they appear on the published page. */
  sectionOrder: string[];
  /** Optional sections currently in use. Required sections are always on. */
  sectionEnabled: Record<string, boolean>;
  /** Content of the registry-driven (non-builtin) sections. */
  blocks: Record<string, Record<string, any>>;
};


/** Store branding + contact defaults used by the landing page when the merchant leaves a field blank. */
export type LandingStoreInfo = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  name_logo_url?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  business_hours?: string | null;
  trade_license?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
  linkedin?: string | null;
  telegram?: string | null;
  messenger?: string | null;
  twitter?: string | null;
  pinterest?: string | null;
  snapchat?: string | null;
  threads?: string | null;
};

export const SOCIAL_KEYS = [
  "facebook", "instagram", "whatsapp", "youtube", "tiktok", "linkedin",
  "twitter", "telegram", "messenger", "pinterest", "snapchat", "threads",
] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export type LandingTheme = {
  primary: string;
  accent: string;
  dark: boolean;
  rounded: boolean;
  /** Merchant-editable color roles (Design tab). Older pages omit these. */
  secondary?: string;
  background?: string;
  text?: string;
  /** Selected preset identity, so the Design tab can show what is active. */
  themeId?: string;
  themeName?: string;
  /**
   * AI palettes generated once (at page creation). They are stored with the
   * page so the Design tab always shows the same list — never regenerated
   * unless the merchant explicitly asks for it.
   */
  presets?: import("@/lib/landing-theme").LandingThemePreset[];
  presetsAt?: string;
};

export const MAX_KEY_POINTS = 5;

export const FORM_FIELDS = [
  { key: "customer_name", label: "Full name" },
  { key: "phone", label: "Phone number" },
  { key: "address", label: "Address" },
  { key: "area", label: "Area / City" },
  { key: "email", label: "Email" },
  { key: "quantity", label: "Quantity" },
  { key: "note", label: "Order note" },
] as const;

export type FormFieldKey = (typeof FORM_FIELDS)[number]["key"];

/** One selectable delivery area with its own charge. */
export type LandingDeliveryZone = {
  id: string;
  name: string;
  charge: number;
  isDefault?: boolean;
};

export type LandingFormConfig = {
  fields: { key: FormFieldKey; label: string; enabled: boolean; required: boolean }[];
  paymentMethods: string[];
  deliveryCharge: number;
  /** Optional zone-based delivery pricing. Empty = flat `deliveryCharge`. */
  deliveryZones?: LandingDeliveryZone[];
  /** Label shown above the zone selector on the landing page. */
  deliveryZoneLabel?: string;
  buttonText: string;
};

/** Cleans stored zones (drops broken rows, clamps charges, keeps order). */
export function normalizeDeliveryZones(raw: unknown): LandingDeliveryZone[] {
  if (!Array.isArray(raw)) return [];
  const out: LandingDeliveryZone[] = [];
  for (const z of raw) {
    const r = (z ?? {}) as Record<string, unknown>;
    const name = String(r["name"] ?? "").trim().slice(0, 60);
    if (!name) continue;
    out.push({
      id: String(r["id"] ?? name.toLowerCase().replace(/\s+/g, "-")).slice(0, 60),
      name,
      charge: Math.max(0, Math.round(Number(r["charge"]) || 0)),
      isDefault: Boolean(r["isDefault"]),
    });
    if (out.length >= 20) break;
  }
  if (out.length && !out.some((z) => z.isDefault)) out[0]!.isDefault = true;
  return out;
}

/** Charge for a chosen zone, falling back to the default zone / flat charge. */
export function resolveDeliveryCharge(cfg: {
  deliveryCharge?: number;
  deliveryZones?: unknown;
}, zoneId?: string | null): { charge: number; zone: LandingDeliveryZone | null } {
  const zones = normalizeDeliveryZones(cfg.deliveryZones);
  if (!zones.length) return { charge: Math.max(0, Number(cfg.deliveryCharge ?? 0)), zone: null };
  const zone =
    zones.find((z) => z.id === zoneId) ??
    zones.find((z) => z.name === zoneId) ??
    zones.find((z) => z.isDefault) ??
    zones[0]!;
  return { charge: zone.charge, zone };
}


export const PAYMENT_METHODS = ["cod", "bkash", "nagad", "rocket", "bank"] as const;

export const FEATURE_ICONS = [
  "check", "star", "shield", "truck", "zap", "heart", "award", "clock",
  "gift", "thumbs-up", "package", "sparkles",
] as const;

/** Starting design for a new page; merchants refine it in the Design tab. */
export function defaultTheme(): LandingTheme {
  return {
    primary: "#16a34a",
    accent: "#f59e0b",
    dark: false,
    rounded: true,
    secondary: "#0f172a",
    background: "#ffffff",
    text: "#171717",
  };
}

export function defaultFormConfig(): LandingFormConfig {
  return {
    fields: [
      { key: "customer_name", label: "আপনার নাম", enabled: true, required: true },
      { key: "phone", label: "মোবাইল নম্বর", enabled: true, required: true },
      { key: "address", label: "সম্পূর্ণ ঠিকানা", enabled: true, required: true },
      { key: "area", label: "এলাকা / শহর", enabled: true, required: false },
      { key: "email", label: "ইমেইল", enabled: false, required: false },
      { key: "quantity", label: "পরিমাণ", enabled: true, required: false },
      { key: "note", label: "অতিরিক্ত নোট", enabled: false, required: false },
    ],
    paymentMethods: ["cod"],
    deliveryCharge: 0,
    deliveryZones: [],
    deliveryZoneLabel: "ডেলিভারি এলাকা",
    buttonText: "অর্ডার কনফার্ম করুন",
  };
}

export type SourceProduct = {
  id: string;
  name: string;
  price: number;
  old_price: number | null;
  short_description: string | null;
  description: string | null;
  primary_image_url: string | null;
  gallery: unknown;
  features: unknown;
  specifications: unknown;
  warranty: string | null;
  shipping_info: string | null;
  return_policy: string | null;
  delivery_time_days: string | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : typeof v === "object" && v ? String((v as any).url ?? "") : ""))
    .filter(Boolean);
}

function asFeatureList(value: unknown): LPFeature[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v === "string") return { icon: "check", title: v, text: "" };
      if (v && typeof v === "object") {
        const o = v as any;
        return {
          icon: typeof o.icon === "string" ? o.icon : "check",
          title: String(o.title ?? o.name ?? o.label ?? ""),
          text: String(o.text ?? o.value ?? o.description ?? ""),
        };
      }
      return { icon: "check", title: "", text: "" };
    })
    .filter((f) => f.title || f.text)
    .slice(0, 12);
}

function asSpecs(value: unknown): LPSpec[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        const o = (v ?? {}) as any;
        return { label: String(o.label ?? o.key ?? o.name ?? ""), value: String(o.value ?? "") };
      })
      .filter((s) => s.label)
      .slice(0, 20);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([label, v]) => ({ label, value: String(v ?? "") }))
      .slice(0, 20);
  }
  return [];
}

/** Strip HTML down to readable text for the details section. */
function toPlainText(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
}

/** One-time content snapshot generated from a store product. */
export function generateContentFromProduct(p: SourceProduct): LandingContent {
  const gallery = asStringArray(p.gallery);
  const features = asFeatureList(p.features);
  const specs = asSpecs(p.specifications);
  const short = p.short_description?.trim() || toPlainText(p.description).slice(0, 180);

  const points: LPPoint[] = [
    p.warranty ? { title: "ওয়ারেন্টি", text: p.warranty, icon: "shield" } : null,
    p.delivery_time_days ? { title: "দ্রুত ডেলিভারি", text: `${p.delivery_time_days} দিনের মধ্যে ডেলিভারি`, icon: "truck" } : null,
    p.return_policy ? { title: "সহজ রিটার্ন", text: p.return_policy, icon: "package" } : null,
    p.shipping_info ? { title: "শিপিং", text: p.shipping_info, icon: "gift" } : null,
  ].filter(Boolean) as LPPoint[];

  return {
    header: { storeName: "", buttonText: "অর্ডার করুন", showButton: true, iconLogo: "", nameLogo: "" },
    hero: {
      headline: p.name,
      subheadline: short,
      offerText: p.old_price && p.old_price > p.price ? "বিশেষ ছাড়" : "নতুন",
      ctaText: "অর্ডার করুন",
      image: p.primary_image_url ?? gallery[0] ?? "",
    },
    pricing: {
      price: Number(p.price) || 0,
      oldPrice: p.old_price ? Number(p.old_price) : null,
      note: "ক্যাশ অন ডেলিভারি",
    },
    product: {
      enabled: true,
      title: "প্রোডাক্ট ডিটেইলস",
      subtitle: short,
      showFeatures: true,
      showSpecs: true,
      images: gallery.slice(0, 8),
      selectedImages: [],
      features: features.length ? features : [{ icon: "check", title: "উন্নত মান", text: "" }],
      specs,
    },
    description: {
      enabled: true,
      title: "কেন এই প্রোডাক্ট?",
      text: toPlainText(p.description) || short,
      points: points.slice(0, MAX_KEY_POINTS),
    },
    faq: {
      enabled: true,
      title: "সাধারণ প্রশ্ন",
      items: [
        { q: "ডেলিভারিতে কত দিন লাগে?", a: p.delivery_time_days ? `${p.delivery_time_days} দিন` : "২-৩ দিন" },
        { q: "পেমেন্ট কিভাবে করব?", a: "ক্যাশ অন ডেলিভারি — প্রোডাক্ট হাতে পেয়ে টাকা দিন।" },
      ],
    },
    reviews: { enabled: false, title: "কাস্টমার রিভিউ", items: [] },
    order: {
      title: "অর্ডার ফরম",
      subtitle: "নিচের ফরমটি পূরণ করে অর্ডার কনফার্ম করুন।",
      successMessage: "ধন্যবাদ! আপনার অর্ডার গ্রহণ করা হয়েছে। আমরা শীঘ্রই কল করব।",
    },
    footer: {
      text: "", contactText: "", copyright: "", iconLogo: "", nameLogo: "", storeName: "",
      phone: "", email: "", address: "", hours: "",
      facebook: "", instagram: "", youtube: "", tiktok: "", whatsapp: "",
      links: [],
    },
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    sectionEnabled: { product: true, description: true, faq: true, reviews: false },
    blocks: {},
  };
}

/**
 * Accepts any stored content (old multi-section shape or the new one) and
 * returns the canonical 8-section shape. Existing merchant text is preserved.
 */
export function normalizeContent(raw: unknown): LandingContent {
  const c = (raw ?? {}) as any;
  const hero = c.hero ?? {};
  const legacyGallery = c.gallery ?? {};
  const legacyFeatures = c.features ?? {};
  const legacyBenefits = c.benefits ?? {};
  const legacyDetails = c.details ?? {};
  const product = c.product ?? {};
  const description = c.description ?? {};
  const faq = c.faq ?? {};
  const reviews = c.reviews ?? {};
  const order = c.order ?? {};
  const footer = c.footer ?? {};
  const contact = c.contact ?? {};

  const points: LPPoint[] = Array.isArray(description.points)
    ? description.points
    : Array.isArray(legacyBenefits.items)
      ? legacyBenefits.items
      : [];

  const out: LandingContent = {
    header: {
      storeName: String(c.header?.storeName ?? ""),
      buttonText: String(c.header?.buttonText ?? hero.ctaText ?? "অর্ডার করুন"),
      showButton: c.header?.showButton !== false,
      iconLogo: String(c.header?.iconLogo ?? (c.header?.logo && c.header.logo !== "none" ? c.header.logo : "")),
      nameLogo: String(c.header?.nameLogo ?? ""),
    },
    hero: {
      headline: String(hero.headline ?? ""),
      subheadline: String(hero.subheadline ?? ""),
      offerText: String(hero.offerText ?? hero.badge ?? ""),
      ctaText: String(hero.ctaText ?? "অর্ডার করুন"),
      image: String(hero.image ?? ""),
    },
    pricing: {
      price: Number(c.pricing?.price ?? 0),
      oldPrice: c.pricing?.oldPrice != null ? Number(c.pricing.oldPrice) : null,
      note: String(c.pricing?.note ?? ""),
    },
    product: {
      enabled: product.enabled ?? legacyFeatures.enabled ?? true,
      title: String(product.title ?? legacyDetails.title ?? "প্রোডাক্ট ডিটেইলস"),
      subtitle: String(product.subtitle ?? ""),
      showFeatures: product.showFeatures !== false,
      showSpecs: product.showSpecs !== false,
      selectedImages: Array.isArray(product.selectedImages) ? product.selectedImages.map(String) : [],
      images: Array.isArray(product.images)
        ? product.images
        : Array.isArray(legacyGallery.images)
          ? legacyGallery.images
          : [],
      features: Array.isArray(product.features)
        ? product.features
        : Array.isArray(legacyFeatures.items)
          ? legacyFeatures.items
          : [],
      specs: Array.isArray(product.specs)
        ? product.specs
        : Array.isArray(legacyDetails.specs)
          ? legacyDetails.specs
          : [],
    },
    description: {
      enabled: description.enabled ?? legacyDetails.enabled ?? true,
      title: String(description.title ?? legacyBenefits.title ?? "কেন এই প্রোডাক্ট?"),
      text: String(description.text ?? legacyDetails.text ?? ""),
      points: points.slice(0, MAX_KEY_POINTS).map((p: any) => ({
        title: String(p?.title ?? ""),
        text: String(p?.text ?? ""),
        icon: String(p?.icon ?? "check"),
      })),
    },
    faq: {
      enabled: faq.enabled ?? true,
      title: String(faq.title ?? "সাধারণ প্রশ্ন"),
      items: (Array.isArray(faq.items) ? faq.items : []).map((f: any) => ({
        q: String(f?.q ?? ""),
        a: String(f?.a ?? ""),
      })),
    },
    reviews: {
      enabled: reviews.enabled ?? false,
      title: String(reviews.title ?? "কাস্টমার রিভিউ"),
      items: (Array.isArray(reviews.items) ? reviews.items : []).map((r: any) => ({
        name: String(r?.name ?? ""),
        location: String(r?.location ?? ""),
        rating: Number(r?.rating ?? 5),
        text: String(r?.text ?? ""),
        photo: String(r?.photo ?? ""),
      })),
    },
    order: {
      title: String(order.title ?? "অর্ডার ফরম"),
      subtitle: String(order.subtitle ?? order.note ?? ""),
      successMessage: String(order.successMessage ?? "ধন্যবাদ! আপনার অর্ডার গ্রহণ করা হয়েছে।"),
    },
    footer: {
      text: String(footer.text ?? ""),
      contactText: String(footer.contactText ?? contact.title ?? ""),
      copyright: String(footer.copyright ?? ""),
      iconLogo: String(footer.iconLogo ?? (footer.logo && footer.logo !== "none" ? footer.logo : "")),
      nameLogo: String(footer.nameLogo ?? ""),
      storeName: String(footer.storeName ?? ""),
      phone: String(footer.phone ?? contact.phone ?? ""),
      email: String(footer.email ?? contact.email ?? ""),
      address: String(footer.address ?? contact.address ?? ""),
      hours: String(footer.hours ?? contact.hours ?? ""),
      facebook: String(footer.facebook ?? contact.facebook ?? ""),
      instagram: String(footer.instagram ?? contact.instagram ?? ""),
      youtube: String(footer.youtube ?? contact.youtube ?? ""),
      tiktok: String(footer.tiktok ?? contact.tiktok ?? ""),
      whatsapp: String(footer.whatsapp ?? contact.whatsapp ?? ""),
      website: String(footer.website ?? contact.website ?? ""),
      linkedin: String(footer.linkedin ?? contact.linkedin ?? ""),
      telegram: String(footer.telegram ?? contact.telegram ?? ""),
      messenger: String(footer.messenger ?? contact.messenger ?? ""),
      twitter: String(footer.twitter ?? contact.twitter ?? ""),
      pinterest: String(footer.pinterest ?? contact.pinterest ?? ""),
      snapchat: String(footer.snapchat ?? contact.snapchat ?? ""),
      threads: String(footer.threads ?? contact.threads ?? ""),
      links: (Array.isArray(footer.links) ? footer.links : []).map((l: any) => ({
        label: String(l?.label ?? ""),
        url: String(l?.url ?? ""),
      })),
    },
    sectionOrder: [],
    sectionEnabled: {},
    blocks: {},
  };

  // ---- section order / visibility / generic block content ----
  const storedBlocks = (c.blocks && typeof c.blocks === "object" ? c.blocks : {}) as Record<string, any>;
  const blocks: Record<string, Record<string, any>> = {};
  for (const [key, value] of Object.entries(storedBlocks)) {
    if (sectionSpec(key) && value && typeof value === "object") blocks[key] = { ...value };
  }
  out.blocks = blocks;

  const storedEnabled = (c.sectionEnabled && typeof c.sectionEnabled === "object" ? c.sectionEnabled : {}) as Record<string, unknown>;
  const enabled: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(storedEnabled)) {
    if (sectionSpec(key)) enabled[key] = Boolean(value);
  }
  // The four builtin optional sections keep their own flag as the source of truth.
  enabled["product"] = out.product.enabled;
  enabled["description"] = out.description.enabled;
  enabled["faq"] = out.faq.enabled;
  enabled["reviews"] = out.reviews.enabled;
  out.sectionEnabled = enabled;

  const storedOrder: string[] = Array.isArray(c.sectionOrder)
    ? c.sectionOrder.map(String).filter((k: string) => !!sectionSpec(k))
    : [];
  const finalOrder: string[] = [...new Set(storedOrder)];
  for (const key of DEFAULT_SECTION_ORDER) {
    if (finalOrder.includes(key)) continue;
    const at = finalOrder.findIndex((k: string) => sectionRank(k) > sectionRank(key));
    if (at === -1) finalOrder.push(key);
    else finalOrder.splice(at, 0, key);
  }
  out.sectionOrder = finalOrder;
  for (const key of REQUIRED_SECTION_KEYS) out.sectionEnabled[key] = true;

  return out;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Media stored in the app bucket is served through the image proxy. */
export function lpImage(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("http") || value.startsWith("/")) return value;
  return `/api/img/${value}`;
}

export const RESERVED_LP_SLUGS = new Set([
  "www", "api", "admin", "app", "auth", "login", "signup", "dashboard", "store",
  "stores", "cdn", "assets", "static", "img", "images", "mail", "blog", "docs",
  "help", "support", "status", "billing", "pay", "payments", "checkout", "cart",
  "owner", "platform", "orzen", "test", "dev", "staging", "preview", "webhook",
  "webhooks", "lp",
]);
