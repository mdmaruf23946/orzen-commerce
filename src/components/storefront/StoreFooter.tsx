import { useState } from "react";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useStoreT } from "@/lib/store-i18n";
import { useStoreTheme } from "@/lib/theme/context";
import { resolveStoreIcon } from "@/lib/store-icon";
import { subscribeToStoreOffers } from "@/lib/newsletter.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FacebookGlyph,
  InstagramGlyph,
  YoutubeGlyph,
  TiktokGlyph,
  LinkedinGlyph,
  WhatsappGlyph,
  MessengerGlyph,
  TelegramGlyph,
  WebsiteGlyph,
} from "@/components/storefront/social-icons";

const SOCIAL_BRANDS = {
  facebook: { label: "Facebook", Icon: FacebookGlyph, bg: "#1877F2" },
  instagram: {
    label: "Instagram",
    Icon: InstagramGlyph,
    bg: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF,#515BD4)",
  },
  youtube: { label: "YouTube", Icon: YoutubeGlyph, bg: "#FF0000" },
  tiktok: { label: "TikTok", Icon: TiktokGlyph, bg: "#000000" },
  linkedin: { label: "LinkedIn", Icon: LinkedinGlyph, bg: "#0A66C2" },
  whatsapp: { label: "WhatsApp", Icon: WhatsappGlyph, bg: "#25D366" },
  messenger: {
    label: "Messenger",
    Icon: MessengerGlyph,
    bg: "linear-gradient(45deg,#0084FF,#A033FF,#FF5280)",
  },
  telegram: { label: "Telegram", Icon: TelegramGlyph, bg: "#24A1DE" },
  website: { label: "Website", Icon: WebsiteGlyph, bg: "#334155" },
} as const;

type SocialKey = keyof typeof SOCIAL_BRANDS;

/** Normalizes a raw merchant value (handle or URL) into an external link. */
function socialHref(key: SocialKey, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  if (key === "whatsapp") {
    const digits = v.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : null;
  }
  if (key === "telegram") return `https://t.me/${handle}`;
  if (key === "messenger") return `https://m.me/${handle}`;
  return `https://${v}`;
}


export function StoreFooter({
  store,
  slug,
}: {
  store: {
    id?: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    icon_url?: string | null;
    name_logo_url?: string | null;
    phone: string | null;
    whatsapp: string | null;
    email?: string | null;
    facebook: string | null;
    instagram?: string | null;
    youtube?: string | null;
    tiktok?: string | null;
    linkedin?: string | null;
    website?: string | null;
    messenger?: string | null;
    telegram?: string | null;
    address: string | null;
    trade_license?: string | null;
    business_hours?: string | null;
  };
  slug: string;
}) {
  const { t } = useStoreT();
  const theme = useStoreTheme();
  const f = theme.footer;

  const iconUrl = resolveStoreIcon(store as any);
  const nameLogoUrl = (store as any).name_logo_url
    ? ((store as any).name_logo_url.startsWith("http") || (store as any).name_logo_url.startsWith("/")
        ? (store as any).name_logo_url
        : `/api/img/${(store as any).name_logo_url}`)
    : null;

  const phone = f.phone || store.phone;
  const address = f.address || store.address;
  const email = f.email || store.email || null;
  const businessHours = store.business_hours || null;

  const socialOrder: SocialKey[] = [
    "facebook",
    "instagram",
    "whatsapp",
    "messenger",
    "telegram",
    "youtube",
    "tiktok",
    "linkedin",
    "website",
  ];
  const socials =
    f.social === false
      ? []
      : socialOrder
          .map((key) => {
            const href = socialHref(key, (store as Record<string, any>)[key] ?? "");
            return href ? { key, href, ...SOCIAL_BRANDS[key] } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

  const [emailInput, setEmailInput] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const subscribe = useServerFn(subscribeToStoreOffers);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim() || !store.id) return;
    setSubscribing(true);
    try {
      await subscribe({ data: { store_id: store.id, email: emailInput.trim() } });
      toast.success(t("footer.subscribeSuccess") as string);
      setEmailInput("");
    } catch (err) {
      toast.error((err as Error).message || (t("common.error") as string));
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <footer id="contact" className="mt-4 border-t-4 border-sf-accent bg-sf-footer text-sf-footer-muted sm:mt-6 md:mt-10">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex min-w-0 items-center gap-3">
              {iconUrl && (
                <img
                  src={iconUrl}
                  alt={nameLogoUrl ? "" : store.name}
                  className={
                    theme.header?.logo_shape === "round"
                      ? "h-12 w-12 shrink-0 rounded-full object-cover"
                      : "h-12 w-auto max-w-[220px] shrink-0 object-contain"
                  }
                  loading="lazy"
                />
              )}
              {nameLogoUrl && (
                <img src={nameLogoUrl} alt={store.name} className="h-10 w-auto min-w-0 max-w-[220px] shrink object-contain" loading="lazy" />
              )}
              {!iconUrl && !nameLogoUrl && (
                <span className="text-lg font-bold text-sf-footer-fg">{store.name}</span>
              )}
            </div>
            {store.description && <p className="text-sm leading-relaxed text-sf-footer-muted">{store.description}</p>}
            {address && (
              <p className="flex items-start gap-2 text-sm text-sf-footer-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sf-accent" />
                <span>{address}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {socials.map((s2) => (
                <a
                  key={s2.key}
                  href={s2.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s2.label}
                  title={s2.label}
                  style={{ background: s2.bg }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-200 hover:scale-110"
                >
                  <s2.Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-sf-footer-fg">{t("footer.quickLinks")}</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/store/$slug/about-us" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.aboutUs")}
                </Link>
              </li>
              <li>
                <Link to="/store/$slug/contact-us" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.contactUs")}
                </Link>
              </li>
              <li>
                <Link to="/store/$slug/shop" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.shopAll")}
                </Link>
              </li>
              <li>
                <Link to="/store/$slug/track-order" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.trackOrder")}
                </Link>
              </li>
              <li>
                <Link to="/store/$slug/blogs" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.blogs")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Policies */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-sf-footer-fg">{t("footer.customerPolicies")}</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/store/$slug/privacy-policy" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link to="/store/$slug/terms-conditions" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link to="/store/$slug/return-refund-policy" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.returnRefund")}
                </Link>
              </li>
              <li>
                <Link to="/store/$slug/shipping-policy" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.shippingPolicy")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter & Contact */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-sf-footer-fg">{t("footer.newsletter")}</h3>
            {phone && (
              <p className="flex items-center gap-2 text-sm text-sf-footer-muted">
                <Phone className="h-4 w-4 shrink-0 text-sf-accent" />
                <a href={`tel:${phone}`} className="transition-colors hover:text-sf-accent">
                  {phone}
                </a>
              </p>
            )}
            {email && (
              <p className="flex items-center gap-2 text-sm text-sf-footer-muted">
                <Mail className="h-4 w-4 shrink-0 text-sf-accent" />
                <a href={`mailto:${email}`} className="transition-colors hover:text-sf-accent">
                  {email}
                </a>
              </p>
            )}
            {businessHours && (
              <p className="flex items-start gap-2 text-sm text-sf-footer-muted">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sf-accent" />
                <span>{businessHours}</span>
              </p>
            )}
            <form onSubmit={handleSubscribe} className="flex gap-2 pt-1">
              <Input
                type="email"
                required
                placeholder={t("footer.subscribePlaceholder") as string}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="h-10 flex-1 border-sf-footer-line bg-sf-card text-sm text-sf-ink placeholder:text-sf-footer-muted focus-visible:ring-sf-accent"
              />
              <Button type="submit" disabled={subscribing} size="sm" className="h-10 px-4 bg-sf-accent hover:bg-sf-accent-hover text-white">
                {subscribing ? t("common.saving") : t("footer.join")}
              </Button>
            </form>
          </div>
        </div>

      </div>

      {/* Bottom Bar */}
      {f.copyright !== false && (
        <div className="border-t border-sf-footer-line bg-sf-secondary text-sf-on-secondary">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-5 text-center text-xs text-sf-on-secondary/80 md:flex-row md:text-left md:px-8">
            <p>
              © {new Date().getFullYear()} {store.name}. {t("footer.copyright")}
            </p>
            {store.trade_license && (
              <p>
                {t("footer.tradeLicense")}: {store.trade_license}
              </p>
            )}
          </div>
        </div>
      )}
    </footer>
  );
}
