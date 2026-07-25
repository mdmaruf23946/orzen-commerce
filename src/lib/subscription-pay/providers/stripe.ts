import type { SubscriptionPaymentProvider } from "./types";

export const stripe: SubscriptionPaymentProvider = {
  meta: {
    id: "stripe",
    label: "Stripe",
    methods: ["visa", "mastercard", "amex", "wallet"],
    supportsSandbox: true,
    credentialFields: [
      { key: "publishable_key", label: "Publishable Key", type: "text", placeholder: "pk_live_… or pk_test_…", required: true, group: "Credentials", pattern: "^pk_(live|test)_", patternHint: "Must start with pk_live_ or pk_test_" },
      { key: "secret_key", label: "Secret Key", type: "password", placeholder: "sk_live_… or sk_test_…", required: true, group: "Credentials", pattern: "^sk_(live|test)_", patternHint: "Must start with sk_live_ or sk_test_" },
      { key: "webhook_secret", label: "Webhook Signing Secret", type: "password", placeholder: "whsec_…", group: "Credentials", helper: "From Stripe Dashboard → Developers → Webhooks." },
      { key: "currency", label: "Default currency", type: "select", group: "Credentials",
        options: [
          { label: "USD — US Dollar", value: "USD" },
          { label: "EUR — Euro", value: "EUR" },
          { label: "GBP — British Pound", value: "GBP" },
          { label: "BDT — Bangladeshi Taka", value: "BDT" },
        ], placeholder: "USD" },
      { key: "statement_descriptor", label: "Statement Descriptor", type: "text", group: "Credentials", helper: "Appears on customer card statements (max 22 chars)." },
    ],
  },
  async testConnection(cfg) {
    const start = Date.now();
    const secret = String(cfg.credentials.secret_key ?? "").trim();
    if (!secret) return { ok: false, message: "Secret key required", latency_ms: 0 };
    try {
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const ok = res.status === 200;
      const json: any = await res.json().catch(() => ({}));
      return {
        ok,
        message: ok
          ? `Connected (${secret.startsWith("sk_test_") ? "test" : "live"})`
          : json?.error?.message ?? `HTTP ${res.status}`,
        latency_ms: Date.now() - start,
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Network error", latency_ms: Date.now() - start };
    }
  },
  async createCheckout() {
    throw new Error("Stripe checkout not yet wired for storefront");
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "USD", provider_ref: input.provider_ref };
  },
};
