// Provider-agnostic voice calling contract. Adding a provider = one adapter
// file + one registry entry; the order system only talks to VoiceService.

export type VoiceProviderId = "epbx";

export type VoiceCreds = { api_token: string; base_url?: string };

export type VoiceAccount = {
  account_id?: string;
  name?: string;
  balance?: number | null;
  currency?: string;
};

export type VoiceNumber = { number: string; label?: string; verified: boolean };

export type VoiceCallResult = { provider_call_id: string };

/** What the connected provider's API actually exposes; the UI shows "not available" for false. */
export type VoiceCapabilities = {
  click_to_call: boolean; order_verification: boolean; call_history: boolean; recordings: boolean;
  numbers_list: boolean; extensions_list: boolean; ivr: boolean; webrtc: boolean;
};

export type VoiceOverview = {
  tenant?: string; balance: number | null; currency: string;
  trunk_number?: string | null; trunk_balance?: number | null;
};

export type VoiceCdrRow = {
  id: string; date: string; source: string; destination: string; caller_id: string;
  direction: "incoming" | "outgoing" | "internal"; disposition: string;
  duration_sec: number; billable_sec: number; has_recording: boolean;
};

export type VoiceCdrFilter = {
  start_date?: string; end_date?: string; phone_number?: string; extension?: string;
  disposition?: "ANSWERED" | "NO ANSWER" | "BUSY" | "FAILED"; page: number; per_page: number;
};

export class VoiceProviderError extends Error {
  constructor(public code: "invalid_token" | "unavailable" | "not_supported" | "insufficient_balance" | "invalid_phone" | "rate_limited" | "failed", message: string) {
    super(message);
  }
}

export interface VoiceProvider {
  id: VoiceProviderId;
  label: string;
  /** False until the adapter is wired to the provider's real API. */
  ready: boolean;
  testConnection(creds: VoiceCreds): Promise<VoiceAccount>;
  getBalance(creds: VoiceCreds): Promise<number | null>;
  getNumbers(creds: VoiceCreds): Promise<VoiceNumber[]>;
  makeCall(creds: VoiceCreds, opts: { to: string; callerId?: string; extension?: string; webhookUrl: string }): Promise<VoiceCallResult>;
  makeOrderVerificationCall(creds: VoiceCreds, opts: { to: string; callerId?: string; messages: Record<string, string>; webhookUrl: string; vars?: { customer_name?: string; amount?: string; store_name?: string; order_id?: string }; audio?: { main?: string; confirm?: string; cancel?: string } }): Promise<VoiceCallResult>;
  capabilities: VoiceCapabilities;
  getOverview(creds: VoiceCreds): Promise<VoiceOverview>;
  getCallHistory(creds: VoiceCreds, f: VoiceCdrFilter): Promise<{ rows: VoiceCdrRow[]; page: number; last_page: number; total: number }>;
  /** Provider URL for a recording, fetched only server-side with the store's token. */
  recordingUrl(providerCallId: string, creds?: VoiceCreds): string;
  parseWebhook(body: any): { event_id: string; provider_call_id: string; status?: string; dtmf?: string; duration_sec?: number; recording_ref?: string } | null;
}

export const DEFAULT_VOICE_MESSAGES: Record<string, string> = {
  greeting: "Assalamu Alaikum. আপনি আমাদের ওয়েবসাইটে একটি অর্ডার করেছেন।",
  confirm: "অর্ডারটি নিশ্চিত করতে 1 চাপুন।",
  cancel: "অর্ডারটি বাতিল করতে 2 চাপুন।",
  transfer: "একজন প্রতিনিধির সাথে কথা বলতে 0 চাপুন।",
  no_answer: "আমরা আপনাকে পরে আবার কল করব।",
  busy: "আপনি ব্যস্ত আছেন, আমরা পরে আবার কল করব।",
  retry: "আপনার অর্ডার নিশ্চিত করার জন্য আবার কল করছি।",
};

export const TTS_TAGS = ["{customer_name}", "{store_name}", "{amount}", "{order_id}"] as const;
export const DEFAULT_TTS_TEMPLATE = "আসসালামু আলাইকুম {customer_name}। {store_name} থেকে আপনার {amount} টাকার অর্ডার {order_id} নিশ্চিত করতে 1 চাপুন, বাতিল করতে 2 চাপুন।";
export function fillTemplate(t: string, v: Record<string, string | undefined>) {
  return t.replace(/\{(customer_name|store_name|amount|order_id)\}/g, (_, k) => v[k] ?? "");
}
