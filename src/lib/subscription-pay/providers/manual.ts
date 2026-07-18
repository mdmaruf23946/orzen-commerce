// Manual / offline bank-transfer "provider". Winner Admin manually
// verifies. Kept in the same modular shape so the checkout UI can
// treat it uniformly.
import type { SubscriptionPaymentProvider } from "./types";

export const manual: SubscriptionPaymentProvider = {
  meta: {
    id: "manual",
    label: "Manual / Bank Transfer",
    methods: ["bank", "cash"],
    supportsSandbox: false,
    credentialFields: [
      { key: "instructions", label: "Payment instructions shown to customers", type: "text" },
    ],
  },
  async testConnection() {
    return { ok: true, message: "Manual provider is always available", latency_ms: 0 };
  },
  async createCheckout(_cfg, ctx) {
    // No redirect — the return URL just shows a pending-verification screen.
    return { redirect_url: ctx.returnUrl, provider_ref: ctx.invoiceNo };
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "BDT", provider_ref: input.provider_ref };
  },
};
