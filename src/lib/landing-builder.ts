// Shared, client-safe types + defaults for the Landing Page builder.
// A landing page keeps its OWN snapshot of product content; the store product
// is never mutated and never auto-syncs into a page.
//
// The content model is section-based and FIXED:
//   Header → Hero → Product → Description → FAQ → Reviews → Order form → Footer
// Merchants edit text only; the design is owned by the system template.

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
    /** "" = use the Store Settings logo, "none" = no logo, otherwise a storage path/URL. */
    logo: string;
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
    /** "" = use the Store Settings logo, "none" = no logo. */
    logo: string;
    storeName: string;
    phone: string;
    email: string;
    address: string;
    hours: string;
    facebook: string;
    instagram: string;
    youtube: string;
    tiktok: string;
    whatsapp: string;
    links: LPLink[];
  };
};

/** Store branding + contact defaults used by the landing page when the merchant leaves a field blank. */
export type LandingStoreInfo = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  name_logo_url?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  tiktok?: string | null;
};

export const SOCIAL_KEYS = ["facebook", "instagram", "youtube", "tiktok", "whatsapp"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export type LandingTheme = {
  primary: string;
  accent: string;
  dark: boolean;
  rounded: boolean;
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

export type LandingFormConfig = {
  fields: { key: FormFieldKey; label: string; enabled: boolean; required: boolean }[];
  paymentMethods: string[];
  deliveryCharge: number;
  buttonText: string;
};

export const PAYMENT_METHODS = ["cod", "bkash", "nagad", "rocket", "bank"] as const;

export const FEATURE_ICONS = [
  "check", "star", "shield", "truck", "zap", "heart", "award", "clock",
  "gift", "thumbs-up", "package", "sparkles",
] as const;

/** The design is system-owned; every page uses this fixed professional theme. */
export function defaultTheme(): LandingTheme {
  return { primary: "#16a34a", accent: "#f59e0b", dark: false, rounded: true };
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
    header: { storeName: "", buttonText: "অর্ডার করুন", showButton: true, logo: "" },
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
      text: "", contactText: "", copyright: "", logo: "", storeName: "",
      phone: "", email: "", address: "", hours: "",
      facebook: "", instagram: "", youtube: "", tiktok: "", whatsapp: "",
      links: [],
    },
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

  return {
    header: {
      storeName: String(c.header?.storeName ?? ""),
      buttonText: String(c.header?.buttonText ?? hero.ctaText ?? "অর্ডার করুন"),
      showButton: c.header?.showButton !== false,
      logo: String(c.header?.logo ?? ""),
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
    },
  };
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
