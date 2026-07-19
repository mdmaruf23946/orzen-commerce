import { createFileRoute, Link, Outlet, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShoppingCart, Search, Phone, MessageCircle, Facebook, Menu, X, Mail, User, LogOut } from "lucide-react";
import { getStoreBySlug } from "@/lib/storefront.functions";
import { getStoreAgentPublic } from "@/lib/ai.functions";
import { cartCount } from "@/lib/cart";
import { StoreUIProvider, useStoreUI } from "@/lib/store-ui";
import { AIChatLauncher } from "@/components/storefront/AIChatLauncher";
import { useCustomerSession } from "@/lib/customer-session";


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
    const links: any[] = [];
    if (seo.favicon_url) links.push({ rel: "icon", href: seo.favicon_url });
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
  if (!store) return null;
  const s: any = store;
  const theme = s.theme ?? {};
  const radius = typeof theme.radius === "number" ? `${theme.radius}px` : "0.5rem";

  const themeVars = {
    ["--primary" as string]: store.primary_color || "#0f172a",
    ["--store-header-bg" as string]: store.header_color || "#ffffff",
    ["--store-title-bar-bg" as string]: store.title_bar_color || store.primary_color || "#0f172a",
    ["--store-footer-bg" as string]: store.footer_color || "#0f172a",
    ["--store-btn-bg" as string]: store.button_color || store.primary_color || "#0f172a",
    ["--radius" as string]: radius,
  } as React.CSSProperties;

  return (
    <StoreUIProvider>
      <TrackingScripts marketing={s.marketing} />
      <div className="min-h-screen bg-background" style={themeVars}>
        <StoreHeader slug={slug} name={store.name} logoUrl={store.logo_url} />
        <main className="mx-auto max-w-5xl px-4 pb-12 pt-4 sm:px-6">
          <Outlet />
        </main>
        <StoreFooter store={store} />
        {agent && (
          <AIChatLauncher
            slug={slug}
            agentName={agent.agent_name}
            welcome={agent.welcome_message}
            messengerUrl={toMessengerUrl(store.facebook)}
          />
        )}
      </div>
    </StoreUIProvider>
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


function TrackingScripts({ marketing }: { marketing: any }) {
  const m = marketing ?? {};
  const en = m.enabled ?? {};
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
    if (m.fb_pixel_id && en.fb_pixel !== false) {
      add(
        "",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${m.fb_pixel_id}');fbq('track','PageView');`,
      );
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
  }, [m.gtm_id, m.ga4_id, m.fb_pixel_id, m.tiktok_pixel_id, en.gtm, en.ga4, en.fb_pixel, en.tiktok]);
  return null;
}

function StoreHeader({
  slug,
  name,
  logoUrl,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
}) {
  const [count, setCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { query, setQuery } = useStoreUI();
  const { customer, signOut } = useCustomerSession(slug);


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
    <header
      className="sticky top-0 z-30 border-b border-black/5 backdrop-blur"
      style={{ backgroundColor: "var(--store-header-bg, rgba(255,255,255,0.9))" }}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-14 items-center gap-3">
          <Link to="/store/$slug" params={{ slug }} className="flex min-w-0 items-center gap-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
                loading="eager"
              />
            ) : (
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "var(--primary)" }}
              >
                {name.charAt(0)}
              </div>
            )}
            <span className="truncate text-sm font-semibold sm:text-base">{name}</span>
          </Link>

          <div className="relative ml-auto hidden flex-1 max-w-sm sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="h-9 w-full rounded-full border bg-background pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <Link
            to="/store/$slug/cart"
            params={{ slug }}
            className="relative ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 sm:ml-0"
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
              className="hidden h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium hover:bg-neutral-100 sm:flex"
              aria-label="Account"
            >
              <User className="h-4 w-4" />
              <span className="max-w-[8rem] truncate">{customer.full_name.split(" ")[0]}</span>
            </Link>
          ) : (
            <Link
              to="/store/$slug/auth/login"
              params={{ slug }}
              className="hidden h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium hover:bg-neutral-100 sm:flex"
            >
              <User className="h-4 w-4" /> Sign in
            </Link>
          )}


          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 sm:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div className="pb-2 sm:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="h-9 w-full rounded-full border bg-background pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {menuOpen && (
          <div className="border-t py-2 text-sm sm:hidden">
            <Link
              to="/store/$slug"
              params={{ slug }}
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 hover:bg-neutral-100"
            >
              Home
            </Link>
            <Link
              to="/store/$slug/cart"
              params={{ slug }}
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 hover:bg-neutral-100"
            >
              Cart {count > 0 && <span className="ml-1 text-xs text-neutral-500">({count})</span>}
            </Link>
            <a href="#contact" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 hover:bg-neutral-100">
              Contact
            </a>
            <a href="#policies" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 hover:bg-neutral-100">
              Policies
            </a>
          </div>
        )}
      </div>
    </header>
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
    facebook: string | null;
    address: string | null;
    seo?: any;
  };
}) {
  const email = (store.seo && (store.seo.contact_email || store.seo.email)) || null;
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
          {store.address && (
            <p className="text-xs text-white/60">{store.address}</p>
          )}
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
          {store.facebook && (
            <a
              href={store.facebook}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-white/80 hover:text-white"
            >
              <Facebook className="h-4 w-4" /> Facebook
            </a>
          )}
        </div>

        <div id="policies" className="space-y-2 text-sm">
          <h3 className="text-sm font-semibold text-white">Quick Links</h3>
          <a href="#privacy" className="block text-white/80 hover:text-white">Privacy Policy</a>
          <a href="#terms" className="block text-white/80 hover:text-white">Terms &amp; Conditions</a>
          <a href="#returns" className="block text-white/80 hover:text-white">Return Policy</a>
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

