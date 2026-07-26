// Frontend metadata registry for supported couriers. Adding a new courier
// only requires appending an entry here — the UI adapts automatically.

export type CourierKey =
  | "steadfast"
  | "pathao"
  | "redx"
  | "paperfly"
  | "ecourier"
  | "sa_paribahan"
  | "sundarban";

export type CourierSupports = {
  sandbox: boolean;
  subCity: boolean;
  pickupPoint: boolean;
  exchange: boolean;
  returnDelivery: boolean;
  autoParcel: boolean;
  autoStatus: boolean;
  autoTracking: boolean;
  autoLabel: boolean;
  autoSms: boolean;
  autoNotify: boolean;
};

export type CredentialFieldSpec = {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: { label: string; value: string }[];
};

export type CourierMeta = {
  key: CourierKey;
  label: string;
  tagline: string;
  brandColor: string; // official brand color
  brandColorSoft: string; // subtle background variant
  supports: CourierSupports;
  credentialFields?: CredentialFieldSpec[];
  supportsWebhook?: boolean;
};

// Legacy default fields kept for backward compatibility with existing
// SteadFast/Pathao/RedX/Paperfly configurations.
export const DEFAULT_CREDENTIAL_FIELDS: CredentialFieldSpec[] = [
  { key: "api_key", label: "API Key", type: "password" },
  { key: "secret", label: "Secret Key", type: "password" },
  { key: "base_url", label: "Base URL", type: "url", placeholder: "https://" },
];

export const COURIERS: CourierMeta[] = [
  {
    key: "steadfast",
    label: "SteadFast",
    tagline: "Nationwide COD courier",
    brandColor: "#0E9F6E",
    brandColorSoft: "#0E9F6E1A",
    credentialFields: DEFAULT_CREDENTIAL_FIELDS,
    supports: {
      sandbox: false,
      subCity: false,
      pickupPoint: false,
      exchange: false,
      returnDelivery: true,
      autoParcel: true,
      autoStatus: true,
      autoTracking: true,
      autoLabel: false,
      autoSms: true,
      autoNotify: true,
    },
  },
  {
    key: "pathao",
    label: "Pathao Courier",
    tagline: "Urban express & COD",
    brandColor: "#E8541C",
    brandColorSoft: "#E8541C1A",
    credentialFields: DEFAULT_CREDENTIAL_FIELDS,
    supports: {
      sandbox: true,
      subCity: true,
      pickupPoint: true,
      exchange: true,
      returnDelivery: true,
      autoParcel: true,
      autoStatus: true,
      autoTracking: true,
      autoLabel: true,
      autoSms: true,
      autoNotify: true,
    },
  },
  {
    key: "redx",
    label: "RedX",
    tagline: "Fast delivery across BD",
    brandColor: "#E11D48",
    brandColorSoft: "#E11D481A",
    credentialFields: DEFAULT_CREDENTIAL_FIELDS,
    supports: {
      sandbox: false,
      subCity: true,
      pickupPoint: false,
      exchange: true,
      returnDelivery: true,
      autoParcel: true,
      autoStatus: true,
      autoTracking: true,
      autoLabel: true,
      autoSms: false,
      autoNotify: true,
    },
  },
  {
    key: "paperfly",
    label: "Paperfly",
    tagline: "Nationwide logistics",
    brandColor: "#1E3A8A",
    brandColorSoft: "#1E3A8A1A",
    credentialFields: DEFAULT_CREDENTIAL_FIELDS,
    supports: {
      sandbox: true,
      subCity: false,
      pickupPoint: true,
      exchange: false,
      returnDelivery: true,
      autoParcel: true,
      autoStatus: true,
      autoTracking: true,
      autoLabel: true,
      autoSms: false,
      autoNotify: true,
    },
  },
  {
    key: "ecourier",
    label: "eCourier",
    tagline: "Nationwide COD & express",
    brandColor: "#00A651",
    brandColorSoft: "#00A6511A",
    supportsWebhook: true,
    credentialFields: [
      { key: "user_id", label: "User ID", type: "text", required: true, help: "eCourier merchant User ID" },
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "api_secret", label: "API Secret", type: "password", required: true },
      { key: "base_url", label: "Base URL", type: "url", placeholder: "https://backoffice.ecourier.com.bd/api" },
    ],
    supports: {
      sandbox: true,
      subCity: true,
      pickupPoint: true,
      exchange: false,
      returnDelivery: true,
      autoParcel: true,
      autoStatus: true,
      autoTracking: true,
      autoLabel: true,
      autoSms: true,
      autoNotify: true,
    },
  },
  {
    key: "sa_paribahan",
    label: "S.A. Paribahan",
    tagline: "Trusted nationwide parcel service",
    brandColor: "#1F4E9C",
    brandColorSoft: "#1F4E9C1A",
    credentialFields: [
      { key: "merchant_code", label: "Merchant Code", type: "text", required: true },
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "base_url", label: "Base URL", type: "url", placeholder: "https://" },
    ],
    supports: {
      sandbox: false,
      subCity: false,
      pickupPoint: false,
      exchange: false,
      returnDelivery: true,
      autoParcel: false,
      autoStatus: true,
      autoTracking: true,
      autoLabel: false,
      autoSms: false,
      autoNotify: true,
    },
  },
  {
    key: "sundarban",
    label: "Sundarban Courier",
    tagline: "Legacy nationwide network",
    brandColor: "#B45309",
    brandColorSoft: "#B453091A",
    credentialFields: [
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true },
      { key: "base_url", label: "Base URL", type: "url", placeholder: "https://" },
    ],
    supports: {
      sandbox: false,
      subCity: false,
      pickupPoint: false,
      exchange: false,
      returnDelivery: true,
      autoParcel: false,
      autoStatus: false,
      autoTracking: true,
      autoLabel: false,
      autoSms: false,
      autoNotify: false,
    },
  },
];

export type CourierShipping = {
  insideCity?: number | null;
  outsideCity?: number | null;
  subCity?: number | null;
  cod?: boolean;
  home?: boolean;
  pickupPoint?: boolean;
  returnDelivery?: boolean;
  exchange?: boolean;
  priority?: number | null; // lower = higher priority
};

export type CourierPickup = {
  contactName?: string;
  phone?: string;
  address?: string;
  district?: string;
  area?: string;
  instructions?: string;
};

export type CourierAutomation = {
  autoParcel?: boolean;
  autoStatus?: boolean;
  autoTracking?: boolean;
  autoLabel?: boolean;
  autoSms?: boolean;
  autoNotify?: boolean;
};

export type CourierDiagnostics = {
  lastConnectedAt?: string | null;
  lastStatus?: "connected" | "error" | "unknown" | null;
  lastError?: string | null;
  lastResponse?: string | null;
  latencyMs?: number | null;
};

export type CourierWebhook = {
  verify_token?: string | null;
};

export type CourierConfig = {
  api_key?: string | null;
  secret?: string | null;
  base_url?: string | null;
  enabled?: boolean;
  sandbox?: boolean;
  is_default?: boolean;
  credentials?: Record<string, string>;
  shipping?: CourierShipping;
  pickup?: CourierPickup;
  automation?: CourierAutomation;
  diagnostics?: CourierDiagnostics;
  webhook?: CourierWebhook;
};

export const emptyConfig: CourierConfig = {
  enabled: false,
  sandbox: false,
  is_default: false,
  credentials: {},
  shipping: { cod: true, home: true },
  pickup: {},
  automation: {},
  diagnostics: {},
  webhook: {},
};

// Read a credential value with legacy fallback so old rows keep working.
export function readCredential(cfg: CourierConfig, key: string): string {
  const v = cfg.credentials?.[key];
  if (v != null && v !== "") return v;
  if (key === "api_key" && cfg.api_key) return cfg.api_key;
  if (key === "secret" && cfg.secret) return cfg.secret;
  if (key === "base_url" && cfg.base_url) return cfg.base_url;
  return "";
}
