## ORZEN Design Studio — Professional Redesign

Scope: Store Admin only, at the existing route `/admin/invoice-design`. Owner panel (`/owner/invoice-templates`) keeps its current UI untouched. No route changes, no API signature changes, no changes to invoice generation or the saved-template shape.

### What stays exactly as-is
- `src/lib/invoice-templates.functions.ts` (list/save/delete/duplicate/set-default) — untouched.
- `src/components/invoice/InvoiceRenderer.tsx` and `Codes.tsx` — untouched, still the single renderer for printing and PDF.
- `src/lib/invoice-template/types.ts` element model and `data.ts` variables — untouched (one additive optional field only, see Technical).
- All existing editor behaviour (drag, resize, snap, undo/redo, lock, keyboard nudge, preview, save) is carried over, not rewritten.

### 1. Studio shell
New `DesignStudioShell` wrapping the page:
- **Left rail** (collapsible, icon-only on tablet, drawer on mobile): Dashboard, My Designs, Brand Kit, then a "Design Studio" group — Invoice Builder, Logo Maker, Poster Designer, Banner Designer (all live) — then a "Coming Soon" group: Landing Page Builder, Social Media Designer, Business Card, Certificate, Packaging, Thumbnail, Presentation, Resume, Video Editor, Website Builder, AI Designer.
- Coming Soon items open a polished modal (🚀 Coming Soon, description, "Notify Me" + "Close"). Notify Me shows a confirmation toast only — no navigation, no crash, nothing opens.
- Studio navigation is internal view state, so the URL and route tree do not change.

### 2. Dashboard
Recent designs (from the existing template list), quick-create tiles for the four live design types, counts, and a "continue editing" card. Reads only existing data.

### 3. My Designs
Grid/list of the store's templates with thumbnail preview (rendered from the existing renderer at small scale), search, type filter, and the existing actions: Edit, Duplicate, Set default, Delete, plus the "Ready-made presets" section (Use this) that exists today.

### 4. Brand Kit (basic)
Edits the existing `brand` tokens already on a template: primary / secondary / accent colours, font, radius, shadow, margin. Applies to the design being edited — same fields, nicer UI. No new storage.

### 5. Editor redesign
Same engine, new chrome:
- **Top toolbar**: project name (inline edit), Undo, Redo, Preview, Save, Save As (uses existing duplicate/save), Download/Print, element search, zoom control, user avatar.
- **Left elements panel**: categorized — Basic (Text, Image, Logo, Shape, Icons, QR, Barcode, Divider, Table), Invoice (Product Table, Customer Info, Store Info, Payment QR, Courier Block, Invoice Info, Totals, Terms — composed from existing element types + preset props), Design (Background, Gradient, Typography, Brand Colors). Future categories visible but disabled with a Coming Soon tag.
- **Canvas**: workspace背景 with soft shadow page, portrait/landscape toggle, safe-print area outline, optional grid and rulers, existing snap/centre guides. Bottom bar: zoom, canvas size, grid toggle, ruler toggle, fit-to-screen.
- **Right inspector**: collapsible cards — Position (X/Y), Size (W/H/rotation), Appearance (opacity, radius, shadow), Alignment, Layer order, Lock/Visibility/Duplicate/Delete, and type-specific sections (Color, Gradient, Typography, Spacing, Replace/Crop/Flip for images).
- **Layers panel**: reorder, rename, lock, hide, bring front / send back / forward / backward.
- Locked objects cannot move, resize, rotate, or be edited until unlocked (extends the existing `locked` flag).
- Multi-select with shift-click and marquee, copy/paste/duplicate, and keyboard shortcuts (Cmd/Ctrl+Z/Shift+Z, C/V/D, Delete, arrow nudge).

### 6. Logo / Poster / Banner
Same editor, different canvas presets (logo 1000×1000, poster A4/A3 portrait, banner 1200×628 and 1920×1080, plus custom). Invoice-specific element categories are hidden for non-invoice designs; everything else is shared.

### 7. Zoom & responsiveness
Zoom presets 25/50/75/100/150/200/300%, Fit Screen, Fit Width. Desktop = three-panel layout; tablet = collapsible side panels; mobile = canvas-first with a bottom toolbar, sheet-based element and property panels, and floating quick actions.

---

### Technical notes
- New files under `src/components/design-studio/`: `StudioShell.tsx`, `StudioSidebar.tsx`, `ComingSoonDialog.tsx`, `Dashboard.tsx`, `MyDesigns.tsx`, `BrandKit.tsx`, and editor parts (`Toolbar.tsx`, `ElementsPanel.tsx`, `Canvas.tsx`, `Inspector.tsx`, `LayersPanel.tsx`).
- The current `TemplateBuilder.tsx` is refactored into these panels while keeping its state model, commit/undo stack and pointer logic identical. `InvoiceTemplatesManager.tsx` stays exported and continues to serve the owner route unchanged.
- Design type + canvas orientation are stored inside the existing `canvas.page` object (additive optional keys `kind` and `preset`), so no database migration, no column rename, and old templates load with `kind` defaulting to `invoice`.
- Only existing deps used: shadcn UI, lucide, Tailwind. No new heavy libraries.
- Page `head()` metadata for `/admin/invoice-design` updated to Design Studio titles.

### Safety checklist verification at the end
No feature removed, no API changed, no migration, saved templates load and render identically, invoice printing path untouched, routes unchanged.
