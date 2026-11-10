// Decides whether a message from an allow-listed admin PSID is a real admin
// command. Anything else (sales-style questions the owner sends to test the
// Page) is answered by the public sales agent, exactly as a prospect sees it.
const ADMIN_PATTERNS: RegExp[] = [
  /^\s*(\/|admin\b|অ্যাডমিন\b|এডমিন\b)/i,
  /^\s*(yes|no|ok|okay|confirm|cancel|done|haa?n?|ha|na|হ্যাঁ|হা|না|ঠিক আছে|করো|করুন|বাতিল)\s*[.!।]*\s*$/i,
  /dashboard|ড্যাশবোর্ড|stats?\b|স্ট্যাটস|revenue|রেভিনিউ|আজকের (অর্ডার|সেল|বিক্রি|হিসাব)|today'?s? (orders?|sales)/i,
  /pending|পেন্ডিং|approve|reject|অ্যাপ্রুভ|রিজেক্ট|suspend|সাসপেন্ড|activate|অ্যাক্টিভ কর/i,
  /support|সাপোর্ট|অপেক্ষা করছে|waiting|তাকে|ওকে বল|বলে দাও|জিজ্ঞেস করো|tell (him|her|them)|ask (him|her|them)/i,
  /(store|স্টোর|user|ইউজার|merchant|মার্চেন্ট|invoice|ইনভয়েস|payment|পেমেন্ট).*(খোঁজ|খুঁজ|find|search|দেখাও|list|তালিকা|check|চেক)/i,
  /(খোঁজ|খুঁজে|find|search|দেখাও|list)\s.*(store|স্টোর|user|ইউজার|merchant|মার্চেন্ট|order|অর্ডার)/i,
  /(price|দাম|stock|স্টক|status|স্ট্যাটাস)\s*(update|বদল|change|সেট)/i,
];

export function isAdminCommand(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  return ADMIN_PATTERNS.some((re) => re.test(t));
}

/** Split a reply into at most 3 short Messenger bubbles (blank-line separated). */
export function splitReplyBubbles(reply: string, max = 3): string[] {
  const parts = String(reply ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= max) return parts.length ? parts : [String(reply ?? "").trim()];
  return [...parts.slice(0, max - 1), parts.slice(max - 1).join("\n")];
}
