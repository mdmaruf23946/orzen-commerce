# AI Product Builder (Premium)

Add a second product creation flow inside the existing Products page. Manual Add stays untouched; a toggle picks the mode. Gated by the `ai_product_builder` plan feature via `FeatureGate` — free plans see an upgrade CTA linking to `/admin/billing`.

## UX

On `src/routes/_authenticated/admin/products.tsx`, the "Add product" button opens a small mode picker:
- **Manual** → existing `ProductDialog` (unchanged).
- **AI Builder** → new `AIProductBuilderDialog` (same shell/design tokens).

AI Builder is a 2-step wizard, then a Preview:

1. **Images** — reuse `GalleryUploader` behavior (multi-file, drag/drop, camera via `capture` attr, `compressImage`, ≤5 MB, ≤8 imgs, WebP). Uploads to `store-assets/{storeId}/ai-tmp/...`.
2. **Description** — large textarea with the placeholder from the spec, char counter, 4000 char cap. "Generate Product" button.
3. **Preview** — renders all AI-filled fields inside a lightly wrapped `ProductDialog` (prefilled `editing` prop) so every field is editable and Save goes through the existing `upsertProduct` server function. No new DB schema.

Right-side "AI Suggestions" panel shows confidence %, completeness, SEO score, missing fields, category suggestion, price suggestion. Purely advisory.

Generation progress uses a stepper with the labels from the spec (Analyzing Images → … → Done), driven by SSE `data:` progress events from the server.

## Server

New `src/lib/ai-product-builder.functions.ts`:
- `generateProductDraft` — `createServerFn({ method: "POST" })` with `requireSupabaseAuth`.
  - Inputs: `{ imagePaths: string[]; description: string }` (Zod, description ≤4000, ≤8 images, all paths under `${storeId}/ai-tmp/`).
  - `assertPlan(context.supabase, context.userId, "ai_product_builder")` for server-side gating.
  - Signs each image via `store-assets` (short expiry) and passes them as `image_url` parts to `openai/gpt-5.5` via `createLovableAiGatewayProvider` using `generateText` + `Output.object` with a **small, flat, constraint-free** Zod schema (name, short_desc, long_desc_html, brand, category_guess, subcategory_guess, tags[], features[], specs[{key,value}], includes[], keywords[], alt_texts[], variant_options[{name,values[]}], suggested_price, suggested_old_price, suggested_weight_g, dimensions{l,w,h}, seo{title,description,slug}, confidence, missing[], primary_image_index). Limits stated in prompt, clamped in code. Wrapped in `NoObjectGeneratedError` fallback.
  - Prompt-injection guard: description is wrapped in `<user_description>` fences with a system instruction to treat it as data only.
  - Category/subcategory: resolved to existing rows in `categories` by name (case-insensitive); low confidence → return names only, UI asks admin to confirm.
  - Returns a draft shaped exactly like `upsertProduct` input (existing schema), plus a `suggestions` block for the sidebar. No DB write.

New route `src/routes/api/ai/product-builder-stream.ts` — thin SSE wrapper that emits stage events while awaiting `generateProductDraft` server-side, so the client can render the progress stepper. Auth via existing session; validates the same inputs.

Duplicate guard: hash `(storeId + normalized name + first image path)` in-memory per session; block re-submits of an identical draft within 60s.

## Feature flag

- Add `ai_product_builder` to `FEATURE_LABELS` and the plan features JSON (defaults: false on free/trial-free, true on premium tiers). Owner package editor already edits `features` JSON — no schema change.
- Client: wrap the AI mode entry with `FeatureGate feature="ai_product_builder"`.
- Server: `assertPlan(..., "ai_product_builder")` in both the server function and SSE route.

## Files

Add:
- `src/lib/ai-product-builder.functions.ts`
- `src/routes/api/ai/product-builder-stream.ts`
- `src/components/admin/product-form/AIProductBuilderDialog.tsx` (2-step wizard + suggestions panel; on "Use draft" opens the existing `ProductDialog` prefilled)
- `src/components/admin/product-form/AIModePicker.tsx` (small chooser popover)

Edit:
- `src/routes/_authenticated/admin/products.tsx` — replace "Add product" click to open `AIModePicker`; keep every other behavior identical.
- `src/lib/features.ts` — add `ai_product_builder` key + Bengali label.

No changes to `products` schema, `upsertProduct`, existing dialog, or manual flow.

## Technical notes

- Model: default `openai/gpt-5.5` (multimodal), via existing `createLovableAiGatewayProvider` helper; structured output uses `Output.object` with `structuredOutputs: true` provider option — schema is flat, no `.min/.max`, limits stated in prompt.
- Images passed as signed `store-assets` URLs (never base64 in the model request) to keep payload small and cache-friendly.
- Progress SSE: server emits `event: stage` frames (`analyzing`, `understanding`, `generating`, `variants`, `seo`, `done`) at real checkpoints (image sign, model start, model finish, category resolve, done).
- Errors surface via toast; 402/429 from gateway shown verbatim.
- All uploads and generated drafts stay in `ai-tmp/`; only on Save (through `upsertProduct`) do the chosen images become part of the product `gallery`. Unused `ai-tmp/` files are ignored (existing storage lifecycle handles cleanup if configured).
- Architecture leaves room for future sources by keeping the AI call behind `generateProductDraft({ inputs: { images?, text?, url?, barcode?, pdf?, audio? } })` — only `images`/`text` are wired now; other keys are typed but rejected until enabled.
