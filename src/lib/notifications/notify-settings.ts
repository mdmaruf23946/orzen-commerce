// Client-safe shared types/defaults for the store notification settings.

export type NotifyEventKey =
  | "new_order"
  | "order_confirmed"
  | "order_status"
  | "order_cancelled"
  | "return_update"
  | "digital_delivery"
  | "customer_password_reset"
  | "payment_update"
  | "courier_update";

export const NOTIFY_EVENTS: { key: NotifyEventKey; label: string; hint: string }[] = [
  { key: "new_order", label: "New order", hint: "A new order is placed" },
  { key: "order_confirmed", label: "Order confirmation", hint: "Order is confirmed" },
  { key: "order_status", label: "Order status update", hint: "Packed, shipped, delivered" },
  { key: "order_cancelled", label: "Cancellation", hint: "Order is cancelled" },
  { key: "return_update", label: "Return / Exchange update", hint: "Return request status changes" },
  { key: "digital_delivery", label: "Digital delivery", hint: "A purchased download is ready" },
  { key: "customer_password_reset", label: "Customer password reset", hint: "A customer requests a reset link" },
  { key: "payment_update", label: "Payment update", hint: "Payment received or failed" },
  { key: "courier_update", label: "Courier / shipping update", hint: "Parcel assigned or in transit" },
];

export type EventAudience = { admin: boolean; customer: boolean };
export type EventMap = Record<string, EventAudience>;

export type ChannelState = "connected" | "not_configured" | "disabled" | "error";

export type ChannelStatus = {
  state?: ChannelState;
  last_error?: string | null;
  last_tested_at?: string | null;
};

export type ChannelCommon = {
  enabled: boolean;
  events: EventMap;
  status: ChannelStatus;
};

export type WhatsappChannel = ChannelCommon & {
  provider: "cloud_api";
  number: string;
  phone_number_id: string;
  template_name: string;
  /** never sent to the browser; UI receives has_token instead */
  has_token?: boolean;
};

export type EmailProvider = "platform" | "resend" | "sendgrid" | "mailgun" | "brevo" | "smtp";

export const EMAIL_PROVIDERS: { key: EmailProvider; label: string; hint: string }[] = [
  { key: "platform", label: "Platform email (merchant inbox only)", hint: "ORZEN sends to your own inbox. Customers are never emailed by ORZEN." },
  { key: "resend", label: "Resend (your account)", hint: "API key from resend.com, sending domain verified there." },
  { key: "sendgrid", label: "SendGrid (your account)", hint: "API key with Mail Send permission." },
  { key: "mailgun", label: "Mailgun (your account)", hint: "Private API key plus your Mailgun sending domain." },
  { key: "brevo", label: "Brevo (your account)", hint: "API v3 key from your own Brevo account." },
  { key: "smtp", label: "Own mail server (SMTP relay)", hint: "Your server's HTTPS-to-SMTP relay endpoint." },
];

export type EmailChannel = ChannelCommon & {
  provider: EmailProvider;
  address: string;
  from_address: string;
  from_name?: string;
  /** Mailgun sending domain, or the region host for Mailgun EU. */
  mailgun_domain?: string;
  mailgun_region?: "us" | "eu";
  /** HTTPS endpoint of the merchant's own SMTP relay. */
  smtp_endpoint?: string;
  has_api_key?: boolean;
};

export type SmsChannel = ChannelCommon & {
  provider: "bulksmsbd";
  number: string;
  sender_id: string;
  has_api_key?: boolean;
};

export type NotifySettings = {
  version: 2;
  whatsapp: WhatsappChannel;
  email: EmailChannel;
  sms: SmsChannel;
};

export type ChannelKey = "whatsapp" | "email" | "sms";

/** Events a shopper is expected to receive as soon as a sender is connected. */
const CUSTOMER_FACING: NotifyEventKey[] = [
  "order_confirmed",
  "order_status",
  "order_cancelled",
  "return_update",
  "digital_delivery",
  "customer_password_reset",
  "courier_update",
];

function defaultEvents(admin = true, customer?: boolean): EventMap {
  const m: EventMap = {};
  for (const e of NOTIFY_EVENTS) {
    m[e.key] = {
      admin,
      customer: customer ?? CUSTOMER_FACING.includes(e.key),
    };
  }
  return m;
}

export function defaultSettings(): NotifySettings {
  return {
    version: 2,
    whatsapp: {
      enabled: false,
      provider: "cloud_api",
      number: "",
      phone_number_id: "",
      template_name: "",
      events: defaultEvents(),
      status: { state: "disabled", last_error: null, last_tested_at: null },
    },
    email: {
      enabled: false,
      provider: "platform",
      address: "",
      from_address: "",
      events: defaultEvents(),
      status: { state: "disabled", last_error: null, last_tested_at: null },
    },
    sms: {
      enabled: false,
      provider: "bulksmsbd",
      number: "",
      sender_id: "",
      events: defaultEvents(),
      status: { state: "disabled", last_error: null, last_tested_at: null },
    },
  };
}

/** Accepts legacy `{ whatsapp: "01...", email_enabled: true }` and v2 shapes. */
export function normalizeSettings(raw: any): NotifySettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== "object") return base;
  if (raw.version === 2) {
    return {
      version: 2,
      whatsapp: { ...base.whatsapp, ...(raw.whatsapp ?? {}), events: { ...base.whatsapp.events, ...(raw.whatsapp?.events ?? {}) } },
      email: { ...base.email, ...(raw.email ?? {}), events: { ...base.email.events, ...(raw.email?.events ?? {}) } },
      sms: { ...base.sms, ...(raw.sms ?? {}), events: { ...base.sms.events, ...(raw.sms?.events ?? {}) } },
    };
  }
  // legacy migration
  if (typeof raw.whatsapp === "string" && raw.whatsapp) {
    base.whatsapp.number = raw.whatsapp;
    base.whatsapp.enabled = true;
  }
  if (raw.email_enabled) base.email.enabled = true;
  return base;
}

export function computeState(key: ChannelKey, ch: any): ChannelState {
  if (!ch?.enabled) return "disabled";
  if (ch.status?.state === "error") return "error";
  const ok =
    key === "whatsapp"
      ? !!(ch.number && ch.phone_number_id && (ch.has_token || ch.access_token))
      : key === "email"
        ? !!(
            ch.address &&
            (ch.provider === "platform" ||
              (ch.from_address &&
                (ch.has_api_key || ch.api_key) &&
                (ch.provider !== "mailgun" || ch.mailgun_domain) &&
                (ch.provider !== "smtp" || ch.smtp_endpoint)))
          )
        : !!(ch.number && ch.sender_id && (ch.has_api_key || ch.api_key));
  return ok ? "connected" : "not_configured";
}

export const STATE_LABEL: Record<ChannelState, string> = {
  connected: "Connected",
  not_configured: "Not configured",
  disabled: "Disabled",
  error: "Error",
};
