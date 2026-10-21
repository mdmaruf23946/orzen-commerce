// Omni Inbox channel + folder registry. Add a new chat channel (Instagram, TikTok…)
// by appending one entry here; the inbox list, filter bar and badges pick it up.
export type OmniChannelKey = "messenger" | "whatsapp" | "web";

export const OMNI_CHANNELS: { key: OmniChannelKey; label: string }[] = [
  { key: "messenger", label: "Messenger" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "web", label: "Website" },
];
export const OMNI_CHANNEL_KEYS = OMNI_CHANNELS.map((c) => c.key);

// Segments are computed automatically from conversation + order data.
export const OMNI_FOLDERS = [
  { key: "all", label: "সব" },
  { key: "unread", label: "না-পড়া" },
  { key: "interested", label: "আগ্রহী, কেনেনি" },
  { key: "incomplete", label: "অসম্পূর্ণ অর্ডার" },
  { key: "hold", label: "হোল্ড" },
  { key: "customers", label: "ক্রেতা" },
  { key: "vip", label: "VIP" },
  { key: "new", label: "নতুন (২৪ঘ)" },
  { key: "human", label: "মানুষ চায়" },
  { key: "attention", label: "পাঠানো যায়নি" },
  { key: "ai", label: "AI চালাচ্ছে" },
] as const;
export type OmniFolder = (typeof OMNI_FOLDERS)[number]["key"];

/** Big customer: 3+ orders or ৳5,000+ spent. */
export function isVip(c: { total_orders?: number | null; total_spent?: number | null }) {
  return (c.total_orders ?? 0) >= 3 || Number(c.total_spent ?? 0) >= 5000;
}
