import { createFileRoute, Link, Outlet, notFound, useRouterState } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Phone, MessageCircle, Facebook, Menu, Mail, User } from "lucide-react";
import { getStoreBySlug, listStoreCategories, listStoreProducts } from "@/lib/storefront.functions";
import { DEFAULT_THEME, mergeTheme, themeCssVars } from "@/lib/theme/definition";
import { ThemeStyle, THEME_SCOPE } from "@/lib/theme/ThemeStyle";
import {
  StoreThemeProvider,
  THEME_PREVIEW_PARAM,
  useStoreTheme,
  useThemePreviewListener,
} from "@/lib/theme/context";


import { getStoreAgentPublic } from "@/lib/ai.functions";
import { cartCount } from "@/lib/cart";
import { StoreUIProvider, useStoreUI } from "@/lib/store-ui";
import { AIChatLauncher } from "@/components/storefront/AIChatLauncher";
import { useCustomerSession } from "@/lib/customer-session";
import { SearchBar } from "@/components/storefront/SearchBar";
import { MobileDrawer } from "@/components/storefront/MobileDrawer";
import { BottomNav } from "@/components/storefront/BottomNav";

export const storeQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store", slug],
    queryFn: () => getStoreBySlug({ data: { slug } }),
    staleTime: 5 * 60 * 1000,
  });

const agentQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store", slug, "agent"],
    queryFn: () => getStoreAgentPublic({ data: { slug } }),
    staleTime: 5 * 60 * 1000,
  });

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) throw notFound();
    return { store };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const s: any = loaderData.store;
    const seo = s.seo ?? {};
    const title = seo.title || s.name;
    const description = seo.description || s.description || s.name;
    const meta: any[] = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ];
    if (seo.keywords) meta.push({ name: "keywords", content: seo.keywords });
    if (seo.og_image_url) meta.push({ property: "og:image", content: seo.og_image_url });
    // Prefer per-store favicon → store icon → legacy seo.favicon_url → store logo.
    const useIcon = s.use_icon_as_favicon !== false;
    const favicon = useIcon
      ? (s.favicon_url || s.icon_url || s.custom_favicon_url || seo.favicon_url || s.logo_url)
      : (s.custom_favicon_url || s.favicon_url || s.icon_url || seo.favicon_url || s.logo_url);
    const links: any[] = [];
    if (favicon) {
      links.push({ rel: "icon", href: favicon });
      links.push({ rel: "apple-touch-icon", href: favicon });
    }
    return { meta, links };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Store not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This store doesn't exist or is unavailable.</p>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6">Something went wrong.</div>
  ),
  component: StoreLayout,
});

function StoreLayout() {
  const { slug } = Route.useParams();
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  const { data: agent } = useQuery(agentQuery(slug));
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const isPreview = String(search?.[THEME_PREVIEW_PARAM] ?? "") === "1";
  const previewTheme = useThemePreviewListener(isPreview);
  if (!store) return null;
  const s: any = store;
  const theme = s.theme ?? {};
  const radius = typeof theme.radius === "number" ? `${theme.radius}px` : "0.5rem";

  // Winner-Admin theme (definition) + store's safe customisations (overrides).
  const resolved =
    previewTheme ?? (s.theme_id ? mergeTheme(s.theme_definition, s.theme_overrides) : null);

  const themeVars = (
    resolved
      ? themeCssVars(resolved)
      : {
          ["--primary" as string]: store.primary_color || "#0f172a",
          ["--store-header-bg" as string]: store.header_color || "#ffffff",
          ["--store-title-bar-bg" as string]: store.title_bar_color || store.primary_color || "#0f172a",
          ["--store-footer-bg" as string]: store.footer_color || "#0f172a",
          ["--store-btn-bg" as string]: store.button_color || store.primary_color || "#0f172a",
          ["--radius" as string]: radius,
        }
  ) as React.CSSProperties;


  const isAccount = pathname.includes("/account");
  const isCheckoutFlow = /\/(checkout|cart|order)/.test(pathname);
  const showChrome = !isAccount && !isPreview;

  return (
    <StoreThemeProvider theme={resolved ?? DEFAULT_THEME}>
    <StoreUIProvider>
      <TrackingScripts marketing={s.marketing} slug={slug} />
      <div className="min-h-screen bg-background" style={themeVars}>

        <StoreHeader
          slug={slug}
          storeId={store.id}
          name={store.name}
          logoUrl={(store as any).icon_url || store.logo_url}
          showSearch={!isAccount && !isCheckoutFlow}
        />
        <main
          className="mx-auto px-4 pb-24 pt-4 sm:px-6 md:pb-12"
          style={{ maxWidth: resolved ? "var(--store-container)" : undefined }}
        >
          <Outlet />
        </main>
        {showChrome && <StoreFooter store={store} />}
        {showChrome && agent && (
          <AIChatLauncher
            slug={slug}
            agentName={agent.agent_name}
            welcome={agent.welcome_message}
            messengerUrl={toMessengerUrl(store.facebook)}
          />
        )}
        {!isPreview && <BottomNav slug={slug} />}
      </div>
    </StoreUIProvider>
    </StoreThemeProvider>
  );

}

function toMessengerUrl(fb: string | null): string | null {
  if (!fb) return null;
  const trimmed = fb.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://m.me/") || trimmed.startsWith("https://m.me/")) return trimmed;
  const m = trimmed.match(/facebook\.com\/([^/?#]+)/i);
  if (m) return `https://m.me/${m[1]}`;
  return trimmed;
}

function TrackingScripts({ marketing, slug }: { marketing: any; slug: string }) {
  const m = marketing ?? {};
  const en = m.enabled ?? {};
  const slugForInit = slug;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const added: HTMLScriptElement[] = [];
    const add = (src: string, inline?: string) => {
      const s = document.createElement("script");
      s.async = true;
      if (src) s.src = src;
      if (inline) s.text = inline;
      document.head.appendChild(s);
      added.push(s);
    };
    if (m.gtm_id && en.gtm !== false) {
      add(
        "",
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${m.gtm_id}');`,
      );
    }
    if (m.ga4_id && en.ga4 !== false) {
      add(`https://www.googletagmanager.com/gtag/js?id=${m.ga4_id}`);
      add(
        "",
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${m.ga4_id}');`,
      );
    }
    if (m.fb_pixel_id && m.fb_pixel_enabled !== false && en.fb_pixel !== false) {
      (window as any).__fbInit = { slug: slugForInit, pixelId: m.fb_pixel_id };
      add(
        "",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${m.fb_pixel_id}');`,
      );
      import("@/lib/fb-track").then(({ fbTrack }) => fbTrack("PageView"));
    }
    if (m.tiktok_pixel_id && en.tiktok !== false) {
      add(
        "",
        `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${m.tiktok_pixel_id}');ttq.page();}(window,document,'ttq');`,
      );
    }
    return () => {
      for (const s of added) s.remove();
    };
  }, [m.gtm_id, m.ga4_id, m.fb_pixel_id, m.fb_pixel_enabled, m.tiktok_pixel_id, en.gtm, en.ga4, en.fb_pixel, en.tiktok, slugForInit]);
  return null;
}

function StoreHeader({
  slug,
  storeId,
  name,
  logoUrl,
  showSearch,
}: {
  slug: string;
  storeId: string;
  name: string;
  logoUrl: string | null;
  showSearch: boolean;
}) {
  const [count, setCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { customer } = useCustomerSession(slug);
  const theme = useStoreTheme();


  const { data: categories = [] } = useQuery({
    queryKey: ["categories", storeId],
    queryFn: () => listStoreCategories({ data: { storeId } }),
    staleTime: 5 * 60_000,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => listStoreProducts({ data: { storeId } }),
    staleTime: 5 * 60_000,
  });

  const countsByMain = useMemo(() => {
    const catParentMap = new Map<string, string | null>();
    for (const c of categories as any[]) catParentMap.set(c.id, c.parent_id ?? null);
    const m = new Map<string, number>();
    for (const p of products as any[]) {
      if (!p.category_id) continue;
      const parent = catParentMap.get(p.category_id);
      const mainId = parent ?? p.category_id;
      m.set(mainId, (m.get(mainId) ?? 0) + 1);
    }
    return m;
  }, [products, categories]);

  useEffect(() => {
    const update = () => setCount(cartCount(slug));
    update();
    window.addEventListener("cart-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("cart-changed", update);
      window.removeEventListener("storage", update);
    };
  }, [slug]);

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-black/5 backdrop-blur-md"
        style={{ backgroundColor: "var(--store-header-bg, rgba(255,255,255,0.9))" }}
      >
        <div className="mx-auto max-w-5xl px-3 sm:px-6">
          {/* Mobile compact header */}
          <div className="flex h-12 items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link
              to="/store/$slug"
              params={{ slug }}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5"
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                  loading="eager"
                />
              ) : (
                <div
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  {name.charAt(0)}
                </div>
              )}
              <span className="truncate text-sm font-semibold text-neutral-900">{name}</span>
            </Link>

            <Link
              to="/store/$slug/cart"
              params={{ slug }}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-neutral-100"
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5 text-neutral-700" />
              {count > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  {count}
                </span>
              )}
            </Link>

            <Link
              to={customer ? "/store/$slug/account" : "/store/$slug/auth/login"}
              params={{ slug }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-neutral-100"
              aria-label={customer ? "Account" : "Sign in"}
            >
              <User className="h-5 w-5 text-neutral-700" />
            </Link>
          </div>

          {/* Desktop header */}
          <div className="hidden h-14 items-center gap-4 md:flex">
            <Link to="/store/$slug" params={{ slug }} className="flex min-w-0 items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" loading="eager" />
              ) : (
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  {name.charAt(0)}
                </div>
              )}
              <span className="truncate text-base font-semibold">{name}</span>
            </Link>

            <div className="mx-auto w-full max-w-md">
              <SearchBar />
            </div>

            <Link
              to="/store/$slug/cart"
              params={{ slug }}
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-neutral-100"
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span
                  className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  {count}
                </span>
              )}
            </Link>

            {customer ? (
              <Link
                to="/store/$slug/account"
                params={{ slug }}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-neutral-100"
              >
                <User className="h-4 w-4" />
                <span className="max-w-[8rem] truncate">{customer.full_name.split(" ")[0]}</span>
              </Link>
            ) : (
              <Link
                to="/store/$slug/auth/login"
                params={{ slug }}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-neutral-100"
              >
                <User className="h-4 w-4" /> Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile-only search band below header */}
      {showSearch && (
        <div className="sticky top-12 z-20 border-b border-black/5 bg-white/95 px-3 py-2 backdrop-blur md:hidden">
          <SearchBar />
        </div>
      )}

      <MobileDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        slug={slug}
        storeName={name}
        logoUrl={logoUrl}
        categories={categories as any}
        productCounts={countsByMain}
        totalProducts={(products as any[]).length}
      />
    </>
  );
}

function StoreFooter({
  store,
}: {
  store: {
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
    seo?: any;
  };
}) {
  const email = store.email || (store.seo && (store.seo.contact_email || store.seo.email)) || null;
  const socials: { label: string; href: string; icon: any }[] = [];
  if (store.facebook) socials.push({ label: "Facebook", href: store.facebook, icon: Facebook });
  if (store.instagram) socials.push({ label: "Instagram", href: store.instagram, icon: MessageCircle });
  if (store.youtube) socials.push({ label: "YouTube", href: store.youtube, icon: MessageCircle });
  if (store.tiktok) socials.push({ label: "TikTok", href: store.tiktok, icon: MessageCircle });
  if (store.linkedin) socials.push({ label: "LinkedIn", href: store.linkedin, icon: MessageCircle });
  if (store.website) socials.push({ label: "Website", href: store.website, icon: MessageCircle });
  return (
    <footer
      id="contact"
      className="mt-10 text-white/90"
      style={{ backgroundColor: "var(--store-footer-bg)" }}
    >
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-bold">
                {store.name.charAt(0)}
              </div>
            )}
            <span className="text-base font-semibold text-white">{store.name}</span>
          </div>
          {store.description && (
            <p className="text-sm text-white/70 line-clamp-4">{store.description}</p>
          )}
          {store.address && <p className="text-xs text-white/60">{store.address}</p>}
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="text-sm font-semibold text-white">Contact</h3>
          {store.phone && (
            <a href={`tel:${store.phone}`} className="flex items-center gap-2 text-white/80 hover:text-white">
              <Phone className="h-4 w-4" /> {store.phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="flex items-center gap-2 text-white/80 hover:text-white">
              <Mail className="h-4 w-4" /> {email}
            </a>
          )}
          {store.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-white/80 hover:text-white"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-white/80 hover:text-white"
            >
              <s.icon className="h-4 w-4" /> {s.label}
            </a>
          ))}
        </div>

        <div id="policies" className="space-y-2 text-sm">
          <h3 className="text-sm font-semibold text-white">Quick Links</h3>
          <a href="/privacy-policy" className="block text-white/80 hover:text-white">Privacy Policy</a>
          <a href="/terms" className="block text-white/80 hover:text-white">Terms &amp; Conditions</a>
          <a href="/refund-policy" className="block text-white/80 hover:text-white">Return Policy</a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-white/60 sm:px-6">
          © {new Date().getFullYear()} {store.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
