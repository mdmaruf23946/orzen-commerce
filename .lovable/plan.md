## Manual Subscription Payment Verification System

Redesign the checkout into a dedicated bKash-first payment page, add duplicate-txn protection, and wire Lovable Emails on submit / approve / reject. Reuses the existing `payments` + `platform_payment_settings` tables — no schema rebuild.

### 1. Migration (small, additive)

```sql
-- Email + note on payment requests
ALTER TABLE public.payments
  ADD COLUMN customer_email text,
  ADD COLUMN customer_note  text,
  ADD COLUMN rejection_reason text;

-- Prevent duplicate transaction IDs within the same method
CREATE UNIQUE INDEX payments_method_txn_unique
  ON public.payments (method, txn_id)
  WHERE txn_id IS NOT NULL AND status <> 'rejected';

-- Store owner needs to see their own payment on the success page
-- (existing "store owner reads payments" policy already covers this)

-- Email log for retry + audit
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  template text NOT NULL,          -- 'payment_submitted_admin' | 'payment_submitted_customer' | 'payment_approved' | 'payment_rejected'
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',  -- pending | sent | failed
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads email logs" ON public.email_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner'));

-- Add notification_email + merchant_name to platform_payment_settings.bkash JSON (no schema change, handled in code)
```

### 2. Server functions — `src/lib/billing.functions.ts`

Extend `submitManualPayment`:
- Accept `customer_email`, `customer_note`.
- Validate BD phone (`/^01[3-9]\d{8}$/`) on sender number.
- Validate txn_id length 6–32 alphanumeric.
- On unique-index violation → friendly "This transaction ID has already been submitted" error.
- After insert, enqueue two email_logs rows: `payment_submitted_admin` + `payment_submitted_customer`, then fire-and-forget `sendPendingEmails()`.

New `getPaymentForConfirmation({ paymentId })` — used by success page.

### 3. Server functions — `src/lib/owner.functions.ts`

Extend `verifyPayment`:
- On approve: existing activation logic + enqueue `payment_approved` email.
- On reject: require `notes` (rejection_reason), save to `rejection_reason`, enqueue `payment_rejected` email.

New `retryEmailLog({ id })` — owner-only.

### 4. Email sender — `src/lib/emails.server.ts` (new)

Single `sendEmail({ to, subject, html })` via **Lovable Emails** (built-in). Wraps in try/catch and updates `email_logs` row (`status`, `attempts`, `last_error`, `sent_at`). Templates are pure functions returning branded responsive HTML (ORZEN logo, `--store-btn-bg`, mobile-first table layout):
- `payment_submitted_admin(payment, store)` — full details table + "Review Payment Request" button → `/owner/billing?status=pending`.
- `payment_submitted_customer(payment)` — "under verification" message.
- `payment_approved(payment, store, plan, expires_at)` — plan, activation date, expiry, store URL, Login button.
- `payment_rejected(payment, reason, support_email)` — reason + resubmit instructions.

`processPendingEmails()` — loops pending rows in `email_logs`, sends, updates status. Called inline after each enqueue; owner has "Retry" button for failed rows.

### 5. UI — dedicated bKash-first payment page

Replace `src/routes/_authenticated/admin/billing.checkout.$packageId.tsx` with a redesigned layout (single route, same URL):

```
┌────────────────────────────────────────┐
│  ← Back                                │
│  Complete your payment                 │
├────────────────────────────────────────┤
│  Plan summary card                     │
│    Business • Monthly                  │
│    Amount ৳500                         │
│    Duration 30 days                    │
├────────────────────────────────────────┤
│  Billing cycle chips (Monthly/3m/6m/Y) │
├────────────────────────────────────────┤
│  Payment method tabs                   │
│  [ bKash ] Nagad  Rocket  SSLCommerz   │
├────────────────────────────────────────┤
│  bKash Send Money to                   │
│   ┌──────────────────────────┐  [Copy] │
│   │  01XXXXXXXXX             │         │
│   └──────────────────────────┘         │
│  Amount                                │
│   ┌──────────┐  [Copy]                 │
│   │  ৳500    │                         │
│   └──────────┘                         │
│                                        │
│  Instructions (from settings)          │
│  1. Open bKash app                     │
│  2. Send Money to above number         │
│  3. Copy Transaction ID                │
│  4. Fill the form below                │
├────────────────────────────────────────┤
│  Payment form                          │
│    Sender bKash Number*  (BD validator)│
│    Transaction ID*                     │
│    Email Address* (auto-filled)        │
│    Note (optional)                     │
│    [ Submit Payment Request ]          │
└────────────────────────────────────────┘
```

- Copy buttons use `navigator.clipboard.writeText` + toast.
- Nagad/Rocket/SSLCommerz tabs hidden when disabled; SSLCommerz keeps its "coming soon" note.
- Success state (after submit) replaces the card with a confirmation panel: "Your payment request has been submitted. Subscription activates after manual verification." + "View my requests" → `/admin/subscription`.
- All Tailwind utilities, no new deps. Mobile-first (single column below `sm`).

### 6. UI — Owner "Subscription Requests" page

Reuse `src/routes/_authenticated/owner/billing.tsx` (already lists payments + Approve/Reject). Enhancements:
- Add columns for Sender Number, Customer Email, and a "View" expand row showing Note + Rejection Reason.
- Reject action opens a small dialog asking for a **required** reason (min 10 chars), replacing the current `prompt()`.
- Add a small "Email log" strip under each row showing sent/failed with a Retry button on failure.

### 7. Owner Settings — `src/routes/_authenticated/owner/payment-settings.tsx`

Extend the bKash section with:
- Merchant Name (text)
- Merchant bKash Number (existing)
- Instructions (textarea, multiline — rendered on payment page)
- Notification Email (where "New Payment Received" mail goes)

All stored inside `platform_payment_settings.bkash` JSON — no migration.

### 8. Security & performance

- Server-side Zod validation on every server fn (`sender_number`, `txn_id`, `customer_email`, `packageId`, `cycle`).
- Duplicate txn blocked by unique index (DB-level, race-safe).
- All emails sent from server functions (never client). Failures logged, not thrown to user.
- No new npm dependencies. Uses existing Lovable Emails, existing shadcn Dialog, existing lucide icons.
- Payment page loads with a single `useSuspenseQuery` for `{plans, methods, settings}` batched via one server fn.

### 9. Future gateway readiness

Payment method is already a discriminated field (`method`). Adding a real gateway = new `method` value + a `createGatewayCheckout(packageId, cycle, method)` server fn that returns a redirect URL. The `payments` row + email pipeline stays identical; verification flips from manual owner action to gateway webhook writing `status='paid'`. No table changes needed for bKash Gateway / PipraPay / SSLCommerz / Stripe / PayPal.

### Files touched

- Migration: add columns + unique index + `email_logs` table
- `src/lib/billing.functions.ts` — validation, email enqueue, `getPaymentForConfirmation`
- `src/lib/owner.functions.ts` — approve/reject email hooks, `retryEmailLog`
- `src/lib/emails.server.ts` — NEW (Lovable Emails sender + templates + `processPendingEmails`)
- `src/routes/_authenticated/admin/billing.checkout.$packageId.tsx` — redesigned page
- `src/routes/_authenticated/owner/billing.tsx` — reject dialog + email log strip + new columns
- `src/routes/_authenticated/owner/payment-settings.tsx` — merchant name, instructions, notification email
