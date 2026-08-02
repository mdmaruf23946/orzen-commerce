// Shared, browser-safe helpers for digital products.
// Digital configuration lives in products.meta.digital (see ProductDialog).

export type DigitalFileMeta = { path: string; name: string; size: number; type: string };

export type DigitalFaq = { q: string; a: string };

export type DigitalRequirements = {
  os?: string;
  software?: string;
  browser?: string;
  ram?: string;
  storage?: string;
  dependencies?: string;
};

export type DigitalPreview = {
  type?: PreviewType;
  images?: string[];
  video_url?: string | null;
  demo_url?: string | null;
  pdf_url?: string | null;
  audio_url?: string | null;
};

export type PreviewType = "none" | "images" | "video" | "pdf" | "audio" | "demo";

export type DigitalDownloadRules = {
  mode?: "instant" | "manual";
  max_downloads?: number | null;
  expiry_days?: number | null;
  link_minutes?: number | null;
  max_devices?: number | null;
  max_ips?: number | null;
  max_activations?: number | null;
  allow_redownload?: boolean;
  require_login?: boolean;
  auto_email?: boolean;
  auto_invoice?: boolean;
};

export type DigitalMeta = {
  files?: DigitalFileMeta[];
  external_url?: string | null;
  version?: string | null;
  changelog?: string | null;
  platforms?: string[];
  tags?: string[];
  preview?: DigitalPreview;
  download?: DigitalDownloadRules;
  free?: boolean;
  sale_window?: { start?: string | null; end?: string | null };
  license_type?: LicenseType;
  license_note?: string | null;
  included?: string[];
  requirements?: DigitalRequirements;
  faq?: DigitalFaq[];
};

export type LicenseType = "personal" | "commercial" | "extended" | "custom";

export const LICENSE_LABELS: Record<LicenseType, string> = {
  personal: "Personal License",
  commercial: "Commercial License",
  extended: "Extended License",
  custom: "Custom License",
};

export const LICENSE_DESCRIPTIONS: Record<LicenseType, string> = {
  personal: "Use in your own personal, non-commercial projects. Redistribution is not allowed.",
  commercial: "Use in commercial projects for you or a client. Redistribution is not allowed.",
  extended: "Use in commercial projects and in end products that are sold to multiple customers.",
  custom: "Custom terms defined by the seller.",
};

/** Catalogue of things a seller can mark as included in the package. */
export const INCLUDED_ITEMS = [
  { id: "zip", label: "ZIP File" },
  { id: "pdf", label: "PDF" },
  { id: "source", label: "Source Code" },
  { id: "psd", label: "PSD" },
  { id: "figma", label: "Figma" },
  { id: "canva", label: "Canva" },
  { id: "video", label: "Video Lessons" },
  { id: "audio", label: "Audio Files" },
  { id: "templates", label: "Templates" },
  { id: "fonts", label: "Fonts" },
  { id: "license", label: "License File" },
  { id: "docs", label: "Documentation" },
  { id: "bonus", label: "Bonus Files" },
] as const;

export type IncludedItemId = (typeof INCLUDED_ITEMS)[number]["id"];

export function isDigitalType(t?: string | null) {
  return t === "digital";
}

export function readDigitalMeta(meta: unknown): DigitalMeta {
  if (!meta || typeof meta !== "object") return {};
  const d = (meta as Record<string, unknown>).digital;
  return d && typeof d === "object" ? (d as DigitalMeta) : {};
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return null;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** youtube / vimeo embed URL, or null when the link is not embeddable. */
export function toEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* invalid url */
  }
  return null;
}
