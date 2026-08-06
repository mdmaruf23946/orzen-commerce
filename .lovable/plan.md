# Returns & Exchanges — Global Settings

Add one global Return & Exchange settings panel, opened from a new button under the Returns & Exchanges page header, and let each request override the money rules when needed.

## 1. Entry point

- New button under the Returns & Exchanges header: "⚙️ Return & Exchange Settings".
- Opens a full-height drawer (mobile-first, sectioned) instead of leaving the page.
- The same settings stay available in Settings → Order & Workflow (existing Return Policy card is replaced by a link/short summary so nothing is duplicated).

## 2. Settings sections

1. Shipping charges
   - Return shipping: Customer pays / Store pays / Split cost / Free. Split reveals Customer amount (৳) + Store amount (৳).
   - Replacement shipping: same four options and the same split fields.
2. Restocking fee: Disabled / Fixed amount (৳) / Percentage (%).
3. Exchange rules (checkboxes): Same variant, Different variant, Different product, Higher price, Lower price, Equal price.
4. Replacement product source: Cart items only (default) / Wishlist / All store products.
5. Payment adjustment: difference always auto-calculated. If replacement costs more → customer pays difference (toggle). If it costs less → Refund wallet / Refund bank-MFS / Store credit / No refund.
6. Return approval (toggles): Admin approval, Product inspection, Photo verification, Courier tracking.
7. Refund methods (checkboxes): bKash, Nagad, Rocket, Bank transfer, Store wallet.
8. Return window: return allowed within 7/14/30 days; exchange allowed within 7/14/30 days (separate values).
9. Auto workflow (toggles): auto generate return courier, auto create replacement order, auto reserve replacement stock, auto update inventory, auto notify customer, auto sync courier tracking.

Every section is a card with a one-line description; one "Save settings" button with a success toast.

## 3. Per-request override

Inside each return/exchange request drawer: a "Use global settings" toggle, on by default. Turning it off unlocks manual Return shipping, Replacement shipping and Restocking fee for that request only, then recalculates the customer-pays / refund figures.

## 4. Storefront exchange flow

- Choosing "Different product" shows only products allowed by the configured source (default: the customer's current cart items), filtered by the enabled price rules (higher / lower / equal).
- The wizard then shows replacement value, shipping, restocking fee, and the final "you pay ৳X" or "you get refunded ৳X", recomputed server-side on submit.

## 5. Automation on approval

When admin approves an exchange, the enabled auto-workflow steps run in order: create the replacement order, reserve stock, update inventory, create the return courier shipment, notify the customer, and keep tracking in sync. Any step whose toggle is off is left for the admin to do manually.

## Technical notes

- Migration on `store_return_settings`: add split-cost payer modes and amounts (`return_shipping_mode`, `return_split_customer`, `return_split_store`, and replacement equivalents), `exchange_rules` jsonb, `replacement_source` text, `refund_direction` text, `customer_pays_difference` bool, approval flags (`require_admin_approval`, `require_photo`, `require_courier_tracking`; `require_inspection` already exists), `exchange_window_days`, and an `auto_workflow` jsonb. Existing columns keep working; `normalizePolicy` in `src/lib/returns-pricing.ts` gains defaults for the new keys and the shipping math learns the split/free modes.
- `returns` gains `use_global_settings` boolean plus the already-present per-request charge columns for overrides.
- `getReturnSettings` / `saveReturnSettings` in `src/lib/returns-admin.functions.ts` and the public `get_public_return_settings` RPC are extended to carry the new fields; validation stays server-side.
- New `src/components/admin/returns/ReturnSettingsDrawer.tsx` holds the panel; `ReturnPolicySection.tsx` is reduced to avoid duplicate config.
- Cart-based replacement source reads the shopper's existing local cart in the return wizard; wishlist and all-products sources query the store catalogue.

## Verification

- Settings save and reload correctly; storefront wizard reflects each rule.
- Split cost, restocking fee and price-rule filters change the customer's payable/refund total as expected.
- Per-request override changes only that request.
