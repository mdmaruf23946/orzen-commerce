import type { SubscriptionPaymentProvider } from "./types";

export const stripe: SubscriptionPaymentProvider = {
  meta: {
    id: "stripe",
    label: "Stripe",
    methods: ["visa", "mastercard", "amex", "wallet"],
    supportsSandbox: true,
    credentialFields: [
      { key: "publishable_key", label: "Publishable key", type: "text", placeholder: "pk_..." },
      { key: "secret_key", label: "Secret key", type: "password", placeholder: "sk_..." },
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
