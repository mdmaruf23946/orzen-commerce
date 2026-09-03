// Landing page base presentation layer.
//
// Everything the public landing renderer needs for its *default* look lives
// here as real CSS instead of React inline styles, so the merchant "Coding"
// tab can override any of it. Cascade layers guarantee the precedence:
//
//   tailwind utilities  <  @layer lp-base  <  @layer lp-user (merchant CSS)
//
// Nothing in this file touches content, product data or business logic.

export const LP_LAYER_ORDER = "@layer lp-base, lp-user;";

export const LP_BASE_CSS = `
${LP_LAYER_ORDER}
@layer lp-base {
  .lp-root {
    background: var(--lp-bg);
    color: var(--lp-text);
  }

  /* Map the template's neutral utilities onto the merchant palette. */
  .lp-root .bg-white,
  .lp-root .bg-neutral-50,
  .lp-root .bg-neutral-100 { background-color: var(--lp-surface); }
  .lp-root .text-neutral-900,
  .lp-root .text-neutral-800 { color: var(--lp-text); }
  .lp-root .text-neutral-700,
  .lp-root .text-neutral-600,
  .lp-root .text-neutral-500,
  .lp-root .text-neutral-400 { color: var(--lp-muted); }
  .lp-root .border-neutral-200,
  .lp-root .border-neutral-100,
  .lp-root .border-neutral-300 { border-color: var(--lp-border); }

  /* Shape helpers */
  .lp-root .lp-round { border-radius: var(--lp-radius); }
  .lp-root .lp-round-sm { border-radius: calc(var(--lp-radius) / 1.5); }
  .lp-root .lp-round-xs { border-radius: calc(var(--lp-radius) / 2); }

  /* Header */
  .lp-root .lp-header {
    border-color: var(--lp-border);
    background: color-mix(in srgb, var(--lp-bg) 90%, transparent);
  }

  /* Buttons */
  .lp-root .lp-btn {
    background: var(--lp-primary);
    color: #fff;
    border-radius: var(--lp-radius);
  }
  .lp-root .lp-btn-sm {
    background: var(--lp-primary);
    color: #fff;
    border-radius: calc(var(--lp-radius) / 2);
  }

  /* Surfaces */
  .lp-root .lp-card {
    background: var(--lp-surface);
    border-radius: var(--lp-radius);
  }

  /* Accents */
  .lp-root .lp-badge { background: var(--lp-accent); }
  .lp-root .lp-accent-bg { background: var(--lp-accent); }
  .lp-root .lp-primary-bg { background: var(--lp-primary); }
  .lp-root .lp-primary-text { color: var(--lp-primary); }
  .lp-root .lp-muted-text { color: var(--lp-muted); }
  .lp-root .lp-text { color: var(--lp-text); }

  /* Form controls */
  .lp-root .lp-input { border-radius: calc(var(--lp-radius) / 2); }

  /* Footer */
  .lp-root .lp-footer {
    background: var(--lp-surface);
    color: var(--lp-text);
    border-top: 1px solid var(--lp-border);
  }
  .lp-root .lp-footer-bottom {
    border-top: 1px solid var(--lp-border);
    color: var(--lp-muted);
  }
}
`;

/** Wraps validated + scoped merchant CSS in the winning cascade layer. */
export function wrapUserLayer(css: string): string {
  const code = String(css ?? "").trim();
  if (!code) return "";
  return `${LP_LAYER_ORDER}\n@layer lp-user {\n${code}\n}\n`;
}
