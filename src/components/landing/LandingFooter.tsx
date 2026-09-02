// Public landing page footer — fully data-driven, theme-token styled.
// Contact/social values come from the Merchant Panel store record, with
// per-page overrides from the Footer editor. Empty values never render.
import { Phone, Mail, MapPin, Clock, Globe } from "lucide-react";
import { resolveSocials } from "@/lib/landing-social";
import { STORE_PAGES } from "@/lib/store-pages";
import { lpImage, type LandingContent } from "@/lib/landing-builder";

export type FooterStore = {
  name?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  business_hours?: string | null;
  trade_license?: string | null;
  [k: string]: unknown;
};

type Props = {
  footer: LandingContent["footer"];
  store: FooterStore | null | undefined;
  storePages?: { key: string; title: string }[];
  storeUrl?: string;
  fallbackName: string;
};

function s(v: unknown) {
  return String(v ?? "").trim();
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-wide" style={{ color: "var(--lp-text)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function LandingFooter({ footer, store, storePages = [], storeUrl = "", fallbackName }: Props) {
  const name = s(footer.storeName) || s(store?.name) || fallbackName;
  const description = s(footer.text) || s(store?.description);
  const icon = s(footer.iconLogo);
  const nameLogo = s(footer.nameLogo);

  const phone = s(footer.phone) || s(store?.phone);
  const email = s(footer.email) || s(store?.email);
  const address = s(footer.address) || s(store?.address);
  const hours = s(footer.hours) || s(store?.business_hours);
  const whatsapp = s((footer as any).whatsapp) || s(store?.whatsapp);
  const website = s((footer as any).website) || s(store?.website);

  const socials = resolveSocials(footer as any, (store ?? {}) as any);

  const links = footer.links.filter((l) => s(l.label) && s(l.url));

  const pageDefs = new Map(STORE_PAGES.map((p) => [p.key, p]));
  const pages = storeUrl
    ? storePages
        .filter((p) => pageDefs.has(p.key))
        .map((p) => ({
          ...p,
          group: pageDefs.get(p.key)!.group,
          title: p.title || pageDefs.get(p.key)!.label,
          href: `${storeUrl.replace(/\/$/, "")}/${p.key}`,
        }))
    : [];
  const quickPages = pages.filter((p) => p.group === "quick");
  const policyPages = pages.filter((p) => p.group === "policy");

  const contactRows: { icon: typeof Phone; label: string; href?: string }[] = [];
  if (phone) contactRows.push({ icon: Phone, label: phone, href: `tel:${phone.replace(/\s+/g, "")}` });
  if (whatsapp)
    contactRows.push({
      icon: Phone,
      label: whatsapp,
      href: /^https?:\/\//i.test(whatsapp) ? whatsapp : `https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`,
    });
  if (email) contactRows.push({ icon: Mail, label: email, href: `mailto:${email}` });
  if (website)
    contactRows.push({
      icon: Globe,
      label: website.replace(/^https?:\/\//i, ""),
      href: /^https?:\/\//i.test(website) ? website : `https://${website}`,
    });
  if (address) contactRows.push({ icon: MapPin, label: address });
  if (hours) contactRows.push({ icon: Clock, label: hours });

  const columns: React.ReactNode[] = [];

  if (contactRows.length || s(footer.contactText)) {
    columns.push(
      <Column key="contact" title="Contact">
        {s(footer.contactText) && (
          <p className="text-sm" style={{ color: "var(--lp-muted)" }}>{footer.contactText}</p>
        )}
        <ul className="space-y-2.5">
          {contactRows.map((row, i) => {
            const Icon = row.icon;
            const body = (
              <span className="whitespace-pre-line break-words">{row.label}</span>
            );
            return (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--lp-muted)" }}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--lp-primary)" }} />
                {row.href ? (
                  <a
                    href={row.href}
                    target={row.href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer noopener"
                    className="transition-colors hover:opacity-80"
                  >
                    {body}
                  </a>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </Column>,
    );
  }

  if (links.length || quickPages.length) {
    columns.push(
      <Column key="quick" title="Quick Links">
        <ul className="space-y-2 text-sm" style={{ color: "var(--lp-muted)" }}>
          {links.map((l, i) => (
            <li key={`l${i}`}>
              <a href={l.url} target="_blank" rel="noreferrer noopener" className="transition-colors hover:opacity-80">
                {l.label}
              </a>
            </li>
          ))}
          {quickPages.map((p) => (
            <li key={p.key}>
              <a href={p.href} target="_blank" rel="noreferrer noopener" className="transition-colors hover:opacity-80">
                {p.title}
              </a>
            </li>
          ))}
        </ul>
      </Column>,
    );
  }

  if (policyPages.length) {
    columns.push(
      <Column key="policies" title="Policies">
        <ul className="space-y-2 text-sm" style={{ color: "var(--lp-muted)" }}>
          {policyPages.map((p) => (
            <li key={p.key}>
              <a href={p.href} target="_blank" rel="noreferrer noopener" className="transition-colors hover:opacity-80">
                {p.title}
              </a>
            </li>
          ))}
        </ul>
      </Column>,
    );
  }

  const gridCols =
    columns.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-4" : columns.length === 2 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";

  return (
    <footer
      data-lp-section="footer"
      className="px-4 pt-12 pb-6"
      style={{ background: "var(--lp-surface)", color: "var(--lp-text)", borderTop: "1px solid var(--lp-border)" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className={`grid gap-10 ${gridCols}`}>
          {/* Brand */}
          <div className="space-y-4">
            {(icon || nameLogo) && (
              <div className="flex items-center gap-3">
                {icon && <img src={lpImage(icon)} alt="" className="h-11 w-11 object-contain" loading="lazy" />}
                {nameLogo && (
                  <img
                    src={lpImage(nameLogo)}
                    alt={name}
                    className="h-9 w-auto max-w-[200px] object-contain"
                    loading="lazy"
                  />
                )}
              </div>
            )}
            {!nameLogo && <div className="text-lg font-bold">{name}</div>}
            {description && (
              <p className="max-w-sm text-sm leading-relaxed" style={{ color: "var(--lp-muted)" }}>
                {description}
              </p>
            )}
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {socials.map((soc) => {
                  const Glyph = soc.Glyph;
                  return (
                    <a
                      key={soc.key}
                      href={soc.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={soc.label}
                      title={soc.label}
                      className="lp-social flex h-9 w-9 items-center justify-center rounded-full transition-all hover:-translate-y-0.5"
                      style={{
                        border: "1px solid var(--lp-border)",
                        color: "var(--lp-text)",
                        // @ts-expect-error custom property
                        "--brand": soc.color,
                      }}
                    >
                      <Glyph className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {columns}
        </div>

        <div
          className="mt-10 flex flex-col items-center justify-between gap-2 pt-5 text-center text-xs sm:flex-row sm:text-left"
          style={{ borderTop: "1px solid var(--lp-border)", color: "var(--lp-muted)" }}
        >
          <p>{s(footer.copyright) || `© ${new Date().getFullYear()} ${name}. All rights reserved.`}</p>
          {s(store?.trade_license) && <p>Trade License: {s(store?.trade_license)}</p>}
        </div>
      </div>

      <style>{`.lp-social:hover{background:var(--brand);border-color:var(--brand);color:#fff}`}</style>
    </footer>
  );
}
