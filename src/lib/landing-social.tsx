// Social platform registry used by the public landing page footer.
// Brand glyphs + brand colors are shared with the storefront.
import type { ComponentType } from "react";
import {
  FacebookGlyph, InstagramGlyph, YoutubeGlyph, TiktokGlyph, LinkedinGlyph,
  WhatsappGlyph, MessengerGlyph, TelegramGlyph, XGlyph, PinterestGlyph,
  SnapchatGlyph, ThreadsGlyph, WebsiteGlyph,
} from "@/components/storefront/social-icons";

export type SocialPlatform = {
  key: string;
  label: string;
  color: string;
  Glyph: ComponentType<{ className?: string }>;
  /** Turns a raw merchant value (handle, number or URL) into a real link. */
  href: (value: string) => string;
};

const url = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`);
const digits = (v: string) => v.replace(/[^\d]/g, "");

export const LP_SOCIALS: SocialPlatform[] = [
  { key: "facebook", label: "Facebook", color: "#1877F2", Glyph: FacebookGlyph, href: url },
  { key: "instagram", label: "Instagram", color: "#E4405F", Glyph: InstagramGlyph, href: url },
  {
    key: "whatsapp", label: "WhatsApp", color: "#25D366", Glyph: WhatsappGlyph,
    href: (v) => (/^https?:\/\//i.test(v) ? v : `https://wa.me/${digits(v)}`),
  },
  { key: "youtube", label: "YouTube", color: "#FF0000", Glyph: YoutubeGlyph, href: url },
  { key: "tiktok", label: "TikTok", color: "#010101", Glyph: TiktokGlyph, href: url },
  { key: "linkedin", label: "LinkedIn", color: "#0A66C2", Glyph: LinkedinGlyph, href: url },
  { key: "twitter", label: "X", color: "#000000", Glyph: XGlyph, href: url },
  {
    key: "telegram", label: "Telegram", color: "#26A5E4", Glyph: TelegramGlyph,
    href: (v) => (/^https?:\/\//i.test(v) ? v : `https://t.me/${v.replace(/^@/, "")}`),
  },
  { key: "messenger", label: "Messenger", color: "#0084FF", Glyph: MessengerGlyph, href: url },
  { key: "pinterest", label: "Pinterest", color: "#BD081C", Glyph: PinterestGlyph, href: url },
  { key: "snapchat", label: "Snapchat", color: "#FFFC00", Glyph: SnapchatGlyph, href: url },
  { key: "threads", label: "Threads", color: "#000000", Glyph: ThreadsGlyph, href: url },
  { key: "website", label: "Website", color: "#0F766E", Glyph: WebsiteGlyph, href: url },
];

export type ResolvedSocial = SocialPlatform & { value: string; url: string };

/** Merchant override wins, store setting is the automatic fallback, empty is hidden. */
export function resolveSocials(
  override: Record<string, string | null | undefined>,
  store: Record<string, string | null | undefined>,
): ResolvedSocial[] {
  const out: ResolvedSocial[] = [];
  for (const p of LP_SOCIALS) {
    const raw = String(override[p.key] ?? "").trim() || String(store[p.key] ?? "").trim();
    if (!raw) continue;
    out.push({ ...p, value: raw, url: p.href(raw) });
  }
  return out;
}
