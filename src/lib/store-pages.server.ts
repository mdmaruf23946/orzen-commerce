// Server-only helpers for merchant-editable storefront pages.
import createDOMPurify from "isomorphic-dompurify";
import { generatePage, type LegalPageKey, type LegalInfo } from "@/lib/legal-templates.server";
import { storePageDef } from "@/lib/store-pages";

const ALLOWED_TAGS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td", "img",
];

/** Strips scripts, event handlers and unsafe URLs from merchant-authored HTML. */
export function sanitizePageHtml(html: string): string {
  return createDOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "colspan", "rowspan"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/)/i,
  });
}

/** Generates starter content for a page from the store's business information. */
export function starterContent(
  key: string,
  info: LegalInfo,
): { title: string; description: string; html: string } {
  const def = storePageDef(key);
  const legalKey = def?.legalKey as LegalPageKey | undefined;
  if (legalKey) {
    const page = generatePage(legalKey, info);
    return {
      title: page.title,
      description: page.description,
      html: sanitizePageHtml(page.html),
    };
  }
  const label = def?.label ?? "Page";
  return {
    title: `${label} — ${info.store_name}`,
    description: def?.defaultDescription ?? `${label} for ${info.store_name}.`,
    html: sanitizePageHtml(
      `<p>Welcome to ${info.store_name}. Use this space to tell your customers more about this page.</p>`,
    ),
  };
}
