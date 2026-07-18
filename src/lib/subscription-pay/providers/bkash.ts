// bKash direct integration stub. Not implemented yet; kept as a
// disabled placeholder so the Winner Admin can wire it in later
// without touching subscription code.
import type { SubscriptionPaymentProvider } from "./types";

export const bkash: SubscriptionPaymentProvider = {
  meta: {
    id: "bkash",
    label: "bKash (Direct)",
    methods: ["bkash"],
    supportsSandbox: true,
    credentialFields: [
      { key: "app_key", label: "App Key", type: "text" },
      { key: "app_secret", label: "App Secret", type: "password" },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
    ],
  },
  async testConnection() {
    return { ok: false, message: "bKash direct integration is not yet implemented", latency_ms: 0 };
  },
  async createCheckout() {
    throw new Error("bKash direct provider is not yet implemented");
  },
  async verifyPayment(_cfg, input) {
    return { status: "pending", amount: 0, currency: "BDT", provider_ref: input.provider_ref };
  },
};
