# Smart Language Switcher + FAQ Grid

## 1. Language switcher in the header

Add an "EN | বাংলা" toggle to the navbar (desktop bar and mobile menu). English stays the default.

- The choice is remembered in the browser, so a returning visitor keeps their language.
- Switching is instant — no page reload, no flash of the wrong language.
- The `<html lang>` attribute updates to `en` / `bn` for SEO and screen readers.

### Smart Bangla mode

Bangla mode is a professional bilingual mix, not a literal translation:

- Headlines, benefit text, instructions, FAQ answers and CTA buttons become clear professional Bengali — e.g. "আপনার অনলাইন স্টোর তৈরি করুন মাত্র কয়েক মিনিটে", "বিনামূল্যে স্টোর খুলুন".
- Product and technical terms stay in English inside the Bengali sentence: eCommerce, AI Sales Agent, Courier Integration, Dashboard, Facebook Pixel, SEO, Analytics, Messenger, WhatsApp, API, plan names.
- Numbers, prices and brand names are untouched.

### Coverage

All landing sections: header/nav, hero, trust bar, features, AI showcase, workflow, dashboard showcase (tab pills and mock labels stay English since they are product UI), why-ORZEN, testimonials heading, FAQ, final CTA.

Footer: static labels only — the description fallback, column headings ("Product", "Company", "Legal", "Contact") and the copyright line. Owner-entered link text, contact details and reviews from the Owner Panel render exactly as typed; the owner can enter Bangla there themselves.

## 2. FAQ layout

- Two-column grid on desktop (`md:grid-cols-2`), single column on mobile, wider container than today.
- Only the first 6 questions show by default; a "View all FAQs" / "সব প্রশ্ন দেখুন" button reveals the remaining 9, with a "Show less" state to collapse again.
- Accordion behaviour, styling and the `#faq` anchor stay the same.

## Technical notes

- New `src/lib/i18n.tsx`: `LangProvider` + `useLang()` (context + `localStorage` key `orzen-lang`), and a `t(key)` lookup over a typed dictionary of `{ en, bn }` string pairs. Provider is mounted inside the landing route so store/admin surfaces are unaffected.
- New `src/lib/landing-copy.ts` holds every landing string as an `{ en, bn }` pair; `src/routes/index.tsx` sections read from it instead of inline literals. Data arrays (`FEATURES`, `STEPS`, `WHY`, `FAQS`, `NAV`) become bilingual objects.
- `SiteFooter.tsx` reads the same context for its static labels, falling back to English when rendered outside the provider.
- `FAQ()` gets a `showAll` state, grid wrapper, and `Accordion type="single"` retained per column-agnostic list.
- SSR-safe: language resolves to `en` on the server and syncs from `localStorage` after hydration to avoid hydration mismatch.
- No database, routing or backend changes.
