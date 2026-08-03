// Shared, browser-safe types + cycle maths for the Subscription Billing
// Checkout. Completely isolated from physical / digital / service checkout.

export type SubCycle =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly"
  | "lifetime"
  | "custom";

export const CYCLE_LABEL: Record<SubCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Semi-annual",
  yearly: "Yearly",
  lifetime: "Lifetime",
  custom: "Custom",
};

export const CYCLES: SubCycle[] = [
  "weekly",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
  "lifetime",
  "custom",
];

export type SubStatus =
  | "pending"
  | "trialing"
  | "active"
  | "past_due"
  | "grace"
  | "suspended"
  | "cancelled"
  | "expired";

export const STATUS_LABEL: Record<SubStatus, string> = {
  pending: "Pending payment",
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  grace: "Grace period",
  suspended: "Suspended",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const STATUS_TONE: Record<SubStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  trialing: "bg-sky-100 text-sky-800",
  active: "bg-emerald-100 text-emerald-800",
  past_due: "bg-orange-100 text-orange-800",
  grace: "bg-orange-100 text-orange-800",
  suspended: "bg-zinc-200 text-zinc-800",
  cancelled: "bg-rose-100 text-rose-800",
  expired: "bg-zinc-200 text-zinc-700",
};

/** Next billing date for a cycle. Lifetime never renews → null. */
export function nextBillingDate(
  from: Date | string,
  cycle: SubCycle | string | null | undefined,
  customDays?: number | null,
): string | null {
  const d = new Date(from);
  switch (cycle) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "half_yearly":
      d.setMonth(d.getMonth() + 6);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "lifetime":
      return null;
    case "custom":
      d.setDate(d.getDate() + Math.max(1, Number(customDays ?? 30)));
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}

export type SubscriptionSettings = {
  store_id: string;
  auto_renew_default: boolean;
  default_billing_cycle: SubCycle;
  allow_free_trial: boolean;
  trial_days: number;
  grace_period_days: number;
  renewal_reminder_days: number;
  failed_payment_retry: number;
  cancellation_policy: string | null;
  refund_policy: string | null;
  subscription_terms: string | null;
  setup_fee: number;
  tax_percent: number;
  invoice_prefix: string;
  invoice_template_id: string | null;
  success_redirect_url: string | null;
  payment_methods: string[];
  cod_enabled: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
};

export const DEFAULT_SUBSCRIPTION_SETTINGS: Omit<SubscriptionSettings, "store_id"> = {
  auto_renew_default: true,
  default_billing_cycle: "monthly",
  allow_free_trial: false,
  trial_days: 0,
  grace_period_days: 3,
  renewal_reminder_days: 7,
  failed_payment_retry: 3,
  cancellation_policy: null,
  refund_policy: null,
  subscription_terms: null,
  setup_fee: 0,
  tax_percent: 0,
  invoice_prefix: "SUB",
  invoice_template_id: null,
  success_redirect_url: null,
  payment_methods: [],
  cod_enabled: false,
  notify_email: true,
  notify_sms: false,
  notify_whatsapp: false,
};

export function normalizeSubscriptionSettings(storeId: string, row: any): SubscriptionSettings {
  const r = row ?? {};
  return {
    store_id: storeId,
    auto_renew_default: r.auto_renew_default ?? true,
    default_billing_cycle: (r.default_billing_cycle ?? "monthly") as SubCycle,
    allow_free_trial: r.allow_free_trial ?? false,
    trial_days: Number(r.trial_days ?? 0),
    grace_period_days: Number(r.grace_period_days ?? 3),
    renewal_reminder_days: Number(r.renewal_reminder_days ?? 7),
    failed_payment_retry: Number(r.failed_payment_retry ?? 3),
    cancellation_policy: r.cancellation_policy ?? null,
    refund_policy: r.refund_policy ?? null,
    subscription_terms: r.subscription_terms ?? null,
    setup_fee: Number(r.setup_fee ?? 0),
    tax_percent: Number(r.tax_percent ?? 0),
    invoice_prefix: r.invoice_prefix ?? "SUB",
    invoice_template_id: r.invoice_template_id ?? null,
    success_redirect_url: r.success_redirect_url ?? null,
    payment_methods: Array.isArray(r.payment_methods) ? r.payment_methods : [],
    cod_enabled: r.cod_enabled ?? false,
    notify_email: r.notify_email ?? true,
    notify_sms: r.notify_sms ?? false,
    notify_whatsapp: r.notify_whatsapp ?? false,
  };
}

/** Billing summary maths shared by checkout, admin and the renewal engine. */
export function billingSummary(input: {
  price: number;
  qty?: number;
  setupFee?: number;
  taxPercent?: number;
  discount?: number;
}) {
  const qty = Math.max(1, input.qty ?? 1);
  const plan = Number(input.price) * qty;
  const setup = Number(input.setupFee ?? 0);
  const discount = Math.min(Number(input.discount ?? 0), plan);
  const taxable = Math.max(0, plan - discount + setup);
  const tax = Math.round((taxable * Number(input.taxPercent ?? 0)) / 100);
  const total = Math.max(0, taxable + tax);
  return { plan, setup, discount, tax, total, qty };
}

export const SUB_NOTIFICATION_KINDS = [
  "activated",
  "payment_received",
  "upcoming_renewal",
  "expiring",
  "renewed",
  "payment_failed",
  "cancelled",
] as const;
export type SubNotificationKind = (typeof SUB_NOTIFICATION_KINDS)[number];

export const SUB_NOTIFICATION_LABEL: Record<SubNotificationKind, string> = {
  activated: "Subscription activated",
  payment_received: "Payment received",
  upcoming_renewal: "Upcoming renewal",
  expiring: "Subscription expiring",
  renewed: "Subscription renewed",
  payment_failed: "Payment failed",
  cancelled: "Subscription cancelled",
};
