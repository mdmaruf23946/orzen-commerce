import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home,
  Package,
  Heart,
  ShoppingCart,
  Phone,
  Mail,
  Shield,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
  LogIn,
  LayoutGrid,
  MessageCircle,
  Truck,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useStoreUI } from "@/lib/store-ui";
import { useCustomerSession } from "@/lib/customer-session";
import { useStoreT } from "@/lib/store-i18n";
import { StoreLangSwitch } from "@/components/storefront/StoreLangSwitch";

type Category = { id: string; name: string; parent_id: string | null };

function toDisplayUrl(v?: string | null): string | null {
  if (!v) return null;
  if (v.startsWith("http") || v.startsWith("/")) return v;
  return `/api/img/${v}`;
}

export function MobileDrawer({
  open,
  onOpenChange,
  slug,
  storeName,
  logoUrl,
  nameLogoUrl,
  phone,
  email,
  whatsapp,
  categories,
  productCounts,
  totalProducts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  storeName: string;
  logoUrl: string | null;
  nameLogoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  categories: Category[];
  productCounts: Map<string, number>;
  totalProducts: number;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const { activeMainId, activeSubId, selectMain, selectSub } = useStoreUI();
  const { customer, signOut } = useCustomerSession(slug);
  const { t } = useStoreT();

  const nameLogo = toDisplayUrl(nameLogoUrl);
  const waHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`
    : null;

  const mains = categories.filter((c) => !c.parent_id);
  const subsByParent = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.parent_id) {
      if (!subsByParent.has(c.parent_id)) subsByParent.set(c.parent_id, []);
      subsByParent.get(c.parent_id)!.push(c);
    }
  }

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      document
        .getElementById("all-products")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function pickMain(id: string | null) {
    selectMain(id, id ? "header" : null);
    close();
  }
  function pickSub(mainId: string, subId: string) {
    if (activeMainId !== mainId) selectMain(mainId, "header");
    selectSub(subId);
    close();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[86%] max-w-sm border-sf-line bg-sf-card p-0 [&>button]:hidden"
      >
        <div className="flex h-full flex-col bg-sf-card">
          {/* Brand header — same logo as storefront header & footer */}
          <div className="flex items-center gap-3 border-b border-sf-line bg-sf-surface p-4">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sf-accent text-sm font-bold text-sf-on-accent">
                {storeName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {nameLogo ? (
                <img
                  src={nameLogo}
                  alt={storeName}
                  className="h-7 w-auto max-w-[160px] object-contain"
                />
              ) : (
                <div className="truncate text-base font-bold text-sf-ink">{storeName}</div>
              )}
              {customer ? (
                <div className="truncate text-xs text-sf-muted">
                  {t("nav.greeting")}, {customer.full_name.split(" ")[0]}
                </div>
              ) : (
                <div className="text-xs text-sf-muted">{t("nav.welcome")}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("common.close")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sf-muted hover:bg-sf-line"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            {/* Primary links */}
            <NavItem to="/store/$slug" params={{ slug }} icon={Home} label={t("nav.home")} onClick={() => onOpenChange(false)} />

            {/* Categories accordion */}
            <div className="mt-1">
              <SectionLabel>{t("nav.categories")}</SectionLabel>
              <button
                type="button"
                onClick={() => pickMain(null)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-sf-accent-soft ${
                  activeMainId === null ? "bg-sf-accent-soft font-semibold text-sf-ink" : "text-sf-text"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LayoutGrid className="h-4 w-4 text-sf-accent" />
                  {t("nav.allProducts")}
                </span>
                <span className="text-[11px] font-medium text-sf-muted">{totalProducts}</span>
              </button>
              {mains.map((m) => {
                const subs = subsByParent.get(m.id) ?? [];
                const expanded = openCat === m.id;
                const isActive = activeMainId === m.id;
                return (
                  <div key={m.id} className="mt-0.5">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => pickMain(m.id)}
                        className={`flex flex-1 items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-sf-accent-soft ${
                          isActive ? "bg-sf-accent-soft font-semibold text-sf-ink" : "text-sf-text"
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className="text-[11px] font-medium text-sf-muted">
                          {productCounts.get(m.id) ?? 0}
                        </span>
                      </button>
                      {subs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenCat(expanded ? null : m.id)}
                          aria-expanded={expanded}
                          aria-label={expanded ? "Collapse" : "Expand"}
                          className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sf-accent hover:bg-sf-accent-soft"
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                    {expanded && subs.length > 0 && (
                      <div className="ml-6 mt-1 space-y-0.5 border-l border-sf-line pl-2 animate-accordion-down">
                        {subs.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickSub(m.id, s.id)}
                            className={`block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-sf-accent-soft ${
                              activeSubId === s.id
                                ? "font-semibold text-sf-accent"
                                : "text-sf-muted"
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Shop */}
            <div className="mt-3">
              <SectionLabel>{t("nav.shop")}</SectionLabel>
              <NavItem to="/store/$slug/cart" params={{ slug }} icon={ShoppingCart} label={t("nav.cart")} onClick={() => onOpenChange(false)} />
              <NavItem to="/store/$slug/account" params={{ slug }} search={{ tab: "orders" }} icon={Package} label={t("nav.orders")} onClick={() => onOpenChange(false)} />
              <NavItem to="/store/$slug/account" params={{ slug }} search={{ tab: "wishlist" }} icon={Heart} label={t("nav.wishlist")} onClick={() => onOpenChange(false)} />
              <NavItem to="/store/$slug/track-order" params={{ slug }} icon={Truck} label={t("footer.trackOrder")} onClick={() => onOpenChange(false)} />
            </div>

            {/* Help — merchant-managed contact + policies */}
            <div className="mt-3">
              <SectionLabel>{t("nav.help")}</SectionLabel>
              {phone && (
                <NavExtLink href={`tel:${phone}`} icon={Phone} label={phone} onClick={() => onOpenChange(false)} />
              )}
              {waHref && (
                <NavExtLink href={waHref} icon={MessageCircle} label="WhatsApp" onClick={() => onOpenChange(false)} external />
              )}
              {email && (
                <NavExtLink href={`mailto:${email}`} icon={Mail} label={email} onClick={() => onOpenChange(false)} />
              )}
              <NavItem to="/store/$slug/privacy-policy" params={{ slug }} icon={Shield} label={t("footer.privacy")} onClick={() => onOpenChange(false)} />
              <NavItem to="/store/$slug/terms-conditions" params={{ slug }} icon={Shield} label={t("footer.terms")} onClick={() => onOpenChange(false)} />
              <NavItem to="/store/$slug/return-refund-policy" params={{ slug }} icon={Shield} label={t("footer.returnPolicy")} onClick={() => onOpenChange(false)} />
              <NavItem to="/store/$slug/shipping-policy" params={{ slug }} icon={Shield} label={t("footer.shippingPolicy")} onClick={() => onOpenChange(false)} />
            </div>
          </div>

          {/* Account footer */}
          <div className="border-t border-sf-line bg-sf-surface p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-sf-muted">
                {t("nav.language")}
              </span>
              <StoreLangSwitch />
            </div>
            {customer ? (
              <div className="space-y-1">
                <NavItem
                  to="/store/$slug/account"
                  params={{ slug }}
                  icon={User}
                  label={t("nav.myAccount")}
                  onClick={() => onOpenChange(false)}
                />
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-sf-accent transition-colors hover:bg-sf-accent/10"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.signOut")}
                </button>
              </div>
            ) : (
              <Link
                to="/store/$slug/auth/login"
                params={{ slug }}
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-sf-accent px-3 py-2.5 text-sm font-semibold text-sf-on-accent shadow-sm"
              >
                <LogIn className="h-4 w-4" />
                {t("nav.signIn")}
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-sf-muted">
      {children}
    </div>
  );
}

function NavItem({
  to,
  params,
  search,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  params?: any;
  search?: any;
  icon: any;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to as any}
      params={params}
      search={search}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-sf-text transition-colors hover:bg-sf-accent-soft"
    >
      <Icon className="h-4 w-4 shrink-0 text-sf-accent" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavExtLink({
  href,
  icon: Icon,
  label,
  onClick,
  external,
}: {
  href: string;
  icon: any;
  label: string;
  onClick?: () => void;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-sf-text transition-colors hover:bg-sf-accent-soft"
    >
      <Icon className="h-4 w-4 shrink-0 text-sf-accent" />
      <span className="truncate">{label}</span>
    </a>
  );
}
