// Shared (client-safe) digital-store helpers: types, defaults, small predicates.

export type StoreMode = "physical" | "digital" | "hybrid";
export type ProductType = "physical" | "digital" | "service" | "subscription";

export const STORE_MODES: { value: StoreMode; label: string; description: string }[] = [
  {
    value: "physical",
    label: "Physical store",
    description: "Shippable goods only. Delivery zones, couriers and addresses are shown.",
  },
  {
    value: "digital",
    label: "Digital store",
    description: "Downloadable products only. No shipping, no courier — instant delivery.",
  },
  {
    value: "hybrid",
    label: "Hybrid store",
    description: "Sell both physical and digital products. Checkout adapts per cart.",
  },
];

/** Per-product digital configuration, stored in products.digital (jsonb). */
export type DigitalConfig = {
  /** Unlock downloads as soon as the order is paid, or wait for manual approval. */
  delivery: "instant" | "manual";
  /** Attach one license key per purchase from the product's key pool. */
  license_enabled: boolean;
  /** Max downloads per purchased file (null = unlimited). */
  download_limit: number | null;
  /** Access window in days after unlock (null = never expires). */
  expiry_days: number | null;
  /** Shown to the buyer on the downloads screen. */
  instructions: string | null;
};

export const DEFAULT_DIGITAL: DigitalConfig = {
  delivery: "instant",
  license_enabled: false,
  download_limit: null,
  expiry_days: null,
  instructions: null,
};

export function normalizeDigital(raw: any): DigitalConfig {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    delivery: d.delivery === "manual" ? "manual" : "instant",
    license_enabled: !!d.license_enabled,
    download_limit:
      d.download_limit === null || d.download_limit === undefined || d.download_limit === ""
        ? null
        : Math.max(1, Number(d.download_limit) || 1),
    expiry_days:
      d.expiry_days === null || d.expiry_days === undefined || d.expiry_days === ""
        ? null
        : Math.max(1, Number(d.expiry_days) || 1),
    instructions: d.instructions ? String(d.instructions).slice(0, 2000) : null,
  };
}

export function storeMode(raw: any): StoreMode {
  return raw === "digital" || raw === "hybrid" ? raw : "physical";
}

export function isDigitalProduct(p: { product_type?: string | null } | null | undefined): boolean {
  return (p?.product_type ?? "physical") === "digital";
}

export function allowsPhysical(mode: StoreMode) {
  return mode !== "digital";
}
export function allowsDigital(mode: StoreMode) {
  return mode !== "physical";
}

export const DIGITAL_ACCEPT =
  ".pdf,.zip,.rar,.7z,.epub,.mp3,.wav,.mp4,.mov,.psd,.ai,.svg,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.json,.txt";

export function prettySize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
