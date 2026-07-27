// Shared helper for provider adapters where the official live API integration
// is not yet wired. We still let store owners configure and save credentials
// (encrypted at rest) so the Winner Admin can activate live processing later
// without any Store Panel change. testConnection succeeds with a clear
// "configuration accepted" message; createCheckout / verifyPayment fail loudly
// so nothing silently marks orders paid.
import type {
  CheckoutContext,
  ProviderConfig,
  SubscriptionPaymentProvider,
  CredentialField,
  ProviderMeta,
} from "./types";

export function pendingAdapter(meta: ProviderMeta): SubscriptionPaymentProvider {
  return {
    meta,
    async testConnection(cfg: ProviderConfig) {
      const start = Date.now();
      // Basic presence check for every field marked required.
      const missing: string[] = [];
      for (const f of meta.credentialFields) {
        if (!f.required) continue;
        const v = cfg.credentials[f.key];
        if (typeof v !== "string" || !v.trim()) missing.push(f.label);
      }
      if (missing.length) {
        return {
          ok: false,
          message: `Please fill: ${missing.join(", ")}`,
          latency_ms: Date.now() - start,
        };
      }
      return {
        ok: true,
        message: `Credentials saved securely. Live ${meta.label} payment routing will activate once the official API integration ships.`,
        latency_ms: Date.now() - start,
      };
    },
    async createCheckout(_cfg: ProviderConfig, _ctx: CheckoutContext) {
      throw new Error(
        `${meta.label} checkout is not yet available. Please pick another gateway or enable one that is fully connected.`,
      );
    },
    async verifyPayment(_cfg, input) {
      return {
        status: "pending",
        amount: 0,
        currency: "BDT",
        provider_ref: input.provider_ref,
      };
    },
  };
}

// Shared credential-field builders keep the 10+ new providers consistent.
export const commonFields = {
  merchantId: (): CredentialField => ({
    key: "merchant_id",
    label: "Merchant ID",
    type: "text",
    required: true,
    group: "Credentials",
  }),
  storeId: (): CredentialField => ({
    key: "store_id",
    label: "Store ID",
    type: "text",
    required: true,
    group: "Credentials",
  }),
  apiKey: (): CredentialField => ({
    key: "api_key",
    label: "API Key",
    type: "password",
    required: true,
    group: "Credentials",
  }),
  apiSecret: (): CredentialField => ({
    key: "api_secret",
    label: "API Secret",
    type: "password",
    required: true,
    group: "Credentials",
  }),
  clientId: (): CredentialField => ({
    key: "client_id",
    label: "Client ID",
    type: "text",
    required: true,
    group: "Credentials",
  }),
  clientSecret: (): CredentialField => ({
    key: "client_secret",
    label: "Client Secret",
    type: "password",
    required: true,
    group: "Credentials",
  }),
  username: (): CredentialField => ({
    key: "username",
    label: "Username",
    type: "text",
    required: true,
    group: "Credentials",
  }),
  password: (): CredentialField => ({
    key: "password",
    label: "Password",
    type: "password",
    required: true,
    group: "Credentials",
  }),
  appKey: (): CredentialField => ({
    key: "app_key",
    label: "App Key",
    type: "password",
    required: true,
    group: "Credentials",
  }),
  appSecret: (): CredentialField => ({
    key: "app_secret",
    label: "App Secret",
    type: "password",
    required: true,
    group: "Credentials",
  }),
  webhookSecret: (): CredentialField => ({
    key: "webhook_secret",
    label: "Webhook Secret",
    type: "password",
    group: "Webhook",
    helper: "Optional. Used to verify incoming webhook signatures.",
  }),
  callbackUrl: (): CredentialField => ({
    key: "callback_url",
    label: "Callback URL",
    type: "url",
    group: "URLs",
    helper: "Leave blank to use the ORZEN default.",
  }),
  successUrl: (): CredentialField => ({
    key: "success_url",
    label: "Success URL",
    type: "url",
    group: "URLs",
  }),
  failUrl: (): CredentialField => ({
    key: "fail_url",
    label: "Fail URL",
    type: "url",
    group: "URLs",
  }),
  cancelUrl: (): CredentialField => ({
    key: "cancel_url",
    label: "Cancel URL",
    type: "url",
    group: "URLs",
  }),
};
