// Browser-safe helpers for connected websites / landing pages.

/** Only public https URLs may receive outbound order updates (blocks SSRF to private hosts). */
export function assertSafeOutboundUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Status update link must be a valid https:// URL");
  }
  if (u.protocol !== "https:") throw new Error("Status update link must start with https://");
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.startsWith("[") 
  ) {
    throw new Error("Status update link must be a public website address");
  }
  return u.toString();
}

export type OrderSourceInfo = { label: string; tone: string };

/** One label per order origin, shown as a badge on All Orders. */
export function orderSourceInfo(source: string | null | undefined, siteType?: string | null, siteName?: string | null): OrderSourceInfo {
  const s = (source ?? "").toLowerCase();
  if (s === "landing_page") {
    if (siteType === "website") return { label: `Website${siteName ? `: ${siteName}` : ""}`, tone: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300" };
    return { label: `Landing Page${siteName ? `: ${siteName}` : ""}`, tone: "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300" };
  }
  if (s === "landing_builder" || s === "landing") return { label: "Own Landing Page", tone: "bg-pink-500/12 text-pink-700 dark:text-pink-300" };
  if (s === "messenger") return { label: "Messenger", tone: "bg-blue-500/12 text-blue-700 dark:text-blue-300" };
  if (s === "whatsapp") return { label: "WhatsApp", tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" };
  if (s === "webchat" || s === "web_chat") return { label: "Web Chat", tone: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300" };
  if (s === "manual" || s === "admin" || s === "pos") return { label: "Merchant Panel", tone: "bg-slate-500/12 text-slate-700 dark:text-slate-300" };
  if (s === "ai" || s === "chat") return { label: "AI Chat", tone: "bg-violet-500/12 text-violet-700 dark:text-violet-300" };
  return { label: "Storefront", tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300" };
}
