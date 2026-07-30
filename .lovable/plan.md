## Goal

Rebrand the studio at `/admin/invoice-design` to **Origin Studio** and rework its desktop and mobile UI to match the two reference screenshots — without touching data, APIs, template CRUD, or the editing engine.

## 1. Rename to Origin Studio

- Sidebar menu label in `src/routes/_authenticated/admin/route.tsx`: "Invoice Design" → "Origin Studio".
- Studio header/brand block, dashboard hero badge, and the coming-soon copy: "ORZEN Design Studio" → "Origin Studio".
- Route `head()` title/description updated to Origin Studio (route path itself unchanged, so no links break).

## 2. Desktop layout (screenshot 1)

Rebuild `DesignStudio` + `StudioEditor` shell into the reference's 4-column frame:

```text
┌──────────────────────────────────────────────────────────────┐
│ Top bar: logo + "Origin Studio" | tagline | search | actions │
├──────────┬───────────────┬────────────────────┬──────────────┤
│ Left nav │ Elements rail │  Canvas + toolbar  │ Properties   │
│ Create   │ Elements /    │  rulers, grid,     │ Layers/Pages │
│ New,     │ Templates /   │  snap guides       │ tabs + right │
│ Dashboard│ Uploads tabs  │                    │ icon strip   │
│ …        │ collapsible   │  bottom bar:       │              │
│ Coming   │ groups        │  size, orientation,│              │
│ Soon     │               │  zoom, grid, ruler │              │
└──────────┴───────────────┴────────────────────┴──────────────┘
```

- **Left nav**: gradient "Create New" button, Dashboard / My Designs / Brand Kit, "Design Studio" group (Invoice with PRO chip, Logo, Social Media, Banner, Landing Page, Poster, Business Card, Certificate, More Tools), then Templates / Projects / Trash, and a bottom "Design Credits" progress card with an Upgrade button (Upgrade links to `/admin/billing`; locked items keep the existing Coming Soon dialog).
- **Top bar**: breadcrumb (`Invoice Template Builder / <project name>` with inline rename pencil), undo/redo, Preview, Save split-button, Download.
- **Elements rail**: search field + filter icon, collapsible sections Basic / E-commerce / Advanced (Soon chips) / Brand / Typography / Background / Illustrations / More, wired to the existing element factories.
- **Canvas**: floating icon toolbar above the canvas (select, pan, shape, delete, duplicate, align, text styles, Animate), horizontal + vertical rulers, grid overlay, selection handles with rotate knob, and a bottom control bar (page-size select, orientation, zoom −/+, Fit to Screen, Grid and Ruler switches) plus the mini page thumbnail.
- **Right panel**: Properties / Layers / Pages tabs; Properties shows Selected name with lock/eye, Position & Size (X, Y, W, H, rotation, align buttons), Style (opacity slider, border radius, shadow switch), Quick Actions grid (Replace, Crop, Flip, Duplicate, Bring Front, Send Back, destructive Delete), Color & Filters with tint + preset swatches. Vertical icon strip on the far right (Lock, Guide, Comments, History, Settings).

Only controls that map to existing element props mutate state; purely decorative reference controls (Comments, History, Animate, Crop/Flip) surface the existing Coming Soon dialog rather than faking behaviour.

## 3. Mobile layout (screenshot 2)

Below `lg`, the editor becomes the phone layout from screenshot 2:

- Compact header: hamburger (opens left nav sheet), logo + "Origin Studio", undo/redo, preview, Save, overflow menu.
- Control row: page-size select, zoom stepper, grid toggle, lock, fullscreen.
- Canvas fills the middle, pinch/scroll scrollable, selection handles preserved.
- Floating horizontal element strip: `+` FAB then Text, Image, QR Code, Shape, Table, More.
- Selected-object card: "SELECTED: <name>" with Lock / eye / delete, then a wrapped action grid (Edit, Replace, Crop, Flip, Bring Front, Send Back, Duplicate).
- Bottom tab bar: Elements | Layers | Properties | Templates, each opening a bottom sheet with the corresponding panel.

## 4. Styling

New studio-specific tokens in `src/styles.css` (indigo/violet primary, soft surface greys, rounded-2xl cards, subtle shadows) so the look matches the screenshots while staying token-based and dark-mode safe. No hardcoded colour utilities.

## Technical notes

- Files touched: `src/components/design-studio/*` (shell, sidebar, editor, dashboard, my-designs, brand kit), `src/routes/_authenticated/admin/route.tsx`, `src/routes/_authenticated/admin/invoice-design.tsx`, `src/styles.css`. Editor split into smaller components (`StudioTopBar`, `ElementsRail`, `CanvasStage`, `InspectorPanel`, `MobileEditor`) since `StudioEditor.tsx` is already 921 lines.
- No database migration, no change to `invoice-templates.functions.ts`, canvas JSON shape, or the undo/drag/resize logic — those are reused as-is.
