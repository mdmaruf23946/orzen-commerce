// Omni Inbox channel + folder registry. Add a new chat channel (Instagram, TikTok…)
// by appending one entry here; the inbox list, filter bar and badges pick it up.
export type OmniChannelKey = "messenger" | "whatsapp" | "web";

export const OMNI_CHANNELS: { key: OmniChannelKey; label: string }[] = [
  { key: "messenger", label: "Messenger" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "web", label: "Website" },
];
export const OMNI_CHANNEL_KEYS = OMNI_CHANNELS.map((c) => c.key);

export const OMNI_FOLDERS = [
  { key: "all", label: "সব" },
  { key: "unread", label: "না-পড়া" },
  { key: "human", label: "মানুষ চায়" },
  { key: "vip", label: "VIP" },
  { key: "attention", label: "পাঠানো যায়নি" },
  { key: "ai", label: "AI চালাচ্ছে" },
] as const;
export type OmniFolder = (typeof OMNI_FOLDERS)[number]["key"];

/** Big customer: 3+ orders or ৳5,000+ spent. */
export function isVip(c: { total_orders?: number | null; total_spent?: number | null }) {
  return (c.total_orders ?? 0) >= 3 || Number(c.total_spent ?? 0) >= 5000;
}
