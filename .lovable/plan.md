## Goal

Unify product creation so **one** `ProductDialog` handles Manual, AI, and future edit flows. The AI dialog becomes a thin input-only step that prefills the same form.

## Current state (verified)

- `src/routes/_authenticated/admin/products.tsx` shows two separate top buttons: "AI Builder" and "Add product".
- `AIProductBuilderDialog.tsx` already hands off its draft to `ProductDialog` via `buildEditingLike()` — so the shared-form architecture already exists. What's missing is (a) a unified entry point, (b) optional YouTube/Facebook video URL inputs in the AI step, and (c) piping those URLs into the prefilled form.
- `ProductDialog` already supports `meta.videos[]` + `video_url`, so no schema change is needed.

## Changes

### 1. `src/routes/_authenticated/admin/products.tsx`
Replace the two buttons with a single **Add Product** button that opens a small chooser popover/menu with two options:
- **Manual** → opens `ProductDialog` (empty)
- **AI Assistant** → opens `AIProductBuilderDialog`

Keep all existing state (`editing`, `open`, `aiOpen`) — only the trigger UI changes. Edit buttons on the list still open `ProductDialog` directly (unchanged).

### 2. `src/components/admin/product-form/AIProductBuilderDialog.tsx`
- Extend Step 2 with two optional inputs: **YouTube URL** and **Facebook Video URL** (plain `<Input>`s, light URL validation).
- Add `youtubeUrl` / `facebookUrl` state.
- In `buildEditingLike()`, when either URL is present, populate `meta.videos = [...]` (mark first as `primary: true`) and set `video_url` to the primary URL so `ProductDialog` picks them up automatically.
- No changes to progress stages, gating, upload flow, or handoff logic.

### 3. No changes to
- `ProductDialog.tsx` — already the single shared form.
- `ai-product-builder.functions.ts` — server draft schema unchanged (videos come from user input, not AI).
- `admin.functions.ts` / DB schema — `video_url` + `meta.videos` already persisted.

## Result

Single "Add Product" entry → user picks Manual or AI → both paths land in the identical `ProductDialog`. AI simply prefills fields (including optional videos). No duplicate form, no second editor.
