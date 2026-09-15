// Client-safe registry for the Merchant AI Command Center.
import type { FeatureKey } from "@/lib/features";

// Adding a new agent = one entry here + one tool group in tools.server.ts.

export type AgentKey =
  | "master"
  | "messenger"
  | "whatsapp"
  | "facebook"
  | "sales"
  | "order"
  | "customer"
  | "courier"
  | "notification"
  | "handoff";

export type AgentStatus = "active" | "needs_setup" | "paused" | "error";

export type PermissionLevel = "auto" | "approval" | "restricted";

export type AgentMeta = {
  key: AgentKey;
  label: string;
  description: string;
  /** Channel agents need an external connection before they can work. */
  channel?: "messenger" | "whatsapp" | "facebook";
  /** Plan feature that unlocks this agent (undefined = always available). */
  feature?: FeatureKey;
};

export const AGENTS: AgentMeta[] = [
  {
    key: "master",
    label: "Master AI Agent",
    description: "Central brain. Understands your command and runs the right agents in order.",
    feature: "ai_agent",
  },
  {
    key: "messenger",
    label: "Messenger Agent",
    description: "Handles Messenger conversations — customers get support, you get business control.",
    channel: "messenger",
    feature: "ai_messenger",
  },
  {
    key: "whatsapp",
    label: "WhatsApp Agent",
    description: "Same brain on WhatsApp. Send commands, get replies and approvals.",
    channel: "whatsapp",
    feature: "whatsapp",
  },
  {
    key: "facebook",
    label: "Facebook Page Agent",
    description:
      "Comments, replies, moderation and spam handling on your Page. Page chat messages are handled by the Messenger Agent.",

    channel: "facebook",
    feature: "facebook_page",
  },
  {
    key: "sales",
    label: "Sales Agent",
    description: "Answers product, price, stock and variant questions from real catalog data.",
    feature: "ai_agent",
  },
  {
    key: "order",
    label: "Order Agent",
    description: "Creates, finds, verifies, updates and cancels orders.",
  },
  {
    key: "customer",
    label: "Customer Agent",
    description: "Finds customers and their history — only inside your own store.",
  },
  {
    key: "courier",
    label: "Courier Agent",
    description: "Validates addresses, submits parcels and tracks delivery.",
    feature: "courier",
  },
  {
    key: "notification",
    label: "Notification Agent",
    description: "Sends you only the alerts that matter, based on your own rules.",
  },
  {
    key: "handoff",
    label: "Human Handoff Agent",
    description: "Pulls you in with full context when a customer needs a human.",
  },
];

export const AGENT_BY_KEY: Record<string, AgentMeta> = Object.fromEntries(
  AGENTS.map((a) => [a.key, a]),
);

export type MerchantActionMeta = {
  key: string;
  agent: AgentKey;
  label: string;
  description: string;
  defaultLevel: PermissionLevel;
  /** Restricted actions can never be moved to auto/approval. */
  locked?: boolean;
};

export const MERCHANT_ACTIONS: MerchantActionMeta[] = [
  // Sales
  { key: "sales_product_search", agent: "sales", label: "Search products", description: "Find products by name, code or category.", defaultLevel: "auto" },
  { key: "sales_product_details", agent: "sales", label: "Product details", description: "Price, stock, variants and description.", defaultLevel: "auto" },
  { key: "sales_bestsellers", agent: "sales", label: "Best sellers", description: "Top selling products of the store.", defaultLevel: "auto" },

  // Orders
  { key: "order_search", agent: "order", label: "Search orders", description: "Find orders by phone, name, invoice or id.", defaultLevel: "auto" },
  { key: "order_details", agent: "order", label: "Order details", description: "Full detail of a single order.", defaultLevel: "auto" },
  { key: "order_today", agent: "order", label: "Today's orders", description: "Today's order count and value.", defaultLevel: "auto" },
  { key: "order_create", agent: "order", label: "Create order", description: "Create a new order for a customer.", defaultLevel: "approval" },
  { key: "order_update_status", agent: "order", label: "Change order status", description: "Move an order to another status.", defaultLevel: "approval" },
  { key: "order_verify", agent: "order", label: "Verify order", description: "Mark an order confirmed after checking.", defaultLevel: "approval" },
  { key: "order_cancel", agent: "order", label: "Cancel order", description: "Cancel an existing order.", defaultLevel: "approval" },

  // Customers
  { key: "customer_search", agent: "customer", label: "Search customers", description: "Find a customer by phone, name or email.", defaultLevel: "auto" },
  { key: "customer_details", agent: "customer", label: "Customer profile", description: "Profile plus order summary.", defaultLevel: "auto" },
  { key: "customer_orders", agent: "customer", label: "Customer order history", description: "Previous orders of one customer.", defaultLevel: "auto" },

  // Courier
  { key: "courier_ready_orders", agent: "courier", label: "Courier-ready orders", description: "Orders that can be sent to courier.", defaultLevel: "auto" },
  { key: "courier_submit", agent: "courier", label: "Submit to courier", description: "Create the parcel at the courier.", defaultLevel: "approval" },
  { key: "courier_track", agent: "courier", label: "Track parcel", description: "Current delivery status and tracking id.", defaultLevel: "auto" },

  // Facebook
  { key: "fb_recent_comments", agent: "facebook", label: "Recent Page comments", description: "Latest comments on your Page.", defaultLevel: "auto" },
  { key: "fb_reply_comment", agent: "facebook", label: "Reply to a comment", description: "Post a public reply to a comment.", defaultLevel: "approval" },
  { key: "fb_hide_comment", agent: "facebook", label: "Hide / moderate comment", description: "Hide a spam or abusive comment.", defaultLevel: "approval" },

  // Notification / handoff
  { key: "notify_merchant", agent: "notification", label: "Send me a notification", description: "Push an alert to the panel and your channels.", defaultLevel: "auto" },
  { key: "handoff_open", agent: "handoff", label: "Open human handoff", description: "Hand a customer conversation to you.", defaultLevel: "auto" },
  { key: "handoff_close", agent: "handoff", label: "Close human handoff", description: "Give the conversation back to the AI.", defaultLevel: "auto" },

  // Always blocked
  { key: "secrets_view", agent: "master", label: "View API keys / secrets", description: "Never allowed for the AI.", defaultLevel: "restricted", locked: true },
  { key: "cross_store_access", agent: "master", label: "Access another store's data", description: "Never allowed for the AI.", defaultLevel: "restricted", locked: true },
  { key: "permission_change", agent: "master", label: "Change its own permissions", description: "Never allowed for the AI.", defaultLevel: "restricted", locked: true },
  { key: "security_bypass", agent: "master", label: "Bypass security checks", description: "Never allowed for the AI.", defaultLevel: "restricted", locked: true },
];

export const ACTION_BY_KEY: Record<string, MerchantActionMeta> = Object.fromEntries(
  MERCHANT_ACTIONS.map((a) => [a.key, a]),
);

export const NOTIFICATION_EVENTS: { key: string; label: string; description: string }[] = [
  { key: "new_customer", label: "New customer", description: "A customer talks to your store for the first time." },
  { key: "new_order", label: "New order", description: "An order was placed or created by the AI." },
  { key: "payment_received", label: "Payment received", description: "A payment was confirmed." },
  { key: "ai_failed", label: "AI could not help", description: "The AI failed to answer a customer." },
  { key: "human_requested", label: "Customer wants a human", description: "A customer asked for human support." },
  { key: "high_risk_order", label: "High-risk order", description: "Fraud check or duplicate protection flagged an order." },
  { key: "approval_needed", label: "Approval needed", description: "The AI prepared an action that needs your decision." },
];

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  active: "Active",
  needs_setup: "Needs Setup",
  paused: "Paused",
  error: "Error",
};

export function levelLabel(level: PermissionLevel) {
  return level === "auto" ? "Auto" : level === "approval" ? "Approval Required" : "Restricted";
}
