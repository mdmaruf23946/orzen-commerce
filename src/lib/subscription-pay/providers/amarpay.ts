import type { SubscriptionPaymentProvider } from "./types";

export const amarpay: SubscriptionPaymentProvider = {
  meta: {
    id: "amarpay",
    label: "AmarPay",
    methods: ["bkash", "nagad", "rocket", "visa", "mastercard"],
    supportsSandbox: true,
    credentialFields: [
      { key: "store_id", label: "Store ID", type: "text" },
      { key: "signature_key", label: "Signature Key", type: "password" },
    ],
  },
  async testConnection(cfg) {
    const s = String(cfg.credentials.store_id ?? "").trim();
    const k = String(cfg.credentials.signature_key ?? "").trim();
    if (!s || !k) return { ok: false, message: "Store ID and signature key required", latency_ms: 0 };
    // AmarPay has no lightweight ping; treat presence of both fields as configured.
    return { ok: true, message: `Configured (${cfg.sandbox ? "sandbox" : "live"})`, latency_ms: 0 };
  },
  async createCheckout() {
    throw new Error("AmarPay checkout not yet wired for storefront");
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "BDT", provider_ref: input.provider_ref };
  },
};
