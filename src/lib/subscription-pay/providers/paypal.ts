import type { SubscriptionPaymentProvider } from "./types";

export const paypal: SubscriptionPaymentProvider = {
  meta: {
    id: "paypal",
    label: "PayPal",
    methods: ["paypal", "visa", "mastercard"],
    supportsSandbox: true,
    credentialFields: [
      { key: "client_id", label: "Client ID", type: "text" },
      { key: "client_secret", label: "Client Secret", type: "password" },
    ],
  },
  async testConnection(cfg) {
    const start = Date.now();
    const id = String(cfg.credentials.client_id ?? "").trim();
    const secret = String(cfg.credentials.client_secret ?? "").trim();
    if (!id || !secret) return { ok: false, message: "Client ID and secret required", latency_ms: 0 };
    try {
      const base = cfg.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
      const basic = Buffer.from(`${id}:${secret}`).toString("base64");
      const res = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      const json: any = await res.json().catch(() => ({}));
      const ok = res.ok && !!json?.access_token;
      return {
        ok,
        message: ok ? `Connected (${cfg.sandbox ? "sandbox" : "live"})` : json?.error_description ?? `HTTP ${res.status}`,
        latency_ms: Date.now() - start,
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? "Network error", latency_ms: Date.now() - start };
    }
  },
  async createCheckout() {
    throw new Error("PayPal checkout not yet wired for storefront");
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "USD", provider_ref: input.provider_ref };
  },
};
