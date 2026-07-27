import { createFileRoute, Link, redirect } from "@tanstack/react-router";
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
    links: [{ rel: "canonical", href: "https://orzen.top/" }],
  }),
  component: Landing,
});


/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

function Landing() {
  return (
    <div className="min-h-screen bg-white text-[color:var(--orzen-navy)] overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <TrustBar />
        <Features />
        <AIShowcase />
        <Workflow />
        <DashboardShowcase />
        <Templates />
        <WhyOrzen />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

const NAV = [
  { label: "Features", href: "#features" },
  { label: "Templates", href: "#templates" },
  { label: "AI", href: "#ai" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

function Header() {
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
        "sticky top-0 z-50 w-full transition-all",
        scrolled
          ? "bg-white/85 backdrop-blur-md border-b border-[color:var(--orzen-border)]"
          : "bg-white/70 backdrop-blur-sm border-b border-transparent"
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
              {n.label}
            </a>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <Link
            to="/auth"
            className="text-sm font-medium text-[color:var(--orzen-navy)] hover:text-[color:var(--orzen-blue)]"
          >
            Sign In
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--orzen-blue)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:bg-[color:var(--orzen-blue-600)] transition"
          >
            Create Store <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <button
          className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--orzen-border)]"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
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
                {n.label}
              </a>
            ))}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <Link
                to="/auth"
                className="rounded-lg border border-[color:var(--orzen-border)] px-3 py-2.5 text-center text-sm font-semibold"
              >
                Sign In
              </Link>
              <Link
                to="/auth"
                className="rounded-lg bg-[color:var(--orzen-blue)] px-3 py-2.5 text-center text-sm font-semibold text-white"
              >
                Create Store
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
  return (
    <section id="top" className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.10),transparent)]" />
        <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(17,24,39,0.06),transparent)]" />
      </div>
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-10 pb-16 md:px-8 md:pt-16 md:pb-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20">
        <div className="orzen-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--orzen-border)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--orzen-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--orzen-success)]" />
            Trusted by 1,000+ store owners
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Create Your Online Store <br className="hidden sm:block" />
            <span className="text-[color:var(--orzen-blue)]">in Minutes.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-[color:var(--orzen-muted)] sm:text-lg">
            Everything you need to launch and grow your eCommerce business — store builder, AI sales
            agent, Messenger automation, courier integration, Facebook Pixel, analytics, payments and
            inventory — all in one platform.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--orzen-blue)] px-6 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] hover:bg-[color:var(--orzen-blue-600)] sm:w-auto"
            >
              Create Free Store <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#ai"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--orzen-border)] bg-white px-6 py-3.5 text-sm font-semibold text-[color:var(--orzen-navy)] hover:border-[color:var(--orzen-navy)] sm:w-auto"
            >
              <Play className="h-4 w-4" /> Watch Demo
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[color:var(--orzen-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[color:var(--orzen-success)]" /> No credit card required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[color:var(--orzen-success)]" /> Free forever plan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[color:var(--orzen-success)]" /> Setup in 3 minutes
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
  const stats = [
    { end: 1000, suffix: "+", label: "Stores Created" },
    { end: 50000, suffix: "+", label: "Orders Processed" },
    { end: 99, suffix: ".9%", label: "Uptime" },
    { end: 24, suffix: "/7", label: "Platform Monitoring" },
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
  return (
    <section id="features" className="scroll-mt-24 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader
          eyebrow="Platform"
          title="Everything you need to sell online"
          subtitle="12 production-grade modules built into every store — no plugins, no add-ons, no slowdowns."
        />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group flex h-full items-start gap-4 rounded-2xl border border-[color:var(--orzen-border)] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[color:var(--orzen-navy)]/20 hover:shadow-[var(--shadow-soft)]"
            >
              <span className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--orzen-blue)]/10 text-[color:var(--orzen-blue)] transition-colors group-hover:bg-[color:var(--orzen-blue)] group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-snug">{f.title}</h3>
                <p className="mt-1.5 text-sm text-[color:var(--orzen-muted)]">{f.desc}</p>
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
  const points = [
    "Replies to customers instantly, in Bangla or English",
    "Answers product questions using your catalog",
    "Collects name, address and phone naturally",
    "Confirms orders and hands off to your team",
    "Works 24/7 — never sleeps, never forgets",
    "Connects Messenger, Store Chat and WhatsApp (soon)",
  ];
  return (
    <section id="ai" className="scroll-mt-24 bg-[color:var(--orzen-slate-50)] py-20 md:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <SectionHeader
            eyebrow="AI Sales Agent"
            title="An always-on salesperson trained on your store"
            subtitle="Turn every message into a confirmed order. ORZEN's AI handles pre-sales, objections and checkout — before your team even opens the app."
            align="left"
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
              Try AI Demo <ArrowRight className="h-4 w-4" />
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
          <button className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--orzen-blue)] text-white">
            <ArrowRight className="h-4 w-4" />
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
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader
          eyebrow="How it works"
          title="From signup to first sale in an afternoon"
          subtitle="A guided path from first login to scaling — every step handled inside ORZEN."
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
                        Step {i + 1}
                      </p>
                      <h3 className="mt-0.5 text-base font-bold leading-snug sm:text-lg">
                        {s.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-[color:var(--orzen-muted)]">{s.desc}</p>
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
  { key: "admin", label: "Store Admin" },
  { key: "store", label: "Customer Store" },
  { key: "owner", label: "Owner Panel" },
  { key: "ai", label: "AI Dashboard" },
  { key: "analytics", label: "Analytics" },
] as const;

function DashboardShowcase() {
  const [active, setActive] = useState<(typeof DASHBOARDS)[number]["key"]>("admin");
  return (
    <section className="bg-[color:var(--orzen-slate-50)] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader
          eyebrow="Product"
          title="Every surface, built with the same care"
          subtitle="Admin, storefront, owner panel and AI console — one design language, zero learning curve."
        />
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {DASHBOARDS.map((d) => (
            <button
              key={d.key}
              onClick={() => setActive(d.key)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-sm",
                active === d.key
                  ? "bg-[color:var(--orzen-navy)] text-white"
                  : "bg-white border border-[color:var(--orzen-border)] text-[color:var(--orzen-navy)] hover:border-[color:var(--orzen-navy)]"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <BrowserFrame>
            <DashboardMock kind={active} />
          </BrowserFrame>
          <PhoneFrame>
            <DashboardMock kind={active} compact />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--orzen-border)] bg-white shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-1.5 border-b border-[color:var(--orzen-border)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[11px] text-[color:var(--orzen-muted)]">app.orzen.top</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[260px] shrink-0 rounded-[2.2rem] border-[10px] border-[color:var(--orzen-navy)] bg-[color:var(--orzen-navy)] shadow-[var(--shadow-lift)]">
      <div className="relative overflow-hidden rounded-[1.6rem] bg-white">
        <div className="absolute left-1/2 top-1 h-4 w-16 -translate-x-1/2 rounded-full bg-[color:var(--orzen-navy)]" />
        <div className="pt-6 p-3">{children}</div>
      </div>
    </div>
  );
}

function DashboardMock({ kind, compact = false }: { kind: (typeof DASHBOARDS)[number]["key"]; compact?: boolean }) {
  const scale = compact ? "text-[10px]" : "text-xs";
  if (kind === "store") {
    return (
      <div className={cn(scale, "space-y-3")}>
        <div className="flex items-center justify-between">
          <p className="font-bold">Nova Fashion</p>
          <ShoppingBag className="h-4 w-4" />
        </div>
        <div className="h-24 rounded-xl bg-gradient-to-br from-[color:var(--orzen-navy)] to-[color:var(--orzen-blue)]" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-20 rounded-lg bg-[color:var(--orzen-slate-100)]" />
              <p className="font-semibold">Product {i + 1}</p>
              <p className="text-[color:var(--orzen-blue)] font-bold">৳ {(i + 1) * 490}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "owner") {
    return (
      <div className={cn(scale, "space-y-3")}>
        <p className="font-bold">Platform Overview</p>
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Stores" v="1,024" />
          <Kpi label="MRR" v="৳ 4.2M" />
          <Kpi label="Users" v="18.7k" />
        </div>
        <div className="rounded-xl border border-[color:var(--orzen-border)] p-2.5">
          <p className="font-semibold">Top stores</p>
          {["Nova Fashion", "Deshi Basket", "Techmart BD"].map((n, i) => (
            <div key={n} className="flex items-center justify-between border-t border-[color:var(--orzen-border)] py-1.5 first:border-0">
              <span>{n}</span>
              <span className="text-[color:var(--orzen-success)] font-semibold">+{18 - i * 4}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "ai") {
    return (
      <div className={cn(scale, "space-y-3")}>
        <p className="font-bold">AI Control Center</p>
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Requests 30d" v="182k" />
          <Kpi label="Tokens" v="14.2M" />
        </div>
        <div className="space-y-1.5 rounded-xl border border-[color:var(--orzen-border)] p-2.5">
          {["Sales Agent", "Messenger Bot", "Product Q&A"].map((n, i) => (
            <div key={n} className="flex items-center justify-between">
              <span>{n}</span>
              <span className="rounded-full bg-[color:var(--orzen-success)]/10 px-2 py-0.5 text-[color:var(--orzen-success)] font-semibold">
                Active
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "analytics") {
    return (
      <div className={cn(scale, "space-y-3")}>
        <p className="font-bold">Analytics</p>
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Sessions" v="12.4k" />
          <Kpi label="Conv." v="3.8%" />
          <Kpi label="AOV" v="৳ 892" />
        </div>
        <div className="flex h-24 items-end gap-1.5 rounded-xl border border-[color:var(--orzen-border)] p-2.5">
          {[40, 62, 48, 70, 55, 82, 68, 90, 72, 84, 76, 95].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-[color:var(--orzen-blue)]" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    );
  }
  // admin
  return (
    <div className={cn(scale, "grid grid-cols-[80px_1fr] gap-3")}>
      <div className="space-y-1 rounded-xl bg-[color:var(--orzen-slate-50)] p-2">
        {["Home", "Orders", "Products", "AI", "Settings"].map((i, idx) => (
          <div
            key={i}
            className={cn(
              "rounded-md px-2 py-1.5",
              idx === 0
                ? "bg-[color:var(--orzen-navy)] text-white font-semibold"
                : "text-[color:var(--orzen-muted)]"
            )}
          >
            {i}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Revenue" v="৳ 84k" />
          <Kpi label="Orders" v="127" />
          <Kpi label="AOV" v="৳ 662" />
        </div>
        <div className="rounded-xl border border-[color:var(--orzen-border)] p-2.5">
          <p className="font-semibold">Recent orders</p>
          {["#4821 · Rafi · ৳ 3,290", "#4820 · Nusrat · ৳ 1,890", "#4819 · Sabbir · ৳ 720"].map((r) => (
            <div key={r} className="border-t border-[color:var(--orzen-border)] py-1.5 first:border-0">
              {r}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg bg-[color:var(--orzen-slate-50)] p-2">
      <p className="text-[10px] uppercase tracking-wider text-[color:var(--orzen-muted)]">{label}</p>
      <p className="font-bold">{v}</p>
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

const TEMPLATES = [
  { name: "Nova Fashion", cat: "Fashion", from: "#111827", to: "#2563eb" },
  { name: "Voltronics", cat: "Electronics", from: "#0f172a", to: "#0ea5e9" },
  { name: "Casa Mode", cat: "Furniture", from: "#78350f", to: "#f59e0b" },
  { name: "Bloom Beauty", cat: "Cosmetics", from: "#831843", to: "#f472b6" },
  { name: "PageOne", cat: "Books", from: "#134e4a", to: "#14b8a6" },
  { name: "Foodly", cat: "Food", from: "#7f1d1d", to: "#f97316" },
  { name: "PixelVault", cat: "Digital Products", from: "#312e81", to: "#8b5cf6" },
];

function Templates() {
  return (
    <section id="templates" className="scroll-mt-24 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader
          eyebrow="Marketplace"
          title="Premium themes for every niche"
          subtitle="Launch with a professionally designed template — one click and it's yours to customize."
        />
        <div className="-mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
          {TEMPLATES.map((t) => (
            <div
              key={t.name}
              className="group snap-start w-72 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--orzen-border)] bg-white transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)] sm:w-auto"
            >
              <div
                className="relative h-44 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
              >
                <div className="absolute inset-x-4 top-4 flex items-center justify-between text-white/90">
                  <span className="text-xs font-bold">{t.name}</span>
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div className="absolute inset-x-4 bottom-4 grid grid-cols-3 gap-1.5">
                  <div className="h-12 rounded-md bg-white/85" />
                  <div className="h-12 rounded-md bg-white/70" />
                  <div className="h-12 rounded-md bg-white/50" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-bold">{t.name}</p>
                  <p className="text-xs text-[color:var(--orzen-muted)]">{t.cat}</p>
                </div>
                <Link
                  to="/auth"
                  className="rounded-full border border-[color:var(--orzen-navy)] px-3 py-1.5 text-xs font-semibold text-[color:var(--orzen-navy)] hover:bg-[color:var(--orzen-navy)] hover:text-white"
                >
                  Use Template
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
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
  return (
    <section className="bg-[color:var(--orzen-slate-50)] py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader eyebrow="Why ORZEN" title="Built for the way you actually sell" />
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map((w) => (
            <div
              key={w.title}
              className="flex h-full items-start gap-4 rounded-2xl border border-[color:var(--orzen-border)] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
            >
              <span className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--orzen-navy)] text-white">
                <w.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-snug">{w.title}</h3>
                <p className="mt-1.5 text-sm text-[color:var(--orzen-muted)]">{w.desc}</p>
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

const REVIEWS = [
  {
    name: "Rafiul Islam",
    store: "Nova Fashion",
    initials: "RI",
    tone: "#2563eb",
    review:
      "We tripled orders in 8 weeks. The AI handles 70% of customer chats — my team finally sleeps.",
  },
  {
    name: "Nusrat Jahan",
    store: "Deshi Basket",
    initials: "NJ",
    tone: "#16a34a",
    review:
      "Setup took a Sunday afternoon. Courier booking with Pathao inside ORZEN saved us 4 hours a day.",
  },
  {
    name: "Sabbir Hossain",
    store: "Techmart BD",
    initials: "SH",
    tone: "#f59e0b",
    review: "Pixel + retargeting is baked in. Our Facebook ROAS jumped from 2.1x to 5.4x.",
  },
  {
    name: "Ayesha Rahman",
    store: "Bloom Beauty",
    initials: "AR",
    tone: "#db2777",
    review: "The themes are beautiful. Customers keep asking who designed our store.",
  },
  {
    name: "Tanvir Ahmed",
    store: "Voltronics",
    initials: "TA",
    tone: "#0ea5e9",
    review: "Inventory, invoices, analytics — one login. I stopped juggling five tabs.",
  },
  {
    name: "Mahi Chowdhury",
    store: "Foodly",
    initials: "MC",
    tone: "#dc2626",
    review: "Messenger AI confirms orders overnight. Morning routine: just print labels.",
  },
];

function Testimonials() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % REVIEWS.length), 4500);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHeader eyebrow="Customers" title="Loved by store owners across Bangladesh" />
        <div className="mt-12 overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(calc(-${i} * (100% / 3)))` }}
          >
            {REVIEWS.concat(REVIEWS.slice(0, 3)).map((r, idx) => (
              <div key={idx} className="w-full shrink-0 px-2 sm:w-1/2 lg:w-1/3">
                <div className="h-full rounded-2xl border border-[color:var(--orzen-border)] bg-white p-6 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white"
                      style={{ background: r.tone }}
                    >
                      {r.initials}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{r.name}</p>
                      <p className="text-xs text-[color:var(--orzen-muted)]">{r.store}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-0.5 text-[color:var(--orzen-warning)]">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--orzen-navy)]">{r.review}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-1.5">
          {REVIEWS.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                k === i ? "w-6 bg-[color:var(--orzen-navy)]" : "w-1.5 bg-[color:var(--orzen-border)]"
              )}
              aria-label={`Show review ${k + 1}`}
            />
          ))}
        </div>
      </div>
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
  return (
    <section id="faq" className="scroll-mt-24 bg-[color:var(--orzen-slate-50)] py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <SectionHeader eyebrow="FAQ" title="Everything you wanted to know" />
        <Accordion type="single" collapsible className="mt-10 space-y-2">
          {FAQS.map((f, i) => (
            <AccordionItem
              key={i}
              value={`f-${i}`}
              className="rounded-xl border border-[color:var(--orzen-border)] bg-white px-4"
            >
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-[color:var(--orzen-muted)]">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                   */
/* -------------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="px-5 py-16 md:px-8 md:py-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[color:var(--orzen-navy)] px-6 py-16 text-center text-white shadow-[var(--shadow-lift)] sm:px-12 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(37,99,235,0.25), transparent 45%)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" /> Free forever plan · No credit card
          </span>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Ready to Launch Your Store?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/70 sm:text-base">
            Start building today with ORZEN — everything you need to sell, in one platform.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--orzen-blue)] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[color:var(--orzen-blue-600)] sm:w-auto"
            >
              Create Store Free <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
            >
              Explore Features
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                      */
/* -------------------------------------------------------------------------- */

function Footer() {
  const cols = [
    {
      title: "Product",
      links: [
        { label: "Features", href: "#features" },
        { label: "Templates", href: "#templates" },
        { label: "AI", href: "#ai" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Blog", href: "#" },
        { label: "Support", href: "#contact" },
        { label: "Contact", href: "#contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms", href: "#" },
      ],
    },
  ];
  return (
    <footer id="contact" className="scroll-mt-24 border-t border-[color:var(--orzen-border)] bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <LogoMark />
              <span className="text-lg font-extrabold tracking-tight">ORZEN</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-[color:var(--orzen-muted)]">
              An all-in-one eCommerce SaaS built for Bangladesh — store builder, AI sales agent,
              couriers, analytics and payments in one platform.
            </p>
            <div className="mt-5 flex gap-2">
              {[
                { icon: Facebook, label: "Facebook" },
                { icon: Linkedin, label: "LinkedIn" },
                { icon: Youtube, label: "YouTube" },
                { icon: Mail, label: "Email" },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-[color:var(--orzen-border)] text-[color:var(--orzen-muted)] hover:border-[color:var(--orzen-navy)] hover:text-[color:var(--orzen-navy)]"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--orzen-navy)]">
                {c.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[color:var(--orzen-muted)] hover:text-[color:var(--orzen-navy)]"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[color:var(--orzen-border)] pt-6 text-xs text-[color:var(--orzen-muted)] sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} ORZEN. All rights reserved.</p>
          <p>Made with care in Dhaka.</p>
        </div>
      </div>
    </footer>
  );
}
