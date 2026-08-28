# Merchant Wallet & Auto Renewal

Add a wallet to the Merchant Panel so merchants can top up funds through the existing subscription payment gateway, pay for plans from the balance, and optionally auto-renew when their plan expires.

## What the merchant gets

1. **Wallet page** (`/admin/billing` → new "Wallet" tab)
   - Current balance card, "Add Fund" button, and full transaction history.
   - Add Fund dialog: amount input (with quick amounts), then redirect to the same gateway checkout used for buying plans. No separate payment process.
   - Balance is credited only after the payment is verified by the existing verification/webhook path.

2. **Pay a plan with wallet balance**
   - On the plan checkout page, a "Pay from wallet" option appears when the balance covers the total.
   - Choosing it deducts the amount, activates/renews the plan instantly, creates a paid invoice (same invoice numbering, PDF and receipt email), and records a wallet debit.
   - If the balance is short, the option is disabled with a clear message and a link to Add Fund.

3. **Auto Renewal toggle** (Billing page, near the current plan card)
   - ON: when the plan reaches its expiry date, the plan price for the chosen cycle is deducted from the wallet and the subscription renews automatically for that cycle.
   - The merchant also picks which billing cycle to auto-renew on (monthly / 3m / 6m / yearly).
   - Insufficient balance: no renewal happens, the merchant gets a notification/email saying the wallet is short and by how much, and the plan follows the normal expiry path (falls back to Free plan as it does today).
   - OFF: nothing is charged automatically.

4. **Transaction history**
   - Every entry shows date, type (Fund added, Plan purchase, Auto renewal, Refund, Adjustment), amount (+/−), resulting balance, reference (invoice no. / gateway), and status.

## Technical details

**Database (one migration)**
- `merchant_wallets` — one row per user: `user_id`, `store_id`, `balance` (numeric, never negative), `currency`, `auto_renew` (bool), `auto_renew_cycle`, timestamps.
- `wallet_transactions` — `wallet_id`, `user_id`, `type` (`topup` | `plan_payment` | `auto_renewal` | `refund` | `adjustment`), `amount` (signed), `balance_after`, `status`, `invoice_id`, `reference`, `note`, timestamps.
- Grants + RLS: merchants read only their own wallet/transactions; no client-side insert or update on either table (all mutations happen through service-role server functions). Owner/admin read via existing role check.
- Security-definer function `wallet_credit(...)` / `wallet_debit(...)` doing atomic balance update + transaction insert with idempotency on `invoice_id`, so a webhook replay can never double-credit.

**Payment reuse**
- Add a `purpose` column (`plan` | `wallet_topup`) to `subscription_invoices`; top-ups create a normal invoice with no `package_id`, and go through `initiateSubscriptionCheckout` unchanged in shape.
- In `verifyAndActivateSubscription` and `api/public/subscription-pay/webhook.$provider.ts`, branch on `purpose`: `wallet_topup` credits the wallet (idempotent) instead of activating a plan; `plan` keeps today's behaviour.

**Server functions** (new `src/lib/wallet.functions.ts`)
- `getMyWallet`, `listWalletTransactions`, `initiateWalletTopup` (reuses the checkout initiator), `payPlanWithWallet`, `setAutoRenewSettings`.
- All use `requireSupabaseAuth`; amounts recomputed server-side from plan price + cycle discounts (client-supplied amounts are never trusted).

**Auto renewal execution**
- New handler in `src/lib/wallet.server.ts`, called from the existing daily cron route `api/public/cron/subscription-renewals` (same `CRON_SECRET`): find stores whose `expires_at` is due with `auto_renew = true`, compute the cycle total, debit the wallet, mark a paid invoice, extend `stores.expires_at`, and log the transaction; on insufficient funds write a notification and skip.

**UI files**
- New `src/components/admin/billing/WalletPanel.tsx`, `AddFundDialog.tsx`, `WalletTransactions.tsx`; edits to `billing.index.tsx` (Wallet tab + auto-renew toggle), `billing.checkout.$packageId.tsx` (wallet payment option), `billing.return.tsx` (top-up success message).
