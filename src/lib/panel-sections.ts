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
  { key: "dashboard", label: "Dashboard", group: "Core", paths: ["/admin"] },
  { key: "inbox", label: "Notifications Inbox", group: "Core", paths: ["/admin/inbox"] },

  { key: "orders", label: "All Orders", group: "Orders & Delivery", paths: ["/admin/orders"] },
  { key: "courier_orders", label: "Courier Orders", group: "Orders & Delivery", paths: ["/admin/courier-orders"] },
  { key: "returns", label: "Returns & Exchanges", group: "Orders & Delivery", paths: ["/admin/returns"], feature: "returns" },

  { key: "products", label: "Products", group: "Products & Inventory", paths: ["/admin/products"] },
  { key: "categories", label: "Categories", group: "Products & Inventory", paths: ["/admin/categories"] },
  { key: "inventory", label: "Inventory", group: "Products & Inventory", paths: ["/admin/inventory"], feature: "inventory" },
  { key: "product_defaults", label: "Product Defaults", group: "Products & Inventory", paths: ["/admin/product-defaults"] },
  { key: "low_stock", label: "Low Stock Alerts", group: "Products & Inventory", paths: ["/admin/low-stock"] },

  { key: "customers", label: "Customers", group: "Customers & Support", paths: ["/admin/customers"] },
  { key: "customer_accounts", label: "Customer Accounts", group: "Customers & Support", paths: ["/admin/customers-accounts"], feature: "customer_accounts" },
  { key: "duplicate_protection", label: "Duplicate Protection", group: "Customers & Support", paths: ["/admin/duplicate-protection"], feature: "duplicate_protection" },

  { key: "call_center", label: "Manual Call Center", group: "Customers & Support", paths: ["/admin/call-center"], feature: "call_center" },
  { key: "ai_call_center", label: "AI Call Center", group: "Customers & Support", paths: ["/admin/ai-call-center"], feature: "ai_call_center" },

  { key: "ai_agent", label: "AI Sales Agent", group: "Channels & AI", paths: ["/admin/ai-agent"], feature: "ai_agent" },
  { key: "ai_recommendations", label: "AI Recommendations", group: "Channels & AI", paths: ["/admin/ai-recommendations"] },
  { key: "handoff_queue", label: "Handoff Queue", group: "Channels & AI", paths: ["/admin/handoff-queue"] },
  { key: "messenger", label: "Messenger", group: "Channels & AI", paths: ["/admin/messenger"], feature: "ai_messenger" },
  { key: "messenger_inbox", label: "Messenger Inbox", group: "Channels & AI", paths: ["/admin/messenger-inbox"], feature: "messenger_inbox" },
  { key: "whatsapp", label: "WhatsApp Integration", group: "Channels & AI", paths: ["/admin/whatsapp"], feature: "whatsapp" },
  { key: "whatsapp_inbox", label: "WhatsApp Inbox", group: "Channels & AI", paths: ["/admin/whatsapp-inbox"], feature: "whatsapp" },
  { key: "facebook", label: "Facebook Page", group: "Marketing & Sales", paths: ["/admin/facebook"], feature: "facebook_page" },

  { key: "marketing", label: "Marketing & Tracking", group: "Marketing & Sales", paths: ["/admin/marketing"], feature: "pixel" },
  { key: "coupons", label: "Coupons & Discounts", group: "Marketing & Sales", paths: ["/admin/coupons"], feature: "coupons" },
  { key: "seo", label: "SEO Tools", group: "Marketing & Sales", paths: ["/admin/seo"], feature: "seo" },
  { key: "banners", label: "Banners & Sliders", group: "Online Storefront", paths: ["/admin/banners"] },
  { key: "theme", label: "Theme & Styling", group: "Online Storefront", paths: ["/admin/theme"], feature: "themes" },
  { key: "notifications", label: "Customer Notification Setup", group: "Settings & Management", paths: ["/admin/notifications"], feature: "notifications" },

  { key: "payment_gateway", label: "Payment Gateways", group: "Finance & Analytics", paths: ["/admin/payment-gateway"], ownerOnly: true, feature: "payment_gateways" },
  { key: "finance", label: "Business Finance", group: "Finance & Analytics", paths: ["/admin/finance"] },
  { key: "analytics", label: "Analytics", group: "Finance & Analytics", paths: ["/admin/analytics"], feature: "analytics" },

  { key: "delivery", label: "Delivery Zones", group: "Orders & Delivery", paths: ["/admin/delivery"], feature: "delivery_zones" },
  { key: "couriers", label: "Courier Setup", group: "Orders & Delivery", paths: ["/admin/couriers"], feature: "courier" },
  { key: "parcels", label: "Courier Parcels", group: "Orders & Delivery", paths: ["/admin/parcels"], feature: "courier" },
  { key: "landing_builder", label: "Landing Page Builder", group: "Marketing & Sales", paths: ["/admin/landing-builder"], feature: "landing_page_create" },
  { key: "landing_pages", label: "Landing Page Integrations", group: "Marketing & Sales", paths: ["/admin/landing-pages"], feature: "landing_page_connect" },

  
  { key: "pages", label: "Pages & Legal Content", group: "Online Storefront", paths: ["/admin/pages", "/admin/legal"], feature: "custom_pages" },
  { key: "invoice_templates", label: "Invoice Templates", group: "Online Storefront", paths: ["/admin/invoice-templates"], feature: "invoice" },
  { key: "import_export", label: "Import / Export", group: "Products & Inventory", paths: ["/admin/import-export"], feature: "import_export" },
  { key: "activity", label: "Activity Log", group: "Settings & Management", paths: ["/admin/activity"] },
  { key: "domains", label: "Domains & DNS", group: "Settings & Management", paths: ["/admin/domains", "/admin/dns-check"], ownerOnly: true },
  { key: "employees", label: "Employees & Team", group: "Settings & Management", paths: ["/admin/employees", "/admin/staff"], ownerOnly: true, feature: "staff" },

  { key: "support", label: "Support", group: "Settings & Management", paths: ["/admin/support"] },
  { key: "subscription", label: "My Subscription", group: "Settings & Management", paths: ["/admin/subscription"], ownerOnly: true },
  { key: "billing", label: "Billing & Plans", group: "Settings & Management", paths: ["/admin/billing"], ownerOnly: true },
  { key: "settings", label: "Store Settings", group: "Settings & Management", paths: ["/admin/settings"], ownerOnly: true },
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
