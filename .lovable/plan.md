# Store Settings Navigation Restructure

Split the single long Store Settings page into four focused pages under a collapsible "Settings" submenu in the admin sidebar. No new settings, no logic/database/API changes — pure UI reorganisation.

## New structure

```text
Settings ▼
   • Store Information
   • Store Configuration
   • Order & Workflow
   • Subscription Settings
```

- Clicking "Settings" expands/collapses the submenu (▶ / ▼).
- Clicking a submenu item opens only that page.
- Opening /admin/settings redirects to Store Information (no giant page).

## Page contents (existing sections, moved as-is)

1. Store Information — Store Identity, Store Icon & Favicon, Contact Information, Social Links, Business Information. Save button: "Save Store Information".
2. Store Configuration — Customer Login Settings, Localization, Invoice Numbering. Save button: "Save Store Configuration" (Invoice Numbering keeps its own existing save action, since it writes to a different table).
3. Order & Workflow — Order Confirmation Settings, Service Workflow (each already has its own save button, unchanged).
4. Subscription Settings — the existing Subscription Settings section only.

Danger Zone (Reset to Default Template) stays with Store Information, at the bottom of that page. Customer Login Settings keeps its own instant toggle save as today.

## Technical notes

- `src/routes/_authenticated/admin/settings.tsx` becomes a layout route rendering `<Outlet />` plus a compact section-tab header for mobile.
- New leaf routes:
  - `settings.index.tsx` → redirect to `/admin/settings/information`
  - `settings.information.tsx`
  - `settings.configuration.tsx`
  - `settings.workflow.tsx`
  - `settings.subscription.tsx`
- The existing store form (`getMyStore` / `updateMyStore`) is extracted into shared pieces in `src/components/admin/settings/` so Store Information and Store Configuration each render only their own fields and submit only their own changed keys through the same `updateMyStore` call. Field names, validation and payload shape are unchanged.
- `InvoiceNumberingSection`, `OrderConfirmationSection`, `ServiceWorkflowSection`, `SubscriptionSettingsSection` are reused untouched.
- Sidebar (`src/routes/_authenticated/admin/route.tsx`): replace the single "Store Settings" entry with a collapsible parent that lists the four children; collapsed by default unless the current route is under /admin/settings. Works in both desktop and mobile drawer.
- Mobile: each page is short, sticky save bar retained per page, submenu accessible from the drawer and from a horizontal tab row at the top of the settings layout.

## Verification

- Each page loads and saves independently; saving one page does not clear another's values.
- Old /admin/settings links keep working via the redirect.
- Typecheck passes.
