// Client-safe Store Mode helpers: which admin modules a mode shows,
// and how categories / banners / products map onto a mode.
//
// Rule: a mode NEVER deletes data. It only shows or hides modules.

import type { StoreMode } from "./digital";
export { storeMode, STORE_MODES } from "./digital";
export type { StoreMode } from "./digital";

/** Admin paths that only make sense for a store that ships physical goods. */
export const PHYSICAL_ONLY_PATHS = [
  "/admin/courier-orders",
  "/admin/couriers",
  "/admin/parcels",
  "/admin/delivery",
  "/admin/inventory",
  "/admin/low-stock",
];

/** Admin paths that only make sense for a store selling downloadable goods. */
export const DIGITAL_ONLY_PATHS = ["/admin/digital-orders", "/admin/digital-dashboard"];

export function isPathVisibleInMode(path: string, mode: StoreMode): boolean {
  if (mode === "hybrid") return true;
  if (mode === "digital") return !PHYSICAL_ONLY_PATHS.includes(path);
  return !DIGITAL_ONLY_PATHS.includes(path);
}

/** Product types a mode can create / manage. */
export function allowedProductTypes(mode: StoreMode): ("physical" | "digital")[] {
  if (mode === "digital") return ["digital"];
  if (mode === "physical") return ["physical"];
  return ["physical", "digital"];
}

export const CATEGORY_TYPES = [
  { value: "both", label: "Both (physical & digital)" },
  { value: "physical", label: "Physical only" },
  { value: "digital", label: "Digital only" },
] as const;

export const BANNER_CAMPAIGN_TYPES = [
  { value: "general", label: "General campaign" },
  { value: "physical", label: "Physical campaign" },
  { value: "digital", label: "Digital campaign" },
] as const;

export function categoryMatchesMode(type: string | null | undefined, mode: StoreMode): boolean {
  const t = type ?? "both";
  if (mode === "hybrid" || t === "both") return true;
  return t === mode;
}

export function bannerMatchesMode(type: string | null | undefined, mode: StoreMode): boolean {
  const t = type ?? "general";
  if (mode === "hybrid" || t === "general") return true;
  return t === mode;
}

/** What the confirmation dialog shows before a switch. */
export const MODE_EFFECTS: Record<
  StoreMode,
  { enables: string[]; hides: string[] }
> = {
  physical: {
    enables: [
      "Physical product management",
      "Physical categories & banners",
      "Courier integration & parcels",
      "Shipping settings, weight, dimensions, COD",
      "Inventory & low stock alerts",
    ],
    hides: ["Digital orders, file & license modules"],
  },
  digital: {
    enables: [
      "Digital product management & file uploads",
      "Digital categories & banners",
      "Download settings, license keys, versions",
      "Digital orders & download analytics",
    ],
    hides: [
      "Courier & parcels",
      "Delivery zones & delivery charge",
      "Weight & dimensions",
      "Inventory & low stock alerts",
    ],
  },
  hybrid: {
    enables: [
      "Both physical and digital product management",
      "Categories with a product type (physical / digital / both)",
      "Banners with campaign type (physical / digital / general)",
      "Courier, shipping, downloads and licenses together",
    ],
    hides: [],
  },
};

/** Data that is always preserved across a switch — shown in the dialog. */
export const MODE_PRESERVED = [
  "Products, categories & banners",
  "Customers & orders",
  "Analytics, reports & reviews",
  "Coupons & store information",
  "Payment gateway, AI, email & notification settings",
  "Subscription, billing & invoice history",
];

export const MODE_TRANSITION_STEPS = [
  "Updating Store Configuration…",
  "Preparing Store Modules…",
  "Refreshing Dashboard…",
  "Almost Done…",
];
