// ORZEN Design Studio registry: design kinds, canvas presets and the
// roadmap list. Purely presentational metadata — no API or DB impact.
import {
  Award,
  Badge as BadgeIcon,
  Box,
  Boxes,
  FileText,
  Globe,
  IdCard,
  Image as ImageIcon,
  Instagram,
  LayoutTemplate,
  Palette,
  Presentation,
  Sparkles,
  Video,
} from "lucide-react";
import type { InvoiceCanvas } from "@/lib/invoice-template/types";

export type DesignKind = "invoice" | "logo" | "poster" | "banner";

export type CanvasPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export type KindDef = {
  id: DesignKind;
  label: string;
  short: string;
  description: string;
  icon: any;
  accent: string;
  presets: CanvasPreset[];
};

export const KINDS: KindDef[] = [
  {
    id: "invoice",
    label: "Invoice Builder",
    short: "Invoice",
    description: "Print-ready invoices with live order variables.",
    icon: FileText,
    accent: "from-primary/20 to-primary/5",
    presets: [
      { id: "a4-portrait", label: "A4 Portrait", width: 794, height: 1123 },
      { id: "a4-landscape", label: "A4 Landscape", width: 1123, height: 794 },
      { id: "a5-portrait", label: "A5 Portrait", width: 559, height: 794 },
      { id: "receipt", label: "Receipt 80mm", width: 302, height: 900 },
    ],
  },
  {
    id: "logo",
    label: "Logo Maker",
    short: "Logo",
    description: "Square brand marks and wordmarks.",
    icon: Sparkles,
    accent: "from-chart-3/25 to-chart-3/5",
    presets: [
      { id: "logo-1000", label: "Logo 1000 × 1000", width: 1000, height: 1000 },
      { id: "logo-512", label: "Icon 512 × 512", width: 512, height: 512 },
      { id: "wordmark", label: "Wordmark 1200 × 400", width: 1200, height: 400 },
    ],
  },
  {
    id: "poster",
    label: "Poster Designer",
    short: "Poster",
    description: "Promo posters and print flyers.",
    icon: LayoutTemplate,
    accent: "from-chart-4/25 to-chart-4/5",
    presets: [
      { id: "a4-portrait", label: "A4 Portrait", width: 794, height: 1123 },
      { id: "a3-portrait", label: "A3 Portrait", width: 1123, height: 1587 },
      { id: "a4-landscape", label: "A4 Landscape", width: 1123, height: 794 },
    ],
  },
  {
    id: "banner",
    label: "Banner Designer",
    short: "Banner",
    description: "Storefront and campaign banners.",
    icon: ImageIcon,
    accent: "from-chart-2/25 to-chart-2/5",
    presets: [
      { id: "web-1200", label: "Web 1200 × 628", width: 1200, height: 628 },
      { id: "hero-1920", label: "Hero 1920 × 640", width: 1920, height: 640 },
      { id: "square-1080", label: "Square 1080 × 1080", width: 1080, height: 1080 },
      { id: "story-1080", label: "Story 1080 × 1920", width: 1080, height: 1920 },
    ],
  },
];

export const KIND_MAP: Record<DesignKind, KindDef> = KINDS.reduce(
  (acc, k) => ({ ...acc, [k.id]: k }),
  {} as Record<DesignKind, KindDef>,
);

export type ComingSoonItem = { id: string; label: string; icon: any };

export const COMING_SOON: ComingSoonItem[] = [
  { id: "landing", label: "Landing Page Builder", icon: LayoutTemplate },
  { id: "social", label: "Social Media Designer", icon: Instagram },
  { id: "business-card", label: "Business Card", icon: IdCard },
  { id: "certificate", label: "Certificate", icon: Award },
  { id: "packaging", label: "Packaging Design", icon: Box },
  { id: "thumbnail", label: "Thumbnail Builder", icon: ImageIcon },
  { id: "presentation", label: "Presentation Builder", icon: Presentation },
  { id: "resume", label: "Resume Builder", icon: BadgeIcon },
  { id: "video", label: "Video Editor", icon: Video },
  { id: "website", label: "Website Builder", icon: Globe },
  { id: "ai-designer", label: "AI Designer", icon: Sparkles },
];

export const FUTURE_ELEMENT_GROUPS: { label: string; items: string[]; icon: any }[] = [
  { label: "Charts", items: ["Bar chart", "Line chart", "Pie chart"], icon: Boxes },
  { label: "Effects", items: ["Blur", "Glow", "Pattern"], icon: Palette },
];

/** Read the design kind stored on a canvas (defaults to invoice for legacy rows). */
export function canvasKind(canvas: InvoiceCanvas | null | undefined): DesignKind {
  const k = (canvas?.page as any)?.kind;
  return k === "logo" || k === "poster" || k === "banner" ? k : "invoice";
}

export function canvasPresetId(canvas: InvoiceCanvas | null | undefined): string | undefined {
  return (canvas?.page as any)?.preset;
}

export const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
