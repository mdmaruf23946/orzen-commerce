
# Import / Export Products — Professional Redesign

Replace the current thin `import-export.tsx` (CSV only, no preview, no update, no history) with a modern wizard UI plus stronger server functions and a history table.

## Scope
- Route: `src/routes/_authenticated/admin/import-export.tsx` — full redesign.
- Server logic: `src/lib/business.functions.ts` — extend import/export functions.
- New DB table: `product_import_export_history` for last activity tracking.
- New component files under `src/components/admin/import-export/`.
- Plan-gated via existing `FeatureGate feature="import_export"`.

## UI (wizard, no page reloads)

Top summary cards (responsive grid):
- Total Products, Last Import (time + user + rows), Last Export (time + user + rows).
- Two large primary CTAs: **Import Products**, **Export Products** (open dialogs).

### Import dialog — 4 steps
1. **Source** — Drag-and-drop uploader accepting `.csv`, `.xlsx`, or Google Sheets URL/ID. "Download sample template" (CSV + XLSX) button. Table of required/optional columns with descriptions.
2. **Mode** — radio: Add new only / Update existing (by SKU) / Add + Update. Match key selector (SKU or Product Code).
3. **Preview & validate** — table of first 20 parsed rows, per-row status badge (New / Update / Error), inline reason for failures with row numbers. Toggle "Skip invalid rows" or "Fix in place" (editable cells for common fixes: price, stock, status). Summary counters update live.
4. **Import** — real-time progress bar (chunked 100 rows/request via server fn), final summary card: Total / Imported / Updated / Skipped / Failed with downloadable error report CSV.

### Export dialog
- Filters: Category (multi), Brand, Stock status, Active/Inactive, Date range (created_at).
- Column picker (checkbox list, sensible defaults).
- Format: CSV / XLSX.
- Progress indicator; result streamed to a Blob download; log to history.

### History section
- Bottom card listing last 20 import/export runs: type, file name, rows, status, user, time. Pulled from new table.

Responsive: cards stack on mobile, dialogs full-screen `<480px`, tables become card lists.

## Technical details

### Parsing
- Add `xlsx` npm package for `.xlsx` (SheetJS) and reuse for CSV read/write. For Google Sheets, accept a public sheet URL, extract `spreadsheetId`, fetch via existing `google_sheets` gateway if a workspace connection exists, else instruct user to publish as CSV and paste URL (fallback fetch through server fn to avoid CORS).
- All parsing happens client-side except Sheets fetch (server fn).

### Server functions (extend `src/lib/business.functions.ts`)
- `bulkImportProducts` — extend input: `mode: "add" | "update" | "upsert"`, `matchKey: "sku" | "code"`, wider optional fields (brand, category_slug, images[], features, specifications, etc.), keep chunk size 500. Returns `{ imported, updated, skipped, failed, errors: {row, reason}[] }`. Update path uses `update ... where store_id=sid and sku=?`. Add path insert; Upsert combines. Writes a history row on completion.
- `exportProductsFiltered` — inputs: filters, columns[], format (`csv`|`xlsx_data`). Returns rows + header (client builds XLSX to keep worker light). Writes a history row.
- `getImportExportHistory` — last 20 rows for current store.
- `fetchGoogleSheetCsv` — server fn: given URL, fetch CSV, return text (validates it's a Google Sheets host).

### Database
New migration:
- `public.product_import_export_history` (store_id, user_id, kind ['import'|'export'], file_name, format, total, imported, updated, skipped, failed, filters jsonb, created_at).
- GRANT + RLS: store owner select/insert own rows.

### Files
- New: `src/components/admin/import-export/ImportDialog.tsx`, `ExportDialog.tsx`, `HistoryCard.tsx`, `SummaryCards.tsx`, `sample-template.ts` (builds sample CSV/XLSX Blob).
- Rewrite: `src/routes/_authenticated/admin/import-export.tsx` (composes above).
- Extend: `src/lib/business.functions.ts` (functions above).
- Add dep: `xlsx` via `bun add xlsx`.

### Performance
- Chunked async imports (100/req) with progress via sequential awaits.
- Preview limited to 20 rows; full validation runs in a `requestIdleCallback` loop with counters, no UI freeze.
- Export uses `useQuery` with `enabled:false`; run on click, no route reloads.

## Out of scope
- Editing product variants via CSV (kept minimal — variants stay in product editor).
- Image file uploads via CSV (only URLs supported, matching existing schema).
