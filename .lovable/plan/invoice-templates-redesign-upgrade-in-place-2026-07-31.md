# Invoice Templates — Redesign & Upgrade (in place)

Upgrades the existing Winner Admin → Invoice Templates page at its current URL (`/owner/invoice-templates`). No new menu, no second editor, no rewrite of invoice generation, printing or PDF output.

## What stays exactly as-is

- Route, menu entry, and page URL.
- `invoice_templates` table and all existing rows (no migration of existing data).
- All existing server functions (list / save / delete / duplicate / set default / invoice payload / email share).
- `InvoiceRenderer` — the same renderer keeps driving invoices, print, and PDF.
- Store Admin behaviour and permissions (owner edits global presets; stores duplicate them).

## 1. Template list redesign

Replace the plain cards with professional template cards showing:

- Live miniature preview of the template (rendered with the existing renderer, scaled down)
- Name, category, status badge (Active / Hidden), default badge
- Last updated date
- "Used by N stores" count
- Actions: Preview, Edit, Duplicate, Hide/Show, Delete, plus a More dropdown (Set default, Version history, Rename)

## 2. Toolbar

Search by name, filter by Category, filter by Status, sort by Latest / Most used / Name, and a Grid ⇄ List view toggle. All filtering happens client-side over the already-loaded list, so nothing extra is fetched.

## 3. Create Template

A prominent Create Template button at the top right that opens the **existing** editor with a blank canvas — the same component used for editing.

## 4. Editor upgrade (same `TemplateBuilder`)

Added to the current builder, keeping its existing drag/undo engine:

- Multi-select, group / ungroup, duplicate element, lock / unlock, hide / show
- Bring forward / send backward / to front / to back
- Align (left, center, right, top, middle, bottom) and distribute
- Snap to grid, smart alignment guides, rulers, grid toggle
- Undo / redo (extended history), zoom presets, Fit to screen
- Keyboard shortcuts: arrows to nudge, Ctrl+D duplicate, Ctrl+Z / Ctrl+Shift+Z, Delete

Element palette extended to the full requested set, reusing existing element types where they already exist: Store Logo, Store Info, Customer Info, Product Table, Product Images, Invoice Details, Payment QR, Courier QR, Barcode, Footer, Signature, Terms & Conditions, Shapes, Icons, Divider, Text, Totals. New ones are added as presets of the existing `text` / `qr` / `image` / `shape` element types so old templates keep rendering unchanged.

## 5. Preview modes

Preview dialog with A4, A5, Receipt (80mm) and Print Preview modes. Page size is a preview-only setting on the template; existing templates default to A4.

## 6. Version history

Every save records a snapshot of the canvas and brand. The history panel lists versions with timestamp and author, allows previewing a version and restoring it (restore creates a new version, never overwrites history).

## Technical notes

- Additive-only migration: `category text default 'general'`, `is_hidden boolean default false`, `page_size text default 'a4'` on `invoice_templates`; new table `invoice_template_versions` (template_id, canvas, brand, created_by, created_at) with GRANTs and RLS mirroring the parent table's owner/store rules.
- Usage count comes from counting `invoice_templates.source_template_id` references — no new tracking.
- Server functions are extended with optional fields only, so existing callers keep working; new functions added for listing/restoring versions and toggling hidden.
- Hidden templates stay fully functional for stores already using them; they are only removed from the "pick a preset" lists.
- Files touched: `src/components/invoice/InvoiceTemplatesManager.tsx`, `src/components/invoice/builder/TemplateBuilder.tsx` (+ small new sub-components under `src/components/invoice/builder/`), `src/lib/invoice-templates.functions.ts`, `src/lib/invoice-template/types.ts`.
