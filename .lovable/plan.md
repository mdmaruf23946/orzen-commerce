## Goal
Completely remove the Origin Studio section from the app, leaving the rest of the admin untouched.

## What gets removed
- Route `src/routes/_authenticated/admin/invoice-design.tsx` (the `/admin/invoice-design` page)
- Whole folder `src/components/design-studio/` (DesignStudio, StudioSidebar, StudioEditor, StudioDashboard, MyDesigns, BrandKit, ComingSoonDialog)
- `src/lib/design-studio/registry.ts`
- The "Origin Studio" link + its icon import in the Store Admin sidebar (`src/routes/_authenticated/admin/route.tsx`)

## What stays untouched
- Invoice templates data and server functions (`src/lib/invoice-templates.functions.ts`, `src/lib/invoice-template/*`) and the database tables — nothing is dropped
- Winner Admin → Invoice Templates page (`/owner/invoice-templates`) and `InvoiceTemplatesManager` / `TemplateBuilder`, which keep working as before
- Invoice rendering, printing and sharing across orders

## Technical notes
- Route tree (`src/routeTree.gen.ts`) regenerates automatically after the route file is deleted.
- After deletion, a repo-wide search confirms no leftover imports of `design-studio` or `/admin/invoice-design`, then a typecheck run verifies the build.
