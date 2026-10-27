// Single source of truth for plan feature flags.
export const FEATURE_KEYS = [
  "ai_agent",
  "ai_messenger",
  "ai_product_builder",
  "ai_call_center",
  "call_center",
  "landing_pages",
  "landing_page_create",
  "landing_page_connect",
  "facebook_page",
  "whatsapp",
  "messenger_inbox",
  "themes",
  "custom_pages",
  "seo",
  "duplicate_protection",
  "delivery_zones",
  "payment_gateways",
  "customer_accounts",
  "product_reviews",
  "quick_order",
  "notifications",
  "digital_products",
  "service_products",
  "subscription_products",
  "wallet",
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
  "custom_domain",
  "fraud_checker",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  ai_agent: "AI Sales Agent",
  ai_messenger: "AI Messenger",
  ai_product_builder: "AI Product Builder",
  ai_call_center: "AI Call Center",
  call_center: "AI Call Center",
  landing_pages: "Landing Pages",
  landing_page_create: "Landing Page Builder",
  landing_page_connect: "Website Integration",
  facebook_page: "Facebook Page",
  whatsapp: "WhatsApp Business",
  messenger_inbox: "Messenger Inbox",
  themes: "Store Themes",
  custom_pages: "Custom Pages",
  seo: "Store SEO",
  duplicate_protection: "Duplicate Order Protection",
  delivery_zones: "Delivery Zones",
  payment_gateways: "Payment Gateways",
  customer_accounts: "Customer Accounts",
  product_reviews: "Product Reviews",
  quick_order: "Quick / Manual Orders",
  notifications: "Notifications",
  digital_products: "Digital Products",
  service_products: "Service Products",
  subscription_products: "Subscription Products",
  wallet: "Wallet & Auto-renewal",
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
  custom_domain: "Custom Domain",
  fraud_checker: "Fraud Checker",
};


export type PackageRow = {
  is_trial?: boolean | null;
  features?: Record<string, boolean> | null;
} | null | undefined;

export type StoreWithPackage = {
  subscription_status?: string | null;
  subscription_packages?: PackageRow;
  /** Free plan the store falls back to while its paid plan is not active. */
  free_package?: PackageRow;
} | null | undefined;

/** Statuses where no plan is active — the store is locked until one is activated. */
export const INACTIVE_STATUSES = ["expired", "suspended", "cancelled", "past_due"] as const;

export function isSubscriptionInactive(store: StoreWithPackage): boolean {
  const s = store?.subscription_status ?? "active";
  return (INACTIVE_STATUSES as readonly string[]).includes(s);
}

/**
 * The plan whose limits/features actually apply right now.
 * When the trial or paid plan has ended there is NO fallback plan: the store
 * is locked until the merchant activates the Free plan or pays for one.
 */
export function effectivePackage(store: StoreWithPackage): PackageRow {
  if (!store) return null;
  if (isSubscriptionInactive(store)) return null;
  return store.subscription_packages ?? null;
}

/** Older plans only stored the parent flag. */
const LEGACY_FALLBACK: Partial<Record<FeatureKey, string>> = {
  landing_page_create: "landing_pages",
  landing_page_connect: "landing_pages",
  messenger_inbox: "ai_messenger",
  whatsapp: "ai_messenger",
};

/** Core store features open on every active plan — never shown as plan perks. */
export const ALWAYS_INCLUDED: FeatureKey[] = [
  "themes", "custom_pages", "seo", "delivery_zones", "payment_gateways",
  "customer_accounts", "notifications", "digital_products", "service_products",
  "subscription_products", "wallet", "invoice", "customer_notes",
];

/** Plan-differentiating features, grouped for the billing comparison. */
export const PLAN_FEATURE_GROUPS: { title: string; keys: FeatureKey[] }[] = [
  { title: "AI & Automation", keys: ["ai_agent", "ai_messenger", "ai_product_builder", "call_center"] },
  { title: "Messaging Channels", keys: ["facebook_page", "messenger_inbox", "whatsapp"] },
  { title: "Courier & Orders", keys: ["courier", "quick_order", "duplicate_protection", "fraud_checker", "returns"] },
  { title: "Marketing & Growth", keys: ["pixel", "coupons", "landing_page_create", "landing_page_connect", "product_reviews", "custom_domain"] },
  { title: "Store Management", keys: ["inventory", "analytics", "import_export", "bulk_actions", "staff"] },
];

/** The 16 package features shown on plan cards and toggled in Winner Admin. Each maps to the underlying flags. */
export const PLAN_DISPLAY_FEATURES: { key: string; label: string; flags: string[] }[] = [
  { key: "ai_agent", label: "AI Sales Agent", flags: ["ai_agent"] },
  { key: "messaging", label: "AI Messaging (Messenger, WhatsApp & more)", flags: ["ai_messenger", "whatsapp", "messenger_inbox"] },
  { key: "facebook", label: "Facebook Page (Comment Reply & Posts)", flags: ["facebook_page"] },
  { key: "call", label: "AI Call Center", flags: ["call_center", "ai_call_center"] },
  { key: "builder", label: "AI Product Builder", flags: ["ai_product_builder"] },
  { key: "lp_create", label: "Landing Page Create", flags: ["landing_page_create"] },
  { key: "lp_connect", label: "Website Integration", flags: ["landing_page_connect"] },
  { key: "courier", label: "Courier Integration", flags: ["courier"] },
  { key: "fraud", label: "Fraud Checker & Duplicate Protection", flags: ["fraud_checker", "duplicate_protection"] },
  { key: "pixel", label: "Facebook Pixel & Tracking", flags: ["pixel"] },
  { key: "domain", label: "Custom Domain", flags: ["custom_domain"] },
  { key: "coupons", label: "Coupons & Discounts", flags: ["coupons"] },
  { key: "inventory", label: "Inventory, Bulk & Import/Export", flags: ["inventory", "bulk_actions", "import_export", "quick_order"] },
  { key: "analytics", label: "Analytics", flags: ["analytics"] },
  { key: "returns", label: "Returns & Exchanges", flags: ["returns"] },
  { key: "reviews", label: "Product Reviews", flags: ["product_reviews"] },
  { key: "staff", label: "Staff Management", flags: ["staff"] },
];

/** Winner Admin can hide a display feature from a plan card entirely (no ✓, no ✗). Stored as `hide_<key>` in the package features map. */
export function isDisplayHidden(f: Record<string, boolean | undefined> | null | undefined, key: string): boolean {
  return !!f?.[`hide_${key}`];
}

/** Whether a display feature is on for a package's stored feature map. */
export function displayFeatureOn(f: Record<string, boolean | undefined>, flags: string[]): boolean {
  if (flags.some((k) => !!f[k])) return true;
  if (flags[0] === "landing_page_create" || flags[0] === "landing_page_connect") {
    return f[flags[0]] === undefined && !!f.landing_pages;
  }
  return false;
}

/** Order used to pick the few headline perks shown on each plan card. */
export const HIGHLIGHT_PRIORITY: FeatureKey[] = [
  "ai_agent", "ai_messenger", "call_center", "courier", "pixel", "custom_domain",
  "landing_page_create", "whatsapp", "fraud_checker", "duplicate_protection",
  "coupons", "analytics", "inventory", "staff", "landing_page_connect",
  "messenger_inbox", "facebook_page", "ai_product_builder", "returns",
  "import_export", "bulk_actions", "quick_order", "product_reviews",
];

export function hasFeature(store: StoreWithPackage, key: FeatureKey): boolean {
  const pkg = effectivePackage(store);
  if (!pkg) return false;
  // Trial unlocks everything
  if (pkg.is_trial) return true;
  if (ALWAYS_INCLUDED.includes(key)) return true;
  if (key === "ai_call_center") return !!(pkg.features?.call_center ?? pkg.features?.ai_call_center);
  const f = pkg.features ?? {};
  if (f[key] !== undefined) return !!f[key];
  // Backwards compatibility: plans saved before a flag existed.
  const fallback = LEGACY_FALLBACK[key];
  return fallback ? !!f[fallback] : false;
}

/** Kept for the expired/suspended warning banner — the plan itself is downgraded. */
export function isReadOnly(store: StoreWithPackage): boolean {
  return isSubscriptionInactive(store);
}


export const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly", days: 30 },
  { value: "2m", label: "Every 2 Months", days: 60 },
  { value: "3m", label: "Every 3 Months", days: 90 },
  { value: "6m", label: "Every 6 Months", days: 180 },
  { value: "yearly", label: "Yearly", days: 365 },
  { value: "custom", label: "Custom", days: 30 },
] as const;

// Rows used by both plan cards and the comparison table.
export type PlanRow =
  | { kind: "limit"; key: "product_limit" | "order_limit" | "storage_mb" | "staff_limit" | "landing_page_limit"; label: string; unit?: string }
  | { kind: "feature"; key: FeatureKey; label: string }
  | { kind: "trial"; label: string }
  | { kind: "support"; label: string };

export const PLAN_ROWS: PlanRow[] = [
  { kind: "trial", label: "Trial Availability" },
  { kind: "limit", key: "product_limit", label: "Product Limit" },
  { kind: "limit", key: "order_limit", label: "Order Limit" },
  { kind: "limit", key: "storage_mb", label: "Storage Limit", unit: "MB" },
  { kind: "limit", key: "staff_limit", label: "Staff Limit" },
  { kind: "limit", key: "landing_page_limit", label: "Landing Page Limit" },
  { kind: "feature", key: "ai_agent", label: "AI Sales Agent" },
  { kind: "feature", key: "ai_messenger", label: "Messenger AI" },
  { kind: "feature", key: "courier", label: "Courier Integration" },
  { kind: "feature", key: "pixel", label: "Facebook Pixel" },
  { kind: "feature", key: "analytics", label: "Analytics" },
  { kind: "feature", key: "inventory", label: "Inventory" },
  { kind: "feature", key: "invoice", label: "Invoice" },
  { kind: "feature", key: "coupons", label: "Coupon System" },
  { kind: "feature", key: "landing_page_create", label: "Landing Page Builder" },
  { kind: "feature", key: "landing_page_connect", label: "Website Integration" },
  { kind: "feature", key: "facebook_page", label: "Facebook Page" },
  { kind: "feature", key: "whatsapp", label: "WhatsApp Business" },
  { kind: "support", label: "Support Type" },
];

export function supportTypeFor(plan: { name?: string | null; is_trial?: boolean | null; features?: any }): string {
  const explicit = plan?.features?.support;
  if (typeof explicit === "string" && explicit.trim()) return explicit;
  if (plan?.is_trial) return "Community";
  const n = (plan?.name ?? "").toLowerCase();
  if (n.includes("custom") || n.includes("enterprise")) return "Dedicated";
  if (n.includes("business") || n.includes("pro")) return "Priority";
  if (n.includes("basic") || n.includes("starter")) return "Email";
  return "Email";
}

export function formatLimit(value: number | null | undefined, unit?: string): string {
  if (!value || value <= 0) return "Unlimited";
  if (unit === "MB") {
    if (value >= 1024) return `${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)} GB`;
    return `${value} MB`;
  }
  return value.toLocaleString();
}

