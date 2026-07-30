## Invoice Template Builder

A drag-and-drop invoice designer in the Winner Admin Panel, with per-store copies editable in the Store Admin Panel, plus a real invoice generator that fills templates with live order data.

### Where things live

- **Winner Admin → Invoice Templates** (`/owner/invoice-templates`) — build and manage the 4 global templates.
- **Store Admin → Settings → Invoice Design** (`/admin/invoice-design`) — pick a global template, duplicate it into a store-owned copy, edit it, set it as the store default.
- Existing invoice numbering settings (prefix / separator / padding) stay untouched and feed `{{invoice_number}}`.

### Builder layout

Three panes, collapsing to tabs on mobile (Elements / Canvas / Properties).

```text
┌──────────┬────────────────────────┬──────────────┐
│ Elements │   A4 canvas (zoomable) │  Properties  │
│ Templates│   free drag + resize   │  of selected │
│ Text ... │   snap/align guides    │  element     │
└──────────┴────────────────────────┴──────────────┘
```

**Left — element palette:** Templates, Text, Logo, Product Image, Customer Info, Store Info, Invoice Info, Order Info, Courier Info, Payment Info, Product Table, QR Code, Barcode, Divider, Shape, Icon, Footer, Terms. Click or drag to add.

**Center — canvas:** A4 at 794×1123 px scaled to fit. Absolute x/y positioning, 8-handle resize, arrow-key nudge, snap guides against other elements and page center/margins, multi-select, duplicate, delete, lock/unlock, z-order, optional rotate. Toolbar: undo/redo, zoom, grid toggle, alignment buttons, preview modes.

**Right — properties:** only the selected element's fields — text (font, size, weight, color, align, letter spacing, line height), image (width, height, radius, border, shadow, opacity), table (header color, row color, alternate row, border, padding, row height, column widths, product image size/position), QR (size, border, label, visibility), shape/divider (fill, stroke, radius).

**Brand settings tab:** primary/secondary/accent color, font, logo source, footer style, border style, corner radius, shadow, paper margin — applied as tokens so one change restyles the whole template.

### Templates and saving

Four seeded read-only globals: Modern Minimal, Premium Corporate, E-Commerce Colorful, Luxury Brand. Editing a global requires duplicating it first, so originals never change. Actions: Save, Save As New, Duplicate, Rename, Delete, Preview, Reset, Export (JSON).

### Dynamic variables

Elements bind to placeholders rather than static text: `{{store_name}} {{store_logo}} {{invoice_number}} {{order_id}} {{customer_name}} {{customer_phone}} {{customer_address}} {{product_image}} {{product_name}} {{product_quantity}} {{product_price}} {{delivery_charge}} {{discount}} {{total}} {{payment_method}} {{payment_status}} {{tracking_id}} {{tracking_qr}} {{payment_qr}} {{courier_name}} {{current_date}}`. A variable picker inserts them; the canvas renders sample data so the preview always looks real.

### Preview

Desktop, Mobile, Print and PDF preview toggles over the same renderer, so what you design is what prints.

### Invoice generation

The existing order invoice route is replaced by a template-driven renderer. Opening an order and clicking **Generate Invoice** loads the store's selected template, resolves every placeholder from real order, store, courier and payment data, generates the tracking and payment QR codes, and renders the printable invoice.

Share actions run through a pluggable share-channel registry so new channels are a one-file addition:

- Print
- Download PDF (client-side)
- Copy Link
- Email
- SMS
- WhatsApp
- Messenger

### Technical notes

- **Data:** new `invoice_templates` table (id, scope global/store, store_id, name, is_default, canvas JSON, brand JSON, timestamps) with RLS — global templates readable by all authenticated store owners and writable only by platform owners; store templates readable/writable only by their owner; `GRANT`s included in the migration. Seed the four globals with literal INSERTs in the same migration.
- **Renderer:** one shared `InvoiceRenderer` component consumes the canvas JSON and a resolved-values map, used by the builder canvas, previews and the printed invoice — a single source of truth, no duplicate layout code.
- **Server:** `invoice-templates.functions.ts` (CRUD, duplicate, set-default) and a `resolveInvoiceData` server fn that returns the placeholder map for an order; both auth-scoped through the existing Supabase middleware.
- **Deps:** `qrcode` + a barcode generator for the code blocks, `html2pdf.js` for PDF download. Drag/resize is implemented with pointer events rather than a heavy canvas library to keep the builder fast.
- Templates are stored as plain JSON, so export/import and future template additions need no schema change.
