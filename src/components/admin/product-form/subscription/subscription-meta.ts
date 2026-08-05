// Subscription-only metadata stored in products.meta.subscription.
// Fully isolated from physical / digital / service metadata.

export type BillingCycle =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly"
  | "lifetime"
  | "custom";

export type CycleUnit = "days" | "weeks" | "months" | "years";
export type PlanType = "individual" | "business" | "enterprise" | "custom";
export type TrialUnit = "days" | "weeks" | "months";
export type ActivationType = "automatic" | "manual" | "scheduled";
export type RenewalMode = "automatic" | "manual" | "both";
export type ResetPeriod = "daily" | "weekly" | "monthly" | "never";
export type CustomFieldType = "text" | "email" | "url" | "number";

export type AccessItem = { label: string; note?: string };
export type UsageLimit = {
  metric: string;
  unlimited: boolean;
  limit: number | null;
  reset: ResetPeriod;
};
export type Benefit = { title: string; description?: string };
export type CustomerField = { label: string; type: CustomFieldType; required: boolean };

export type SubscriptionNotifications = {
  welcome: boolean;
  payment_success: boolean;
  trial_ending: boolean;
  renewal_reminder: boolean;
  expiration_reminder: boolean;
  activated: boolean;
  cancelled: boolean;
};

/** One selectable billing plan of a subscription product. */
export type BillingPlan = {
  id: string;
  label: string;
  cycle: BillingCycle;
  custom_number?: number | null;
  custom_unit?: CycleUnit;
  price: number;
  compare_at?: number | null;
  badge?: string | null;
  is_default?: boolean;
};

export type SubscriptionMeta = {
  // Step 2 — plan
  billing_cycle?: BillingCycle;
  /** Multiple billing plans; customers pick one at checkout. */
  plans?: BillingPlan[];
  custom_cycle?: { number: number | null; unit: CycleUnit };
  plan_type?: PlanType;
  plan_type_custom?: string | null;
  badge?: string | null;

  // Step 3 — pricing
  setup_fee?: number | null;
  tax_included?: boolean;
  renewal_price_mode?: "same" | "different";
  renewal_price?: number | null;

  // Step 4 — trial & activation
  trial?: { enabled: boolean; duration: number | null; unit: TrialUnit };
  activation?: { type: ActivationType; delay_hours: number | null };

  // Steps 5–7
  access_items?: AccessItem[];
  usage_limits?: UsageLimit[];
  benefits?: Benefit[];

  // Step 8 — upgrade & renewal
  renewal?: {
    mode: RenewalMode;
    allow_upgrade: boolean;
    allow_downgrade: boolean;
    upgrade_rules?: string;
    grace_period_days: number | null;
    renewal_reminder_days: number | null;
    expiry_reminder_days: number | null;
    renewal_discount: number | null;
    upgrade_discount: number | null;
  };

  // Step 9
  customer_fields?: CustomerField[];

  // Step 10
  media?: { preview_images?: string[]; promo_video?: string | null; documents?: string[] };

  // Steps 12–14
  flags?: {
    featured?: boolean;
    popular?: boolean;
    recommended?: boolean;
    new?: boolean;
    limited_offer?: boolean;
  };
  publish_at?: string | null;
  policies?: {
    refund?: string;
    cancellation?: string;
    renewal?: string;
    terms?: string;
    warranty?: string;
  };
  notifications?: SubscriptionNotifications;
};

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
  lifetime: "Lifetime",
  custom: "Custom",
};

export const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  individual: "Individual",
  business: "Business",
  enterprise: "Enterprise",
  custom: "Custom",
};

export const ACTIVATION_LABEL: Record<ActivationType, string> = {
  automatic: "Automatic after payment",
  manual: "Manual approval",
  scheduled: "Scheduled activation",
};

export const RENEWAL_MODE_LABEL: Record<RenewalMode, string> = {
  automatic: "Automatic",
  manual: "Manual",
  both: "Both",
};

export const RESET_PERIOD_LABEL: Record<ResetPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  never: "Never",
};

export const BADGE_PRESETS = ["Most Popular", "Best Value", "Recommended", "Limited Offer"];

export const ACCESS_PRESETS = [
  "Premium Products",
  "Premium Categories",
  "Premium Downloads",
  "Premium Courses",
  "Members Area",
  "Private Community",
  "Premium Videos",
  "Documents",
  "Templates",
  "API Access",
  "AI Features",
  "Premium Support",
  "Unlimited Usage",
];

export const USAGE_METRIC_PRESETS = [
  "Downloads",
  "Projects",
  "API Calls",
  "Credits",
  "Storage (GB)",
  "Team Members",
  "Devices",
];

export const NOTIFICATION_LABEL: Record<keyof SubscriptionNotifications, string> = {
  welcome: "Welcome email",
  payment_success: "Payment success",
  trial_ending: "Trial ending reminder",
  renewal_reminder: "Renewal reminder",
  expiration_reminder: "Expiration reminder",
  activated: "Subscription activated",
  cancelled: "Subscription cancelled",
};

export const DEFAULT_NOTIFICATIONS: SubscriptionNotifications = {
  welcome: true,
  payment_success: true,
  trial_ending: true,
  renewal_reminder: true,
  expiration_reminder: true,
  activated: true,
  cancelled: true,
};

/** Human-readable billing period, e.g. "every 3 months". */
export function cycleLabel(sub: SubscriptionMeta | undefined | null): string {
  if (!sub) return "—";
  const c = sub.billing_cycle ?? "monthly";
  if (c !== "custom") return BILLING_CYCLE_LABEL[c];
  const n = sub.custom_cycle?.number;
  const u = sub.custom_cycle?.unit ?? "months";
  return n ? `Every ${n} ${u}` : "Custom";
}
