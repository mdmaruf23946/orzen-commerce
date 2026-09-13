// Client-safe catalog of AI Admin actions. The server tool layer implements
// exactly these keys; the permissions UI renders from this list.

export type ActionRisk = "low" | "medium" | "high";

export type ActionMeta = {
  key: string;
  group: string;
  label: string;
  risk: ActionRisk;
  /** Default enabled state when the permission row does not exist yet. */
  defaultEnabled: boolean;
};

export const ACTION_GROUPS: { key: string; label: string }[] = [
  { key: "analytics", label: "Analytics" },
  { key: "users", label: "User Management" },
  { key: "subscriptions", label: "Subscription Management" },
  { key: "payments", label: "Payment Management" },
  { key: "orders", label: "Order Management" },
  { key: "products", label: "Product Management" },
  { key: "restricted", label: "Restricted" },
];

export const ACTIONS: ActionMeta[] = [
  // Analytics (read-only)
  { key: "stats_today_users", group: "analytics", label: "Today's users", risk: "low", defaultEnabled: true },
  { key: "stats_today_orders", group: "analytics", label: "Today's orders", risk: "low", defaultEnabled: true },
  { key: "stats_today_revenue", group: "analytics", label: "Today's revenue", risk: "low", defaultEnabled: true },
  { key: "stats_subscriptions", group: "analytics", label: "Subscription statistics", risk: "low", defaultEnabled: true },
  { key: "stats_active_users", group: "analytics", label: "Active users", risk: "low", defaultEnabled: true },
  { key: "stats_pending_payments", group: "analytics", label: "Pending payments", risk: "low", defaultEnabled: true },
  { key: "stats_pending_subscriptions", group: "analytics", label: "Pending subscriptions", risk: "low", defaultEnabled: true },

  // Users
  { key: "user_search", group: "users", label: "Search user", risk: "low", defaultEnabled: true },
  { key: "user_details", group: "users", label: "View user details", risk: "low", defaultEnabled: true },
  { key: "user_subscription", group: "users", label: "View user subscription", risk: "low", defaultEnabled: true },
  { key: "user_activity", group: "users", label: "View user activity", risk: "low", defaultEnabled: true },
  { key: "user_change_plan", group: "users", label: "Change user plan", risk: "medium", defaultEnabled: true },
  { key: "user_suspend", group: "users", label: "Suspend user", risk: "medium", defaultEnabled: true },
  { key: "user_activate", group: "users", label: "Activate user", risk: "medium", defaultEnabled: true },

  // Subscriptions
  { key: "subscription_view", group: "subscriptions", label: "View subscription", risk: "low", defaultEnabled: true },
  { key: "subscription_pending_list", group: "subscriptions", label: "View pending subscriptions", risk: "low", defaultEnabled: true },
  { key: "subscription_approve", group: "subscriptions", label: "Approve subscription", risk: "medium", defaultEnabled: true },
  { key: "subscription_reject", group: "subscriptions", label: "Reject subscription", risk: "medium", defaultEnabled: true },
  { key: "subscription_change_plan", group: "subscriptions", label: "Change subscription plan", risk: "medium", defaultEnabled: true },
  { key: "subscription_cancel", group: "subscriptions", label: "Cancel subscription", risk: "medium", defaultEnabled: true },
  { key: "subscription_renew", group: "subscriptions", label: "Renew subscription", risk: "medium", defaultEnabled: true },

  // Payments
  { key: "payment_search", group: "payments", label: "Search transaction", risk: "low", defaultEnabled: true },
  { key: "payment_details", group: "payments", label: "View payment details", risk: "low", defaultEnabled: true },
  { key: "payment_pending_list", group: "payments", label: "View pending payments", risk: "low", defaultEnabled: true },
  { key: "payment_today", group: "payments", label: "View today's payments", risk: "low", defaultEnabled: true },
  { key: "payment_approve", group: "payments", label: "Approve payment", risk: "medium", defaultEnabled: true },
  { key: "payment_reject", group: "payments", label: "Reject payment", risk: "medium", defaultEnabled: true },

  // Orders
  { key: "order_search", group: "orders", label: "Search order", risk: "low", defaultEnabled: true },
  { key: "order_details", group: "orders", label: "View order details", risk: "low", defaultEnabled: true },
  { key: "order_pending_list", group: "orders", label: "View pending orders", risk: "low", defaultEnabled: true },
  { key: "order_today", group: "orders", label: "View today's orders", risk: "low", defaultEnabled: true },
  { key: "order_change_status", group: "orders", label: "Change order status", risk: "medium", defaultEnabled: true },

  // Products
  { key: "product_search", group: "products", label: "Search product", risk: "low", defaultEnabled: true },
  { key: "product_details", group: "products", label: "View product details", risk: "low", defaultEnabled: true },
  { key: "product_update_price", group: "products", label: "Update product price", risk: "medium", defaultEnabled: true },
  { key: "product_set_status", group: "products", label: "Enable/disable product", risk: "medium", defaultEnabled: true },
  { key: "product_update_stock", group: "products", label: "Update stock", risk: "medium", defaultEnabled: true },

  // Restricted (off by default)
  { key: "payment_refund", group: "restricted", label: "Refund payment", risk: "high", defaultEnabled: false },
  { key: "user_delete", group: "restricted", label: "Delete user / store", risk: "high", defaultEnabled: false },
  { key: "product_delete", group: "restricted", label: "Delete product", risk: "high", defaultEnabled: false },
  { key: "admin_manage", group: "restricted", label: "Admin permission management", risk: "high", defaultEnabled: false },
];

export const ACTION_BY_KEY: Record<string, ActionMeta> = Object.fromEntries(
  ACTIONS.map((a) => [a.key, a]),
);

export const NOTIFICATION_EVENTS: { key: string; label: string }[] = [
  { key: "new_user", label: "New User Notification" },
  { key: "new_subscription", label: "New Subscription Notification" },
  { key: "payment", label: "Payment Notification" },
  { key: "new_order", label: "New Order Notification" },
  { key: "failed_payment", label: "Failed Payment Notification" },
  { key: "pending_subscription", label: "Pending Subscription Alert" },
  { key: "system_alert", label: "Important System Alert" },
];

export function normalizePhone(raw: string) {
  return (raw || "").replace(/[^\d]/g, "");
}
