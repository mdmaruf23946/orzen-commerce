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
  /** Courier exposes a location/store listing endpoint we can sync. */
  sync?: boolean;
};

export type CredentialFieldSpec = {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required?: boolean;
  placeholder?: string;
  help?: string;
  defaultValue?: string;
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
  /**
   * "simple" renders the beginner-friendly official-spec form
   * (credentials → pickup → shipping → actions → diagnostics).
   * "full" keeps the legacy card with automation/webhook sections.
   */
  profile?: "simple" | "full";
  /** Base URL used when Sandbox mode is on (simple profile only). */
  sandboxBaseUrl?: string;
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
    profile: "simple",
    credentialFields: [
      {
        key: "api_key",
        label: "API Key",
        type: "password",
        required: true,
        help: "SteadFast merchant panel → API. Sent as the Api-Key header.",
      },
      {
        key: "secret",
        label: "Secret Key",
        type: "password",
        required: true,
        help: "Sent as the Secret-Key header.",
      },
      {
        key: "base_url",
        label: "Base API URL",
        type: "url",
        required: true,
        defaultValue: "https://portal.packzy.com/api/v1",
        placeholder: "https://portal.packzy.com/api/v1",
      },
    ],
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
      sync: false,
    },
  },
  {
    key: "pathao",
    label: "Pathao Courier",
    tagline: "Urban express & COD",
    brandColor: "#E8541C",
    brandColorSoft: "#E8541C1A",
    profile: "simple",
    sandboxBaseUrl: "https://courier-api-sandbox.pathao.com",
    credentialFields: [
      { key: "client_id", label: "Client ID", type: "text", required: true },
      { key: "client_secret", label: "Client Secret", type: "password", required: true },
      {
        key: "username",
        label: "Username (email)",
        type: "text",
        required: true,
        placeholder: "merchant@example.com",
      },
      { key: "password", label: "Password", type: "password", required: true },
      {
        key: "store_id",
        label: "Store ID",
        type: "text",
        required: true,
        help: "Pathao merchant panel → Stores.",
      },
      {
        key: "base_url",
        label: "Base API URL",
        type: "url",
        required: true,
        defaultValue: "https://api-hermes.pathao.com",
        placeholder: "https://api-hermes.pathao.com",
        help: "Sandbox uses https://courier-api-sandbox.pathao.com",
      },
    ],
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
      sync: true,
    },
  },
  {
    key: "redx",
    label: "RedX",
    tagline: "Fast delivery across BD",
    brandColor: "#E11D48",
    brandColorSoft: "#E11D481A",
    profile: "simple",
    credentialFields: [
      {
        key: "api_key",
        label: "API Access Token",
        type: "password",
        required: true,
        help: "RedX merchant panel → API. Sent as the API-ACCESS-TOKEN header.",
      },
      {
        key: "base_url",
        label: "Base API URL",
        type: "url",
        required: true,
        defaultValue: "https://openapi.redx.com.bd/v1.0.0-beta",
        placeholder: "https://openapi.redx.com.bd/v1.0.0-beta",
      },
    ],
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
      sync: true,
    },
  },
  {
    key: "paperfly",
    label: "Paperfly",
    tagline: "Nationwide logistics",
    brandColor: "#1E3A8A",
    brandColorSoft: "#1E3A8A1A",
    profile: "simple",
    credentialFields: [
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true },
      {
        key: "api_key",
        label: "API Key (paperflykey)",
        type: "password",
        required: true,
        help: "Sent as the paperflykey header alongside Basic auth.",
      },
      {
        key: "base_url",
        label: "Base API URL",
        type: "url",
        required: true,
        defaultValue: "https://mplog.paperfly.com.bd/api",
        placeholder: "https://mplog.paperfly.com.bd/api",
      },
    ],
    supports: {
      sandbox: false,
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
      sync: false,
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
