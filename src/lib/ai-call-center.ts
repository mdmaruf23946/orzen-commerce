// Client-safe shared types and labels for the AI Voice Call Center.

export type AiCallDirection = "inbound" | "outbound";

export type AiCallStatus =
  | "queued"
  | "calling"
  | "in_progress"
  | "completed"
  | "no_answer"
  | "failed"
  | "cancelled";

export type AiCallResult =
  | "confirmed"
  | "cancelled"
  | "callback"
  | "no_answer"
  | "wrong_number"
  | "failed"
  | "info_only";

export type ProviderState = "connected" | "not_connected" | "error";

export const AI_STATUS_LABEL: Record<AiCallStatus, string> = {
  queued: "Queued",
  calling: "Calling",
  in_progress: "In Progress",
  completed: "Completed",
  no_answer: "No Answer",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const AI_STATUS_TONE: Record<AiCallStatus, string> = {
  queued: "bg-muted text-muted-foreground ring-border",
  calling: "bg-sky-500/12 text-sky-700 dark:text-sky-400 ring-sky-500/20",
  in_progress: "bg-sky-500/12 text-sky-700 dark:text-sky-400 ring-sky-500/20",
  completed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  no_answer: "bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  failed: "bg-destructive/10 text-destructive ring-destructive/20",
  cancelled: "bg-muted text-muted-foreground ring-border",
};

export const AI_RESULT_LABEL: Record<AiCallResult, string> = {
  confirmed: "Order Confirmed",
  cancelled: "Order Cancelled",
  callback: "Callback Requested",
  no_answer: "No Answer",
  wrong_number: "Wrong Number",
  failed: "Failed",
  info_only: "Information Only",
};

export const AI_RESULT_TONE: Record<AiCallResult, string> = {
  confirmed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  cancelled: "bg-destructive/10 text-destructive ring-destructive/20",
  callback: "bg-violet-500/12 text-violet-700 dark:text-violet-400 ring-violet-500/20",
  no_answer: "bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  wrong_number: "bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  failed: "bg-destructive/10 text-destructive ring-destructive/20",
  info_only: "bg-sky-500/12 text-sky-700 dark:text-sky-400 ring-sky-500/20",
};

export const PROVIDER_STATE_LABEL: Record<ProviderState, string> = {
  connected: "Connected",
  not_connected: "Not Connected",
  error: "Connection Error",
};

export const GENDERS = ["female", "male"] as const;
export type Gender = (typeof GENDERS)[number];

export const AI_TOOLS = [
  { key: "get_order", label: "Get Order" },
  { key: "track_order", label: "Track Order (Caller ID)" },
  { key: "confirm_order", label: "Confirm Order" },
  { key: "cancel_order", label: "Cancel Order" },
  { key: "update_order", label: "Update Order" },
  { key: "change_address", label: "Change Address" },
  { key: "get_product", label: "Get Product" },
  { key: "check_stock", label: "Check Stock" },
  { key: "get_delivery_charge", label: "Get Delivery Charge" },
  { key: "create_callback", label: "Create Callback" },
  { key: "transfer_to_human", label: "Transfer To Human" },
  { key: "create_support_ticket", label: "Create Support Ticket" },
] as const;

export const BUSINESS_BEHAVIOR = [
  { key: "greeting", label: "Greeting" },
  { key: "order_confirmation", label: "Order Confirmation" },
  { key: "product_questions", label: "Product Questions" },
  { key: "availability", label: "Product Availability" },
  { key: "pricing", label: "Price Information" },
  { key: "delivery_info", label: "Delivery Information" },
  { key: "cancellation", label: "Cancellation Handling" },
  { key: "address_change", label: "Address Changes" },
  { key: "callback", label: "Callback Requests" },
  { key: "human_transfer", label: "Human Transfer" },
] as const;

export type BehaviorConfig = {
  interruptions: boolean;
  barge_in: boolean;
  turn_taking: boolean;
  response_delay_ms: number;
  silence_timeout_sec: number;
  max_response_chars: number;
  conversation_timeout_sec: number;
};

export type RulesConfig = {
  auto_confirm_orders: boolean;
  delay_minutes: number;
  retry_count: number;
  retry_interval_minutes: number;
  max_duration_sec: number;
  call_start_hour: number;
  call_end_hour: number;
  weekend_calling: boolean;
  holiday_calling: boolean;
};

export function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function maskNumber(n: string): string {
  return n;
}
