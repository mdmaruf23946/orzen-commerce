// Shared column definitions for product import/export.

export type ColumnDef = {
  key: string;
  label: string;
  required?: boolean;
  type: "string" | "number" | "boolean" | "enum" | "array";
  enumValues?: string[];
  description: string;
};

export const IMPORT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", required: true, type: "string", description: "Product name (required)" },
  { key: "price", label: "Price", required: true, type: "number", description: "Selling price (required, ≥ 0)" },
  { key: "old_price", label: "Old Price", type: "number", description: "Original price shown crossed out" },
  { key: "cost_price", label: "Cost Price", type: "number", description: "Your cost for margin analytics" },
  { key: "stock", label: "Stock", type: "number", description: "Current available quantity" },
  { key: "sku", label: "SKU", type: "string", description: "Unique code, used for matching updates" },
  { key: "product_code", label: "Product Code", type: "string", description: "Alt code for matching updates" },
  { key: "status", label: "Status", type: "enum", enumValues: ["active", "draft", "out_of_stock"], description: "active | draft | out_of_stock" },
  { key: "description", label: "Description", type: "string", description: "Full product description (HTML allowed)" },
  { key: "short_description", label: "Short Description", type: "string", description: "One-line summary" },
  { key: "brand", label: "Brand", type: "string", description: "Brand name" },
  { key: "category_slug", label: "Category Slug", type: "string", description: "Existing category slug to link" },
  { key: "primary_image_url", label: "Primary Image URL", type: "string", description: "Main product image URL" },
  { key: "gallery", label: "Gallery URLs", type: "array", description: "Comma or pipe-separated image URLs" },
  { key: "video_url", label: "Video URL", type: "string", description: "YouTube/direct video URL" },
  { key: "is_featured", label: "Featured", type: "boolean", description: "true / false / 1 / 0" },
  { key: "low_stock_threshold", label: "Low Stock Threshold", type: "number", description: "Alert when stock ≤ this" },
  { key: "delivery_charge", label: "Delivery Charge", type: "number", description: "Custom delivery cost" },
  { key: "delivery_time_days", label: "Delivery Time", type: "string", description: 'e.g. "2-3"' },
  { key: "warranty", label: "Warranty", type: "string", description: "Warranty note" },
  { key: "return_policy", label: "Return Policy", type: "string", description: "Return policy text" },
  { key: "shipping_info", label: "Shipping Info", type: "string", description: "Shipping notes" },
];

export const EXPORT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", type: "string", description: "" },
  { key: "sku", label: "SKU", type: "string", description: "" },
  { key: "product_code", label: "Product Code", type: "string", description: "" },
  { key: "brand", label: "Brand", type: "string", description: "" },
  { key: "price", label: "Price", type: "number", description: "" },
  { key: "old_price", label: "Old Price", type: "number", description: "" },
  { key: "cost_price", label: "Cost", type: "number", description: "" },
  { key: "stock", label: "Stock", type: "number", description: "" },
  { key: "status", label: "Status", type: "string", description: "" },
  { key: "is_featured", label: "Featured", type: "boolean", description: "" },
  { key: "short_description", label: "Short Description", type: "string", description: "" },
  { key: "description", label: "Description", type: "string", description: "" },
  { key: "primary_image_url", label: "Primary Image", type: "string", description: "" },
  { key: "gallery", label: "Gallery", type: "array", description: "" },
  { key: "video_url", label: "Video URL", type: "string", description: "" },
  { key: "warranty", label: "Warranty", type: "string", description: "" },
  { key: "return_policy", label: "Return Policy", type: "string", description: "" },
  { key: "shipping_info", label: "Shipping Info", type: "string", description: "" },
  { key: "delivery_charge", label: "Delivery Charge", type: "number", description: "" },
  { key: "delivery_time_days", label: "Delivery Time", type: "string", description: "" },
  { key: "low_stock_threshold", label: "Low Stock Threshold", type: "number", description: "" },
  { key: "created_at", label: "Created At", type: "string", description: "" },
];

export const DEFAULT_EXPORT_COLUMNS = [
  "name", "sku", "brand", "price", "old_price", "cost_price", "stock", "status", "primary_image_url",
];

// Sample rows used in the downloadable template.
export const SAMPLE_ROWS = [
  {
    name: "Premium Wireless Headphones",
    price: 4999,
    old_price: 6999,
    cost_price: 3200,
    stock: 50,
    sku: "WH-001",
    product_code: "PWH-1",
    status: "active",
    description: "Noise cancelling Bluetooth headphones with 30h battery.",
    short_description: "30h battery, ANC, foldable",
    brand: "Sonora",
    category_slug: "audio",
    primary_image_url: "https://example.com/wh1.jpg",
    gallery: "https://example.com/wh1-a.jpg|https://example.com/wh1-b.jpg",
    video_url: "",
    is_featured: "true",
    low_stock_threshold: 5,
    delivery_charge: 60,
    delivery_time_days: "2-3",
    warranty: "1 Year",
    return_policy: "7 days easy return",
    shipping_info: "Ships from Dhaka",
  },
  {
    name: "Cotton Casual T-Shirt",
    price: 799,
    old_price: 999,
    cost_price: 450,
    stock: 120,
    sku: "TS-100",
    product_code: "",
    status: "active",
    description: "100% organic cotton t-shirt, unisex fit.",
    short_description: "Soft, breathable, unisex",
    brand: "UrbanWear",
    category_slug: "clothing",
    primary_image_url: "https://example.com/ts100.jpg",
    gallery: "",
    video_url: "",
    is_featured: "false",
    low_stock_threshold: 10,
    delivery_charge: 60,
    delivery_time_days: "2-3",
    warranty: "",
    return_policy: "3 days return",
    shipping_info: "",
  },
];

export function toBool(v: any): boolean | null {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}

export function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function toArr(v: any): string[] | null {
  if (v == null || v === "") return null;
  return String(v).split(/[|,;]/g).map((s) => s.trim()).filter(Boolean);
}

export type ParsedRow = Record<string, any>;

export function coerceRow(raw: Record<string, any>): { row: any; error?: string } {
  const row: any = {};
  for (const col of IMPORT_COLUMNS) {
    const v = raw[col.key];
    if (v == null || v === "") {
      if (col.required) return { row, error: `Missing required field: ${col.label}` };
      row[col.key] = null;
      continue;
    }
    if (col.type === "number") {
      const n = toNum(v);
      if (n == null) return { row, error: `Invalid number for ${col.label}: "${v}"` };
      if (n < 0) return { row, error: `${col.label} must be ≥ 0` };
      row[col.key] = n;
    } else if (col.type === "boolean") {
      row[col.key] = toBool(v);
    } else if (col.type === "array") {
      row[col.key] = toArr(v);
    } else if (col.type === "enum") {
      const s = String(v).trim().toLowerCase();
      if (!col.enumValues?.includes(s)) {
        return { row, error: `${col.label} must be one of: ${col.enumValues?.join(", ")}` };
      }
      row[col.key] = s;
    } else {
      row[col.key] = String(v);
    }
  }
  return { row };
}
