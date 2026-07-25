import type { SubscriptionPaymentProvider } from "./types";

export const portwallet: SubscriptionPaymentProvider = {
  meta: {
    id: "portwallet",
    label: "PortWallet",
    methods: ["visa", "mastercard", "amex", "bkash", "nagad"],
    supportsSandbox: true,
    credentialFields: [
      { key: "merchant_id", label: "Merchant ID", type: "text", required: true, group: "Credentials" },
      { key: "api_key", label: "API Key", type: "password", required: true, group: "Credentials" },
      { key: "secret_key", label: "Secret Key", type: "password", required: true, group: "Credentials" },
      { key: "currency", label: "Currency", type: "select", group: "Credentials",
        options: [
          { label: "BDT — Bangladeshi Taka", value: "BDT" },
          { label: "USD — US Dollar", value: "USD" },
        ], placeholder: "BDT" },
      { key: "success_url", label: "Success URL", type: "url", group: "Callback URLs" },
      { key: "fail_url", label: "Fail URL", type: "url", group: "Callback URLs" },
      { key: "ipn_url", label: "IPN URL", type: "url", group: "Callback URLs" },
    ],
  },
  async testConnection(cfg) {
    const m = String(cfg.credentials.merchant_id ?? "").trim();
    const a = String(cfg.credentials.api_key ?? "").trim();
    const s = String(cfg.credentials.secret_key ?? "").trim();
    if (!m || !a || !s) return { ok: false, message: "Merchant ID, API key and Secret key required", latency_ms: 0 };
    return { ok: true, message: `Configured (${cfg.sandbox ? "sandbox" : "live"})`, latency_ms: 0 };
  },
  async createCheckout() {
    throw new Error("PortWallet checkout not yet wired for storefront");
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "BDT", provider_ref: input.provider_ref };
  },
};
