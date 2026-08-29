// Single source of truth for Merchant Panel sections used by employee RBAC.
// Derived from the admin sidebar; adding a sidebar entry here makes it
// automatically appear in the employee permission editor and in the guards.
import type { FeatureKey } from "@/lib/features";

export type PermissionLevel = "none" | "view" | "manage";

export type PanelSection = {
  key: string;
  label: string;
  group: string;
  /** Route prefixes that belong to this section. */
  paths: string[];
  /** Owner-only sections can never be granted to an employee. */
  ownerOnly?: boolean;
  feature?: FeatureKey;
};

export const PANEL_SECTIONS: PanelSection[] = [
  { key: "dashboard", label: "Dashboard", group: "Main", paths: ["/admin"] },
  { key: "inbox", label: "Notifications Inbox", group: "Main", paths: ["/admin/inbox"] },

  { key: "orders", label: "Orders", group: "Orders", paths: ["/admin/orders"] },
  { key: "courier_orders", label: "Courier Orders", group: "Orders", paths: ["/admin/courier-orders"] },
  { key: "returns", label: "Returns & Exchanges", group: "Orders", paths: ["/admin/returns"], feature: "returns" },

  { key: "products", label: "Products", group: "Products", paths: ["/admin/products"] },
  { key: "categories", label: "Categories", group: "Products", paths: ["/admin/categories"] },
  { key: "inventory", label: "Inventory", group: "Products", paths: ["/admin/inventory"], feature: "inventory" },
  { key: "product_defaults", label: "Product Defaults", group: "Products", paths: ["/admin/product-defaults"] },
  { key: "low_stock", label: "Low Stock Alerts", group: "Products", paths: ["/admin/low-stock"] },

  { key: "customers", label: "Customers", group: "Customers", paths: ["/admin/customers"] },
  { key: "customer_accounts", label: "Customer Accounts", group: "Customers", paths: ["/admin/customers-accounts"] },
  { key: "duplicate_protection", label: "Duplicate Protection", group: "Customers", paths: ["/admin/duplicate-protection"] },

  { key: "call_center", label: "Manual Call Center", group: "Call Center", paths: ["/admin/call-center"], feature: "call_center" },
  { key: "ai_call_center", label: "AI Call Center", group: "Call Center", paths: ["/admin/ai-call-center"], feature: "ai_call_center" },

  { key: "ai_agent", label: "AI Sales Agent", group: "AI & Automation", paths: ["/admin/ai-agent"], feature: "ai_agent" },
  { key: "ai_recommendations", label: "AI Recommendations", group: "AI & Automation", paths: ["/admin/ai-recommendations"] },
  { key: "handoff_queue", label: "Handoff Queue", group: "AI & Automation", paths: ["/admin/handoff-queue"] },
  { key: "messenger", label: "Messenger", group: "AI & Automation", paths: ["/admin/messenger"], feature: "ai_messenger" },
  { key: "messenger_inbox", label: "Messenger Inbox", group: "AI & Automation", paths: ["/admin/messenger-inbox"], feature: "ai_messenger" },
  { key: "whatsapp", label: "WhatsApp Integration", group: "AI & Automation", paths: ["/admin/whatsapp"] },
  { key: "whatsapp_inbox", label: "WhatsApp Inbox", group: "AI & Automation", paths: ["/admin/whatsapp-inbox"] },
  { key: "facebook", label: "Facebook Page", group: "Facebook Page", paths: ["/admin/facebook"], feature: "facebook_page" },

  { key: "marketing", label: "Marketing", group: "Marketing", paths: ["/admin/marketing"], feature: "pixel" },
  { key: "coupons", label: "Coupons", group: "Marketing", paths: ["/admin/coupons"], feature: "coupons" },
  { key: "seo", label: "SEO", group: "Marketing", paths: ["/admin/seo"] },
  { key: "banners", label: "Banners", group: "Marketing", paths: ["/admin/banners"] },
  { key: "theme", label: "Store Theme", group: "Marketing", paths: ["/admin/theme"] },
  { key: "notifications", label: "Notifications", group: "Marketing", paths: ["/admin/notifications"] },

  { key: "payment_gateway", label: "Payment Gateway", group: "Finance", paths: ["/admin/payment-gateway"], ownerOnly: true },
  { key: "finance", label: "Business Finance", group: "Finance", paths: ["/admin/finance"] },
  { key: "analytics", label: "Analytics", group: "Finance", paths: ["/admin/analytics"], feature: "analytics" },

  { key: "delivery", label: "Delivery Zones", group: "Operations", paths: ["/admin/delivery"] },
  { key: "couriers", label: "Couriers", group: "Operations", paths: ["/admin/couriers"], feature: "courier" },
  { key: "parcels", label: "Courier Parcels", group: "Operations", paths: ["/admin/parcels"], feature: "courier" },
  { key: "landing_builder", label: "Landing Pages", group: "Operations", paths: ["/admin/landing-builder"], feature: "landing_pages" },
  { key: "landing_pages", label: "Landing Page Integrations", group: "Operations", paths: ["/admin/landing-pages"], feature: "landing_pages" },

  
  { key: "pages", label: "Pages & Content", group: "System", paths: ["/admin/pages", "/admin/legal"] },
  { key: "invoice_templates", label: "Invoice Templates", group: "System", paths: ["/admin/invoice-templates"], feature: "invoice" },
  { key: "import_export", label: "Import / Export", group: "System", paths: ["/admin/import-export"], feature: "import_export" },
  { key: "activity", label: "Activity Log", group: "System", paths: ["/admin/activity"] },
  { key: "domains", label: "Domains", group: "System", paths: ["/admin/domains", "/admin/dns-check"], ownerOnly: true },
  { key: "employees", label: "Employees & Team", group: "System", paths: ["/admin/employees", "/admin/staff"], ownerOnly: true, feature: "staff" },

  { key: "support", label: "Support", group: "Account", paths: ["/admin/support"] },
  { key: "subscription", label: "My Subscription", group: "Account", paths: ["/admin/subscription"], ownerOnly: true },
  { key: "billing", label: "Billing & Plans", group: "Account", paths: ["/admin/billing"], ownerOnly: true },
  { key: "settings", label: "Store Settings", group: "Account", paths: ["/admin/settings"], ownerOnly: true },
];

export const GRANTABLE_SECTIONS = PANEL_SECTIONS.filter((s) => !s.ownerOnly);

export const SECTION_BY_KEY: Record<string, PanelSection> = Object.fromEntries(
  PANEL_SECTIONS.map((s) => [s.key, s]),
);

/** Resolve which section a Merchant Panel path belongs to (longest match wins). */
export function sectionForPath(path: string): PanelSection | null {
  let best: PanelSection | null = null;
  let bestLen = -1;
  for (const s of PANEL_SECTIONS) {
    for (const p of s.paths) {
      const match = path === p || path.startsWith(p + "/");
      if (match && p.length > bestLen) {
        best = s;
        bestLen = p.length;
      }
    }
  }
  return best;
}

export type PermissionMap = Record<string, PermissionLevel>;

export function levelOf(permissions: PermissionMap | null | undefined, key: string): PermissionLevel {
  if (!permissions) return "none";
  const v = permissions[key];
  return v === "view" || v === "manage" ? v : "none";
}

export function allows(
  permissions: PermissionMap | null | undefined,
  key: string,
  needed: "view" | "manage",
): boolean {
  const lvl = levelOf(permissions, key);
  if (lvl === "manage") return true;
  return needed === "view" && lvl === "view";
}

/** Built-in role presets. "custom" starts blank. */
export const EMPLOYEE_ROLES = [
  { value: "manager", label: "Manager", description: "Runs the store day to day (no billing, settings or team)" },
  { value: "order_agent", label: "Order Agent", description: "Orders, courier and returns" },
  { value: "support_agent", label: "Support Agent", description: "Inbox, chat channels and support" },
  { value: "inventory_staff", label: "Inventory Staff", description: "Products, categories and stock" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
  { value: "custom", label: "Custom", description: "Pick permissions manually" },
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number]["value"];

const ORDER_KEYS = ["dashboard", "orders", "courier_orders", "returns", "parcels", "couriers", "delivery"];
const SUPPORT_KEYS = ["dashboard", "inbox", "messenger", "messenger_inbox", "whatsapp", "whatsapp_inbox", "handoff_queue", "support", "facebook"];
const INVENTORY_KEYS = ["dashboard", "products", "categories", "inventory", "low_stock", "product_defaults", "import_export"];

export function presetPermissions(role: EmployeeRole): PermissionMap {
  const map: PermissionMap = {};
  const set = (keys: string[], level: PermissionLevel) => {
    for (const k of keys) if (SECTION_BY_KEY[k] && !SECTION_BY_KEY[k].ownerOnly) map[k] = level;
  };
  const all = GRANTABLE_SECTIONS.map((s) => s.key);

  switch (role) {
    case "manager":
      set(all, "manage");
      break;
    case "order_agent":
      set(ORDER_KEYS, "manage");
      set(["customers", "customer_accounts", "products"], "view");
      break;
    case "support_agent":
      set(SUPPORT_KEYS, "manage");
      set(["orders", "customers", "products"], "view");
      break;
    case "inventory_staff":
      set(INVENTORY_KEYS, "manage");
      set(["orders"], "view");
      break;
    case "viewer":
      set(all, "view");
      break;
    default:
      break;
  }
  return map;
}
