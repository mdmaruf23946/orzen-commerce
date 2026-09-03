// Server-only AI helpers for the Landing Page "Coding" tab.
//
// The AI may only ever produce CSS for the page's presentation layer. Its
// output goes through the same validator as hand-written code, so it can
// never introduce scripts, imports or anything outside the visual layer.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { autoFixDesignCode, validateDesignCode, MAX_DESIGN_CODE_BYTES } from "@/lib/landing-code";

function model() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  return provider("google/gemini-3.7-flash");
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
  const m = model();
  if (!m) return null;
  try {
    const { text } = await generateText({ model: m, system, prompt });
    const css = cleanOutput(text ?? "");
    if (!css) return null;
    if (new TextEncoder().encode(css).length > MAX_DESIGN_CODE_BYTES) return null;
    const check = validateDesignCode(css);
    return check.ok ? check.css : null;
  } catch {
    return null;
  }
}

/** Repairs broken design CSS while preserving the merchant's design intent. */
export async function fixDesignCode(
  code: string,
  errorMessage: string,
  sections: string[],
): Promise<string | null> {
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
  return run(RULES, prompt);
}

/**
 * Generates a complete product-specific design for a page. Used by the
 * Coding tab and reusable by a future AI Design Generator.
 */
export async function generateDesignCode(input: {
  productName?: string;
  category?: string;
  sections: string[];
  hints?: string;
}): Promise<string | null> {
  const prompt = [
    `Product: ${input.productName || "unknown"}`,
    `Category: ${input.category || "unknown"}`,
    `Sections on this page (in order): ${input.sections.join(", ")}`,
    input.hints ? `Merchant notes: ${input.hints}` : "",
    "",
    "Write a professional, modern design for this landing page: typography scale, section rhythm and spacing, card and button styling, image presentation, hover states, subtle entrance animation, and mobile rules. Style only the sections listed above.",
  ]
    .filter(Boolean)
    .join("\n");
  return run(RULES, prompt);
}
