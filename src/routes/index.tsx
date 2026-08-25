import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import {
  ArrowRight,
  Bot,
  BarChart3,
  Truck,
  MessageCircle,
  Package,
  Tag,
  FileText,
  Search,
  Palette,
  Smartphone,
  Boxes,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  MapPin,
  Wallet,
  Facebook,
  Linkedin,
  Youtube,
  Mail,
  Menu,
  X,
  Check,
  Play,
  Store,
  ShoppingBag,
  User,
  CheckCircle2,
  TrendingUp,
  Users,
  Star,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCountUp, useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";
import { resolveHost } from "@/lib/domains.functions";
import { BrandMark } from "@/lib/platform-branding";

import { LangProvider, useLang } from "@/lib/i18n";
import { FAQ_COPY, FEATURE_COPY, STEP_COPY, WHY_COPY } from "@/lib/landing-copy";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { TestimonialsMarquee } from "@/components/landing/TestimonialsMarquee";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicShowcase, type ShowcaseRow } from "@/lib/showcase.functions";

export const Route = createFileRoute("/")({
  // If the request host is a store subdomain or a verified custom domain,
  // route the visitor directly into the storefront instead of the landing.
  beforeLoad: async () => {
    try {
      const r = await resolveHost();
      if (r?.slug) {
        throw redirect({ to: "/store/$slug", params: { slug: r.slug } });
      }
    } catch (e) {
      // rethrow redirect so router handles it
      if (e && typeof e === "object" && "isRedirect" in (e as any)) throw e;
      // swallow lookup errors — fall through to landing
    }
  },
  head: () => ({
    meta: [{ property: "og:url", content: "https://orzen.top/" }],
    links: [{ rel: "canonical", href: "https://orzen.top/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://orzen.top/#organization",
              name: "ORZEN",
              url: "https://orzen.top/",
              description:
                "All-in-one eCommerce platform for store building, AI sales assistance, messenger automation, courier delivery, analytics and secure payments.",
            },
            {
              "@type": "WebSite",
              "@id": "https://orzen.top/#website",
              name: "ORZEN",
              url: "https://orzen.top/",
              publisher: { "@id": "https://orzen.top/#organization" },
            },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});


/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

function AuthSplash() {
  return (
    <div
      className="min-h-screen bg-background"
      role="status"
      aria-label="Checking your session"
    />
  );
}

function Landing() {
  const navigate = useNavigate();
  // Start unresolved on both the server and browser. This guarantees that the
  // landing DOM is never rendered before the persisted session is checked.
  const [authState, setAuthState] = useState<"loading" | "anon" | "authed">("loading");

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;

    import("@/integrations/supabase/client").then(async ({ supabase }) => {
      // getSession reads the persisted, auto-refreshed session locally and avoids
      // waiting for a network user lookup before redirecting.
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setAuthState("authed");
        navigate({ to: "/admin", replace: true });
        return;
      }
      setAuthState("anon");
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === "SIGNED_IN" && session?.user) {
          setAuthState("authed");
          navigate({ to: "/admin", replace: true });
        }
      });
      unsub = () => sub.subscription.unsubscribe();
    }).catch(() => {
      if (active) setAuthState("anon");
    });

    return () => {
      active = false;
      unsub?.();
    };
  }, [navigate]);

  if (authState === "loading" || authState === "authed") return <AuthSplash />;

  return (
    <LangProvider>
    <div className="min-h-screen bg-white text-[color:var(--orzen-navy)] overflow-x-hidden">
      <Header />
      <main className="pt-16">
        <Hero />
        <TrustBar />
        <Features />
        <AIShowcase />
        <Workflow />
        <DashboardShowcase />
        <WhyOrzen />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
    </LangProvider>
  );
}


/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

const NAV = [
  { key: "nav_features", href: "#features" },
  { key: "nav_ai", href: "#ai" },
  { key: "nav_faq", href: "#faq" },
  { key: "nav_contact", href: "#contact" },
] as const;

function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang();
  return (
    <div
      role="group"
      aria-label={t("lang_label")}
      className={cn(
        "inline-flex items-center rounded-full border border-[color:var(--orzen-border)] bg-white p-0.5",
        className,
      )}
    >
      {(["en", "bn"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            lang === l
              ? "bg-[color:var(--orzen-navy)] text-white"
              : "text-[color:var(--orzen-muted)] hover:text-[color:var(--orzen-navy)]",
          )}
        >
          {l === "en" ? "EN" : "বাংলা"}
        </button>
      ))}
    </div>
  );
}

function Header() {
  const { t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm"
          : "bg-background/60 backdrop-blur-sm border-b border-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 md:px-8">
        <a href="#top" className="flex items-center gap-2">
          <BrandMark
            placement="website_header"
            fallbackText="ORZEN"
            className="text-lg font-extrabold tracking-tight"
          />
        </a>
        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-sm font-medium text-[color:var(--orzen-muted)] hover:text-[color:var(--orzen-navy)] transition-colors"
            >
              {t(n.key)}
            </a>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            to="/auth"
            className="text-sm font-medium text-[color:var(--orzen-navy)] hover:text-[color:var(--orzen-blue)]"
          >
            {t("sign_in")}
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--orzen-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:bg-[color:var(--orzen-blue-600)] transition"
          >
            {t("create_store")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher />
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--orzen-border)]"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden border-t border-[color:var(--orzen-border)] bg-white">
          <div className="px-5 py-4 space-y-1">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--orzen-navy)] hover:bg-[color:var(--orzen-slate-50)]"
              >
                {t(n.key)}
              </a>
            ))}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <Link
                to="/auth"
                className="rounded-lg border border-[color:var(--orzen-border)] px-3 py-2.5 text-center text-sm font-semibold"
              >
                {t("sign_in")}
              </Link>
              <Link
                to="/auth"
                className="rounded-lg bg-[color:var(--orzen-blue)] px-3 py-2.5 text-center text-sm font-semibold text-white"
              >
                {t("create_store")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function LogoMark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--orzen-navy)] text-white">
      <span className="text-sm font-black">O</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */

function Hero() {
  const { t } = useLang();
  return (
    <section id="top" className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.10),transparent)]" />
        <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(17,24,39,0.06),transparent)]" />
      </div>
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-6 pb-10 md:px-8 md:pt-10 md:pb-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-12">
        <div className="orzen-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--orzen-border)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--orzen-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--orzen-success)]" />
            {t("hero_badge")}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {t("hero_title_1")} <br className="hidden sm:block" />
            <span className="text-[color:var(--orzen-blue)]">{t("hero_title_2")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-[color:var(--orzen-muted)] sm:text-lg">
            {t("hero_sub")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--orzen-blue)] px-6 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:bg-[color:var(--orzen-blue-600)] sm:w-auto"
            >
              {t("hero_cta_primary")} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#ai"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--orzen-border)] bg-white px-6 py-3.5 text-sm font-semibold text-[color:var(--orzen-navy)] hover:border-[color:var(--orzen-navy)] sm:w-auto"
            >
              <Play className="h-4 w-4" /> {t("hero_cta_secondary")}
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[color:var(--orzen-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[color:var(--orzen-success)]" /> {t("hero_point_1")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[color:var(--orzen-success)]" /> {t("hero_point_2")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[color:var(--orzen-success)]" /> {t("hero_point_3")}
            </span>
          </div>
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      {/* Main dashboard card */}
      <div className="relative rounded-2xl border border-[color:var(--orzen-border)] bg-white shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-1.5 border-b border-[color:var(--orzen-border)] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[11px] text-[color:var(--orzen-muted)]">
            app.orzen.top/dashboard
          </span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[color:var(--orzen-muted)]">
                Overview
              </p>
              <h3 className="text-base font-bold">Good morning, Rafi</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--orzen-slate-100)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--orzen-navy)]">
              <TrendingUp className="h-3 w-3 text-[color:var(--orzen-success)]" /> +18.2%
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Revenue" value="৳ 84,320" tone="blue" />
            <MiniStat label="Orders" value="127" tone="navy" />
            <MiniStat label="Visitors" value="2,481" tone="green" />
          </div>
          <div className="mt-4 rounded-xl border border-[color:var(--orzen-border)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold">Sales this week</p>
              <p className="text-[11px] text-[color:var(--orzen-muted)]">Mon–Sun</p>
            </div>
            <div className="flex h-24 items-end gap-1.5">
              {[38, 55, 42, 70, 58, 88, 74].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md bg-[color:var(--orzen-slate-100)]">
                  <div
                    className="w-full rounded-t-md bg-[color:var(--orzen-blue)]"
                    style={{ height: `${h}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { name: "Silk Kurta — Black", qty: 2, amt: "৳ 2,400", status: "Paid" },
              { name: "Wireless Earbuds Pro", qty: 1, amt: "৳ 1,890", status: "Shipped" },
            ].map((o) => (
              <div
                key={o.name}
                className="flex items-center justify-between rounded-lg bg-[color:var(--orzen-slate-50)] px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-semibold">{o.name}</p>
                  <p className="text-[color:var(--orzen-muted)]">Qty {o.qty} · {o.amt}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[color:var(--orzen-success)] border border-[color:var(--orzen-border)]">
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating: New order */}
      <div className="absolute -left-3 top-24 hidden w-56 rounded-xl border border-[color:var(--orzen-border)] bg-white p-3 shadow-[var(--shadow-soft)] orzen-float sm:block">
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--orzen-blue)]/10 text-[color:var(--orzen-blue)]">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold">New order #4821</p>
            <p className="text-[11px] text-[color:var(--orzen-muted)]">৳ 3,290 · Dhaka</p>
          </div>
        </div>
      </div>

      {/* Floating: AI replied */}
      <div
        className="absolute -right-3 top-40 hidden w-60 rounded-xl border border-[color:var(--orzen-border)] bg-white p-3 shadow-[var(--shadow-soft)] orzen-float sm:block"
        style={{ animationDelay: "1s" }}
      >
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--orzen-success)]/10 text-[color:var(--orzen-success)]">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold">AI replied to customer</p>
            <p className="text-[11px] text-[color:var(--orzen-muted)]">
              “Yes, size L is in stock ✓”
            </p>
          </div>
        </div>
      </div>

      {/* Floating: Courier */}
      <div
        className="absolute -bottom-4 left-6 hidden w-56 rounded-xl border border-[color:var(--orzen-border)] bg-white p-3 shadow-[var(--shadow-soft)] orzen-float sm:block"
        style={{ animationDelay: "2s" }}
      >
        <div className="flex items-start gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[color:var(--orzen-warning)]/10 text-[color:var(--orzen-warning)]">
            <Truck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold">Courier picked up</p>
            <p className="text-[11px] text-[color:var(--orzen-muted)]">Pathao · 3 parcels</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "blue" | "navy" | "green" }) {
  const bg =
    tone === "blue"
      ? "bg-[color:var(--orzen-blue)]/8"
      : tone === "green"
      ? "bg-[color:var(--orzen-success)]/8"
      : "bg-[color:var(--orzen-slate-100)]";
  return (
    <div className={cn("rounded-xl p-2.5", bg)}>
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--orzen-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Trust bar                                                                   */
/* -------------------------------------------------------------------------- */

function TrustBar() {
  const { ref, visible } = useReveal();
  const { t } = useLang();
  const stats = [
    { end: 1000, suffix: "+", label: t("stat_stores") },
    { end: 50000, suffix: "+", label: t("stat_orders") },
    { end: 99, suffix: ".9%", label: t("stat_uptime") },
    { end: 24, suffix: "/7", label: t("stat_monitoring") },
  ];
  return (
    <section ref={ref} className="border-y border-[color:var(--orzen-border)] bg-[color:var(--orzen-slate-50)]">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4 md:px-8 md:py-14">
        {stats.map((s) => (
          <StatTile key={s.label} end={s.end} suffix={s.suffix} label={s.label} start={visible} />
        ))}
      </div>
    </section>
  );
}
function StatTile({ end, suffix, label, start }: { end: number; suffix: string; label: string; start: boolean }) {
  const v = useCountUp(end, start);
  return (
    <div className="text-center">
      <p className="text-3xl font-extrabold sm:text-4xl">
        {v.toLocaleString("en-US")}
        <span className="text-[color:var(--orzen-blue)]">{suffix}</span>
      </p>
      <p className="mt-1 text-xs font-medium text-[color:var(--orzen-muted)] sm:text-sm">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section shell                                                               */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      {eyebrow && (
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[color:var(--orzen-blue)]">
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base text-[color:var(--orzen-muted)]">{subtitle}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Features                                                                    */
/* -------------------------------------------------------------------------- */

const FEATURES = [
  { icon: Store, title: "Store Builder", desc: "Drag-and-drop pages, categories and products in minutes." },
  { icon: Bot, title: "AI Sales Agent", desc: "Autonomously answers questions and confirms orders 24/7." },
  { icon: MessageCircle, title: "Messenger AI", desc: "Auto-reply on Facebook Messenger with your brand voice." },
  { icon: Sparkles, title: "Facebook Pixel", desc: "Track, retarget and scale ads without touching code." },
  { icon: Truck, title: "Courier Integration", desc: "Pathao, Steadfast, RedX — one-click parcel booking." },
  { icon: Boxes, title: "Inventory", desc: "Real-time stock, variants, low-stock alerts and SKUs." },
  { icon: Tag, title: "Coupons", desc: "Percent, flat, first-order and code-based discounts." },
  { icon: BarChart3, title: "Analytics", desc: "Revenue, cohorts and product performance in one view." },
  { icon: FileText, title: "Invoices", desc: "Auto-generated, printable invoices with your branding." },
  { icon: Search, title: "SEO", desc: "Editable meta, sitemaps and structured data on every page." },
  { icon: Palette, title: "Theme Customizer", desc: "Colors, fonts and layouts — no code, live preview." },
  { icon: Smartphone, title: "Multi Device Responsive", desc: "Pixel-perfect on 320px phones through 4K desktops." },
];

function Features() {
  const { t, pick } = useLang();
  return (
    <section id="features" className="scroll-mt-24 py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader
          eyebrow={t("features_eyebrow")}
          title={t("features_title")}
          subtitle={t("features_sub")}
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, fi) => (
            <div
              key={f.title}
              className="group flex h-full items-start gap-4 rounded-2xl border border-[color:var(--orzen-border)] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[color:var(--orzen-navy)]/20 hover:shadow-[var(--shadow-soft)]"
            >
              <span className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--orzen-blue)]/10 text-[color:var(--orzen-blue)] transition-colors group-hover:bg-[color:var(--orzen-blue)] group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-snug">{pick(FEATURE_COPY[fi]!.title)}</h3>
                <p className="mt-1.5 text-sm text-[color:var(--orzen-muted)]">{pick(FEATURE_COPY[fi]!.desc)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* AI showcase                                                                 */
/* -------------------------------------------------------------------------- */

function AIShowcase() {
  const { t } = useLang();
  const points = [
    t("ai_point_1"),
    t("ai_point_2"),
    t("ai_point_3"),
    t("ai_point_4"),
    t("ai_point_5"),
    t("ai_point_6"),
  ];
  return (
    <section id="ai" className="scroll-mt-24 bg-[color:var(--orzen-slate-50)] py-10 md:py-12">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <SectionHeader
            eyebrow={t("ai_eyebrow")}
            title={t("ai_title")}
            subtitle={t("ai_sub")}
            align="center"
          />
          <ul className="mt-8 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-[color:var(--orzen-success)]" />
                <span className="text-[color:var(--orzen-navy)]">{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-[color:var(--orzen-navy)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("ai_cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <ChatMockup />
      </div>
    </section>
  );
}

function ChatMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-[color:var(--orzen-border)] bg-white shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-3 rounded-t-3xl bg-[color:var(--orzen-navy)] px-4 py-3 text-white">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
            <Bot className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">ORZEN AI Assistant</p>
            <p className="flex items-center gap-1.5 text-[11px] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--orzen-success)]" /> Online
            </p>
          </div>
          <X className="h-4 w-4 text-white/60" />
        </div>
        <div className="space-y-3 px-4 py-4">
          <Bubble side="left">Hi! I love your silk kurta collection 😍</Bubble>
          <Bubble side="right">
            Hello! Thanks for reaching out. We have 8 designs in stock. Any color preference?
          </Bubble>
          <Bubble side="left">Do you have black in size L?</Bubble>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm border border-[color:var(--orzen-border)] bg-white p-2 shadow-sm">
            <div className="rounded-xl bg-[color:var(--orzen-slate-50)] p-2">
              <div className="h-20 rounded-lg bg-gradient-to-br from-[color:var(--orzen-navy)] to-[color:var(--orzen-blue)]" />
              <p className="mt-2 text-xs font-semibold">Silk Kurta — Black</p>
              <p className="text-[11px] text-[color:var(--orzen-muted)]">Size L · In stock</p>
              <p className="mt-1 text-xs font-bold text-[color:var(--orzen-blue)]">৳ 1,200</p>
            </div>
            <p className="mt-2 text-xs">Yes! Available. Would you like to order?</p>
          </div>
          <Bubble side="left">Yes please, cash on delivery</Bubble>
          <div className="flex items-center gap-1 text-[color:var(--orzen-muted)]">
            <span className="h-2 w-2 rounded-full bg-[color:var(--orzen-muted)] orzen-blink" />
            <span
              className="h-2 w-2 rounded-full bg-[color:var(--orzen-muted)] orzen-blink"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="h-2 w-2 rounded-full bg-[color:var(--orzen-muted)] orzen-blink"
              style={{ animationDelay: "0.4s" }}
            />
            <span className="ml-1 text-[11px]">AI is typing…</span>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-[color:var(--orzen-border)] p-3">
          <div className="flex-1 rounded-full bg-[color:var(--orzen-slate-50)] px-4 py-2 text-xs text-[color:var(--orzen-muted)]">
            Type a message…
          </div>
          <button
            type="button"
            aria-label="Send message"
            className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--orzen-blue)] text-white"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ side, children }: { side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs",
        side === "left"
          ? "mr-auto rounded-tl-sm bg-[color:var(--orzen-slate-100)] text-[color:var(--orzen-navy)]"
          : "ml-auto rounded-tr-sm bg-[color:var(--orzen-blue)] text-white"
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Workflow                                                                    */
/* -------------------------------------------------------------------------- */

const STEPS = [
  { title: "Create Account", desc: "Sign up in under 30 seconds — no credit card.", icon: User },
  { title: "Create Store", desc: "Pick a template, set your brand and go live.", icon: Store },
  { title: "Add Products", desc: "Import from CSV or add manually with variants.", icon: Package },
  { title: "Receive Orders", desc: "AI + Messenger + storefront funnel into one inbox.", icon: ShoppingBag },
  { title: "Courier Booking", desc: "One-click parcel with Pathao, Steadfast, RedX.", icon: Truck },
  { title: "Delivery", desc: "Real-time tracking and automatic status updates.", icon: MapPin },
  { title: "Analytics & Growth", desc: "See what sells, retarget with Pixel, scale profits.", icon: BarChart3 },
];

function Workflow() {
  const { t, pick } = useLang();
  return (
    <section className="py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader
          eyebrow={t("workflow_eyebrow")}
          title={t("workflow_title")}
          subtitle={t("workflow_sub")}
        />
        <div className="relative mx-auto mt-14 max-w-3xl">
          <div
            className="absolute left-5 top-2 bottom-2 w-px bg-gradient-to-b from-[color:var(--orzen-blue)]/50 via-[color:var(--orzen-border)] to-transparent"
            aria-hidden
          />
          <ol className="space-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex items-stretch gap-4 sm:gap-6">
                <div className="relative z-10 flex flex-col items-center">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--orzen-navy)] text-xs font-bold text-white shadow-[var(--shadow-soft)] ring-4 ring-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="min-w-0 flex-1 rounded-2xl border border-[color:var(--orzen-border)] bg-white p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--orzen-blue)]/10 text-[color:var(--orzen-blue)]">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--orzen-blue)]">
                        {t("workflow_step")} {i + 1}
                      </p>
                      <h3 className="mt-0.5 text-base font-bold leading-snug sm:text-lg">
                        {pick(STEP_COPY[i]!.title)}
                      </h3>
                      <p className="mt-1.5 text-sm text-[color:var(--orzen-muted)]">
                        {pick(STEP_COPY[i]!.desc)}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard showcase                                                          */
/* -------------------------------------------------------------------------- */

const DASHBOARDS = [
  { key: "admin", label: "Merchant Panel" },
  { key: "store", label: "Customer Store" },
  { key: "owner", label: "Owner Panel" },
  { key: "ai", label: "AI Dashboard" },
  { key: "analytics", label: "Analytics" },
] as const;

type DashKey = (typeof DASHBOARDS)[number]["key"];

function DashboardShowcase() {
  const { t } = useLang();
  const [active, setActive] = useState<DashKey>("admin");
  const fetchShowcase = useServerFn(getPublicShowcase);
  const { data: showcase } = useQuery({
    queryKey: ["platform", "showcase"],
    queryFn: () => fetchShowcase(),
    staleTime: 5 * 60 * 1000,
  });
  const current = ((showcase as ShowcaseRow[]) ?? []).find((r) => r.key === active);
  const desktopUrl = current?.desktop_url || null;
  const mobileUrl = current?.mobile_url || null;
  const label = DASHBOARDS.find((d) => d.key === active)?.label ?? "ORZEN";

  return (
    <section className="bg-[color:var(--orzen-slate-50)] py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader
          eyebrow={t("product_eyebrow")}
          title={t("product_title")}
          subtitle={t("product_sub")}
        />
        <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
          {DASHBOARDS.map((d) => (
            <button
              key={d.key}
              onClick={() => setActive(d.key)}
              aria-pressed={active === d.key}
              className={cn(
                "shrink-0 snap-start rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 sm:text-sm",
                active === d.key
                  ? "bg-[color:var(--orzen-navy)] text-white shadow-[var(--shadow-soft)]"
                  : "border border-[color:var(--orzen-border)] bg-white text-[color:var(--orzen-navy)] hover:border-[color:var(--orzen-navy)] hover:-translate-y-0.5"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:items-center">
          <SwapFade k={active}>
            <BrowserFrame>
              {desktopUrl ? (
                <img
                  src={desktopUrl}
                  alt={`${label} — desktop preview`}
                  loading="lazy"
                  className="block w-full object-cover object-top"
                />
              ) : (
                <DesktopMock kind={active} />
              )}
            </BrowserFrame>
          </SwapFade>
          <SwapFade k={active}>
            <PhoneFrame bare={!!mobileUrl}>
              {mobileUrl ? (
                <img
                  src={mobileUrl}
                  alt={`${label} — mobile preview`}
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <MobileMock kind={active} />
              )}
            </PhoneFrame>
          </SwapFade>
        </div>
      </div>
    </section>
  );
}

function SwapFade({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div key={k} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {children}
    </div>
  );
}

/* ------------------------------- frames ---------------------------------- */

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--orzen-border)] bg-white shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-1.5 border-b border-[color:var(--orzen-border)] bg-[color:var(--orzen-slate-50)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="mx-auto flex items-center gap-1.5 rounded-md border border-[color:var(--orzen-border)] bg-white px-3 py-1 text-[10px] text-[color:var(--orzen-muted)]">
          <ShieldCheck className="h-3 w-3 text-[color:var(--orzen-success)]" />
          app.orzen.top
        </span>
      </div>
      <div className="bg-[color:var(--orzen-slate-50)] p-2 sm:p-3">
        <div className="overflow-hidden rounded-xl border border-[color:var(--orzen-border)] bg-white">
          {children}
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[248px] max-w-full sm:w-[272px]">
      <div className="relative rounded-[2.6rem] border-[9px] border-[color:var(--orzen-navy)] bg-[color:var(--orzen-navy)] shadow-[var(--shadow-lift)]">
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2rem] bg-white">
          {/* status bar */}
          <div className="flex items-center justify-between px-4 pt-2 text-[9px] font-semibold text-[color:var(--orzen-navy)]">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="flex items-end gap-[1px]">
                <i className="block h-1 w-[2px] rounded-sm bg-current" />
                <i className="block h-1.5 w-[2px] rounded-sm bg-current" />
                <i className="block h-2 w-[2px] rounded-sm bg-current" />
              </span>
              <span>5G</span>
              <span className="inline-block h-2 w-4 rounded-[3px] border border-current p-[1px]">
                <span className="block h-full w-3/4 rounded-[1px] bg-current" />
              </span>
            </span>
          </div>
          {/* dynamic island */}
          <div className="absolute left-1/2 top-1.5 h-4 w-16 -translate-x-1/2 rounded-full bg-[color:var(--orzen-navy)]" />
          <div className="h-[calc(100%-1.5rem)] overflow-hidden px-3 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- pieces ---------------------------------- */

function Kpi({ label, v, delta }: { label: string; v: string; delta?: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--orzen-border)] bg-white p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[color:var(--orzen-muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold leading-none">{v}</p>
      {delta && (
        <p className="mt-1 flex items-center gap-0.5 text-[9px] font-semibold text-[color:var(--orzen-success)]">
          <TrendingUp className="h-2.5 w-2.5" />
          {delta}
        </p>
      )}
    </div>
  );
}

const AREA_POINTS = [38, 52, 44, 66, 58, 74, 62, 86, 78, 92, 84, 98];

function AreaChart({ height = 96 }: { height?: number }) {
  const pts = AREA_POINTS.map((v, i) => `${(i / (AREA_POINTS.length - 1)) * 100},${100 - v}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full">
      <defs>
        <linearGradient id="orzen-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--orzen-blue)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--orzen-blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${pts} 100,100`} fill="url(#orzen-area)" />
      <polyline
        points={pts}
        fill="none"
        stroke="var(--orzen-blue)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusPill({ tone, children }: { tone: "green" | "amber" | "blue"; children: React.ReactNode }) {
  const map = {
    green: "bg-[color:var(--orzen-success)]/10 text-[color:var(--orzen-success)]",
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-[color:var(--orzen-blue)]/10 text-[color:var(--orzen-blue)]",
  } as const;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold", map[tone])}>{children}</span>
  );
}

const ORDERS_ROWS = [
  { id: "#4821", name: "Rafiul Islam", tone: "green" as const, status: "Delivered", amt: "৳ 3,290", date: "25 Aug" },
  { id: "#4820", name: "Nusrat Jahan", tone: "blue" as const, status: "Shipped", amt: "৳ 1,890", date: "25 Aug" },
  { id: "#4819", name: "Sabbir Ahmed", tone: "amber" as const, status: "Pending", amt: "৳ 720", date: "24 Aug" },
  { id: "#4818", name: "Tanjila Akter", tone: "green" as const, status: "Delivered", amt: "৳ 2,450", date: "24 Aug" },
];

const SIDEBAR = [
  { icon: BarChart3, label: "Dashboard" },
  { icon: Package, label: "Orders" },
  { icon: Boxes, label: "Products" },
  { icon: Users, label: "Customers" },
  { icon: Bot, label: "AI Agent" },
  { icon: Truck, label: "Courier" },
];

/* ------------------------------ desktop ---------------------------------- */

function DesktopMock({ kind }: { kind: DashKey }) {
  if (kind === "store") return <DesktopStore />;
  if (kind === "owner") return <DesktopOwner />;
  if (kind === "ai") return <DesktopAI />;
  if (kind === "analytics") return <DesktopAnalytics />;
  return <DesktopAdmin />;
}

function AppChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] text-[11px] sm:grid-cols-[132px_1fr]">
      <aside className="border-r border-[color:var(--orzen-border)] bg-[color:var(--orzen-slate-50)] p-2.5">
        <div className="flex items-center gap-1.5 px-1 pb-3">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-[color:var(--orzen-navy)] text-[9px] font-black text-white">
            O
          </span>
          <span className="text-[10px] font-bold">ORZEN</span>
        </div>
        <div className="space-y-0.5">
          {SIDEBAR.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5",
                i === 0
                  ? "bg-[color:var(--orzen-navy)] font-semibold text-white"
                  : "text-[color:var(--orzen-muted)]"
              )}
            >
              <s.icon className="h-3 w-3 shrink-0" />
              <span className="truncate text-[10px]">{s.label}</span>
            </div>
          ))}
        </div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center gap-2 border-b border-[color:var(--orzen-border)] px-3 py-2">
          <p className="text-[11px] font-bold">{title}</p>
          <span className="ml-auto hidden items-center gap-1 rounded-md border border-[color:var(--orzen-border)] px-2 py-1 text-[9px] text-[color:var(--orzen-muted)] sm:flex">
            <Search className="h-2.5 w-2.5" />
            Search orders, products…
          </span>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--orzen-blue)]/15 text-[9px] font-bold text-[color:var(--orzen-blue)]">
            MA
          </span>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

function DesktopAdmin() {
  return (
    <AppChrome title="Dashboard">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Revenue" v="৳ 84,120" delta="+12.4%" />
        <Kpi label="Orders" v="127" delta="+8.1%" />
        <Kpi label="AOV" v="৳ 662" delta="+3.2%" />
        <Kpi label="Conversion" v="3.8%" delta="+0.6%" />
      </div>
      <div className="mt-2 rounded-lg border border-[color:var(--orzen-border)] p-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold">Revenue · last 12 weeks</p>
          <span className="text-[9px] text-[color:var(--orzen-muted)]">৳ 6.4L total</span>
        </div>
        <AreaChart height={78} />
      </div>
      <div className="mt-2 overflow-hidden rounded-lg border border-[color:var(--orzen-border)]">
        <div className="grid grid-cols-[52px_1fr_66px_60px_44px] gap-2 border-b border-[color:var(--orzen-border)] bg-[color:var(--orzen-slate-50)] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[color:var(--orzen-muted)]">
          <span>Order</span>
          <span>Customer</span>
          <span>Status</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Date</span>
        </div>
        {ORDERS_ROWS.map((o) => (
          <div
            key={o.id}
            className="grid grid-cols-[52px_1fr_66px_60px_44px] items-center gap-2 border-b border-[color:var(--orzen-border)] px-2.5 py-1.5 text-[10px] last:border-0"
          >
            <span className="font-semibold">{o.id}</span>
            <span className="truncate">{o.name}</span>
            <span><StatusPill tone={o.tone}>{o.status}</StatusPill></span>
            <span className="text-right font-semibold tabular-nums">{o.amt}</span>
            <span className="text-right text-[color:var(--orzen-muted)]">{o.date}</span>
          </div>
        ))}
      </div>
    </AppChrome>
  );
}

const PRODUCTS = [
  { name: "Linen Kurta", price: "৳ 1,290", old: "৳ 1,690", off: "-24%" },
  { name: "Denim Jacket", price: "৳ 2,450", old: "৳ 2,990", off: "-18%" },
  { name: "Leather Bag", price: "৳ 3,150", old: "৳ 3,800", off: "-17%" },
  { name: "Sneakers Pro", price: "৳ 2,790", old: "৳ 3,250", off: "-14%" },
];

function ProductCardMock({ p, big = false }: { p: (typeof PRODUCTS)[number]; big?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--orzen-border)] bg-white">
      <div className={cn("relative bg-gradient-to-br from-[color:var(--orzen-slate-100)] to-[color:var(--orzen-slate-50)]", big ? "h-20" : "h-16")}>
        <span className="absolute left-1.5 top-1.5 rounded bg-[color:var(--orzen-navy)] px-1 py-0.5 text-[8px] font-bold text-white">
          {p.off}
        </span>
      </div>
      <div className="p-1.5">
        <p className="truncate text-[10px] font-semibold">{p.name}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <span className="text-[10px] font-bold text-[color:var(--orzen-blue)]">{p.price}</span>
          <span className="text-[8px] text-[color:var(--orzen-muted)] line-through">{p.old}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-0.5 text-amber-500">
          {[0, 1, 2, 3, 4].map((s) => (
            <Star key={s} className="h-2 w-2" fill="currentColor" />
          ))}
          <span className="ml-0.5 text-[8px] text-[color:var(--orzen-muted)]">(42)</span>
        </div>
      </div>
    </div>
  );
}

function DesktopStore() {
  return (
    <div className="text-[11px]">
      <div className="flex items-center gap-2 border-b border-[color:var(--orzen-border)] px-3 py-2">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-[color:var(--orzen-navy)] text-[9px] font-black text-white">
          N
        </span>
        <span className="text-[11px] font-bold">Nova Fashion</span>
        <span className="ml-3 hidden gap-3 text-[10px] text-[color:var(--orzen-muted)] sm:flex">
          <span>New in</span>
          <span>Men</span>
          <span>Women</span>
          <span>Sale</span>
        </span>
        <span className="relative ml-auto">
          <ShoppingBag className="h-4 w-4" />
          <span className="absolute -right-1.5 -top-1.5 grid h-3 w-3 place-items-center rounded-full bg-[color:var(--orzen-blue)] text-[7px] font-bold text-white">
            3
          </span>
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between overflow-hidden rounded-lg bg-gradient-to-r from-[color:var(--orzen-navy)] to-[color:var(--orzen-blue)] p-4 text-white">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest opacity-80">Eid Collection</p>
            <p className="mt-1 text-base font-black leading-tight">Up to 40% off</p>
            <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-[9px] font-bold text-[color:var(--orzen-navy)]">
              Shop now
            </span>
          </div>
          <div className="hidden h-16 w-24 rounded-lg bg-white/15 sm:block" />
        </div>
        <div className="mt-2 flex gap-1.5">
          {["All", "Kurta", "Shoes", "Bags", "Accessories"].map((c, i) => (
            <span
              key={c}
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-semibold",
                i === 0
                  ? "bg-[color:var(--orzen-navy)] text-white"
                  : "border border-[color:var(--orzen-border)] text-[color:var(--orzen-muted)]"
              )}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {PRODUCTS.map((p) => (
            <ProductCardMock key={p.name} p={p} big />
          ))}
        </div>
      </div>
    </div>
  );
}

const TOP_STORES = [
  { n: "Nova Fashion", r: "৳ 8.4L", g: "+18%" },
  { n: "Deshi Basket", r: "৳ 6.1L", g: "+14%" },
  { n: "Techmart BD", r: "৳ 5.7L", g: "+11%" },
  { n: "Bloom Beauty", r: "৳ 4.2L", g: "+9%" },
];

function DesktopOwner() {
  return (
    <AppChrome title="Platform overview">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Stores" v="1,024" delta="+42" />
        <Kpi label="MRR" v="৳ 4.2M" delta="+9.3%" />
        <Kpi label="Active users" v="18.7k" delta="+5.1%" />
        <Kpi label="Churn" v="1.4%" />
      </div>
      <div className="mt-2 grid grid-cols-[1.3fr_1fr] gap-2">
        <div className="rounded-lg border border-[color:var(--orzen-border)] p-2.5">
          <p className="text-[10px] font-bold">Platform growth</p>
          <AreaChart height={82} />
        </div>
        <div className="rounded-lg border border-[color:var(--orzen-border)] p-2.5">
          <p className="text-[10px] font-bold">Top stores</p>
          <div className="mt-1 space-y-1">
            {TOP_STORES.map((s, i) => (
              <div key={s.n} className="flex items-center gap-1.5 text-[10px]">
                <span className="grid h-4 w-4 place-items-center rounded bg-[color:var(--orzen-slate-100)] text-[8px] font-bold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.n}</span>
                <span className="font-semibold tabular-nums">{s.r}</span>
                <StatusPill tone="green">{s.g}</StatusPill>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-[color:var(--orzen-border)] p-2.5">
        <p className="text-[10px] font-bold">Recent signups</p>
        <div className="mt-1 grid grid-cols-3 gap-2 text-[10px]">
          {["Rangpur Crafts", "Green Grocer", "Urban Ride"].map((n) => (
            <div key={n} className="flex items-center gap-1.5 rounded-md bg-[color:var(--orzen-slate-50)] px-2 py-1.5">
              <Store className="h-3 w-3 text-[color:var(--orzen-blue)]" />
              <span className="truncate">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </AppChrome>
  );
}

function Meter({ label, v, pct }: { label: string; v: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-[color:var(--orzen-muted)]">{label}</span>
        <span className="font-semibold">{v}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color:var(--orzen-slate-100)]">
        <div className="h-full rounded-full bg-[color:var(--orzen-blue)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ChatLine({ side, text }: { side: "left" | "right"; text: string }) {
  return (
    <div className={cn("flex", side === "right" ? "justify-end" : "justify-start")}>
      <span
        className={cn(
          "max-w-[85%] rounded-xl px-2.5 py-1.5 text-[10px] leading-snug",
          side === "right"
            ? "rounded-br-sm bg-[color:var(--orzen-navy)] text-white"
            : "rounded-bl-sm bg-[color:var(--orzen-slate-100)]"
        )}
      >
        {text}
      </span>
    </div>
  );
}

function DesktopAI() {
  return (
    <AppChrome title="AI control center">
      <div className="grid grid-cols-3 gap-2">
        {[
          { n: "Sales Agent", d: "Messenger + Web" },
          { n: "WhatsApp Bot", d: "Cloud API" },
          { n: "Product Q&A", d: "Storefront" },
        ].map((a) => (
          <div key={a.n} className="rounded-lg border border-[color:var(--orzen-border)] p-2.5">
            <div className="flex items-center gap-1.5">
              <Bot className="h-3 w-3 text-[color:var(--orzen-blue)]" />
              <span className="text-[10px] font-bold">{a.n}</span>
              <span className="ml-auto"><StatusPill tone="green">Live</StatusPill></span>
            </div>
            <p className="mt-1 text-[9px] text-[color:var(--orzen-muted)]">{a.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[1.2fr_1fr] gap-2">
        <div className="rounded-lg border border-[color:var(--orzen-border)] p-2.5">
          <p className="text-[10px] font-bold">Live conversation</p>
          <div className="mt-1.5 space-y-1.5">
            <ChatLine side="left" text="এই কুর্তাটা কি XL সাইজে আছে?" />
            <ChatLine side="right" text="জি, XL স্টকে আছে — ৳1,290, ক্যাশ অন ডেলিভারি।" />
            <ChatLine side="left" text="ঠিক আছে, অর্ডার করতে চাই।" />
            <ChatLine side="right" text="নাম ও ঠিকানা দিন, আমি অর্ডারটি কনফার্ম করে দিচ্ছি ✅" />
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-[color:var(--orzen-border)] p-2.5">
          <p className="text-[10px] font-bold">Usage · 30 days</p>
          <Meter label="Requests" v="182k" pct={72} />
          <Meter label="Tokens" v="14.2M" pct={58} />
          <Meter label="Auto-resolved" v="87%" pct={87} />
          <div className="rounded-md bg-[color:var(--orzen-slate-50)] p-2 text-[9px] text-[color:var(--orzen-muted)]">
            Avg reply time <span className="font-bold text-[color:var(--orzen-navy)]">1.2s</span>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

const FUNNEL = [
  { label: "Sessions", v: "12,480", pct: 100 },
  { label: "Product views", v: "7,910", pct: 63 },
  { label: "Add to cart", v: "2,140", pct: 27 },
  { label: "Checkout", v: "912", pct: 12 },
  { label: "Orders", v: "474", pct: 6 },
];

const SOURCES = [
  { n: "Facebook", pct: 46 },
  { n: "Direct", pct: 24 },
  { n: "Google", pct: 18 },
  { n: "Messenger", pct: 12 },
];

function DesktopAnalytics() {
  return (
    <AppChrome title="Analytics">
      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Sessions" v="12.4k" delta="+7.8%" />
        <Kpi label="Conversion" v="3.8%" delta="+0.4%" />
        <Kpi label="AOV" v="৳ 892" delta="+2.1%" />
        <Kpi label="Repeat rate" v="31%" delta="+4.0%" />
      </div>
      <div className="mt-2 grid grid-cols-[1.2fr_1fr] gap-2">
        <div className="rounded-lg border border-[color:var(--orzen-border)] p-2.5">
          <p className="text-[10px] font-bold">Conversion funnel</p>
          <div className="mt-1.5 space-y-1">
            {FUNNEL.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-[9px]">
                <span className="w-20 shrink-0 text-[color:var(--orzen-muted)]">{f.label}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-sm bg-[color:var(--orzen-slate-100)]">
                  <span
                    className="block h-full rounded-sm bg-gradient-to-r from-[color:var(--orzen-navy)] to-[color:var(--orzen-blue)]"
                    style={{ width: `${f.pct}%` }}
                  />
                </span>
                <span className="w-12 text-right font-semibold tabular-nums">{f.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2 rounded-lg border border-[color:var(--orzen-border)] p-2.5">
          <p className="text-[10px] font-bold">Traffic sources</p>
          {SOURCES.map((s) => (
            <Meter key={s.n} label={s.n} v={`${s.pct}%`} pct={s.pct} />
          ))}
        </div>
      </div>
      <div className="mt-2 rounded-lg border border-[color:var(--orzen-border)] p-2.5">
        <p className="text-[10px] font-bold">Orders per day</p>
        <div className="mt-1.5 flex h-14 items-end gap-1">
          {[40, 62, 48, 70, 55, 82, 68, 90, 72, 84, 76, 95, 66, 88].map((h, i) => (
            <span key={i} className="flex-1 rounded-t bg-[color:var(--orzen-blue)]/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </AppChrome>
  );
}

/* ------------------------------- mobile ---------------------------------- */

function MobileMock({ kind }: { kind: DashKey }) {
  if (kind === "store") return <MobileStore />;
  if (kind === "owner") return <MobileOwner />;
  if (kind === "ai") return <MobileAI />;
  if (kind === "analytics") return <MobileAnalytics />;
  return <MobileAdmin />;
}

function MobileShell({
  title,
  tabs,
  children,
}: {
  title: string;
  tabs: { icon: typeof Bot; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 pb-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-[color:var(--orzen-navy)] text-[9px] font-black text-white">
          O
        </span>
        <p className="text-[11px] font-bold">{title}</p>
        <span className="ml-auto grid h-6 w-6 place-items-center rounded-full bg-[color:var(--orzen-slate-100)]">
          <User className="h-3 w-3 text-[color:var(--orzen-muted)]" />
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden">{children}</div>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-[color:var(--orzen-border)] bg-white px-2 py-1.5">
        {tabs.map((t, i) => (
          <span
            key={t.label}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 text-[8px] font-semibold",
              i === 0 ? "text-[color:var(--orzen-navy)]" : "text-[color:var(--orzen-muted)]"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </span>
        ))}
      </div>
      <div className="mx-auto mt-1.5 mb-1 h-1 w-16 rounded-full bg-[color:var(--orzen-slate-100)]" />
    </div>
  );
}

const ADMIN_TABS = [
  { icon: BarChart3, label: "Home" },
  { icon: Package, label: "Orders" },
  { icon: Boxes, label: "Products" },
  { icon: Bot, label: "AI" },
];

function MobileAdmin() {
  return (
    <MobileShell title="Merchant Panel" tabs={ADMIN_TABS}>
      <div className="rounded-xl bg-gradient-to-br from-[color:var(--orzen-navy)] to-[color:var(--orzen-blue)] p-3 text-white">
        <p className="text-[9px] uppercase tracking-widest opacity-80">Today&apos;s revenue</p>
        <p className="mt-0.5 text-xl font-black leading-none">৳ 84,120</p>
        <p className="mt-1 flex items-center gap-1 text-[9px] font-semibold opacity-90">
          <TrendingUp className="h-3 w-3" /> +12.4% vs yesterday
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Orders" v="127" delta="+8%" />
        <Kpi label="AOV" v="৳ 662" delta="+3%" />
      </div>
      <div className="rounded-xl border border-[color:var(--orzen-border)] p-2.5">
        <p className="text-[10px] font-bold">Recent orders</p>
        <div className="mt-1 space-y-1.5">
          {ORDERS_ROWS.slice(0, 3).map((o) => (
            <div key={o.id} className="flex items-center gap-1.5 text-[10px]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--orzen-slate-100)]">
                <Package className="h-3 w-3 text-[color:var(--orzen-muted)]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{o.name}</span>
                <span className="block text-[9px] text-[color:var(--orzen-muted)]">{o.id}</span>
              </span>
              <span className="text-right">
                <span className="block font-bold tabular-nums">{o.amt}</span>
                <StatusPill tone={o.tone}>{o.status}</StatusPill>
              </span>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}

const STORE_TABS = [
  { icon: Store, label: "Shop" },
  { icon: Search, label: "Search" },
  { icon: ShoppingBag, label: "Cart" },
  { icon: User, label: "Account" },
];

function MobileStore() {
  return (
    <MobileShell title="Nova Fashion" tabs={STORE_TABS}>
      <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--orzen-border)] px-2.5 py-1.5 text-[9px] text-[color:var(--orzen-muted)]">
        <Search className="h-3 w-3" /> Search products
      </div>
      <div className="rounded-xl bg-gradient-to-r from-[color:var(--orzen-navy)] to-[color:var(--orzen-blue)] p-3 text-white">
        <p className="text-[8px] uppercase tracking-widest opacity-80">Eid collection</p>
        <p className="mt-0.5 text-sm font-black">Up to 40% off</p>
        <span className="mt-1.5 inline-block rounded-full bg-white px-2.5 py-1 text-[8px] font-bold text-[color:var(--orzen-navy)]">
          Shop now
        </span>
      </div>
      <div className="flex gap-1.5 overflow-hidden">
        {["All", "Kurta", "Shoes", "Bags"].map((c, i) => (
          <span
            key={c}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold",
              i === 0
                ? "bg-[color:var(--orzen-navy)] text-white"
                : "border border-[color:var(--orzen-border)] text-[color:var(--orzen-muted)]"
            )}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PRODUCTS.slice(0, 4).map((p) => (
          <ProductCardMock key={p.name} p={p} />
        ))}
      </div>
    </MobileShell>
  );
}

const OWNER_TABS = [
  { icon: BarChart3, label: "Home" },
  { icon: Store, label: "Stores" },
  { icon: Wallet, label: "Billing" },
  { icon: Users, label: "Users" },
];

function MobileOwner() {
  return (
    <MobileShell title="Owner Panel" tabs={OWNER_TABS}>
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Stores" v="1,024" delta="+42" />
        <Kpi label="MRR" v="৳ 4.2M" delta="+9%" />
      </div>
      <div className="rounded-xl border border-[color:var(--orzen-border)] p-2.5">
        <p className="text-[10px] font-bold">Growth</p>
        <AreaChart height={64} />
      </div>
      <div className="rounded-xl border border-[color:var(--orzen-border)] p-2.5">
        <p className="text-[10px] font-bold">Top stores</p>
        <div className="mt-1 space-y-1.5">
          {TOP_STORES.slice(0, 3).map((s, i) => (
            <div key={s.n} className="flex items-center gap-1.5 text-[10px]">
              <span className="grid h-4 w-4 place-items-center rounded bg-[color:var(--orzen-slate-100)] text-[8px] font-bold">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{s.n}</span>
              <StatusPill tone="green">{s.g}</StatusPill>
            </div>
          ))}
        </div>
      </div>
    </MobileShell>
  );
}

const AI_TABS = [
  { icon: MessageCircle, label: "Inbox" },
  { icon: Bot, label: "Agents" },
  { icon: FileText, label: "Logs" },
  { icon: BarChart3, label: "Usage" },
];

function MobileAI() {
  return (
    <MobileShell title="AI Assistant" tabs={AI_TABS}>
      <div className="flex items-center gap-1.5 rounded-xl border border-[color:var(--orzen-border)] p-2">
        <Bot className="h-3.5 w-3.5 text-[color:var(--orzen-blue)]" />
        <span className="text-[10px] font-bold">Sales Agent</span>
        <span className="ml-auto"><StatusPill tone="green">Live</StatusPill></span>
      </div>
      <div className="space-y-1.5 rounded-xl border border-[color:var(--orzen-border)] p-2.5">
        <ChatLine side="left" text="এই কুর্তাটা XL আছে?" />
        <ChatLine side="right" text="জি আছে — ৳1,290, ক্যাশ অন ডেলিভারি।" />
        <ChatLine side="left" text="অর্ডার করতে চাই।" />
        <ChatLine side="right" text="নাম ও ঠিকানা দিন ✅" />
      </div>
      <div className="space-y-1.5 rounded-xl border border-[color:var(--orzen-border)] p-2.5">
        <Meter label="Requests" v="182k" pct={72} />
        <Meter label="Auto-resolved" v="87%" pct={87} />
      </div>
    </MobileShell>
  );
}

const ANALYTICS_TABS = [
  { icon: BarChart3, label: "Report" },
  { icon: TrendingUp, label: "Trends" },
  { icon: Users, label: "Audience" },
  { icon: Tag, label: "Products" },
];

function MobileAnalytics() {
  return (
    <MobileShell title="Analytics" tabs={ANALYTICS_TABS}>
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Sessions" v="12.4k" delta="+7.8%" />
        <Kpi label="Conv." v="3.8%" delta="+0.4%" />
      </div>
      <div className="rounded-xl border border-[color:var(--orzen-border)] p-2.5">
        <p className="text-[10px] font-bold">Funnel</p>
        <div className="mt-1 space-y-1">
          {FUNNEL.map((f) => (
            <div key={f.label} className="flex items-center gap-1.5 text-[8px]">
              <span className="w-14 shrink-0 text-[color:var(--orzen-muted)]">{f.label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-sm bg-[color:var(--orzen-slate-100)]">
                <span
                  className="block h-full rounded-sm bg-gradient-to-r from-[color:var(--orzen-navy)] to-[color:var(--orzen-blue)]"
                  style={{ width: `${f.pct}%` }}
                />
              </span>
              <span className="w-9 text-right font-semibold tabular-nums">{f.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-[color:var(--orzen-border)] p-2.5">
        <p className="text-[10px] font-bold">Orders per day</p>
        <div className="mt-1 flex h-12 items-end gap-1">
          {[40, 62, 48, 70, 55, 82, 68, 90, 72, 84].map((h, i) => (
            <span key={i} className="flex-1 rounded-t bg-[color:var(--orzen-blue)]/80" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </MobileShell>
  );
}





/* -------------------------------------------------------------------------- */
/* Why ORZEN                                                                   */
/* -------------------------------------------------------------------------- */

const WHY = [
  { icon: Zap, title: "No Coding Required", desc: "Visual editor, no plugins, no dev team needed." },
  { icon: ArrowRight, title: "Fast Setup", desc: "From signup to live store in under 10 minutes." },
  { icon: Sparkles, title: "AI Powered", desc: "Sales agent, product descriptions, replies — all AI." },
  { icon: MapPin, title: "Bangladesh Friendly", desc: "৳ pricing, Bangla UI, bKash & local checkouts." },
  { icon: Truck, title: "Courier Ready", desc: "Native Pathao, Steadfast, RedX and more." },
  { icon: Facebook, title: "Facebook Ready", desc: "Pixel, Conversions API and Messenger built in." },
  { icon: Smartphone, title: "Mobile First", desc: "Optimized for 80% of your customers on mobile." },
  { icon: Wallet, title: "Affordable Pricing", desc: "Start free. Enterprise features from ৳ 990/mo." },
];

function WhyOrzen() {
  const { t, pick } = useLang();
  return (
    <section className="bg-[color:var(--orzen-slate-50)] py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader eyebrow={t("why_eyebrow")} title={t("why_title")} />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((w, wi) => (
            <div
              key={w.title}
              className="flex h-full items-start gap-4 rounded-2xl border border-[color:var(--orzen-border)] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
            >
              <span className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--orzen-navy)] text-white">
                <w.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-snug">{pick(WHY_COPY[wi]!.title)}</h3>
                <p className="mt-1.5 text-sm text-[color:var(--orzen-muted)]">{pick(WHY_COPY[wi]!.desc)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Testimonials                                                                */
/* -------------------------------------------------------------------------- */

function Testimonials() {
  const { t } = useLang();
  return (
    <section className="py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader eyebrow={t("testimonials_eyebrow")} title={t("testimonials_title")} />
      </div>
      <TestimonialsMarquee />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                         */
/* -------------------------------------------------------------------------- */

const FAQS = [
  { q: "Is there really a free plan?", a: "Yes. The Free plan is forever-free with 1 store and 20 products — no credit card required." },
  { q: "How does the pricing work?", a: "Pick a plan and a billing cycle. Longer cycles get automatic discounts: 10% (3M), 20% (6M), 30% (yearly)." },
  { q: "Can I cancel any time?", a: "Yes. Cancel from the billing page — you keep access until the end of your paid cycle." },
  { q: "Which payment methods do you support?", a: "Cards, bKash, Nagad, Rocket and bank transfer for annual plans." },
  { q: "Does the AI understand Bangla?", a: "Yes — the AI Sales Agent replies in Bangla, English or a natural mix, matched to your customer." },
  { q: "Can the AI actually confirm orders?", a: "Yes. It collects name, address, phone and preferred courier, then creates the order in your admin." },
  { q: "Which couriers are supported?", a: "Pathao, Steadfast, RedX, Sundarban and eCourier — with one-click parcel booking from any order." },
  { q: "Does Facebook Pixel work with iOS 14+?", a: "Yes — we send events via both browser Pixel and server-side Conversions API for accuracy." },
  { q: "Can I connect Facebook Messenger?", a: "Yes. Connect your Page in Settings — replies flow through the AI or your team." },
  { q: "Is there a free trial on paid plans?", a: "Every paid plan includes a 7-day trial with all features unlocked." },
  { q: "How fast is support?", a: "Community for Free, Email for Basic, Priority (under 2h) for Business, Dedicated for Custom." },
  { q: "Can I bring my own domain?", a: "Yes — from Basic and up you can connect any custom domain in a few clicks." },
  { q: "Do I own my data?", a: "Always. Export orders, customers and products as CSV whenever you want." },
  { q: "Can I switch themes later?", a: "Yes. All themes are hot-swappable and preserve your content." },
  { q: "Do you handle hosting and updates?", a: "Yes. Hosting, SSL, backups and updates are fully managed — 99.9% uptime SLA." },
];

function FAQ() {
  const { t, pick } = useLang();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? FAQ_COPY : FAQ_COPY.slice(0, 6);
  return (
    <section id="faq" className="scroll-mt-24 bg-[color:var(--orzen-slate-50)] py-10 md:py-12">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <SectionHeader eyebrow={t("faq_eyebrow")} title={t("faq_title")} />
        <Accordion
          type="single"
          collapsible
          className="mt-10 grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3"
        >
          {visible.map((f, i) => (
            <AccordionItem
              key={i}
              value={`f-${i}`}
              className="h-fit rounded-xl border border-[color:var(--orzen-border)] bg-white px-4"
            >
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
                {pick(f.q)}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-[color:var(--orzen-muted)]">
                {pick(f.a)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {FAQ_COPY.length > 6 && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--orzen-border)] bg-white px-6 py-2.5 text-sm font-semibold text-[color:var(--orzen-navy)] transition hover:border-[color:var(--orzen-navy)]"
            >
              {showAll ? t("faq_show_less") : t("faq_view_all")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                   */
/* -------------------------------------------------------------------------- */

function FinalCTA() {
  const { t } = useLang();
  return (
    <section className="px-5 py-10 md:px-8 md:py-12">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[color:var(--orzen-navy)] px-6 py-10 text-center text-white shadow-[var(--shadow-lift)] sm:px-12 sm:py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(37,99,235,0.25), transparent 45%)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" /> {t("cta_badge")}
          </span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">
            {t("cta_title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/70 sm:text-base">
            {t("cta_sub")}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--orzen-blue)] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[color:var(--orzen-blue-600)] sm:w-auto"
            >
              {t("cta_primary")} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              {t("cta_secondary")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

