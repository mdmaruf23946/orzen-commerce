// Manual / offline bank-transfer "provider". Winner Admin manually
// verifies. Kept in the same modular shape so the checkout UI can
// treat it uniformly.
import type { SubscriptionPaymentProvider } from "./types";

export const manual: SubscriptionPaymentProvider = {
  meta: {
    id: "manual",
    label: "Manual / Bank Transfer",
    methods: ["bank", "bkash", "nagad", "rocket", "upay"],
    supportsSandbox: false,
    credentialFields: [
      { key: "bank_name", label: "Bank Name", type: "text", group: "Bank Account" },
      { key: "account_name", label: "Account Name", type: "text", group: "Bank Account" },
      { key: "account_number", label: "Account Number", type: "text", group: "Bank Account" },
      { key: "branch", label: "Branch", type: "text", group: "Bank Account" },
      { key: "routing_number", label: "Routing Number", type: "text", group: "Bank Account" },
      { key: "swift", label: "SWIFT / BIC", type: "text", group: "Bank Account" },
      { key: "iban", label: "IBAN", type: "text", group: "Bank Account" },

      { key: "bkash_number", label: "bKash Number", type: "text", placeholder: "017XXXXXXXX", group: "Mobile Wallets" },
      { key: "nagad_number", label: "Nagad Number", type: "text", placeholder: "017XXXXXXXX", group: "Mobile Wallets" },
      { key: "rocket_number", label: "Rocket Number", type: "text", placeholder: "017XXXXXXXX", group: "Mobile Wallets" },
      { key: "upay_number", label: "Upay Number", type: "text", placeholder: "017XXXXXXXX", group: "Mobile Wallets" },

      { key: "qr_code_url", label: "Payment QR Code", type: "image", group: "Instructions", helper: "Upload a QR code that customers can scan." },
      { key: "instructions", label: "Payment Instructions", type: "textarea", group: "Instructions", placeholder: "e.g. Send Money to the number above and paste the TrxID at checkout.", helper: "Shown to customers on the checkout page." },
    ],
  },
  async testConnection() {
    return { ok: true, message: "Manual provider is always available", latency_ms: 0 };
  },
  async createCheckout(_cfg, ctx) {
    return { redirect_url: ctx.returnUrl, provider_ref: ctx.invoiceNo };
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "BDT", provider_ref: input.provider_ref };
  },
};
