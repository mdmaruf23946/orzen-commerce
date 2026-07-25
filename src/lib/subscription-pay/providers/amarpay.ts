import type { SubscriptionPaymentProvider } from "./types";

export const amarpay: SubscriptionPaymentProvider = {
  meta: {
    id: "amarpay",
    label: "AmarPay",
    methods: ["bkash", "nagad", "rocket", "visa", "mastercard"],
    supportsSandbox: true,
    credentialFields: [
      { key: "store_id", label: "Store ID", type: "text", required: true, group: "Credentials" },
      { key: "signature_key", label: "Signature Key", type: "password", required: true, group: "Credentials" },
      { key: "currency", label: "Currency", type: "select", group: "Credentials",
        options: [
          { label: "BDT — Bangladeshi Taka", value: "BDT" },
          { label: "USD — US Dollar", value: "USD" },
        ], placeholder: "BDT" },
      { key: "success_url", label: "Success URL", type: "url", group: "Callback URLs" },
      { key: "fail_url", label: "Fail URL", type: "url", group: "Callback URLs" },
      { key: "cancel_url", label: "Cancel URL", type: "url", group: "Callback URLs" },
      { key: "ipn_url", label: "IPN URL", type: "url", group: "Callback URLs" },
    ],
  },
  async testConnection(cfg) {
    const s = String(cfg.credentials.store_id ?? "").trim();
    const k = String(cfg.credentials.signature_key ?? "").trim();
    if (!s || !k) return { ok: false, message: "Store ID and signature key required", latency_ms: 0 };
    return { ok: true, message: `Configured (${cfg.sandbox ? "sandbox" : "live"})`, latency_ms: 0 };
  },
  async createCheckout() {
    throw new Error("AmarPay checkout not yet wired for storefront");
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "BDT", provider_ref: input.provider_ref };
  },
};
