// Landing Page "Coding" layer — the visual design code of a published page.
//
// The coding layer is CSS ONLY. It styles the markup produced by the existing
// section system and can never read or change content, orders, payments,
// customers, products, store settings or domains.
//
// Everything a merchant (or the AI design generator) writes is validated and
// then automatically scoped to the landing page root, so a page can never
// affect the Merchant Panel or another page.

export const LP_SCOPE = ".lp-root";
export const MAX_DESIGN_CODE_BYTES = 60_000;

export type DesignCodeCheck =
  | { ok: true; css: string }
  | { ok: false; error: string; line?: number };

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const FORBIDDEN: { re: RegExp; msg: string }[] = [
  { re: /@import\b/i, msg: "@import is not allowed. Paste the styles directly instead." },
  { re: /@charset\b/i, msg: "@charset is not allowed." },
  { re: /expression\s*\(/i, msg: "expression() is not allowed." },
  // Only the legacy IE `behavior:` property — never `scroll-behavior`,
  // `-webkit-...-behavior`, `overscroll-behavior` and friends.
  { re: /(?<![\w-])behavior\s*:/i, msg: "The behavior property is not allowed." },
  { re: /javascript\s*:/i, msg: "javascript: URLs are not allowed." },
  {
    re: /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?>/i,
    msg: "HTML or <script> markup is not allowed — this editor accepts CSS only.",
  },
  { re: /-moz-binding/i, msg: "-moz-binding is not allowed." },
];

/** Removes comments but keeps line numbers identical to the original source. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function lineOf(css: string, index: number): number {
  return css.slice(0, index).split("\n").length;
}


/** Validates raw design CSS. Returns the cleaned (comment-preserving) source. */
export function validateDesignCode(raw: string): DesignCodeCheck {
  const css = String(raw ?? "");
  if (!css.trim()) return { ok: true, css: "" };

  if (new TextEncoder().encode(css).length > MAX_DESIGN_CODE_BYTES) {
    return { ok: false, error: `Design code is too large (max ${Math.round(MAX_DESIGN_CODE_BYTES / 1000)} KB).` };
  }

  const bare = stripComments(css);

  for (const rule of FORBIDDEN) {
    const m = rule.re.exec(bare);
    if (m) return { ok: false, error: rule.msg, line: lineOf(bare, m.index) };
  }

  // url(...) may only point at https or an inline image.
  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let u: RegExpExecArray | null;
  while ((u = urlRe.exec(bare))) {
    const value = (u[2] ?? "").trim();
    const allowed =
      value.startsWith("https://") ||
      value.startsWith("/api/img/") ||
      value.startsWith("data:image/") ||
      value.startsWith("#");
    if (!allowed) {
      return {
        ok: false,
        error: `url(${value}) is not allowed. Use an https:// image, an uploaded /api/img/ path, or a data:image URL.`,
        line: lineOf(bare, u.index),
      };
    }
  }

  // Brace balance (the single most common hand-editing mistake).
  let depth = 0;
  for (let i = 0; i < bare.length; i++) {
    const ch = bare[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth < 0) return { ok: false, error: "Unexpected `}` — one closing brace too many.", line: lineOf(bare, i) };
    }
  }
  if (depth > 0) return { ok: false, error: `Missing ${depth} closing brace${depth > 1 ? "s" : ""} (\`}\`).` };

  return { ok: true, css };
}

/* ------------------------------------------------------------------ */
/* Scoping                                                             */
/* ------------------------------------------------------------------ */

const NESTED_AT = /^@(media|supports|container|layer|scope)\b/i;
const RAW_AT = /^@(keyframes|-webkit-keyframes|font-face|property|counter-style|page)\b/i;

function splitTopLevel(selectorList: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of selectorList) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(buf);
      buf = "";
    } else buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function scopeSelector(selector: string): string {
  const sel = selector.trim();
  if (!sel) return sel;
  if (sel.startsWith("%")) return sel; // placeholder-ish, leave alone
  if (sel.startsWith(LP_SCOPE)) return sel;
  // Root-ish selectors become the page root itself.
  const rootish = sel.replace(/^(:root|html|body)\b/, "").trim();
  if (rootish !== sel) return rootish ? `${LP_SCOPE} ${rootish}` : LP_SCOPE;
  if (sel.startsWith("&")) return sel.replace("&", LP_SCOPE);
  return `${LP_SCOPE} ${sel}`;
}

/**
 * Rewrites every selector so it can only match inside the landing page root.
 * `@media` / `@supports` blocks are recursed into; `@keyframes` and
 * `@font-face` bodies are kept verbatim.
 */
export function scopeDesignCode(raw: string): string {
  const css = String(raw ?? "");
  if (!css.trim()) return "";
  return scopeBlock(stripComments(css));
}

function scopeBlock(css: string): string {
  let out = "";
  let i = 0;

  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) {
      // Trailing at-statement such as `@layer a, b;`
      const rest = css.slice(i).trim();
      if (rest.startsWith("@")) out += `${rest}\n`;
      break;
    }

    let prelude = css.slice(i, open).trim();

    // Statement at-rules before this block (e.g. `@layer base;`).
    const semi = prelude.lastIndexOf(";");
    if (semi !== -1) {
      const statements = prelude.slice(0, semi + 1).trim();
      if (statements.startsWith("@")) out += `${statements}\n`;
      prelude = prelude.slice(semi + 1).trim();
    }

    // Find the matching closing brace.
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, depth === 0 ? j - 1 : css.length);
    i = j;

    if (!prelude) continue;

    if (prelude.startsWith("@")) {
      if (NESTED_AT.test(prelude)) {
        out += `${prelude}{\n${scopeBlock(body)}}\n`;
      } else if (RAW_AT.test(prelude)) {
        out += `${prelude}{${body}}\n`;
      } else {
        // Unknown at-rule with a block — keep it, but do not scope it.
        out += `${prelude}{${body}}\n`;
      }
      continue;
    }

    const scoped = splitTopLevel(prelude).map(scopeSelector).filter(Boolean).join(",\n");
    out += `${scoped}{${body}}\n`;
  }

  return out;
}

/** Validate + scope in one step. Returns "" when the code is unusable. */
export function safeDesignCss(raw: string | null | undefined): string {
  const check = validateDesignCode(String(raw ?? ""));
  if (!check.ok) return "";
  return scopeDesignCode(check.css);
}

/* ------------------------------------------------------------------ */
/* Default design code                                                 */
/* ------------------------------------------------------------------ */

/** Human labels for the style hooks available on a page. */
export function designHooks(sectionKeys: string[]): { selector: string; label: string }[] {
  const base = [
    { selector: ".lp-root", label: "Page root (background, base font)" },
    { selector: "[data-lp-section]", label: "Every section wrapper" },
    { selector: "[data-lp-section] > section", label: "Section inner block (padding, width)" },
    { selector: "[data-lp-section] h2", label: "Section headings" },
    { selector: '[data-lp-section="header"]', label: "Header" },
    { selector: ".lp-header", label: "Header bar surface" },
    { selector: '[data-lp-section="hero"]', label: "Hero" },
    { selector: '[data-lp-section="order"]', label: "Order form" },
    { selector: ".lp-btn", label: "Primary buttons" },
    { selector: ".lp-btn-sm", label: "Small buttons" },
    { selector: ".lp-card", label: "Cards / surfaces" },
    { selector: ".lp-input", label: "Form inputs" },
    { selector: ".lp-badge", label: "Offer badge" },
    { selector: ".lp-offer", label: "Offer block (purchase options)" },
    { selector: ".lp-offer-tier", label: "Offer option card" },
    { selector: ".lp-offer-tier.is-selected", label: "Selected offer option" },
    { selector: ".lp-offer-tier.is-featured", label: "Highlighted offer option" },
    { selector: ".lp-price", label: "Price" },
    { selector: ".lp-price-old", label: "Original (struck) price" },
    { selector: ".lp-save-badge", label: "Savings badge" },
    { selector: ".lp-footer", label: "Footer" },
  ];
  const extra = sectionKeys
    .filter((k) => !["header", "hero", "order", "footer"].includes(k))
    .map((k) => ({ selector: `[data-lp-section="${k}"]`, label: `Section: ${k}` }));
  return [...base, ...extra];
}


/**
 * The system design that a page starts from. It is real, working CSS — the
 * merchant can edit any part of it, and "Reset to default" brings it back.
 */
export function defaultDesignCode(sectionKeys: string[] = []): string {
  const list = sectionKeys.length ? sectionKeys.join(", ") : "header, hero, product, order, footer";
  return `/* ------------------------------------------------------------------
   Landing page design code (CSS only)

   This styles the sections your Content tab produces. It never changes
   any content, price, order or setting.

   Sections on this page: ${list}

   Palette variables come from the Design tab:
     var(--lp-primary)  var(--lp-secondary)  var(--lp-accent)
     var(--lp-bg)       var(--lp-surface)    var(--lp-text)
     var(--lp-muted)    var(--lp-border)     var(--lp-radius)

   Target a section with:  [data-lp-section="hero"] { ... }

   Reusable element hooks:
     .lp-header  .lp-card  .lp-btn  .lp-btn-sm  .lp-input
     .lp-badge   .lp-footer  .lp-round  .lp-round-sm  .lp-round-xs

------------------------------------------------------------------ */

/* Base typography ------------------------------------------------- */
.lp-root {
  --lp-section-space: 3rem;
  font-feature-settings: "liga" 1;
  letter-spacing: -0.01em;
}

[data-lp-section] h2 {
  font-size: clamp(1.35rem, 1.05rem + 1.4vw, 2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}

/* Section rhythm --------------------------------------------------- */
[data-lp-section] > section {
  padding-top: var(--lp-section-space);
  padding-bottom: var(--lp-section-space);
}

[data-lp-section]:nth-of-type(even) {
  background: color-mix(in srgb, var(--lp-surface) 60%, transparent);
}

/* Hero ------------------------------------------------------------- */
[data-lp-section="hero"] h1 {
  letter-spacing: -0.03em;
  line-height: 1.1;
}

[data-lp-section="hero"] img {
  border-radius: var(--lp-radius);
  box-shadow: 0 24px 60px -30px color-mix(in srgb, var(--lp-text) 55%, transparent);
}

/* Cards ------------------------------------------------------------ */
[data-lp-section] .lp-card,
[data-lp-section] .rounded-xl,
[data-lp-section] .rounded-2xl {
  border-radius: var(--lp-radius);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}

@media (hover: hover) {
  [data-lp-section] .lp-card:hover,
  [data-lp-section] .rounded-xl:hover,
  [data-lp-section] .rounded-2xl:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 40px -28px color-mix(in srgb, var(--lp-text) 60%, transparent);
  }
}


/* Buttons ---------------------------------------------------------- */
.lp-root a[href="#order"],
.lp-root button[type="submit"] {
  transition: transform 0.18s ease, filter 0.18s ease;
}

.lp-root a[href="#order"]:hover,
.lp-root button[type="submit"]:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

/* Order form ------------------------------------------------------- */
[data-lp-section="order"] input,
[data-lp-section="order"] textarea,
[data-lp-section="order"] select {
  border-radius: calc(var(--lp-radius) / 1.6);
}

/* Motion ----------------------------------------------------------- */
@media (prefers-reduced-motion: no-preference) {
  [data-lp-section] {
    animation: lp-rise 0.5s ease both;
  }
}

@keyframes lp-rise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}

/* Responsive ------------------------------------------------------- */
@media (max-width: 640px) {
  .lp-root { --lp-section-space: 2rem; }
  [data-lp-section="hero"] h1 { font-size: 1.75rem; }
}
`;
}

/* ------------------------------------------------------------------ */
/* Deterministic repair (no AI needed)                                 */
/* ------------------------------------------------------------------ */

/**
 * Repairs the mistakes that pasted CSS normally has: markdown fences,
 * disallowed declarations/at-rules, bad url() values and unbalanced braces.
 * Design intent is preserved — only the offending pieces are removed.
 */
export function autoFixDesignCode(raw: string): string {
  let css = String(raw ?? "");

  // Markdown fences from chat tools.
  css = css.replace(/```[a-z]*\s*/gi, "");

  // Stray HTML markup (e.g. a pasted <style> wrapper).
  css = css.replace(/<\/?[a-z][a-z0-9-]*(\s[^<>]*)?>/gi, "");

  // Disallowed at-rules (whole statement).
  css = css.replace(/@(?:import|charset)[^;{}]*;?/gi, "");

  // Disallowed declarations.
  css = css.replace(/(?<![\w-])behavior\s*:[^;{}]*;?/gi, "");
  css = css.replace(/[^;{}]*-moz-binding\s*:[^;{}]*;?/gi, "");
  css = css.replace(/[^;{}]*expression\s*\([^;{}]*\)[^;{}]*;?/gi, "");
  css = css.replace(/[^;{}]*javascript\s*:[^;{}]*;?/gi, "");

  // url() values that are not allowed → drop the whole declaration.
  css = css.replace(/[^;{}]*url\(\s*(['"]?)([^'")]*)\1\s*\)[^;{}]*;?/gi, (decl, _q, value: string) => {
    const v = String(value).trim();
    const ok =
      v.startsWith("https://") ||
      v.startsWith("/api/img/") ||
      v.startsWith("data:image/") ||
      v.startsWith("#");
    return ok ? decl : "";
  });

  // Brace balance.
  const bare = stripComments(css);
  let depth = 0;
  let cut = "";
  for (let i = 0; i < bare.length; i++) {
    const ch = bare[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      if (depth === 0) continue; // drop the extra closing brace
      depth--;
    }
    cut += css[i];
  }
  css = cut;
  if (depth > 0) css += `\n${"}".repeat(depth)}\n`;

  // Size guard: keep the leading (most important) rules.
  const enc = new TextEncoder();
  if (enc.encode(css).length > MAX_DESIGN_CODE_BYTES) {
    let end = css.length;
    while (end > 0 && enc.encode(css.slice(0, end)).length > MAX_DESIGN_CODE_BYTES - 200) {
      end = Math.floor(end * 0.9);
    }
    const lastClose = css.lastIndexOf("}", end);
    css = css.slice(0, lastClose > 0 ? lastClose + 1 : end);
  }

  return css.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
