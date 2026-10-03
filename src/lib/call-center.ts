// Shared, client-safe types and labels for call history.
export type CallStatus =
  | "calling"
  | "ringing"
  | "answered"
  | "missed"
  | "busy"
  | "failed"
  | "no_answer"
  | "completed";

export type CallResult =
  | "order_confirmed"
  | "callback"
  | "unavailable"
  | "order_cancelled"
  | "wrong_number"
  | "interested"
  | "not_interested"
  | "other";

export const CALL_STATUSES: CallStatus[] = [
  "calling", "ringing", "answered", "missed", "busy", "failed", "no_answer", "completed",
];

export const STATUS_LABEL: Record<CallStatus, string> = {
  calling: "Calling",
  ringing: "Ringing",
  answered: "Answered",
  missed: "Missed",
  busy: "Busy",
  failed: "Failed",
  no_answer: "No Answer",
  completed: "Completed",
};

export const STATUS_TONE: Record<CallStatus, string> = {
  calling: "bg-sky-500/12 text-sky-700 dark:text-sky-400 ring-sky-500/20",
  ringing: "bg-sky-500/12 text-sky-700 dark:text-sky-400 ring-sky-500/20",
  answered: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  completed: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  missed: "bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  no_answer: "bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  busy: "bg-violet-500/12 text-violet-700 dark:text-violet-400 ring-violet-500/20",
  failed: "bg-destructive/10 text-destructive ring-destructive/20",
};

export const LIVE_STATUSES: CallStatus[] = ["calling", "ringing", "answered"];

export const RESULT_LABEL: Record<CallResult, string> = {
  order_confirmed: "Order Confirmed",
  callback: "Wants Callback",
  unavailable: "Customer Unavailable",
  order_cancelled: "Order Cancelled",
  wrong_number: "Wrong Number",
  interested: "Interested",
  not_interested: "Not Interested",
  other: "Other",
};

export const CALL_RESULTS = Object.keys(RESULT_LABEL) as CallResult[];

export type CallRow = {
  id: string;
  store_id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  phone: string;
  agent_email: string | null;
  provider: string;
  status: CallStatus;
  duration_sec: number;
  result: CallResult | null;
  note: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  invoice_no?: string | null;
};

export function formatDuration(sec: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(sec ?? 0)));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/** Digits-only E.164-ish normalisation for Bangladeshi numbers. */
export function toE164(phone: string): string {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("880")) return `+${d}`;
  if (d.startsWith("0")) return `+88${d}`;
  return `+${d}`;
}
