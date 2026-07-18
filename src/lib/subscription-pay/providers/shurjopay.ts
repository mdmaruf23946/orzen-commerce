import type { SubscriptionPaymentProvider } from "./types";

// ShurjoPay adapter (stub for storefront checkout).
// Configure credentials in Store Admin → Payment Gateway.
export const shurjopay: SubscriptionPaymentProvider = {
  meta: {
    id: "shurjopay",
    label: "ShurjoPay",
    methods: ["bkash", "nagad", "rocket", "visa", "mastercard"],
    supportsSandbox: true,
    credentialFields: [
      { key: "merchant_username", label: "Merchant Username", type: "text" },
      { key: "merchant_password", label: "Merchant Password", type: "password" },
      { key: "prefix", label: "Prefix", type: "text", placeholder: "sp" },
    ],
  },
  async testConnection(cfg) {
    const start = Date.now();
    const u = String(cfg.credentials.merchant_username ?? "").trim();
    const p = String(cfg.credentials.merchant_password ?? "").trim();
    if (!u || !p) return { ok: false, message: "Username and password required", latency_ms: Date.now() - start };
    try {
      const base = cfg.sandbox
        ? "https://sandbox.shurjopayment.com"
        : "https://engine.shurjopayment.com";
      const res = await fetch(`${base}/api/get_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const json: any = await res.json().catch(() => ({}));
      const ok = !!json?.token;
      return {
        ok,
        message: ok ? `Connected (${cfg.sandbox ? "sandbox" : "live"})` : json?.message ?? "Invalid credentials",
        latency_ms: Date.now() - start,
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Network error", latency_ms: Date.now() - start };
    }
  },
  async createCheckout(_cfg, ctx) {
    throw new Error("ShurjoPay checkout not yet wired for storefront");
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "BDT", provider_ref: input.provider_ref };
  },
};
