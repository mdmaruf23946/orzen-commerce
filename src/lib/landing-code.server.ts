// Server-only AI helpers for the Landing Page "Coding" tab.
//
// The AI may only ever produce CSS for the page's presentation layer. Its
// output goes through the same validator as hand-written code, so it can
// never introduce scripts, imports or anything outside the visual layer.
import { generateText } from "ai";
import { autoFixDesignCode, validateDesignCode, MAX_DESIGN_CODE_BYTES } from "@/lib/landing-code";
import { routedModel } from "@/lib/ai-provider.server";

// Runs on the platform owner's own provider keys (Winner Admin → AI).
async function model() {
  try {
    return await routedModel("google/gemini-2.5-flash");
  } catch {
    return null;
  }
}

const RULES = [
  "You write CSS for a single-product e-commerce landing page.",
  "",
  "HARD RULES:",
  "- Output CSS only. No HTML, no JavaScript, no markdown fences, no explanation.",
  "- Never use @import, @charset, expression(), behavior:, javascript: URLs or -moz-binding.",
  "- url() may only reference https://, /api/img/ or data:image/ resources.",
  "- Style presentation only: layout, spacing, typography, cards, buttons, images, responsiveness, animation.",
  "- Never attempt to change text, prices, products, orders, payments or settings — CSS cannot and must not simulate content.",
  "- Use the page palette variables: --lp-primary, --lp-secondary, --lp-accent, --lp-bg, --lp-surface, --lp-text, --lp-muted, --lp-border, --lp-radius.",
  '- Target sections with [data-lp-section="<key>"]. The page root is .lp-root.',
  "- Keep every brace balanced and the whole file under 50 KB.",
].join("\n");

function cleanOutput(text: string): string {
  return text
    .replace(/^\s*```(?:css)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function run(system: string, prompt: string): Promise<string | null> {
  const m = await model();
  if (!m) return null;
  try {
    const { text } = await generateText({ model: m, system, prompt, maxOutputTokens: 32_000 });
    let css = cleanOutput(text ?? "");
    if (!css) return null;
    if (!validateDesignCode(css).ok) css = autoFixDesignCode(css);
    if (new TextEncoder().encode(css).length > MAX_DESIGN_CODE_BYTES) return null;
    const check = validateDesignCode(css);
    return check.ok ? check.css : null;
  } catch {
    return null;
  }
}

/**
 * Repairs broken design CSS while preserving the merchant's design intent.
 *
 * A deterministic repair runs first — it fixes the mistakes pasted code
 * normally has (fences, disallowed rules, unbalanced braces) without any
 * model call. The AI is only used when that is not enough, and the
 * deterministic result is still returned if the AI is unavailable.
 */
export async function fixDesignCode(
  code: string,
  errorMessage: string,
  sections: string[],
): Promise<string | null> {
  const local = autoFixDesignCode(code);
  if (validateDesignCode(local).ok) return local;

  const prompt = [
    `Sections present on this page: ${sections.join(", ") || "header, hero, product, order, footer"}`,
    errorMessage ? `Reported problem: ${errorMessage}` : "The code fails validation.",
    "",
    "Fix the problem in the CSS below. Keep the existing design intent, selectors and values wherever they are valid — change only what is broken or disallowed. Return the complete corrected CSS.",
    "",
    "<css>",
    code,
    "</css>",
  ].join("\n");
  const ai = await run(RULES, prompt);
  if (ai) return ai;

  // Last resort: keep only the parts of the merchant's code that are valid.
  const salvaged = autoFixDesignCode(local);
  return validateDesignCode(salvaged).ok ? salvaged : null;
}


/**
 * Generates a complete product-specific design for a page. Used by the
 * Coding tab and reusable by a future AI Design Generator.
 */
export async function generateDesignCode(input: {
  productName?: string;
  category?: string | null;
  sections: string[];
  hints?: string;
  /** Page palette, so the generated CSS matches the chosen theme. */
  palette?: Partial<Record<"primary" | "secondary" | "accent" | "background" | "text", string>>;
  /** Offer model driving the page, when it sells more than one product. */
  offerType?: string | null;
  tierCount?: number;
}): Promise<string | null> {
  const palette = input.palette
    ? Object.entries(input.palette)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "";

  const prompt = [
    `Product: ${input.productName || "unknown"}`,
    `Category: ${input.category || "unknown"}`,
    `Sections on this page (in order): ${input.sections.join(", ")}`,
    palette ? `Page palette (already applied as CSS variables): ${palette}` : "",
    input.offerType && input.offerType !== "single"
      ? `This page sells a multi-product offer of type "${input.offerType}" with ${input.tierCount ?? 0} purchase options rendered inside .lp-offer as .lp-offer-tier cards (one has .is-featured). Give the offer block premium treatment: clear price hierarchy (.lp-price, .lp-price-old, .lp-save-badge), comparable tier cards, a highlighted recommended tier, and an obvious selected state (.lp-offer-tier[aria-pressed="true"]).`
      : "",
    input.hints ? `Merchant notes: ${input.hints}` : "",
    "",
    "Write a premium, modern e-commerce design for this landing page. Cover: page background and section backgrounds (subtle gradients allowed), typography scale and weights, section rhythm and spacing, container widths, product and offer cards with borders/radius/shadows, pricing presentation, primary and secondary buttons, image presentation, visual hierarchy, hover states, smooth transitions, tasteful entrance animation, and full mobile rules under 768px. Style only the sections listed above. Aim for a rich, complete stylesheet, not a few colour tweaks.",
  ]
    .filter(Boolean)
    .join("\n");
  return run(RULES, prompt);
}
