// Provider-agnostic voice calling contract. Adding a provider = one adapter
// file + one registry entry; the order system only talks to VoiceService.

export type VoiceProviderId = "epbx";

export type VoiceCreds = { api_token: string };

export type VoiceAccount = {
  account_id?: string;
  name?: string;
  balance?: number | null;
  currency?: string;
};

export type VoiceNumber = { number: string; label?: string; verified: boolean };

export type VoiceCallResult = { provider_call_id: string };

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
  makeOrderVerificationCall(creds: VoiceCreds, opts: { to: string; callerId?: string; messages: Record<string, string>; webhookUrl: string }): Promise<VoiceCallResult>;
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
