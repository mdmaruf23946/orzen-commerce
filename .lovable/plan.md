# Content Language Step in AI Landing Page Creation

Add one small language choice to the existing Create Landing Page dialog. Nothing else changes — sections, tabs, settings, design and creation logic stay exactly as they are.

## Flow

```text
Create Landing Page → select product → Content Language (বাংলা / English / বাংলা+English)
   → [ Create Landing Page ] → AI generates → editor opens
```

The language block appears only after a product is selected, directly above the Create button. Three radio-style options, default English. No other new options.

## AI behaviour

The chosen language is passed to the generator as a required output language and applies to every AI-written field: hero headline and description, product description, benefits, FAQ, CTA text, order form text, footer text and all other generated copy.

- বাংলা: all generated copy in natural, professional Bengali.
- English: all generated copy in natural, professional English.
- বাংলা+English: natural Bengali with common English terms kept where merchants normally use them.

Product name, brand, model numbers and technical terms stay in their original form — existing product data is used as source information, not translated. Facts, prices, images, specs and reviews behave exactly as today, and if AI fails the page is still created with template content.

## Technical notes

- `src/routes/_authenticated/admin/landing-builder.index.tsx`: `CreateDialog` gains a `lang` state (`'en' | 'bn' | 'mixed'`, default `'en'`) rendered as a compact three-button group, passed as `contentLang` in the `createLandingPage` call.
- `src/lib/landing-builder.functions.ts`: `createLandingPage` input validator accepts optional `contentLang` enum and forwards it to `generateLandingCopy`.
- `src/lib/landing-ai.server.ts`: `generateLandingCopy` takes the language and replaces the current "match the product's language" STYLE line with an explicit instruction for the selected language, plus a rule to keep product names/brands/model numbers untranslated. Default remains English when nothing is passed.
