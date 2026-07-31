// Shared theme contract between Winner Admin (theme authors) and Store Admin
// (safe customisers). The Winner Admin owns the structure; Store Admin can only
// change the whitelisted keys below and never anything a theme marks as locked.

export const THEME_CATEGORIES = [
  "modern",
  "premium",
  "luxury",
  "fashion",
  "electronics",
  "grocery",
  "minimal",
  "dark",
  "corporate",
  "elegant",
] as const;
export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

export const COLOR_KEYS = ["primary", "secondary", "accent", "button", "header", "footer"] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_LABELS: Record<ColorKey, string> = {
  primary: "Primary Color",
  secondary: "Secondary Color",
  accent: "Accent Color",
  button: "Button Color",
  header: "Header Background",
  footer: "Footer Background",
};

export const HEADER_KEYS = ["search", "categories", "wishlist", "cart", "account"] as const;
export type HeaderKey = (typeof HEADER_KEYS)[number];
export const HEADER_LABELS: Record<HeaderKey, string> = {
  search: "Search",
  categories: "Categories",
  wishlist: "Wishlist",
  cart: "Cart",
  account: "Account",
};

export const SECTION_KEYS = [
  "banner",
  "categories",
  "featured",
  "flash_sale",
  "best_sellers",
  "new_arrival",
  "reviews",
  "faq",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_LABELS: Record<SectionKey, string> = {
  banner: "Banner",
  categories: "Categories",
  featured: "Featured Products",
  flash_sale: "Flash Sale",
  best_sellers: "Best Sellers",
  new_arrival: "New Arrival",
  reviews: "Reviews",
  faq: "FAQ",
};

export const CARD_KEYS = [
  "rating",
  "discount_badge",
  "sold_count",
  "wishlist",
  "quick_view",
  "buy_now",
  "add_to_cart",
] as const;
export type CardKey = (typeof CARD_KEYS)[number];
export const CARD_LABELS: Record<CardKey, string> = {
  rating: "Rating",
  discount_badge: "Discount Badge",
  sold_count: "Sold Count",
  wishlist: "Wishlist",
  quick_view: "Quick View",
  buy_now: "Buy Now",
  add_to_cart: "Add to Cart",
};

export const BUTTON_STYLES = ["solid", "outline", "soft"] as const;
export const BANNER_STYLES = ["slider", "static", "full"] as const;
export const ANIMATIONS = ["none", "fade", "slide", "zoom"] as const;
export type Animation = (typeof ANIMATIONS)[number];

export const FONT_OPTIONS = [
  "Inter",
  "Manrope",
  "DM Sans",
  "Work Sans",
  "Figtree",
  "Sora",
  "Space Grotesk",
  "Plus Jakarta Sans",
  "Syne",
  "Urbanist",
  "Epilogue",
  "Nunito Sans",
  "Lora",
  "Barlow",
  "Bebas Neue",
  "Karla",
  "Cormorant Garamond",
] as const;

export type ThemeDefinition = {
  colors: Record<ColorKey, string>;
  typography: {
    heading_font: string;
    body_font: string;
    button_font: string;
    base_size: number;
  };
  header: Record<HeaderKey, boolean>;
  sections: Record<SectionKey, boolean>;
  product_card: Record<CardKey, boolean>;
  buttons: { radius: number; style: (typeof BUTTON_STYLES)[number]; hover_color: string };
  banner: { style: (typeof BANNER_STYLES)[number] };
  animation: Animation;
  footer: { phone?: string; email?: string; address?: string; social?: boolean };
};

/** Locked groups/keys a Store Admin may not touch. */
export type ThemeLocks = Partial<{
  colors: ColorKey[] | true;
  typography: string[] | true;
  header: HeaderKey[] | true;
  sections: SectionKey[] | true;
  product_card: CardKey[] | true;
  buttons: string[] | true;
  animation: true;
  footer: true;
}>;

export const DEFAULT_THEME: ThemeDefinition = {
  colors: {
    primary: "#2563EB",
    secondary: "#1F2937",
    accent: "#F59E0B",
    button: "#2563EB",
    header: "#FFFFFF",
    footer: "#111827",
  },
  typography: { heading_font: "Inter", body_font: "Inter", button_font: "Inter", base_size: 16 },
  header: { search: true, categories: true, wishlist: true, cart: true, account: true },
  sections: {
    banner: true,
    categories: true,
    featured: true,
    flash_sale: true,
    best_sellers: true,
    new_arrival: true,
    reviews: true,
    faq: true,
  },
  product_card: {
    rating: true,
    discount_badge: true,
    sold_count: true,
    wishlist: true,
    quick_view: true,
    buy_now: true,
    add_to_cart: true,
  },
  buttons: { radius: 8, style: "solid", hover_color: "#1D4ED8" },
  banner: { style: "slider" },
  animation: "fade",
  footer: { social: true },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Shallow-per-group merge: definition < overrides. */
export function mergeTheme(
  definition: unknown,
  overrides: unknown,
): ThemeDefinition {
  const base = isPlainObject(definition) ? definition : {};
  const over = isPlainObject(overrides) ? overrides : {};
  const out: any = { ...DEFAULT_THEME };
  for (const key of Object.keys(DEFAULT_THEME) as (keyof ThemeDefinition)[]) {
    const d = (DEFAULT_THEME as any)[key];
    if (isPlainObject(d)) {
      out[key] = { ...d, ...(isPlainObject(base[key]) ? base[key] : {}), ...(isPlainObject(over[key]) ? over[key] : {}) };
    } else {
      out[key] = over[key] ?? base[key] ?? d;
    }
  }
  return out as ThemeDefinition;
}

/** True when the given group (and optional key) is locked by the theme author. */
export function isLocked(locks: ThemeLocks | null | undefined, group: keyof ThemeLocks, key?: string): boolean {
  const l = locks?.[group] as unknown;
  if (l === true) return true;
  if (Array.isArray(l) && key) return l.includes(key);
  return false;
}

/** Strips every key a Store Admin is not allowed to change. */
export function sanitizeOverrides(input: unknown, locks: ThemeLocks | null | undefined): Record<string, any> {
  const src = isPlainObject(input) ? input : {};
  const out: Record<string, any> = {};

  const pick = <K extends string>(
    group: keyof ThemeLocks,
    keys: readonly K[],
    validate: (v: unknown) => boolean,
  ) => {
    const g = isPlainObject(src[group]) ? (src[group] as Record<string, unknown>) : null;
    if (!g) return;
    const bucket: Record<string, unknown> = {};
    for (const k of keys) {
      if (!(k in g)) continue;
      if (isLocked(locks, group, k)) continue;
      if (!validate(g[k])) continue;
      bucket[k] = g[k];
    }
    if (Object.keys(bucket).length) out[group] = bucket;
  };

  const isHex = (v: unknown) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
  const isBool = (v: unknown) => typeof v === "boolean";

  pick("colors", COLOR_KEYS, isHex);
  pick("header", HEADER_KEYS, isBool);
  pick("sections", SECTION_KEYS, isBool);
  pick("product_card", CARD_KEYS, isBool);

  // typography
  if (isPlainObject(src.typography) && !isLocked(locks, "typography")) {
    const t = src.typography as Record<string, unknown>;
    const bucket: Record<string, unknown> = {};
    for (const k of ["heading_font", "body_font", "button_font"] as const) {
      if (typeof t[k] === "string" && (FONT_OPTIONS as readonly string[]).includes(t[k] as string) && !isLocked(locks, "typography", k)) {
        bucket[k] = t[k];
      }
    }
    if (typeof t.base_size === "number" && t.base_size >= 12 && t.base_size <= 20 && !isLocked(locks, "typography", "base_size")) {
      bucket.base_size = Math.round(t.base_size);
    }
    if (Object.keys(bucket).length) out.typography = bucket;
  }

  // buttons
  if (isPlainObject(src.buttons) && !isLocked(locks, "buttons")) {
    const b = src.buttons as Record<string, unknown>;
    const bucket: Record<string, unknown> = {};
    if (typeof b.radius === "number" && b.radius >= 0 && b.radius <= 32) bucket.radius = Math.round(b.radius);
    if (typeof b.style === "string" && (BUTTON_STYLES as readonly string[]).includes(b.style)) bucket.style = b.style;
    if (isHex(b.hover_color)) bucket.hover_color = b.hover_color;
    if (Object.keys(bucket).length) out.buttons = bucket;
  }

  // animation
  if (typeof src.animation === "string" && (ANIMATIONS as readonly string[]).includes(src.animation) && !isLocked(locks, "animation")) {
    out.animation = src.animation;
  }

  // footer contact info (text only — never markup)
  if (isPlainObject(src.footer) && !isLocked(locks, "footer")) {
    const f = src.footer as Record<string, unknown>;
    const bucket: Record<string, unknown> = {};
    for (const k of ["phone", "email", "address"] as const) {
      if (typeof f[k] === "string") bucket[k] = (f[k] as string).replace(/<[^>]*>/g, "").slice(0, 300);
    }
    if (typeof f.social === "boolean") bucket.social = f.social;
    if (Object.keys(bucket).length) out.footer = bucket;
  }

  return out;
}

/** CSS custom properties for a resolved theme. */
export function themeCssVars(t: ThemeDefinition): Record<string, string> {
  return {
    "--primary": t.colors.primary,
    "--store-header-bg": t.colors.header,
    "--store-title-bar-bg": t.colors.secondary,
    "--store-footer-bg": t.colors.footer,
    "--store-btn-bg": t.colors.button,
    "--store-btn-hover": t.buttons.hover_color,
    "--store-accent": t.colors.accent,
    "--radius": `${t.buttons.radius}px`,
    "--store-heading-font": t.typography.heading_font,
    "--store-body-font": t.typography.body_font,
    "--store-base-size": `${t.typography.base_size}px`,
  };
}
