// Modular subscription payment provider contract.
// Adding a new provider = one adapter file + one registry entry.

export type CredentialField = {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "textarea" | "url" | "image" | "number";
  placeholder?: string;
  options?: { label: string; value: string }[];
  helper?: string;
  /** Grouping label for sectioned UI (e.g. "Credentials", "URLs", "Bank details") */
  group?: string;
  /** When true, the UI blocks Save if empty (server still trusts adapter.testConnection) */
  required?: boolean;
  /** Regex hint (client-side only) used to show inline format warnings */
  pattern?: string;
  patternHint?: string;
};

export type ProviderMeta = {
  id: string;
  label: string;
  methods: string[]; // ["bkash","nagad","visa",...]
  supportsSandbox: boolean;
  credentialFields: CredentialField[];
  logo?: string;
};

export type ProviderConfig = {
  credentials: Record<string, string | boolean>;
  sandbox: boolean;
};

export type CheckoutContext = {
  invoiceId: string;
  invoiceNo: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  returnUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  packageLabel: string;
};

export type CheckoutResult = {
  redirect_url: string;
  provider_ref: string;
  raw?: unknown;
};

export type VerifyResult = {
  status: "paid" | "failed" | "pending";
  amount: number;
  currency: string;
  method?: string;
  provider_ref: string;
  raw?: unknown;
};

export type TestResult = {
  ok: boolean;
  message: string;
  latency_ms: number;
};

export interface SubscriptionPaymentProvider {
  meta: ProviderMeta;
  testConnection(cfg: ProviderConfig): Promise<TestResult>;
  createCheckout(cfg: ProviderConfig, ctx: CheckoutContext): Promise<CheckoutResult>;
  verifyPayment(
    cfg: ProviderConfig,
    input: { provider_ref: string; raw?: any },
  ): Promise<VerifyResult>;
  parseWebhook?(cfg: ProviderConfig, req: Request): Promise<{ provider_ref: string; raw: any }>;
}
