// Landing page design tokens: five merchant-editable color roles plus every
// derived state (hover, tint, border, button foreground) computed here with
// automatic contrast checking. Shared by the builder UI and the public page.

export type LandingPalette = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
};

export type LandingThemePreset = LandingPalette & {
  id: string;
  name: string;
};

export const COLOR_ROLES: { key: keyof LandingPalette; label: string; hint: string }[] = [
  { key: "primary", label: "Primary", hint: "Buttons and main highlights" },
  { key: "secondary", label: "Secondary", hint: "Supporting surfaces" },
  { key: "accent", label: "Accent", hint: "Badges, stars, offers" },
  { key: "background", label: "Background", hint: "Page background" },
  { key: "text", label: "Text", hint: "Body text color" },
];

export const DEFAULT_PALETTE: LandingPalette = {
  primary: "#16a34a",
  secondary: "#0f172a",
  accent: "#f59e0b",
  background: "#ffffff",
  text: "#171717",
};

// ---------- color math ----------

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value: unknown): boolean {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

export function normalizeHex(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  if (!HEX_RE.test(raw)) return fallback;
  let hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex.toLowerCase()}`;
}

function toRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex, "#000000").slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors (1 – 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white — whichever stays readable on `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio("#ffffff", bg) >= contrastRatio("#111111", bg) ? "#ffffff" : "#111111";
}

/** Mix two colors; `amount` = share of `b`. */
export function mix(a: string, b: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function darken(hex: string, amount = 0.12): string {
  return mix(hex, "#000000", amount);
}

export function lighten(hex: string, amount = 0.12): string {
  return mix(hex, "#ffffff", amount);
}

/**
 * Nudges `fg` toward black or white until it reaches `min` contrast on `bg`,
 * so a merchant can never save unreadable text.
 */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  const target = luminance(bg) > 0.5 ? "#000000" : "#ffffff";
  let out = fg;
  for (let i = 1; i <= 10; i++) {
    out = mix(fg, target, i / 10);
    if (contrastRatio(out, bg) >= min) return out;
  }
  return target;
}

// ---------- tokens ----------

export type LandingTokens = Record<string, string>;

/** Full `--lp-*` token set derived from the five roles. */
export function themeTokens(palette: LandingPalette): LandingTokens {
  const p = normalizePalette(palette);
  const isDarkBg = luminance(p.background) < 0.4;
  const surface = isDarkBg ? lighten(p.background, 0.08) : darken(p.background, 0.03);

  return {
    "--lp-primary": p.primary,
    "--lp-primary-hover": isDarkBg ? lighten(p.primary, 0.12) : darken(p.primary, 0.14),
    "--lp-primary-soft": mix(p.background, p.primary, 0.12),
    "--lp-on-primary": readableOn(p.primary),
    "--lp-secondary": p.secondary,
    "--lp-secondary-soft": mix(p.background, p.secondary, 0.1),
    "--lp-on-secondary": readableOn(p.secondary),
    "--lp-accent": p.accent,
    "--lp-accent-soft": mix(p.background, p.accent, 0.14),
    "--lp-on-accent": readableOn(p.accent),
    "--lp-bg": p.background,
    "--lp-surface": surface,
    "--lp-border": mix(p.background, p.text, 0.14),
    "--lp-text": ensureContrast(p.text, p.background, 4.5),
    "--lp-muted": mix(p.background, p.text, 0.62),
    "--lp-radius": "1rem",
  };
}

export function normalizePalette(raw: unknown): LandingPalette {
  const r = (raw ?? {}) as Record<string, unknown>;
  const legacyAccent = normalizeHex(r["accent"], DEFAULT_PALETTE.accent);
  const dark = Boolean(r["dark"]);
  return {
    primary: normalizeHex(r["primary"], DEFAULT_PALETTE.primary),
    secondary: normalizeHex(r["secondary"], dark ? "#e2e8f0" : DEFAULT_PALETTE.secondary),
    accent: legacyAccent,
    background: normalizeHex(r["background"], dark ? "#0b1120" : DEFAULT_PALETTE.background),
    text: normalizeHex(r["text"], dark ? "#f8fafc" : DEFAULT_PALETTE.text),
  };
}

/** Contrast report shown in the Design tab. */
export function contrastReport(palette: LandingPalette) {
  const p = normalizePalette(palette);
  return [
    { label: "Body text on background", ratio: contrastRatio(p.text, p.background) },
    { label: "Button label on primary", ratio: contrastRatio(readableOn(p.primary), p.primary) },
    { label: "Accent on background", ratio: contrastRatio(p.accent, p.background) },
  ].map((r) => ({ ...r, pass: r.ratio >= 4.5 }));
}

/** Deterministic professional fallbacks when AI is unavailable. */
export const FALLBACK_THEMES: LandingThemePreset[] = [
  { id: "clean-navy", name: "Clean White + Navy + Blue", primary: "#1d4ed8", secondary: "#1e293b", accent: "#0ea5e9", background: "#ffffff", text: "#0f172a" },
  { id: "premium-gold", name: "Premium White + Charcoal + Gold", primary: "#111827", secondary: "#374151", accent: "#c9a227", background: "#fdfdfc", text: "#111827" },
  { id: "fresh-green", name: "Fresh White + Blue + Green", primary: "#0f766e", secondary: "#1e3a8a", accent: "#22c55e", background: "#f8fefb", text: "#0f172a" },
  { id: "warm-sand", name: "Warm Sand + Terracotta", primary: "#b45309", secondary: "#7c2d12", accent: "#f59e0b", background: "#fffaf3", text: "#1c1917" },
  { id: "midnight-violet", name: "Midnight + Violet", primary: "#7c3aed", secondary: "#1e1b4b", accent: "#22d3ee", background: "#0b1020", text: "#f8fafc" },
];
