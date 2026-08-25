import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Facebook, Linkedin, Youtube, Mail, Instagram, Twitter, Phone, MapPin, Send, Globe,
} from "lucide-react";
import { getFooterSettings, FOOTER_FALLBACK, type FooterSettings } from "@/lib/footer.functions";
import { BrandMark } from "@/lib/platform-branding";
import { useLang } from "@/lib/i18n";

const COLUMN_BN: Record<string, string> = {
  product: "প্রোডাক্ট",
  company: "কোম্পানি",
  legal: "লিগ্যাল",
  resources: "রিসোর্স",
  support: "সাপোর্ট",
};

const BRAND: Record<string, { icon: any; color: string; label: string }> = {
  facebook: { icon: Facebook, color: "#1877F2", label: "Facebook" },
  linkedin: { icon: Linkedin, color: "#0A66C2", label: "LinkedIn" },
  youtube: { icon: Youtube, color: "#FF0000", label: "YouTube" },
  instagram: { icon: Instagram, color: "#E4405F", label: "Instagram" },
  twitter: { icon: Twitter, color: "#0F172A", label: "X / Twitter" },
  whatsapp: { icon: Send, color: "#25D366", label: "WhatsApp" },
  telegram: { icon: Send, color: "#229ED9", label: "Telegram" },
  email: { icon: Mail, color: "#6D28D9", label: "Email" },
  phone: { icon: Phone, color: "#059669", label: "Phone" },
  website: { icon: Globe, color: "#0EA5E9", label: "Website" },
};

export function SiteFooter() {
  const { lang, t } = useLang();
  const localizeTitle = (title?: string) =>
    lang === "bn" ? COLUMN_BN[(title ?? "").toLowerCase().trim()] ?? title : title;
  const fetchFooter = useServerFn(getFooterSettings);
  const { data } = useQuery({
    queryKey: ["platform", "footer"],
    queryFn: () => fetchFooter(),
    staleTime: 5 * 60 * 1000,
  });
  const f: FooterSettings = (data as FooterSettings) ?? FOOTER_FALLBACK;
  const contact = f.contact ?? {};
  const legalColumn = f.columns?.find((c) => c.title?.toLowerCase().trim() === "legal");
  const otherColumns = f.columns?.filter((c) => c.title?.toLowerCase().trim() !== "legal") ?? [];

  return (
    <footer id="contact" className="scroll-mt-24 border-t border-[color:var(--orzen-border)] bg-white">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-5 md:gap-8">
          <div className="col-span-2 md:col-span-1">
            <BrandMark placement="footer" fallbackText="ORZEN" className="text-lg font-extrabold tracking-tight" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[color:var(--orzen-muted)]">
              {f.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(f.socials ?? []).map((s, i) => {
                const b = BRAND[s.platform?.toLowerCase()] ?? BRAND.website!;
                const Icon = b.icon;
                return (
                  <a
                    key={`${s.platform}-${i}`}
                    href={s.url || "#"}
                    target={s.url?.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    aria-label={b.label}
                    style={{ color: b.color }}
                    className="group grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--orzen-border)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = b.color;
                      e.currentTarget.style.backgroundColor = `${b.color}14`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "";
                      e.currentTarget.style.backgroundColor = "";
                    }}
                  >
                    <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  </a>
                );
              })}
            </div>
          </div>

          {otherColumns.map((c) => (
            <div key={c.title} className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--orzen-navy)]">{localizeTitle(c.title)}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {(c.links ?? []).map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href || "#"}
                      className="text-[color:var(--orzen-muted)] transition-colors hover:text-[color:var(--orzen-navy)]"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {(contact.email || contact.phone || contact.address) && (
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--orzen-navy)]">{t("footer_contact")}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--orzen-muted)]">
                {contact.email && (
                  <li className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#6D28D9" }} />
                    <a href={`mailto:${contact.email}`} className="truncate hover:text-[color:var(--orzen-navy)]">
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.phone && (
                  <li className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#059669" }} />
                    <a href={`tel:${contact.phone}`} className="truncate hover:text-[color:var(--orzen-navy)]">
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#F97316" }} />
                    <span>{contact.address}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {legalColumn && (
            <div key={legalColumn.title} className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--orzen-navy)]">{localizeTitle(legalColumn.title)}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {(legalColumn.links ?? []).map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href || "#"}
                      className="text-[color:var(--orzen-muted)] transition-colors hover:text-[color:var(--orzen-navy)]"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--orzen-border)] pt-4 text-xs text-[color:var(--orzen-muted)]">
          <p>© {new Date().getFullYear()} ORZEN. {t("footer_rights")}</p>
          <p>{f.bottom_note}</p>
        </div>
      </div>
    </footer>
  );
}
