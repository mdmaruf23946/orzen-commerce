// Browser-safe catalogue + scoring for platform (orzen.top) page SEO.
export type PlatformPageKey = "home" | "features" | "pricing" | "about" | "contact";
export type PageSeo = { title: string; description: string; keywords: string };

export const PLATFORM_PAGES: { key: PlatformPageKey; path: string; label: string; defaults: PageSeo }[] = [
  { key: "home", path: "/", label: "Home", defaults: {
    title: "ORZEN — AI eCommerce Platform for Online Stores in Bangladesh",
    description: "Build your online store with ORZEN: AI sales agent, Messenger & WhatsApp automation, courier delivery, landing pages, custom domain and analytics.",
    keywords: "" } },
  { key: "features", path: "/features", label: "Features", defaults: {
    title: "Features — ORZEN AI eCommerce Platform",
    description: "AI sales agent, Messenger & WhatsApp automation, AI call center, landing pages, courier, fraud checker, custom domain and analytics — all in ORZEN.",
    keywords: "" } },
  { key: "pricing", path: "/pricing", label: "Pricing", defaults: {
    title: "Pricing — ORZEN eCommerce Plans",
    description: "Simple monthly plans for your online store on ORZEN. Compare packages, product limits and AI features, and start selling today.",
    keywords: "" } },
  { key: "about", path: "/about", label: "About", defaults: { title: "About Us", description: "About Us for our store.", keywords: "" } },
  { key: "contact", path: "/contact", label: "Contact", defaults: { title: "Contact Us", description: "Contact Us for our store.", keywords: "" } },
];

export type SeoOverrides = Partial<Record<PlatformPageKey, Partial<PageSeo>>>;

export function effectiveSeo(key: PlatformPageKey, overrides?: SeoOverrides | null): PageSeo {
  const d = PLATFORM_PAGES.find((p) => p.key === key)!.defaults;
  const o = overrides?.[key] ?? {};
  return {
    title: o.title?.trim() || d.title,
    description: o.description?.trim() || d.description,
    keywords: o.keywords?.trim() || d.keywords,
  };
}

export type SeoIssue = { level: "error" | "warn"; text: string };

/** Deterministic health score (0–100) — no AI tokens used. */
export function scorePageSeo(s: PageSeo): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = [];
  let score = 100;
  const t = s.title.trim().length;
  const d = s.description.trim().length;
  if (!t) { score -= 40; issues.push({ level: "error", text: "Title নেই" }); }
  else if (t < 30) { score -= 15; issues.push({ level: "warn", text: `Title ছোট (${t} অক্ষর, ৩০–৬০ ভালো)` }); }
  else if (t > 60) { score -= 15; issues.push({ level: "warn", text: `Title বড় (${t} অক্ষর, Google কেটে দেবে)` }); }
  if (!d) { score -= 40; issues.push({ level: "error", text: "Description নেই" }); }
  else if (d < 70) { score -= 20; issues.push({ level: "warn", text: `Description দুর্বল/ছোট (${d} অক্ষর, ১২০–১৬০ ভালো)` }); }
  else if (d < 120) { score -= 8; issues.push({ level: "warn", text: `Description একটু ছোট (${d} অক্ষর)` }); }
  else if (d > 160) { score -= 10; issues.push({ level: "warn", text: `Description বড় (${d} অক্ষর, ১৬০-এর বেশি কেটে যাবে)` }); }
  if (!s.keywords.trim()) { score -= 5; issues.push({ level: "warn", text: "Keywords দেওয়া নেই" }); }
  if (t && !/orzen/i.test(s.title)) { score -= 5; issues.push({ level: "warn", text: "Title-এ ব্র্যান্ড নাম (ORZEN) নেই" }); }
  return { score: Math.max(0, score), issues };
}
