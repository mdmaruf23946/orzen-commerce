// Shared Messenger webhook types and origin helper. Extracted verbatim.
export function publicOrigin() {
  return (process.env["PUBLIC_SITE_ORIGIN"] || "https://orzen.top").replace(/\/$/, "");
}
export type ProductRow = {
  id: string;
  name: string;
  slug: string | null;
  brand?: string | null;
  sku?: string | null;
  product_code?: string | null;
  category_id?: string | null;
  short_description?: string | null;
  description?: string | null;
  price: number | string;
  old_price?: number | string | null;
  stock: number;
  primary_image_url?: string | null;
  gallery?: string[] | null;
  features?: unknown;
  specifications?: unknown;
  variants?: unknown;
  total_sold?: number | null;
  rating?: number | null;
  is_featured?: boolean | null;
};

export type ImageAnalysis = {
  description: string;
  keywords: string[];
  is_product: boolean;
  product_type: string;
  product_subtype: string | null;
  category: string;
  primary_color: string | null;
  secondary_colors: string[];
  material: string | null;
  style: string | null;
  shape: string | null;
  pattern: string | null;
  visible_text: string[];
  brand: string | null;
  model_number: string | null;
  functions: string[];
  connectors: string[];
  controls: string[];
  package_specs: string[];
  distinctive_features: string[];
  field_confidence: Record<string, number>;
  visibility_warnings: string[];
  object_boundary_confidence: number;
  text_legibility: number;
  recognition_status: "clear" | "uncertain";
  inspection_passes: 1 | 2;
  confidence: number;
  image_data_url: string;
};

export type VisualMatch = {
  product: ProductRow;
  confidence: number;
  reason: string;
  verdict: "exact" | "close";
  evidence: string[];
};

export class ImageProcessingError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(`IMAGE_${retryable ? "RETRYABLE" : "TERMINAL"}_${code}: ${message}`.slice(0, 450));
    this.name = "ImageProcessingError";
    this.code = code;
    this.retryable = retryable;
  }
}
