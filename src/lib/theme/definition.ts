// Shared theme contract between Winner Admin (theme authors) and Store Admin
// (safe customisers). The Winner Admin owns the structure; Store Admin can only
// change the whitelisted keys below and never anything a theme marks as locked.
//
// v2 note: every group below is additive and defaulted, so themes/overrides that
// were stored before these keys existed keep resolving exactly as they did.

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

export const COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "button",
  "header",
  "footer",
  "success",
  "warning",
  "error",
  "background",
  "surface",
  "card",
  "border",
  "link",
  "ink",
  "text",
  "muted",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_LABELS: Record<ColorKey, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  button: "Button",
  header: "Header Background",
  footer: "Footer Background",
  success: "Success",
  warning: "Warning",
  error: "Error",
  background: "Page Background",
  surface: "Surface",
  card: "Card",
  border: "Border",
  link: "Link",
  ink: "Ink (Black)",
  text: "Body Text",
  muted: "Muted Text",
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
  "trending",
  "collections",
  "testimonials",
  "brand_logos",
  "newsletter",
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
  trending: "Trending",
  collections: "Collections",
  testimonials: "Testimonials",
  brand_logos: "Brand Logos",
  newsletter: "Newsletter",
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

export const ANIMATION_LEVELS = ["none", "minimal", "modern", "premium"] as const;
export const SHADOW_LEVELS = ["low", "medium", "high", "premium"] as const;
export const CARD_STYLES = ["flat", "bordered", "elevated", "glass"] as const;
export const IMAGE_RATIOS = ["square", "portrait", "landscape"] as const;
export const HOVER_EFFECTS = ["none", "lift", "zoom", "glow"] as const;
export const BADGE_STYLES = ["pill", "square", "ribbon"] as const;
export const RATING_STYLES = ["stars", "compact", "hidden"] as const;
export const PRICE_STYLES = ["stacked", "inline", "bold"] as const;
export const MENU_STYLES = ["inline", "pill", "underline"] as const;
export const HEADER_SEARCH_POS = ["center", "right", "hidden"] as const;
export const HEADER_CART_POS = ["right", "left"] as const;
export const LOGO_ALIGNS = ["left", "center"] as const;
export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export const FOOTER_LAYOUTS = ["columns", "compact", "centered"] as const;
export const FONT_WEIGHTS = [400, 500, 600, 700, 800] as const;

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
    heading_weight: number;
    body_weight: number;
    letter_spacing: number;
    line_height: number;
  };
  header: Record<HeaderKey, boolean> & {
    sticky: boolean;
    transparent: boolean;
    height: number;
    search_position: (typeof HEADER_SEARCH_POS)[number];
    cart_position: (typeof HEADER_CART_POS)[number];
    logo_align: (typeof LOGO_ALIGNS)[number];
  };
  nav: {
    menu_style: (typeof MENU_STYLES)[number];
    category_position: "top" | "sidebar";
    mega_menu: boolean;
  };
  hero: {
    height: number;
    radius: number;
    overlay: number;
    text_align: (typeof TEXT_ALIGNS)[number];
    cta_style: (typeof BUTTON_STYLES)[number];
  };
  sections: Record<SectionKey, boolean>;
  section_order: SectionKey[];
  product_card: Record<CardKey, boolean> & {
    style: (typeof CARD_STYLES)[number];
    shadow: (typeof SHADOW_LEVELS)[number];
    radius: number;
    image_ratio: (typeof IMAGE_RATIOS)[number];
    hover: (typeof HOVER_EFFECTS)[number];
    badge_style: (typeof BADGE_STYLES)[number];
    button_style: (typeof BUTTON_STYLES)[number];
    rating_style: (typeof RATING_STYLES)[number];
    price_style: (typeof PRICE_STYLES)[number];
  };
  buttons: {
    radius: number;
    style: (typeof BUTTON_STYLES)[number];
    hover_color: string;
    border: number;
    shadow: (typeof SHADOW_LEVELS)[number];
    hover_animation: (typeof HOVER_EFFECTS)[number];
  };
  banner: { style: (typeof BANNER_STYLES)[number] };
  animation: Animation;
  spacing: {
    container: number;
    section_gap: number;
    card_gap: number;
    padding: number;
  };
  global: {
    radius: number;
    shadow: (typeof SHADOW_LEVELS)[number];
    animation_level: (typeof ANIMATION_LEVELS)[number];
  };
  footer: {
    phone?: string;
    email?: string;
    address?: string;
    social?: boolean;
    layout: (typeof FOOTER_LAYOUTS)[number];
    copyright: boolean;
    payment_icons: boolean;
  };
};

/** Locked groups/keys a Store Admin may not touch. */
export type ThemeLocks = Partial<{
  colors: ColorKey[] | true;
  typography: string[] | true;
  header: string[] | true;
  nav: string[] | true;
  hero: string[] | true;
  sections: SectionKey[] | true;
  section_order: true;
  product_card: string[] | true;
  buttons: string[] | true;
  spacing: string[] | true;
  global: string[] | true;
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
    success: "#16A34A",
    warning: "#F59E0B",
    error: "#DC2626",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    border: "#E2E8F0",
    link: "#2563EB",
    ink: "#111111",
    text: "#171717",
    muted: "#6B7280",
  },
  typography: {
    heading_font: "Inter",
    body_font: "Inter",
    button_font: "Inter",
    base_size: 16,
    heading_weight: 700,
    body_weight: 400,
    letter_spacing: 0,
    line_height: 1.5,
  },
  header: {
    search: true,
    categories: true,
    wishlist: true,
    cart: true,
    account: true,
    sticky: true,
    transparent: false,
    height: 64,
    search_position: "center",
    cart_position: "right",
    logo_align: "left",
  },
  nav: { menu_style: "inline", category_position: "top", mega_menu: false },
  hero: { height: 320, radius: 16, overlay: 0, text_align: "left", cta_style: "solid" },
  sections: {
    banner: true,
    categories: true,
    featured: true,
    flash_sale: true,
    best_sellers: true,
    new_arrival: true,
    trending: false,
    collections: false,
    testimonials: false,
    brand_logos: false,
    newsletter: false,
    reviews: true,
    faq: true,
  },
  section_order: [
    "banner",
    "categories",
    "flash_sale",
    "featured",
    "best_sellers",
    "new_arrival",
    "trending",
    "collections",
    "testimonials",
    "brand_logos",
    "newsletter",
    "reviews",
    "faq",
  ],
  product_card: {
    rating: true,
    discount_badge: true,
    sold_count: true,
    wishlist: true,
    quick_view: true,
    buy_now: true,
    add_to_cart: true,
    style: "bordered",
    shadow: "low",
    radius: 12,
    image_ratio: "square",
    hover: "lift",
    badge_style: "pill",
    button_style: "solid",
    rating_style: "stars",
    price_style: "inline",
  },
  buttons: {
    radius: 8,
    style: "solid",
    hover_color: "#1D4ED8",
    border: 1,
    shadow: "low",
    hover_animation: "lift",
  },
  banner: { style: "slider" },
  animation: "fade",
  spacing: { container: 1120, section_gap: 40, card_gap: 16, padding: 16 },
  global: { radius: 12, shadow: "medium", animation_level: "modern" },
  footer: { social: true, layout: "columns", copyright: true, payment_icons: true },
};

/** One-click style presets a Store Admin can apply on top of the chosen theme. */
export const STYLE_PRESETS: Record<string, Record<string, any>> = {
  flat: {
    global: { radius: 0, shadow: "low", animation_level: "minimal" },
    buttons: { radius: 0, shadow: "low", hover_animation: "none", style: "solid" },
    product_card: { style: "bordered", radius: 0, shadow: "low", hover: "none" },
  },
  soft: {
    global: { radius: 14, shadow: "medium", animation_level: "modern" },
    buttons: { radius: 12, shadow: "low", hover_animation: "lift", style: "solid" },
    product_card: { style: "elevated", radius: 14, shadow: "medium", hover: "lift" },
  },
  glass: {
    global: { radius: 20, shadow: "high", animation_level: "premium" },
    buttons: { radius: 20, shadow: "medium", hover_animation: "glow", style: "soft" },
    product_card: { style: "glass", radius: 20, shadow: "high", hover: "glow" },
  },
  premium: {
    global: { radius: 10, shadow: "premium", animation_level: "premium" },
    buttons: { radius: 8, shadow: "high", hover_animation: "lift", style: "solid" },
    product_card: { style: "elevated", radius: 10, shadow: "premium", hover: "zoom" },
  },
  modern: {
    global: { radius: 16, shadow: "medium", animation_level: "modern" },
    buttons: { radius: 999, shadow: "low", hover_animation: "lift", style: "solid" },
    product_card: { style: "elevated", radius: 16, shadow: "medium", hover: "lift" },
  },
  luxury: {
    global: { radius: 4, shadow: "high", animation_level: "premium" },
    buttons: { radius: 2, shadow: "medium", hover_animation: "glow", style: "outline" },
    product_card: { style: "flat", radius: 2, shadow: "low", hover: "zoom" },
  },
};

export const PRESET_LABELS: Record<string, string> = {
  flat: "Flat",
  soft: "Soft",
  glass: "Glass",
  premium: "Premium",
  modern: "Modern",
  luxury: "Luxury",
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Shallow-per-group merge: definition < overrides. */
export function mergeTheme(definition: unknown, overrides: unknown): ThemeDefinition {
  const base = isPlainObject(definition) ? definition : {};
  const over = isPlainObject(overrides) ? overrides : {};
  const out: any = { ...DEFAULT_THEME };
  for (const key of Object.keys(DEFAULT_THEME) as (keyof ThemeDefinition)[]) {
    const d = (DEFAULT_THEME as any)[key];
    if (Array.isArray(d)) {
      const pick = Array.isArray((over as any)[key])
        ? (over as any)[key]
        : Array.isArray((base as any)[key])
          ? (base as any)[key]
          : d;
      out[key] = pick;
    } else if (isPlainObject(d)) {
      out[key] = {
        ...d,
        ...(isPlainObject(base[key]) ? base[key] : {}),
        ...(isPlainObject(over[key]) ? over[key] : {}),
      };
    } else {
      out[key] = over[key] ?? base[key] ?? d;
    }
  }
  // Section order always covers every known section exactly once.
  const seen = new Set<string>();
  const order = (out.section_order as string[]).filter(
    (k) => {
      if (!SECTION_KEYS.includes(k as SectionKey) || seen.has(k)) return false;
      seen.add(k);
      return true;
    },
  );
  for (const k of SECTION_KEYS) if (!seen.has(k)) order.push(k);
  out.section_order = order;
  return out as ThemeDefinition;
}

/** True when the given group (and optional key) is locked by the theme author. */
export function isLocked(locks: ThemeLocks | null | undefined, group: keyof ThemeLocks, key?: string): boolean {
  const l = locks?.[group] as unknown;
  if (l === true) return true;
  if (Array.isArray(l) && key) return (l as string[]).includes(key);
  return false;
}

const isHex = (v: unknown) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const isBool = (v: unknown) => typeof v === "boolean";
const oneOf = (list: readonly (string | number)[]) => (v: unknown) => list.includes(v as any);
const num = (min: number, max: number) => (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

/** Strips every key a Store Admin is not allowed to change. */
export function sanitizeOverrides(input: unknown, locks: ThemeLocks | null | undefined): Record<string, any> {
  const src = isPlainObject(input) ? input : {};
  const out: Record<string, any> = {};

  const pickGroup = (
    group: keyof ThemeLocks,
    validators: Record<string, (v: unknown) => boolean>,
    coerce?: Record<string, (v: any) => any>,
  ) => {
    const g = isPlainObject(src[group as string]) ? (src[group as string] as Record<string, unknown>) : null;
    if (!g || isLocked(locks, group)) return;
    const bucket: Record<string, unknown> = {};
    for (const k of Object.keys(validators)) {
      if (!(k in g)) continue;
      if (isLocked(locks, group, k)) continue;
      if (!validators[k](g[k])) continue;
      bucket[k] = coerce?.[k] ? coerce[k](g[k]) : g[k];
    }
    if (Object.keys(bucket).length) out[group as string] = bucket;
  };

  // colors
  pickGroup(
    "colors",
    Object.fromEntries(COLOR_KEYS.map((k) => [k, isHex])) as Record<string, (v: unknown) => boolean>,
  );

  // typography
  pickGroup(
    "typography",
    {
      heading_font: oneOf(FONT_OPTIONS),
      body_font: oneOf(FONT_OPTIONS),
      button_font: oneOf(FONT_OPTIONS),
      base_size: num(12, 20),
      heading_weight: oneOf(FONT_WEIGHTS),
      body_weight: oneOf(FONT_WEIGHTS),
      letter_spacing: num(-2, 4),
      line_height: num(1, 2.4),
    },
    { base_size: Math.round },
  );

  // header
  pickGroup("header", {
    ...(Object.fromEntries(HEADER_KEYS.map((k) => [k, isBool])) as Record<string, (v: unknown) => boolean>),
    sticky: isBool,
    transparent: isBool,
    height: num(48, 120),
    search_position: oneOf(HEADER_SEARCH_POS),
    cart_position: oneOf(HEADER_CART_POS),
    logo_align: oneOf(LOGO_ALIGNS),
  }, { height: Math.round });

  // nav
  pickGroup("nav", {
    menu_style: oneOf(MENU_STYLES),
    category_position: oneOf(["top", "sidebar"]),
    mega_menu: isBool,
  });

  // hero
  pickGroup("hero", {
    height: num(160, 640),
    radius: num(0, 40),
    overlay: num(0, 80),
    text_align: oneOf(TEXT_ALIGNS),
    cta_style: oneOf(BUTTON_STYLES),
  }, { height: Math.round, radius: Math.round, overlay: Math.round });

  // sections
  pickGroup(
    "sections",
    Object.fromEntries(SECTION_KEYS.map((k) => [k, isBool])) as Record<string, (v: unknown) => boolean>,
  );

  // section order
  if (Array.isArray(src.section_order) && !isLocked(locks, "section_order")) {
    const seen = new Set<string>();
    const order = (src.section_order as unknown[]).filter((k): k is SectionKey => {
      if (typeof k !== "string" || !SECTION_KEYS.includes(k as SectionKey) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (order.length) out.section_order = order;
  }

  // product card
  pickGroup("product_card", {
    ...(Object.fromEntries(CARD_KEYS.map((k) => [k, isBool])) as Record<string, (v: unknown) => boolean>),
    style: oneOf(CARD_STYLES),
    shadow: oneOf(SHADOW_LEVELS),
    radius: num(0, 30),
    image_ratio: oneOf(IMAGE_RATIOS),
    hover: oneOf(HOVER_EFFECTS),
    badge_style: oneOf(BADGE_STYLES),
    button_style: oneOf(BUTTON_STYLES),
    rating_style: oneOf(RATING_STYLES),
    price_style: oneOf(PRICE_STYLES),
  }, { radius: Math.round });

  // buttons
  pickGroup("buttons", {
    radius: num(0, 999),
    style: oneOf(BUTTON_STYLES),
    hover_color: isHex,
    border: num(0, 4),
    shadow: oneOf(SHADOW_LEVELS),
    hover_animation: oneOf(HOVER_EFFECTS),
  }, { radius: Math.round, border: Math.round });

  // spacing
  pickGroup("spacing", {
    container: num(960, 1600),
    section_gap: num(8, 120),
    card_gap: num(4, 48),
    padding: num(0, 48),
  }, {
    container: Math.round,
    section_gap: Math.round,
    card_gap: Math.round,
    padding: Math.round,
  });

  // global
  pickGroup("global", {
    radius: num(0, 30),
    shadow: oneOf(SHADOW_LEVELS),
    animation_level: oneOf(ANIMATION_LEVELS),
  }, { radius: Math.round });

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
    if (typeof f.copyright === "boolean") bucket.copyright = f.copyright;
    if (typeof f.payment_icons === "boolean") bucket.payment_icons = f.payment_icons;
    if (typeof f.layout === "string" && (FOOTER_LAYOUTS as readonly string[]).includes(f.layout)) bucket.layout = f.layout;
    if (Object.keys(bucket).length) out.footer = bucket;
  }

  return out;
}

const SHADOW_CSS: Record<string, string> = {
  low: "0 1px 2px rgb(15 23 42 / 0.06)",
  medium: "0 4px 14px rgb(15 23 42 / 0.08)",
  high: "0 10px 30px rgb(15 23 42 / 0.12)",
  premium: "0 18px 48px -12px rgb(15 23 42 / 0.28)",
};

const ANIM_MS: Record<string, string> = {
  none: "0ms",
  minimal: "120ms",
  modern: "220ms",
  premium: "360ms",
};

const RATIO_CSS: Record<string, string> = {
  square: "1 / 1",
  portrait: "3 / 4",
  landscape: "4 / 3",
};

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
    "--store-success": t.colors.success,
    "--store-warning": t.colors.warning,
    "--store-error": t.colors.error,
    "--store-bg": t.colors.background,
    "--store-surface": t.colors.surface,
    "--store-card": t.colors.card,
    "--store-border": t.colors.border,
    "--store-link": t.colors.link,
    "--store-ink": t.colors.ink,
    "--store-text": t.colors.text,
    "--store-muted": t.colors.muted,
    // Storefront UI tokens (sf-*) so the theme actually drives every visible
    // colour of the Store Panel, not just the legacy --store-* ones.
    "--sf-accent": t.colors.button,
    "--sf-accent-hover": t.buttons.hover_color,
    "--sf-accent-soft": `color-mix(in srgb, ${t.colors.button} 12%, ${t.colors.card})`,
    "--sf-primary": t.colors.primary,
    "--sf-secondary": t.colors.secondary,
    "--sf-highlight": t.colors.accent,
    "--sf-highlight-soft": `color-mix(in srgb, ${t.colors.accent} 14%, ${t.colors.card})`,
    "--sf-card": t.colors.card,
    "--sf-bg": t.colors.background,
    "--sf-header": t.colors.header,
    "--sf-footer": t.colors.footer,
    "--sf-link": t.colors.link,
    "--sf-success": t.colors.success,
    "--sf-warning": t.colors.warning,
    "--sf-error": t.colors.error,
    "--sf-ink": t.colors.ink,
    "--sf-text": t.colors.text,
    "--sf-muted": t.colors.muted,
    "--sf-surface": t.colors.surface,
    "--sf-line": t.colors.border,

    "--radius": `${t.global.radius}px`,
    "--store-btn-radius": `${t.buttons.radius}px`,
    "--store-btn-border": `${t.buttons.border}px`,
    "--store-btn-shadow": SHADOW_CSS[t.buttons.shadow] ?? SHADOW_CSS.low,
    "--store-card-radius": `${t.product_card.radius}px`,
    "--store-card-shadow": SHADOW_CSS[t.product_card.shadow] ?? SHADOW_CSS.low,
    "--store-card-ratio": RATIO_CSS[t.product_card.image_ratio] ?? "1 / 1",
    "--store-shadow": SHADOW_CSS[t.global.shadow] ?? SHADOW_CSS.medium,
    "--store-anim": ANIM_MS[t.global.animation_level] ?? "220ms",
    "--store-heading-font": t.typography.heading_font,
    "--store-body-font": t.typography.body_font,
    "--store-button-font": t.typography.button_font,
    "--store-base-size": `${t.typography.base_size}px`,
    "--store-heading-weight": String(t.typography.heading_weight),
    "--store-body-weight": String(t.typography.body_weight),
    "--store-letter-spacing": `${t.typography.letter_spacing / 100}em`,
    "--store-line-height": String(t.typography.line_height),
    "--store-container": `${t.spacing.container}px`,
    "--store-section-gap": `${t.spacing.section_gap}px`,
    "--store-card-gap": `${t.spacing.card_gap}px`,
    "--store-padding": `${t.spacing.padding}px`,
    "--store-header-height": `${t.header.height}px`,
    "--store-hero-height": `${t.hero.height}px`,
    "--store-hero-radius": `${t.hero.radius}px`,
    "--store-hero-overlay": String(t.hero.overlay / 100),
  };
}
