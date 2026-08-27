# Customer Account Dashboard + Order Tracking upgrade

Four changes across the storefront account area: a vibrant profile header, unified icon/branding, a new order tracker (public page + in-account widget), and clean pill-style filters.

## 1. Premium multi-color profile header

- Replace the current dark two-stop gradient on the account overview card with a layered 3-4 colour mesh gradient (indigo -> purple -> electric blue -> magenta) plus soft radial highlight blobs.
- Avatar, name, email/phone row, member badge and "Edit profile" button move onto translucent glass surfaces (`bg-white/20 backdrop-blur-md`, subtle white ring) with bold white text so contrast stays clean on every colour stop.
- Card gets a slightly taller layout with rounded-3xl corners and a soft coloured shadow.

## 2. Unified branding and icon colours

- All quick-action tiles (Orders, Wishlist, Addresses, Services, Subscriptions, Downloads, Settings) use one brand accent treatment instead of the current per-tile green/rose/amber/teal mix: accent-tinted icon chip, neutral title, muted hint, accent-tinted hover border.
- Settings list rows use the same accent icon colour, with a consistent hover state.
- "Log out" becomes a subtle outline button: `border-red-200 text-red-600 hover:bg-red-50`, no filled background.
- Accent comes from the existing store theme variable so it stays on-brand per store.

## 3. Instant Order Tracker

Two surfaces, one shared tracker component.

- **New public page** `/store/$slug/track-order` — reachable without login, linked from the footer and the account orders panel.
- **Widget card at the top of the account Orders tab** — same input, pre-filled with the signed-in customer's phone.

Behaviour:
- One input accepting "Order ID (e.g. #1002) or Phone Number", with a highlighted primary "Track Order" button beside it (stacks on mobile).
- Order ID lookup returns that single order. Phone lookup returns all orders for that phone in the store, newest first.
- Result shows order ref, date, total, payment status, a live status timeline (placed -> confirmed -> packed -> shipped -> delivered) built from the existing order timeline records, and courier/tracking details when present.
- Privacy: public results are masked — customer name shown as first name + initial, phone masked (e.g. 017****891), address reduced to area/city only. No email, no full address, no item cost data. A "View full details" link appears only for the signed-in owner.
- Basic abuse protection: minimum input length, capped result count, and no listing of orders without an exact ID or full phone match.

## 4. Clean filters

- Order type tabs (All, Physical, Digital, Service, Subscription) become the same rounded pill buttons used elsewhere in the store: accent-filled when active, light grey when idle, horizontally scrollable on mobile.
- Status and sort dropdowns restyled as matching rounded pill selects, and the search input gets the same rounded treatment.

## Technical notes

- UI: `src/routes/store/$slug/account.tsx` (header, tiles, settings rows, logout), `src/components/storefront/account/OrdersPanel.tsx` (pills + tracker widget), new `src/components/storefront/account/OrderTracker.tsx`, new route `src/routes/store/$slug/track-order.tsx` with its own head() metadata.
- Server: new public server function `trackOrderPublic` in `src/lib/storefront.functions.ts` (input: store slug + query string), reading orders / order_timeline / courier fields through the admin client inside the handler, returning only the masked DTO described above. No new tables and no schema change.
- Existing `listMyOrders` and account queries stay unchanged; the tracker is additive.
