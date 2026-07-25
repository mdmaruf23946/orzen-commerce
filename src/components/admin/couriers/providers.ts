// Frontend metadata registry for supported couriers. Adding a new courier
// only requires appending an entry here — the UI adapts automatically.

export type CourierKey = "steadfast" | "pathao" | "redx" | "paperfly";

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

export type CourierMeta = {
  key: CourierKey;
  label: string;
  tagline: string;
  brandColor: string; // official brand color
  brandColorSoft: string; // subtle background variant
  supports: CourierSupports;
};

export const COURIERS: CourierMeta[] = [
  {
    key: "steadfast",
    label: "SteadFast",
    tagline: "Nationwide COD courier",
    brandColor: "#0E9F6E",
    brandColorSoft: "#0E9F6E1A",
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

export type CourierConfig = {
  api_key?: string | null;
  secret?: string | null;
  base_url?: string | null;
  enabled?: boolean;
  sandbox?: boolean;
  is_default?: boolean;
  shipping?: CourierShipping;
  pickup?: CourierPickup;
  automation?: CourierAutomation;
  diagnostics?: CourierDiagnostics;
};

export const emptyConfig: CourierConfig = {
  enabled: false,
  sandbox: false,
  is_default: false,
  shipping: { cod: true, home: true },
  pickup: {},
  automation: {},
  diagnostics: {},
};
