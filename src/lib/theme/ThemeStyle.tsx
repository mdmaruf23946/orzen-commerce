// Turns a resolved ThemeDefinition into real, visible storefront styling.
// The CSS variables alone were not enough: nothing consumed the typography,
// radius, shadow, spacing or card tokens. This component scopes a single style
// block to the storefront root and loads the selected Google fonts.
import { useEffect } from "react";
import { themeCssVars, type ThemeDefinition } from "./definition";

export const THEME_SCOPE = "orzen-theme";


const STACK = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;

const HOVER_CSS: Record<string, string> = {
  none: "",
  lift: `.${THEME_SCOPE} .theme-card:hover{transform:translateY(-3px)}`,
  zoom: `.${THEME_SCOPE} .theme-card:hover .theme-card-img{transform:scale(1.06)}`,
  glow: `.${THEME_SCOPE} .theme-card:hover{box-shadow:0 0 0 2px var(--store-btn-bg), var(--store-card-shadow)}`,
};

const CARD_SURFACE: Record<string, string> = {
  flat: `background:var(--store-card);border:0;box-shadow:none;`,
  bordered: `background:var(--store-card);border:1px solid var(--store-border);box-shadow:none;`,
  elevated: `background:var(--store-card);border:1px solid transparent;box-shadow:var(--store-card-shadow);`,
  glass: `background:color-mix(in srgb, var(--store-card) 70%, transparent);border:1px solid var(--store-border);backdrop-filter:blur(10px);box-shadow:var(--store-card-shadow);`,
};

function fontHref(fonts: string[]) {
  const families = Array.from(new Set(fonts.filter(Boolean)))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Loads the theme fonts once per unique combination (client-side, idempotent). */
function useThemeFonts(fonts: string[]) {
  const href = fontHref(fonts);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector(`link[data-theme-fonts="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-theme-fonts", href);
    document.head.appendChild(link);
  }, [href]);
}

export function ThemeStyle({ theme }: { theme: ThemeDefinition }) {
  const t = theme;
  useThemeFonts([t.typography.heading_font, t.typography.body_font, t.typography.button_font]);

  // The drawer/dialog/dropdown layers render in a portal on <body>, outside the
  // scoped storefront wrapper. Publishing the same variables on :root makes the
  // theme reach those layers too (this component only mounts on storefront pages).
  const rootVars = Object.entries(themeCssVars(t))
    .map(([k, v]) => `${k}:${v};`)
    .join("");

  const css = `
:root{${rootVars}}
.${THEME_SCOPE}{

  background:var(--store-bg);
  font-family:var(--store-body-font), ${STACK};
  font-size:var(--store-base-size);
  line-height:var(--store-line-height);
  letter-spacing:var(--store-letter-spacing);
  font-weight:var(--store-body-weight);
}
.${THEME_SCOPE} h1,.${THEME_SCOPE} h2,.${THEME_SCOPE} h3,.${THEME_SCOPE} h4{
  font-family:var(--store-heading-font), ${STACK};
  font-weight:var(--store-heading-weight);
  letter-spacing:var(--store-letter-spacing);
}
.${THEME_SCOPE} button,.${THEME_SCOPE} .theme-btn{font-family:var(--store-button-font), ${STACK};}
.${THEME_SCOPE} .theme-btn{
  border-radius:var(--store-btn-radius);
  box-shadow:var(--store-btn-shadow);
  transition:transform var(--store-anim) ease, box-shadow var(--store-anim) ease, opacity var(--store-anim) ease;
}
.${THEME_SCOPE} .theme-btn-outline{
  border-width:var(--store-btn-border);
  border-style:solid;
  border-color:var(--store-btn-bg);
}
.${THEME_SCOPE} .theme-btn:hover:not(:disabled){background-color:var(--store-btn-hover)}
.${THEME_SCOPE} .theme-card{
  border-radius:var(--store-card-radius);
  overflow:hidden;
  transition:transform var(--store-anim) ease, box-shadow var(--store-anim) ease;
  ${CARD_SURFACE[t.product_card.style] ?? CARD_SURFACE.bordered}
}
.${THEME_SCOPE} .theme-card-media{aspect-ratio:var(--store-card-ratio);}
.${THEME_SCOPE} .theme-card-img{transition:transform var(--store-anim) ease;}
${HOVER_CSS[t.product_card.hover] ?? ""}
.${THEME_SCOPE} .theme-badge{border-radius:${
    t.product_card.badge_style === "square" ? "4px" : t.product_card.badge_style === "ribbon" ? "0 8px 8px 0" : "999px"
  };}
.${THEME_SCOPE} .theme-header{height:var(--store-header-height);}
.${THEME_SCOPE} .theme-container{max-width:var(--store-container);margin-inline:auto;}
.${THEME_SCOPE} .theme-sections{display:flex;flex-direction:column;gap:0.75rem;}
.${THEME_SCOPE} .theme-grid{gap:var(--store-card-gap);}
`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
