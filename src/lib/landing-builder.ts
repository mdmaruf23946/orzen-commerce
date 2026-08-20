// Shared, client-safe types + defaults for the Landing Page builder.
// A landing page keeps its OWN snapshot of product content; the store product
// is never mutated and never auto-syncs into a page.

export type LPFeature = { icon: string; title: string; text: string };
export type LPBenefit = { title: string; text: string };
export type LPSpec = { label: string; value: string };
export type LPReview = { name: string; rating: number; text: string };
export type LPFaq = { q: string; a: string };

export type LandingContent = {
  hero: {
    enabled: boolean;
    badge: string;
    headline: string;
    subheadline: string;
    image: string;
    ctaText: string;
  };
  pricing: { price: number; oldPrice: number | null; note: string };
  gallery: { enabled: boolean; title: string; images: string[] };
  features: { enabled: boolean; title: string; items: LPFeature[] };
  benefits: { enabled: boolean; title: string; items: LPBenefit[] };
  details: { enabled: boolean; title: string; text: string; specs: LPSpec[] };
  reviews: { enabled: boolean; title: string; items: LPReview[] };
  faq: { enabled: boolean; title: string; items: LPFaq[] };
  contact: { enabled: boolean; title: string; phone: string; email: string; address: string; hours: string };
  cta: { enabled: boolean; headline: string; text: string; buttonText: string };
  order: { enabled: boolean; title: string; note: string; successMessage: string };
  footer: { enabled: boolean; text: string };
};

export type LandingTheme = {
  primary: string;
  accent: string;
  dark: boolean;
  rounded: boolean;
};

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

  const benefits: LPBenefit[] = [
    p.warranty ? { title: "ওয়ারেন্টি", text: p.warranty } : null,
    p.delivery_time_days ? { title: "দ্রুত ডেলিভারি", text: `${p.delivery_time_days} দিনের মধ্যে ডেলিভারি` } : null,
    p.return_policy ? { title: "সহজ রিটার্ন", text: p.return_policy } : null,
    p.shipping_info ? { title: "শিপিং", text: p.shipping_info } : null,
  ].filter(Boolean) as LPBenefit[];

  return {
    hero: {
      enabled: true,
      badge: p.old_price && p.old_price > p.price ? "বিশেষ ছাড়" : "নতুন",
      headline: p.name,
      subheadline: short,
      image: p.primary_image_url ?? gallery[0] ?? "",
      ctaText: "অর্ডার করুন",
    },
    pricing: { price: Number(p.price) || 0, oldPrice: p.old_price ? Number(p.old_price) : null, note: "ক্যাশ অন ডেলিভারি" },
    gallery: { enabled: gallery.length > 0, title: "প্রোডাক্ট ছবি", images: gallery.slice(0, 8) },
    features: {
      enabled: features.length > 0,
      title: "প্রোডাক্ট ফিচার",
      items: features.length
        ? features
        : [{ icon: "check", title: "উন্নত মান", text: "" }],
    },
    benefits: {
      enabled: benefits.length > 0,
      title: "কেন কিনবেন",
      items: benefits,
    },
    details: {
      enabled: true,
      title: "বিস্তারিত",
      text: toPlainText(p.description) || short,
      specs,
    },
    reviews: {
      enabled: false,
      title: "কাস্টমার রিভিউ",
      items: [],
    },
    faq: {
      enabled: true,
      title: "সাধারণ প্রশ্ন",
      items: [
        { q: "ডেলিভারিতে কত দিন লাগে?", a: p.delivery_time_days ? `${p.delivery_time_days} দিন` : "২-৩ দিন" },
        { q: "পেমেন্ট কিভাবে করব?", a: "ক্যাশ অন ডেলিভারি — প্রোডাক্ট হাতে পেয়ে টাকা দিন।" },
      ],
    },
    contact: { enabled: true, title: "যোগাযোগ", phone: "", email: "", address: "", hours: "" },
    cta: {
      enabled: true,
      headline: "আজই অর্ডার করুন",
      text: "সীমিত স্টক — দ্রুত অর্ডার করে নিন।",
      buttonText: "এখনই অর্ডার করুন",
    },
    order: {
      enabled: true,
      title: "অর্ডার ফরম",
      note: "নিচের ফরমটি পূরণ করে অর্ডার কনফার্ম করুন।",
      successMessage: "ধন্যবাদ! আপনার অর্ডার গ্রহণ করা হয়েছে। আমরা শীঘ্রই কল করব।",
    },
    footer: { enabled: true, text: "" },
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
