// Theme Studio design library: every storefront part (header → footer) offers
// several ready-made designs. A design is just a partial theme override, so it
// reuses the existing theme engine, sanitizer, locks and publish flow.
export type StudioVariant = { id: string; name: string; patch: Record<string, any> };
export type StudioPart = { id: string; label: string; variants: StudioVariant[] };

const v = (id: string, name: string, patch: Record<string, any>): StudioVariant => ({ id, name, patch });

export const STUDIO_PARTS: StudioPart[] = [
  {
    id: "header",
    label: "Header",
    variants: [
      v("classic", "Classic", { header: { logo_align: "left", search_position: "center", cart_position: "right", height: 64, sticky: true, transparent: false, show_name: true } }),
      v("centered", "Centered Logo", { header: { logo_align: "center", search_position: "hidden", cart_position: "right", height: 72, sticky: true, transparent: false } }),
      v("minimal", "Minimal", { header: { logo_align: "left", search_position: "right", cart_position: "right", height: 56, sticky: false, transparent: false, categories: false } }),
      v("tall", "Tall Brand", { header: { logo_align: "center", search_position: "center", height: 88, logo_size: "large", sticky: true } }),
      v("transparent", "Transparent", { header: { transparent: true, sticky: true, logo_align: "left", search_position: "right", height: 64 } }),
      v("compact", "Compact Icons", { header: { logo_mode: "icon", logo_align: "left", search_position: "right", height: 52, show_name: false } }),
      v("left-cart", "Cart Left", { header: { cart_position: "left", logo_align: "center", search_position: "hidden", height: 64 } }),
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    variants: [
      v("one-line-more", "এক লাইন + More", { nav: { menu_style: "inline", category_mode: "more", category_position: "top", mega_menu: false } }),
      v("pill-more", "Pill + More", { nav: { menu_style: "pill", category_mode: "more", category_position: "top", mega_menu: false } }),
      v("underline-more", "Underline + More", { nav: { menu_style: "underline", category_mode: "more", category_position: "top", mega_menu: false } }),
      v("scroll", "এক লাইন স্ক্রল", { nav: { menu_style: "inline", category_mode: "scroll", category_position: "top", mega_menu: false } }),
      v("pill-scroll", "Pill স্ক্রল", { nav: { menu_style: "pill", category_mode: "scroll", category_position: "top", mega_menu: false } }),
      v("wrap", "সব দেখাও (একাধিক লাইন)", { nav: { menu_style: "inline", category_mode: "wrap", category_position: "top", mega_menu: false } }),
    ],
  },
  {
    id: "hero",
    label: "Hero Banner",
    variants: [
      v("split-right", "বড় বামে + ২টি ডানে", { banner: { layout: "split_right", style: "slider" } }),
      v("split-left", "২টি বামে + বড় ডানে", { banner: { layout: "split_left", style: "slider" } }),
      v("stacked", "বড় উপরে + ২টি নিচে", { banner: { layout: "stacked", style: "slider" } }),
      v("full", "পুরো চওড়া স্লাইডার", { banner: { layout: "full", style: "full" } }),
      v("trio", "৩টি সমান কার্ড", { banner: { layout: "trio", style: "static" } }),
      v("strip", "চিকন স্ট্রিপ", { banner: { layout: "strip", style: "slider" } }),
    ],
  },
  {
    id: "product_card",
    label: "Product Card",
    variants: [
      v("bordered", "Bordered", { product_card: { style: "bordered", shadow: "low", radius: 8, image_ratio: "square", hover: "none" } }),
      v("elevated", "Elevated", { product_card: { style: "elevated", shadow: "medium", radius: 14, image_ratio: "square", hover: "lift" } }),
      v("flat", "Flat", { product_card: { style: "flat", shadow: "low", radius: 0, image_ratio: "portrait", hover: "zoom" } }),
      v("glass", "Glass", { product_card: { style: "glass", shadow: "high", radius: 20, image_ratio: "square", hover: "glow" } }),
      v("portrait", "Fashion Portrait", { product_card: { style: "flat", shadow: "low", radius: 4, image_ratio: "portrait", hover: "zoom", price_style: "inline" } }),
      v("landscape", "Wide", { product_card: { style: "bordered", shadow: "low", radius: 12, image_ratio: "landscape", hover: "lift" } }),
      v("premium", "Premium", { product_card: { style: "elevated", shadow: "premium", radius: 10, image_ratio: "square", hover: "zoom", price_style: "bold" } }),
    ],
  },
  {
    id: "buttons",
    label: "Buttons",
    variants: [
      v("solid", "Solid", { buttons: { style: "solid", radius: 8, shadow: "low", hover_animation: "lift" } }),
      v("pill", "Pill", { buttons: { style: "solid", radius: 999, shadow: "low", hover_animation: "lift" } }),
      v("outline", "Outline", { buttons: { style: "outline", radius: 6, shadow: "low", hover_animation: "none" } }),
      v("soft", "Soft", { buttons: { style: "soft", radius: 12, shadow: "low", hover_animation: "glow" } }),
      v("square", "Square", { buttons: { style: "solid", radius: 0, shadow: "medium", hover_animation: "none" } }),
    ],
  },
  {
    id: "colors",
    label: "Colors",
    variants: [
      v("ocean", "Ocean", { colors: { primary: "#0f62fe", button: "#0f62fe", accent: "#00b3a4", header: "#ffffff", footer: "#0b1d3a", background: "#f6f8fb" } }),
      v("forest", "Forest", { colors: { primary: "#1f7a4d", button: "#1f7a4d", accent: "#e0a526", header: "#ffffff", footer: "#13311f", background: "#f7f8f3" } }),
      v("sunset", "Sunset", { colors: { primary: "#e8590c", button: "#e8590c", accent: "#c2255c", header: "#fff8f3", footer: "#2b1408", background: "#fffaf6" } }),
      v("noir", "Noir", { colors: { primary: "#111111", button: "#111111", accent: "#c8a24a", header: "#ffffff", footer: "#111111", background: "#ffffff" } }),
      v("berry", "Berry", { colors: { primary: "#a61e4d", button: "#a61e4d", accent: "#f08c00", header: "#ffffff", footer: "#2d0a17", background: "#fff7fa" } }),
      v("mint", "Mint", { colors: { primary: "#0ca678", button: "#0ca678", accent: "#1c7ed6", header: "#f3fff9", footer: "#063d2d", background: "#f8fffc" } }),
      v("royal", "Royal", { colors: { primary: "#5f3dc4", button: "#5f3dc4", accent: "#fab005", header: "#ffffff", footer: "#1e1240", background: "#f8f6ff" } }),
      v("modern-blue", "Modern Blue", { colors: { primary: "#2563eb", button: "#2563eb", accent: "#f59e0b", header: "#ffffff", footer: "#111827", background: "#ffffff" } }),
      v("corporate", "Premium Corporate", { colors: { primary: "#0f172a", button: "#0f172a", accent: "#0ea5e9", header: "#ffffff", footer: "#0f172a", background: "#f8fafc" } }),
      v("luxury-gold", "Luxury Gold", { colors: { primary: "#c9a84c", button: "#c9a84c", accent: "#f0d78c", header: "#0d0d0d", footer: "#0d0d0d", background: "#faf8f2" } }),
      v("fashion", "Fashion Pink", { colors: { primary: "#ec4899", button: "#ec4899", accent: "#f472b6", header: "#ffffff", footer: "#111827", background: "#fffafc" } }),
      v("electronics", "Electronics Pro", { colors: { primary: "#1d4ed8", button: "#f97316", accent: "#f97316", header: "#ffffff", footer: "#0f172a", background: "#f8fafc" } }),
      v("grocery", "Grocery Fresh", { colors: { primary: "#16a34a", button: "#16a34a", accent: "#facc15", header: "#ffffff", footer: "#14532d", background: "#f7fdf8" } }),
      v("mono", "Minimal Mono", { colors: { primary: "#111111", button: "#111111", accent: "#555555", header: "#ffffff", footer: "#f5f3ee", background: "#ffffff" } }),
      v("dark-pro", "Dark Pro", { colors: { primary: "#22d3ee", button: "#22d3ee", accent: "#a78bfa", header: "#0b1120", footer: "#0b1120", background: "#f4f7fb" } }),
      v("elegant-rose", "Elegant Rose", { colors: { primary: "#9b72cf", button: "#9b72cf", accent: "#e8c5d0", header: "#ffffff", footer: "#2e1065", background: "#fcf9ff" } }),
      v("corporate-clean", "Corporate Clean", { colors: { primary: "#3b82f6", button: "#3b82f6", accent: "#22c55e", header: "#ffffff", footer: "#1e293b", background: "#ffffff" } }),
      v("beauty", "Beauty Soft", { colors: { primary: "#c17c74", button: "#c17c74", accent: "#f8e8ee", header: "#ffffff", footer: "#8b6f5e", background: "#fffaf8" } }),
      v("sports", "Sports Bold", { colors: { primary: "#e85d3a", button: "#e85d3a", accent: "#ffeb3b", header: "#1a1a1a", footer: "#1a1a1a", background: "#ffffff" } }),
      v("coffee", "Coffee", { colors: { primary: "#6f4e37", button: "#6f4e37", accent: "#d4a373", header: "#fffaf3", footer: "#2b1d14", background: "#fdf8f2" } }),
      v("teal", "Teal Calm", { colors: { primary: "#0d9488", button: "#0d9488", accent: "#f43f5e", header: "#ffffff", footer: "#134e4a", background: "#f6fffd" } }),
      v("crimson", "Crimson Deal", { colors: { primary: "#dc2626", button: "#dc2626", accent: "#facc15", header: "#ffffff", footer: "#450a0a", background: "#fffafa" } }),
      v("lavender", "Lavender", { colors: { primary: "#7c3aed", button: "#7c3aed", accent: "#ec4899", header: "#faf5ff", footer: "#2e1065", background: "#fdfbff" } }),
      v("sky", "Sky", { colors: { primary: "#0284c7", button: "#0284c7", accent: "#fb923c", header: "#f0f9ff", footer: "#082f49", background: "#f8fcff" } }),
      v("olive", "Olive", { colors: { primary: "#4d7c0f", button: "#4d7c0f", accent: "#ca8a04", header: "#fbfdf5", footer: "#1a2e05", background: "#fcfdf7" } }),
    ],
  },
  {
    id: "typography",
    label: "Typography",
    variants: [
      v("modern", "Modern", { typography: { heading_font: "Sora", body_font: "Manrope", button_font: "Manrope" } }),
      v("clean", "Clean", { typography: { heading_font: "DM Sans", body_font: "Work Sans", button_font: "DM Sans" } }),
      v("elegant", "Elegant", { typography: { heading_font: "Cormorant Garamond", body_font: "Karla", button_font: "Karla" } }),
      v("bold", "Bold", { typography: { heading_font: "Bebas Neue", body_font: "Barlow", button_font: "Barlow" } }),
      v("friendly", "Friendly", { typography: { heading_font: "Plus Jakarta Sans", body_font: "Nunito Sans", button_font: "Plus Jakarta Sans" } }),
      v("editorial", "Editorial", { typography: { heading_font: "Lora", body_font: "Figtree", button_font: "Figtree" } }),
    ],
  },
  {
    id: "spacing",
    label: "Spacing & Layout",
    variants: [
      v("cozy", "Cozy", { spacing: { container: 1200, section_gap: 40, card_gap: 16, padding: 16 } }),
      v("airy", "Airy", { spacing: { container: 1280, section_gap: 72, card_gap: 24, padding: 24 } }),
      v("dense", "Dense", { spacing: { container: 1360, section_gap: 28, card_gap: 10, padding: 12 } }),
      v("boxed", "Boxed", { spacing: { container: 1080, section_gap: 48, card_gap: 18, padding: 20 } }),
    ],
  },
  {
    id: "footer",
    label: "Footer",
    variants: [
      v("columns", "Columns", { footer: { layout: "columns", social: true, copyright: true, payment_icons: true } }),
      v("compact", "Compact", { footer: { layout: "compact", social: true, copyright: true, payment_icons: false } }),
      v("centered", "Centered", { footer: { layout: "centered", social: true, copyright: true, payment_icons: true } }),
      v("simple", "Simple", { footer: { layout: "compact", social: false, copyright: true, payment_icons: false } }),
      v("full", "Columns (no social)", { footer: { layout: "columns", social: false, copyright: true, payment_icons: true } }),
    ],
  },
];

/** Apply a design's patch on top of overrides (per group; arrays replaced). */
export function applyVariant(overrides: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...overrides };
  for (const [k, val] of Object.entries(patch)) {
    out[k] = val && typeof val === "object" && !Array.isArray(val) ? { ...(overrides?.[k] ?? {}), ...val } : val;
  }
  return out;
}

/** Which design of a part matches the current theme (every patched key equal). */
export function activeVariantId(part: StudioPart, theme: Record<string, any>): string | null {
  const hit = part.variants.find((vr) =>
    Object.entries(vr.patch).every(([g, vals]) =>
      Object.entries(vals as Record<string, unknown>).every(([k, x]) => theme?.[g]?.[k] === x),
    ),
  );
  return hit?.id ?? null;
}

export function reorder<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
