// Zod schemas + TypeScript types for the Custom Payment Gateway Builder.
// The `config` JSON persisted in `custom_payment_gateways.config` conforms
// to `CustomGatewayConfigSchema`. Secret credentials NEVER go here — they
// live encrypted in `credentials_ciphertext` and are shaped per auth type.
import { z } from "zod";

export const AUTH_TYPES = [
  "api_key",
  "api_key_secret",
  "bearer",
  "basic",
  "oauth2",
  "hmac",
  "custom_header",
  "none",
] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const CHECKOUT_TYPES = [
  "hosted",
  "redirect",
  "api_response_url",
  "embedded",
  "direct_api",
  "manual",
] as const;
export type CheckoutType = (typeof CHECKOUT_TYPES)[number];

export const CONTENT_TYPES = ["json", "form_urlencoded", "form_data", "xml"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const VERIFY_METHODS = ["api_status", "webhook_only", "callback", "manual"] as const;
export type VerifyMethod = (typeof VERIFY_METHODS)[number];

export const SIG_ALGOS = ["sha256", "sha512"] as const;
export const SIG_ENCODINGS = ["hex", "base64"] as const;

export const PLATFORM_STATUSES = [
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "expired",
] as const;
export type PlatformStatus = (typeof PLATFORM_STATUSES)[number];

const kv = z.object({ key: z.string().min(1).max(120), value: z.string().max(2000) });

export const HeaderTemplateSchema = z.array(kv).max(40);
export const FieldMappingSchema = z.array(
  z.object({
    source: z.string().min(1).max(120), // internal var name OR "__static"
    target: z.string().min(1).max(200),
    staticValue: z.string().max(2000).optional(),
  }),
).max(80);

export const StatusMapSchema = z.array(
  z.object({
    from: z.string().min(1).max(120),
    to: z.enum(PLATFORM_STATUSES),
  }),
).max(60);

export const PaymentMethodSchema = z.object({
  code: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  icon_url: z.string().url().max(500).optional().or(z.literal("")),
  enabled: z.boolean().default(true),
});

export const WebhookConfigSchema = z.object({
  method: z.enum(["POST", "GET"]).default("POST"),
  contentType: z.enum(CONTENT_TYPES).default("json"),
  signature: z.object({
    type: z.enum(["none", "hmac", "shared_secret", "custom"]).default("none"),
    algorithm: z.enum(SIG_ALGOS).default("sha256"),
    encoding: z.enum(SIG_ENCODINGS).default("hex"),
    header: z.string().max(120).default("X-Signature"),
    prefix: z.string().max(20).default(""),
  }),
  eventIdPath: z.string().max(200).default(""),
  eventTypePath: z.string().max(200).default(""),
  providerRefPath: z.string().max(200).default(""),
  statusPath: z.string().max(200).default(""),
});

export const VerificationConfigSchema = z.object({
  method: z.enum(VERIFY_METHODS).default("webhook_only"),
  endpoint: z.string().max(500).default(""),
  httpMethod: z.enum(HTTP_METHODS).default("GET"),
  transactionIdParam: z.string().max(120).default("transaction_id"),
  statusPath: z.string().max(200).default("data.status"),
  successValues: z.array(z.string().min(1).max(60)).max(20).default(["SUCCESS", "PAID", "COMPLETED"]),
  amountPath: z.string().max(200).default(""),
  currencyPath: z.string().max(200).default(""),
});

export const RefundConfigSchema = z.object({
  enabled: z.boolean().default(false),
  endpoint: z.string().max(500).default(""),
  httpMethod: z.enum(["POST", "PUT"]).default("POST"),
  amountField: z.string().max(120).default("amount"),
  transactionIdField: z.string().max(120).default("transaction_id"),
  reasonField: z.string().max(120).default("reason"),
  statusPath: z.string().max(200).default("data.status"),
  statusMap: StatusMapSchema.default([]),
});

export const CustomGatewayConfigSchema = z.object({
  request: z.object({
    method: z.enum(HTTP_METHODS).default("POST"),
    endpoint: z.string().max(500).default(""),
    contentType: z.enum(CONTENT_TYPES).default("json"),
    headers: HeaderTemplateSchema.default([]),
    // Optional raw body template. If empty, we build from `mapping`.
    bodyTemplate: z.string().max(20_000).default(""),
    mapping: FieldMappingSchema.default([]),
  }),
  checkout: z.object({
    type: z.enum(CHECKOUT_TYPES).default("hosted"),
    responsePayUrlPath: z.string().max(200).default("data.checkout_url"),
    embeddedFieldPath: z.string().max(200).default(""),
  }),
  response: z.object({
    transactionIdPath: z.string().max(200).default("data.transaction_id"),
    referencePath: z.string().max(200).default("data.reference"),
    statusPath: z.string().max(200).default("data.status"),
    messagePath: z.string().max(200).default("data.message"),
  }),
  webhook: WebhookConfigSchema,
  statusMap: StatusMapSchema.default([]),
  verification: VerificationConfigSchema,
  refund: RefundConfigSchema,
  methods: z.array(PaymentMethodSchema).max(20).default([]),
});

export type CustomGatewayConfig = z.infer<typeof CustomGatewayConfigSchema>;
export type CustomGatewayPublic = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  docs_url: string | null;
  support_email: string | null;
  currency: string;
  currencies: string[];
  status: "draft" | "testing" | "connected" | "active" | "error" | "disabled";
  environment: "sandbox" | "production";
  auth_type: AuthType;
  api_base_url: string | null;
  sandbox_base_url: string | null;
  config: CustomGatewayConfig;
  credentials_preview: string | null;
  has_credentials: boolean;
  is_default: boolean;
  is_active: boolean;
  last_tested_at: string | null;
  last_test_result: unknown;
  created_at: string;
  updated_at: string;
};

// Which credential keys are considered secret for each auth type. These are
// stripped from `config` before persist and stored in the encrypted blob.
export const AUTH_SECRET_KEYS: Record<AuthType, string[]> = {
  api_key: ["api_key"],
  api_key_secret: ["api_key", "api_secret"],
  bearer: ["bearer_token"],
  basic: ["username", "password"],
  oauth2: ["client_id", "client_secret"],
  hmac: ["hmac_secret"],
  custom_header: ["custom_header_value"],
  none: [],
};

// Non-secret credential fields (e.g. OAuth URLs, custom header name) kept in `config.authMeta`.
export const AUTH_META_KEYS: Record<AuthType, string[]> = {
  api_key: [],
  api_key_secret: [],
  bearer: [],
  basic: [],
  oauth2: ["authorization_url", "token_url", "scopes"],
  hmac: ["hmac_header"],
  custom_header: ["custom_header_name"],
  none: [],
};

export const InternalVariables = [
  "order_id",
  "amount",
  "currency",
  "customer_name",
  "customer_email",
  "customer_phone",
  "product_name",
  "product_quantity",
  "shipping_address",
  "success_url",
  "cancel_url",
  "fail_url",
  "callback_url",
  "webhook_url",
  "store_id",
] as const;
export type InternalVariable = (typeof InternalVariables)[number];
