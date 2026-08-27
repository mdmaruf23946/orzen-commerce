import { useState } from "react";
import {
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useStoreT } from "@/lib/store-i18n";
import { useStoreTheme } from "@/lib/theme/context";
import { subscribeToStoreOffers } from "@/lib/newsletter.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function WhatsAppIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
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
    phone: string | null;
    whatsapp: string | null;
    email?: string | null;
    facebook: string | null;
    instagram?: string | null;
    youtube?: string | null;
    tiktok?: string | null;
    linkedin?: string | null;
    website?: string | null;
    address: string | null;
    trade_license?: string | null;
    business_hours?: string | null;
  };
  slug: string;
}) {
  const { t } = useStoreT();
  const theme = useStoreTheme();
  const f = theme.footer;

  const phone = f.phone || store.phone;
  const address = f.address || store.address;
  const email = f.email || store.email || null;
  const businessHours = store.business_hours || null;

  const socials: { key: string; href: string; label: string; Icon: any }[] = [];
  if (f.social !== false) {
    if (store.facebook)
      socials.push({ key: "facebook", href: store.facebook, label: "Facebook", Icon: Facebook });
    if (store.instagram)
      socials.push({ key: "instagram", href: store.instagram, label: "Instagram", Icon: Instagram });
    if (store.youtube)
      socials.push({ key: "youtube", href: store.youtube, label: "YouTube", Icon: Youtube });
    if (store.tiktok)
      socials.push({ key: "tiktok", href: store.tiktok, label: "TikTok", Icon: MessageCircle });
    if (store.linkedin)
      socials.push({ key: "linkedin", href: store.linkedin, label: "LinkedIn", Icon: MessageCircle });
    if (store.website)
      socials.push({ key: "website", href: store.website, label: "Website", Icon: Send });
  }

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
    <footer id="contact" className="mt-10 border-t-4 border-sf-accent bg-slate-50 text-slate-600">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {store.logo_url ? (
                <img src={store.logo_url} alt="" className="h-11 w-11 rounded-full object-cover" loading="lazy" />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-700">
                  {store.name.charAt(0)}
                </div>
              )}
              <span className="text-lg font-bold text-slate-900">{store.name}</span>
            </div>
            {store.description && <p className="text-sm leading-relaxed text-slate-600">{store.description}</p>}
            {address && (
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sf-accent" />
                <span>{address}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-slate-200/80 bg-slate-200/80 text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-sf-accent hover:text-white hover:shadow-md"
                >
                  <s.Icon className="h-4 w-4" />
                </a>
              ))}
              {store.whatsapp && (
                <a
                  href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="grid h-9 w-9 place-items-center rounded-full border border-slate-200/80 bg-slate-200/80 text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-sf-accent hover:text-white hover:shadow-md"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">{t("footer.quickLinks")}</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/store/$slug" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.aboutUs")}
                </Link>
              </li>
              <li>
                <a href="#contact" className="transition-colors hover:text-sf-accent">
                  {t("footer.contactUs")}
                </a>
              </li>
              <li>
                <Link to="/store/$slug" params={{ slug }} search={{ view: "all" }} className="transition-colors hover:text-sf-accent">
                  {t("footer.shopAll")}
                </Link>
              </li>
              <li>
                <Link to="/store/$slug/account" params={{ slug }} className="transition-colors hover:text-sf-accent">
                  {t("footer.trackOrder")}
                </Link>
              </li>
              <li>
                <span className="cursor-not-allowed text-slate-400">{t("footer.blogs")}</span>
              </li>
            </ul>
          </div>

          {/* Customer Policies */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">{t("footer.customerPolicies")}</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="/privacy-policy" className="transition-colors hover:text-sf-accent">
                  {t("footer.privacy")}
                </a>
              </li>
              <li>
                <a href="/terms" className="transition-colors hover:text-sf-accent">
                  {t("footer.terms")}
                </a>
              </li>
              <li>
                <a href="/refund-policy" className="transition-colors hover:text-sf-accent">
                  {t("footer.returnRefund")}
                </a>
              </li>
              <li>
                <a href="/shipping-policy" className="transition-colors hover:text-sf-accent">
                  {t("footer.shippingPolicy")}
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter & Contact */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">{t("footer.newsletter")}</h3>
            {phone && (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="h-4 w-4 shrink-0 text-sf-accent" />
                <a href={`tel:${phone}`} className="transition-colors hover:text-sf-accent">
                  {phone}
                </a>
              </p>
            )}
            {email && (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="h-4 w-4 shrink-0 text-sf-accent" />
                <a href={`mailto:${email}`} className="transition-colors hover:text-sf-accent">
                  {email}
                </a>
              </p>
            )}
            {businessHours && (
              <p className="flex items-start gap-2 text-sm text-slate-600">
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
                className="h-10 flex-1 border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-500 focus-visible:ring-sf-accent"
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
        <div className="border-t border-slate-200 bg-slate-100">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-5 text-center text-xs text-slate-500 md:flex-row md:text-left md:px-8">
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
