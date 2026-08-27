import { createFileRoute, Link, Outlet, notFound, useRouterState } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingCart, Menu, User, ChevronDown } from "lucide-react";
import { getStoreBySlug, listStoreCategories, listStoreProducts } from "@/lib/storefront.functions";
import { getRequestOrigin } from "@/lib/seo.functions";
import {
  resolveStoreSeo,
  storeHeadMeta,
  jsonLdScript,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";
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
import { StoreLangProvider, useStoreT } from "@/lib/store-i18n";
import { StoreLangSwitch } from "@/components/storefront/StoreLangSwitch";

import { AIChatLauncher } from "@/components/storefront/AIChatLauncher";
import { useCustomerSession } from "@/lib/customer-session";
import { SearchBar } from "@/components/storefront/SearchBar";
import { MobileDrawer } from "@/components/storefront/MobileDrawer";
import { BottomNav } from "@/components/storefront/BottomNav";
import { StoreBranding } from "@/components/storefront/StoreBranding";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { GlobalHeaderBanner } from "@/components/storefront/GlobalHeaderBanner";
import { resolveStoreIcon, resolveStoreFavicon } from "@/lib/store-icon";
import { useRouteErrorTracking } from "@/hooks/use-error-tracking";

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
    let origin = "";
    try {
      origin = await getRequestOrigin();
    } catch {
      /* ignore */
    }
    return { store, origin };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const s: any = loaderData.store;
    const origin: string = loaderData.origin || "";
    const r = resolveStoreSeo(s, { origin });
    const meta = storeHeadMeta(r);
    const links: any[] = [];
    if (r.canonical) links.push({ rel: "canonical", href: r.canonical });
    if (r.favicon) {
      links.push({ rel: "icon", href: r.favicon });
      links.push({ rel: "apple-touch-icon", href: r.favicon });
    }
    return {
      meta,
      links,
      scripts: [jsonLdScript([organizationJsonLd(s, r), websiteJsonLd(s, r)])],
    };
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
  // Real-time runtime error logging for every Store Panel page.
  useRouteErrorTracking("storefront");
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
  // Product pages render their own fixed buy bar; two fixed bars would stack.
  const isProductPage = /\/product\//.test(pathname);
  // The preview iframe must show the footer too — it is customisable.
  const showChrome = !isAccount;

  return (
    <StoreThemeProvider theme={resolved ?? DEFAULT_THEME}>
    <StoreLangProvider
      storeId={store.id}
      defaultLang={s.storefront_default_lang ?? "en"}
      switcherEnabled={s.storefront_lang_switcher !== false}
    >
    <StoreUIProvider>
      <StoreBranding

        name={store.name}
        iconUrl={resolveStoreIcon(s)}
        faviconUrl={resolveStoreFavicon(s)}
        themeColor={s.primary_color ?? null}
      />
      {!isPreview && <TrackingScripts marketing={s.marketing} slug={slug} />}
      {resolved && <ThemeStyle theme={resolved} />}
      <div
        className={`min-h-screen bg-background ${resolved ? THEME_SCOPE : ""}`}
        style={themeVars}
      >

        <StoreHeader
          slug={slug}
          storeId={store.id}
          name={store.name}
          logoUrl={resolveStoreIcon(store as any)}
          nameLogoUrl={(store as any).name_logo_url ?? null}
          showSearch={!isAccount && !isCheckoutFlow}
        />
        <main
          className="mx-auto px-4 pb-24 pt-0 sm:pt-4 sm:px-6 md:pb-12"
          style={{ maxWidth: resolved ? "var(--store-container)" : undefined }}
        >
          <Outlet />
        </main>
        {showChrome && <StoreFooter store={store} slug={slug} />}
        {showChrome && !isPreview && agent && (
          <AIChatLauncher
            slug={slug}
            agentName={agent.agent_name}
            welcome={agent.welcome_message}
            messengerUrl={toMessengerUrl(store.facebook)}
          />
        )}
        {!isPreview && !isProductPage && <BottomNav slug={slug} whatsapp={store.whatsapp} />}
      </div>

    </StoreUIProvider>
    </StoreLangProvider>
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
  const g = m.google ?? {};
  const tt = m.tiktok ?? {};
  const slugForInit = slug;

  // Namespaced config wins; legacy top-level ids stay supported.
  const gtmId = (g.gtm_enabled !== false && (g.gtm_id || (g.gtm_id === undefined ? m.gtm_id : ""))) || "";
  const ga4Id = (g.ga4_enabled !== false && (g.ga4_id || (g.ga4_id === undefined ? m.ga4_id : ""))) || "";
  const adsId = (g.ads_enabled ? g.ads_conversion_id : "") || "";
  const ttPixel = (tt.pixel_enabled !== false && (tt.pixel_id || (tt.pixel_id === undefined ? m.tiktok_pixel_id : ""))) || "";
  const ttServer = !!tt.events_api_enabled;
  const ga4Server = !!(g.ga4_enabled && g.ga4_api_secret);

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
    const fbOn = !!m.fb_pixel_id && m.fb_pixel_enabled !== false && en.fb_pixel !== false;
    const gtmOn = !!gtmId && en.gtm !== false;
    const ga4On = !!ga4Id && en.ga4 !== false;
    const ttOn = !!ttPixel && en.tiktok !== false;

    (window as any).__trackInit = {
      slug: slugForInit,
      fbPixel: fbOn,
      ga4: ga4On,
      ga4Server,
      ads: adsId ? { id: adsId, label: g.ads_conversion_label || "", purchase: g.ads_purchase_tracking !== false } : null,
      tiktokPixel: ttOn,
      tiktokServer: ttServer,
    };

    if (gtmOn) {
      add(
        "",
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
      );
    }
    if (ga4On || adsId) {
      const bootId = ga4On ? ga4Id : adsId;
      add(`https://www.googletagmanager.com/gtag/js?id=${bootId}`);
      add(
        "",
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${ga4On ? `gtag('config','${ga4Id}');` : ""}${adsId ? `gtag('config','${adsId}');` : ""}`,
      );
    }
    if (fbOn) {
      (window as any).__fbInit = { slug: slugForInit, pixelId: m.fb_pixel_id };
      add(
        "",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${m.fb_pixel_id}');`,
      );
    }
    if (ttOn) {
      add(
        "",
        `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${ttPixel}');}(window,document,'ttq');`,
      );
    }
    if (fbOn || ga4On || ga4Server || ttOn || ttServer) {
      import("@/lib/fb-track").then(({ track }) => track("PageView"));
    }
    return () => {
      for (const s of added) s.remove();
    };
  }, [
    gtmId,
    ga4Id,
    adsId,
    ga4Server,
    ttPixel,
    ttServer,
    g.ads_conversion_label,
    g.ads_purchase_tracking,
    m.fb_pixel_id,
    m.fb_pixel_enabled,
    en.gtm,
    en.ga4,
    en.fb_pixel,
    en.tiktok,
    slugForInit,
  ]);
  return null;
}


function StoreHeader({
  slug,
  storeId,
  name,
  logoUrl,
  nameLogoUrl,
  showSearch,
}: {
  slug: string;
  storeId: string;
  name: string;
  logoUrl: string | null;
  nameLogoUrl?: string | null;
  showSearch: boolean;
}) {
  const [count, setCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener("store-open-menu", open);
    return () => window.removeEventListener("store-open-menu", open);
  }, []);
  const { customer } = useCustomerSession(slug);
  const theme = useStoreTheme();
  const { t } = useStoreT();


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

  const mainCategories = useMemo(
    () => (categories as any[]).filter((c) => !c.parent_id),
    [categories],
  );

  return (
    <>
      <div className={`${theme.header.sticky ? "sticky top-0" : ""} z-40 bg-background`}>
      <header
        className={`border-b border-black/5 backdrop-blur-md`}
        style={{
          backgroundColor: theme.header.transparent
            ? "transparent"
            : "var(--store-header-bg, rgba(255,255,255,0.9))",
        }}
      >

        <div className="mx-auto px-3 sm:px-6" style={{ maxWidth: "var(--store-container, 64rem)" }}>
          {/* Mobile compact header */}

          <div className="flex h-12 items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100"
              aria-label={t("nav.openMenu")}
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
              {nameLogoUrl ? (
                <img
                  src={nameLogoUrl}
                  alt={name}
                  className="h-7 max-h-7 w-auto max-w-[55vw] shrink object-contain"
                  loading="eager"
                />
              ) : (
                <span className="truncate text-sm font-semibold text-neutral-900">{name}</span>
              )}
            </Link>

            {theme.header.cart && (
            <Link
              to="/store/$slug/cart"
              params={{ slug }}
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-neutral-100"
              aria-label={t("nav.cart")}
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
            )}

            {theme.header.account && (
            <Link
              to={customer ? "/store/$slug/account" : "/store/$slug/auth/login"}
              params={{ slug }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-neutral-100"
              aria-label={customer ? t("nav.account") : t("nav.signIn")}
            >
              <User className="h-5 w-5 text-neutral-700" />
            </Link>
            )}

          </div>

          {/* Desktop header */}
          <div
            className="hidden items-center gap-4 md:flex"
            style={{ height: "var(--store-header-height, 3.5rem)" }}
          >
            <Link
              to="/store/$slug"
              params={{ slug }}
              className={`flex min-w-0 items-center gap-2 ${theme.header.logo_align === "center" ? "mx-auto" : ""}`}
            >
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
              {nameLogoUrl ? (
                <img
                  src={nameLogoUrl}
                  alt={name}
                  className="h-8 max-h-8 w-auto max-w-[220px] object-contain"
                  loading="eager"
                />
              ) : (
                <span className="truncate text-base font-semibold">{name}</span>
              )}
            </Link>

            {theme.header.search && theme.header.search_position !== "hidden" && (
              <div
                className={`w-full max-w-md ${theme.header.search_position === "center" ? "mx-auto" : "ml-auto"}`}
              >
                <SearchBar />
              </div>
            )}

            {theme.header.cart && (
            <Link
              to="/store/$slug/cart"
              params={{ slug }}
              className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-neutral-100 ${
                theme.header.cart_position === "left" ? "order-first" : ""
              }`}
              aria-label={t("nav.cart")}
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
            )}

            <StoreLangSwitch />

            {theme.header.account && (customer ? (
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
                <User className="h-4 w-4" /> {t("nav.signIn")}
              </Link>

            ))}
          </div>
        </div>
      </header>

      {/* Platform-wide banner (Owner-managed) — sits right below the nav bar */}
      <GlobalHeaderBanner />

      {/* Mobile-only search band below header */}
      {showSearch && theme.header.search && theme.header.search_position !== "hidden" && (
        <div className="border-b border-black/5 bg-white/95 px-3 py-1 backdrop-blur md:hidden">
          <SearchBar />
        </div>
      )}

      {/* Text-only category bar, anchored inside the sticky header frame */}
      {showSearch && mainCategories.length > 0 && (
        <HeaderCategoryBar
          mains={mainCategories as any}
          categories={categories as any}
          counts={countsByMain}
          totalCount={(products as any[]).length}
        />
      )}
      </div>




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

function HeaderCategoryBar({
  mains,
  categories,
  counts,
  totalCount,
}: {
  mains: { id: string; name: string }[];
  categories: any[];
  counts: Map<string, number>;
  totalCount: number;
}) {
  const { activeMainId, activeSubId, selectMain, selectSub } = useStoreUI();
  const { t } = useStoreT();
  const [openId, setOpenId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subsByParent = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const c of categories) {
      const pid = c.parent_id ?? null;
      if (pid) {
        if (!m.has(pid)) m.set(pid, []);
        m.get(pid)!.push(c);
      }
    }
    return m;
  }, [categories]);

  const open = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpenId(id);
  };
  const closeSoon = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpenId(null), 180);
  };

  const itemBase =
    "flex items-center gap-0.5 px-3 py-1.5 text-[13px] font-medium transition-colors";
  const inactiveItem =
    "text-gray-600 hover:text-orange-600 hover:bg-white/60";
  const activeItem =
    "bg-white text-orange-600 shadow-sm";

  return (
    <nav className="hidden md:block border-b border-black/5">
      <div
        className="mx-auto px-3 py-2 sm:px-6"
        style={{ maxWidth: "var(--store-container, 64rem)" }}
      >
        {/* একই Unified Structure — সব Tax ভিত্তিক Category একই container-এ */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-orange-100/40 bg-orange-50/70 p-1.5 backdrop-blur">
          <button
            type="button"
            onClick={() => selectMain(null, "header")}
            className={`${itemBase} rounded-xl ${activeMainId === null ? activeItem : inactiveItem}`}
          >
            {t("common.all")} ({totalCount})
          </button>
          {mains.map((c) => {
            const active = activeMainId === c.id;
            const subs = subsByParent.get(c.id) ?? [];
            const hasSubs = subs.length > 0;
            const isOpen = openId === c.id;
            return (
              <div
                key={c.id}
                className="relative"
                onMouseEnter={() => hasSubs && open(c.id)}
                onMouseLeave={closeSoon}
              >
                <button
                  type="button"
                  onClick={() => {
                    selectMain(c.id, "header");
                    if (hasSubs) open(c.id);
                  }}
                  onMouseEnter={() => hasSubs && open(c.id)}
                  className={`${itemBase} rounded-xl ${active ? activeItem : inactiveItem}`}
                >
                  {c.name} ({counts.get(c.id) ?? 0})
                  {hasSubs && (
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
                {hasSubs && isOpen && (
                  <div
                    className="absolute left-0 top-full z-50 mt-1.5 min-w-[12rem] rounded-xl border border-neutral-100 bg-white p-1.5 shadow-lg"
                    onMouseEnter={() => open(c.id)}
                    onMouseLeave={closeSoon}
                  >
                    {subs.map((s: any) => {
                      const subActive = activeSubId === s.id && active;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            selectSub(s.id);
                            setOpenId(null);
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            subActive
                              ? "bg-orange-50 font-medium text-orange-700"
                              : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}


