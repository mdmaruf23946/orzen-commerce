// Single source of truth for plan feature flags.
export const FEATURE_KEYS = [
  "ai_agent",
  "ai_messenger",
  "pixel",
  "courier",
  "inventory",
  "coupons",
  "invoice",
  "analytics",
  "import_export",
  "bulk_actions",
  "staff",
  "customer_notes",
  "returns",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  ai_agent: "AI Sales Agent",
  ai_messenger: "AI Messenger",
  pixel: "Facebook Pixel & Tracking",
  courier: "Courier Integration",
  inventory: "Inventory Management",
  coupons: "Coupons & Discounts",
  invoice: "Invoices",
  analytics: "Analytics",
  import_export: "Import / Export",
  bulk_actions: "Bulk Actions",
  staff: "Staff Management",
  customer_notes: "Customer Notes",
  returns: "Returns & Exchanges",
};

export type PackageRow = {
  is_trial?: boolean | null;
  features?: Record<string, boolean> | null;
} | null | undefined;

export type StoreWithPackage = {
  subscription_status?: string | null;
  subscription_packages?: PackageRow;
} | null | undefined;

export function hasFeature(store: StoreWithPackage, key: FeatureKey): boolean {
  const pkg = store?.subscription_packages;
  if (!pkg) return false;
  // Trial unlocks everything
  if (pkg.is_trial) return true;
  return !!pkg.features?.[key];
}

export function isReadOnly(store: StoreWithPackage): boolean {
  const s = store?.subscription_status ?? "active";
  return s === "expired" || s === "suspended" || s === "cancelled";
}

export const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "2m", label: "Every 2 Months", days: 60 },
  { value: "3m", label: "Every 3 Months", days: 90 },
  { value: "6m", label: "Every 6 Months", days: 180 },
  { value: "yearly", label: "Yearly", days: 365 },
  { value: "custom", label: "Custom", days: 30 },
] as const;
