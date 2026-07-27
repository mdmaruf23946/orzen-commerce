# Professional Soft-Lock Feature Gating

Replace the current "Upgrade Required" full-page block with a soft-lock system that keeps every gated page visually intact, intercepts restricted actions, and shows a shared upgrade modal that deep-links to `/admin/billing`.

## Approach

Instead of touching each of the ~10 gated pages individually, refactor the two touchpoints they all share (`FeatureGate` and `useFeature`) so every existing call site inherits the new behavior automatically.

### 1. Shared upgrade modal + context (`src/components/admin/UpgradeModal.tsx`)

- `UpgradeProvider` at the admin route root (`src/routes/_authenticated/admin/route.tsx`) exposes a `useUpgradePrompt()` hook.
- `openUpgrade(feature, opts?)` opens a single global modal with:
  - 🔒 Premium Feature title
  - Feature label (from `FEATURE_LABELS`) + short description
  - Current plan name vs required plan (derived from `subscription_packages` where `features[key] === true`, resolved from `myBillingStatus`)
  - Main benefit copy (per-feature map with sensible defaults)
  - Primary CTA "Upgrade Plan" → navigate to `/admin/billing?highlight=<packageId|feature>&return=<currentPath>`
  - Secondary CTA "Maybe Later" (close)
- Fully responsive (`max-w-md`, stacked buttons on mobile), uses existing shadcn `Dialog`, tokens, and radii — no hard-coded colors.
- Billing page reads the `highlight` query param and adds a ring/scroll to the matching plan card (best-effort; skip silently if not found).

### 2. Rework `src/components/admin/FeatureGate.tsx`

- `<FeatureGate feature=...>` **always renders `children`**. When the feature is not allowed, it wraps them in a relative container with:
  - Pointer-events blocker over the content (transparent, click captured)
  - Subtle top-right "🔒 Available on <plan>" pill badge
  - Very light overlay tint (no heavy blur) so UI stays readable
  - Click on the blocker → `openUpgrade(feature)`
- New optional prop `mode?: "soft" | "inline-badge" | "passthrough"`:
  - `soft` (default) — behavior above.
  - `inline-badge` — no blocker, just renders children plus a lock badge (for pages that already have their own interactive logic gated by `useFeature`, like `orders.tsx` fraud).
- `useFeature(key)` unchanged signature, but returned object also includes `promptUpgrade()` so any handler can call `if (!allowed) return promptUpgrade()`.
- Remove the old "Upgrade Required" full-screen block entirely.

### 3. Action interception helper

Add `guardAction(feature, fn)` from `useFeature` so click handlers on premium buttons can wrap themselves:

```
const { guard } = useFeature("ai_messenger");
<Button onClick={guard(() => connectMessenger())}>Connect</Button>
```

If the feature is locked, `guard` shows the upgrade modal instead of calling `fn`. Apply this in the small number of pages that have interactive premium actions inside an already-visible layout (AIProductBuilderDialog trigger, orders fraud button, messenger connect, courier connect, landing-page create, analytics export). All other pages already wrap the whole route in `<FeatureGate>` and will automatically get soft-lock overlay + modal — no per-page code change needed.

### 4. Backend enforcement (already exists — verify only)

`src/lib/plan-guard.ts` (`assertPlan`) is already used by server functions. Confirm the premium server functions call it; add `assertPlan` calls where missing during implementation (spot-check: `ai-agent`, `ai-web-chat`, `messenger-inbox`, `landing-pages`, `fraud`, `import-export`, `domains`, `coupons`, `returns`, `invoice-settings`, `business.analytics`). No behavior change for allowed users; ensures modal cannot be bypassed via direct RPC.

### 5. Billing page highlight

`src/routes/_authenticated/admin/billing.index.tsx`: read `?highlight=<featureKey>` search param, find the cheapest plan whose `features[key] === true`, add `ring-2 ring-primary` and `scrollIntoView` on mount.

## Files touched

- `src/components/admin/UpgradeModal.tsx` (new)
- `src/components/admin/FeatureGate.tsx` (rewrite — soft-lock + guard helper, keep exported API)
- `src/routes/_authenticated/admin/route.tsx` (mount `UpgradeProvider`)
- `src/routes/_authenticated/admin/billing.index.tsx` (highlight param)
- Minor `guard(...)` wraps in the small set of pages listed above; **no page layout is removed or replaced**.
- Server: add `assertPlan(...)` in premium server-fn handlers that are missing it.

## Out of scope

- Redesigning any admin page.
- Changing plan definitions, billing flow, or payment providers.
- Storefront gating (this is Admin Panel only, per request).
