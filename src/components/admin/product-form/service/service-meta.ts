// Service-only metadata stored in products.meta.service
export type ServicePricingType =
  | "fixed"
  | "starting"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "quote";

export type ServiceAvailability = "available" | "busy" | "fully_booked" | "closed";

export type ServiceBookingType = "instant" | "request" | "appointment" | "manual";

export type ServiceAddon = { name: string; price: number | null; description?: string };
export type ServiceFaq = { question: string; answer: string };
export type BeforeAfter = { before: string | null; after: string | null; label?: string };

export type ServiceMeta = {
  pricing_type?: ServicePricingType;
  tax_included?: boolean;
  delivery?: {
    time?: number | null;
    unit?: "hours" | "days" | "weeks";
    express?: boolean;
    express_fee?: number | null;
    express_time?: string | null;
  };
  availability?: ServiceAvailability;
  max_orders?: number | null;
  max_orders_period?: "day" | "week" | "month";
  included?: string[];
  requirements?: string[];
  deliverables?: string[];
  booking?: {
    type?: ServiceBookingType;
    working_days?: string[];
    working_hours?: { start?: string; end?: string };
    slot_minutes?: number | null;
    buffer_minutes?: number | null;
  };
  media?: {
    portfolio?: string[];
    before_after?: BeforeAfter[];
    demo_video?: string | null;
  };
  addons?: ServiceAddon[];
  faq?: ServiceFaq[];
  policies?: {
    refund?: string;
    cancellation?: string;
    terms?: string;
    warranty?: string;
  };
  flags?: {
    best_seller?: boolean;
    recommended?: boolean;
    new?: boolean;
  };
  // legacy fields kept for backwards compatibility with the old inline form
  booking_type?: string;
  delivery_time?: string | null;
};

export const PRICING_TYPE_LABEL: Record<ServicePricingType, string> = {
  fixed: "Fixed price",
  starting: "Starting from",
  hourly: "Per hour",
  daily: "Per day",
  weekly: "Per week",
  monthly: "Per month",
  quote: "Custom quote",
};

export const AVAILABILITY_LABEL: Record<ServiceAvailability, string> = {
  available: "Available",
  busy: "Busy",
  fully_booked: "Fully booked",
  closed: "Temporarily closed",
};

export const BOOKING_TYPE_LABEL: Record<ServiceBookingType, string> = {
  instant: "Instant booking",
  request: "Request first",
  appointment: "Appointment",
  manual: "Manual approval",
};

export const WEEK_DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
