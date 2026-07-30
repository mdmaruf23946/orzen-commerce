// Shared types for the Invoice Template Builder.
// A template = { page, elements[] } + brand tokens.

export type ElementType =
  | "text"
  | "logo"
  | "image"
  | "table"
  | "totals"
  | "qr"
  | "barcode"
  | "divider"
  | "shape"
  | "icon";

export type Brand = {
  primary: string;
  secondary: string;
  accent: string;
  font: string;
  footerStyle?: string;
  borderStyle?: string;
  radius?: number;
  shadow?: "none" | "sm" | "md";
  margin?: number;
};

export type InvoiceElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  z?: number;
  locked?: boolean;
  hidden?: boolean;
  props: Record<string, any>;
};

export type InvoiceCanvas = {
  page: { width: number; height: number; margin: number };
  elements: InvoiceElement[];
};

export type InvoiceTemplateRow = {
  id: string;
  scope: "global" | "store";
  store_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  canvas: InvoiceCanvas;
  brand: Brand;
  source_template_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const A4 = { width: 794, height: 1123 };

export const DEFAULT_BRAND: Brand = {
  primary: "#111827",
  secondary: "#6b7280",
  accent: "#2563eb",
  font: "Inter, system-ui, sans-serif",
  radius: 8,
  shadow: "none",
  margin: 32,
};

export const EMPTY_CANVAS: InvoiceCanvas = {
  page: { width: A4.width, height: A4.height, margin: 32 },
  elements: [],
};

/** Resolve a colour value that may be a brand token like "@primary". */
export function color(value: string | undefined, brand: Brand, fallback = "#111827") {
  if (!value) return fallback;
  if (value.startsWith("@")) return (brand as any)[value.slice(1)] ?? fallback;
  return value;
}

export function newElement(type: ElementType, at = { x: 60, y: 60 }): InvoiceElement {
  const id = `${type}-${Math.random().toString(36).slice(2, 8)}`;
  const base = { id, type, x: at.x, y: at.y, z: Date.now() % 100000 };
  switch (type) {
    case "text":
      return { ...base, w: 260, h: 40, props: { content: "New text", fontSize: 14, fontWeight: 400, color: "@primary", align: "left", lineHeight: 1.5, letterSpacing: 0 } };
    case "logo":
      return { ...base, w: 120, h: 60, props: { fit: "contain", radius: 6, opacity: 1 } };
    case "image":
      return { ...base, w: 160, h: 120, props: { url: "", fit: "cover", radius: 8, opacity: 1 } };
    case "table":
      return { ...base, w: 700, h: 300, props: { headerColor: "@primary", headerTextColor: "#ffffff", rowColor: "#ffffff", altRowColor: "#f9fafb", border: "#e5e7eb", padding: 10, rowHeight: 36, radius: 8, showImage: true, imageSize: 34, fontSize: 12, columns: ["image", "name", "qty", "price", "total"] } };
    case "totals":
      return { ...base, w: 300, h: 130, props: { fontSize: 13, color: "@primary", accent: "@accent", showDiscount: true, showDelivery: true } };
    case "qr":
      return { ...base, w: 120, h: 140, props: { source: "tracking", size: 110, label: "Scan", border: false } };
    case "barcode":
      return { ...base, w: 220, h: 80, props: { source: "invoice", showText: true } };
    case "divider":
      return { ...base, w: 400, h: 1, props: { color: "@secondary", thickness: 1 } };
    case "shape":
      return { ...base, w: 200, h: 100, props: { fill: "@primary", radius: 8 } };
    case "icon":
      return { ...base, w: 40, h: 40, props: { name: "phone", color: "@primary" } };
    default:
      return { ...base, w: 100, h: 100, props: {} };
  }
}
