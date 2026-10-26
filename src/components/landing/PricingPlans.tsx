import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight, Check, Camera, Globe, PhoneCall, Truck, ShieldCheck, Inbox, Sparkles,
} from "lucide-react";
import { listPublicPlans } from "@/lib/billing.functions";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Bi = { en: string; bn: string };

// Merchant-facing labels; digital/service/subscription products and AI calling
// are hidden platform-wide, so they are never advertised here.
const FEATURE_LABELS: Record<string, Bi> = {
  ai_messenger: { en: "AI Sales Agent (Messenger)", bn: "AI Sales Agent (Messenger)" },
  ai_agent: { en: "AI automation agent", bn: "AI অটোমেশন এজেন্ট" },
  whatsapp: { en: "WhatsApp automation", bn: "WhatsApp অটোমেশন" },
  messenger_inbox: { en: "Omni Inbox (all chats)", bn: "Omni Inbox (সব চ্যাট এক জায়গায়)" },
  facebook_page: { en: "Facebook Page connect", bn: "Facebook Page কানেক্ট" },
  ai_product_builder: { en: "AI product builder", bn: "AI প্রোডাক্ট বিল্ডার" },
  courier: { en: "Courier booking & tracking", bn: "কুরিয়ার বুকিং ও ট্র্যাকিং" },
  call_center: { en: "Call center (manual calling)", bn: "কল সেন্টার (ম্যানুয়াল কল)" },
  fraud_checker: { en: "Fraud checker", bn: "ফ্রড চেকার" },
  duplicate_protection: { en: "Duplicate order protection", bn: "ডুপ্লিকেট অর্ডার প্রোটেকশন" },
  landing_page_create: { en: "Landing page builder", bn: "ল্যান্ডিং পেজ বিল্ডার" },
  landing_page_connect: { en: "Website Integration", bn: "Website Integration" },
  analytics: { en: "Analytics & reports", bn: "Analytics ও রিপোর্ট" },
  pixel: { en: "Facebook Pixel & CAPI", bn: "Facebook Pixel ও CAPI" },
  custom_domain: { en: "Custom domain", bn: "নিজস্ব ডোমেইন" },
  seo: { en: "SEO tools", bn: "SEO টুলস" },
  inventory: { en: "Inventory management", bn: "ইনভেন্টরি ম্যানেজমেন্ট" },
  invoice: { en: "Branded invoices", bn: "ব্র্যান্ডেড ইনভয়েস" },
  returns: { en: "Returns management", bn: "রিটার্ন ম্যানেজমেন্ট" },
  wallet: { en: "Wallet", bn: "ওয়ালেট" },
  bulk_actions: { en: "Bulk actions", bn: "বাল্ক অ্যাকশন" },
  import_export: { en: "Import / export", bn: "ইমপোর্ট / এক্সপোর্ট" },
  payment_gateways: { en: "Payment gateways", bn: "পেমেন্ট গেটওয়ে" },
  customer_notes: { en: "Customer CRM notes", bn: "কাস্টমার CRM নোট" },
  coupons: { en: "Coupons", bn: "কুপন" },
  themes: { en: "Themes", bn: "থিম" },
  delivery_zones: { en: "Delivery zones", bn: "ডেলিভারি জোন" },
  quick_order: { en: "Quick order", bn: "কুইক অর্ডার" },
  product_reviews: { en: "Product reviews", bn: "প্রোডাক্ট রিভিউ" },
  customer_accounts: { en: "Customer accounts", bn: "কাস্টমার অ্যাকাউন্ট" },
  custom_pages: { en: "Custom pages", bn: "কাস্টম পেজ" },
  notifications: { en: "Notifications", bn: "নোটিফিকেশন" },
};

const CYCLES = [
  { key: 1, en: "Monthly", bn: "মাসিক", off: 0 },
  { key: 3, en: "3 months", bn: "৩ মাস", off: 10 },
  { key: 6, en: "6 months", bn: "৬ মাস", off: 20 },
  { key: 12, en: "Yearly", bn: "বাৎসরিক", off: 30 },
] as const;

export function PricingPlans() {
  const { pick } = useLang();
  const fetchPlans = useServerFn(listPublicPlans);
  const { data: plans = [], isError } = useQuery({
    queryKey: ["platform", "public-plans"],
    queryFn: () => fetchPlans(),
    staleTime: 5 * 60 * 1000,
  });
  const [cycle, setCycle] = useState<(typeof CYCLES)[number]>(CYCLES[0]);
  const popularIdx = plans.length > 2 ? plans.length - 2 : -1;

  return (
    <section id="pricing" className="scroll-mt-24 py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--orzen-blue)]">
            {pick({ en: "Pricing", bn: "প্যাকেজ" })}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {pick({ en: "Simple plans that grow with you", bn: "আপনার ব্যবসার সাথে বাড়ে এমন সহজ প্যাকেজ" })}
          </h2>
          <p className="mt-3 text-sm text-[color:var(--orzen-muted)] sm:text-base">
            {pick({ en: "Start free. Upgrade anytime. Longer cycles save more.", bn: "ফ্রিতে শুরু করুন, যেকোনো সময় আপগ্রেড করুন। লম্বা মেয়াদে বেশি সাশ্রয়।" })}
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-[color:var(--orzen-border)] bg-[color:var(--orzen-slate-50)] p-1">
            {CYCLES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCycle(c)}
                aria-pressed={cycle.key === c.key}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm",
                  cycle.key === c.key
                    ? "bg-[color:var(--orzen-navy)] text-white shadow-[var(--shadow-soft)]"
                    : "text-[color:var(--orzen-muted)] hover:text-[color:var(--orzen-navy)]",
                )}
              >
                {pick(c)}
                {c.off > 0 && <span className="ml-1 text-[color:var(--orzen-success)]">-{c.off}%</span>}
              </button>
            ))}
          </div>
        </div>

        {isError && (
          <p className="mt-8 text-center text-sm text-[color:var(--orzen-muted)]">
            <Link to="/pricing" className="underline">{pick({ en: "View all plans", bn: "সব প্যাকেজ দেখুন" })}</Link>
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(plans as any[]).map((p, i) => {
            const price = Number(p.price) || 0;
            const total = Math.round(price * cycle.key * (1 - cycle.off / 100));
            const perMonth = Math.round(total / cycle.key);
            const popular = i === popularIdx;
            const feats = Object.entries((p.features ?? {}) as Record<string, boolean>)
              .filter(([k, v]) => v && FEATURE_LABELS[k])
              .map(([k]) => k);
            return (
              <article
                key={p.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]",
                  popular ? "border-[color:var(--orzen-blue)] shadow-[var(--shadow-lift)] ring-2 ring-[color:var(--orzen-blue)]/20" : "border-[color:var(--orzen-border)]",
                )}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--orzen-blue)] px-3 py-1 text-[11px] font-bold text-white">
                    {pick({ en: "Most popular", bn: "সবচেয়ে জনপ্রিয়" })}
                  </span>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <div className="mt-3">
                  <span className="text-3xl font-extrabold">৳{perMonth.toLocaleString()}</span>
                  <span className="text-sm text-[color:var(--orzen-muted)]">/{pick({ en: "mo", bn: "মাস" })}</span>
                  {price > 0 && cycle.key > 1 && (
                    <p className="mt-1 text-xs text-[color:var(--orzen-muted)]">
                      ৳{total.toLocaleString()} {pick({ en: `billed every ${cycle.key} months`, bn: `${cycle.key} মাসে একবার` })}
                    </p>
                  )}
                </div>
                <ul className="mt-4 space-y-1.5 border-b border-[color:var(--orzen-border)] pb-4 text-sm">
                  <li><b>{p.product_limit ?? "∞"}</b> {pick({ en: "products", bn: "প্রোডাক্ট" })}</li>
                  <li><b>{p.order_limit ?? "∞"}</b> {pick({ en: "orders / month", bn: "অর্ডার / মাস" })}</li>
                  <li><b>{p.staff_limit ?? "∞"}</b> {pick({ en: "staff", bn: "স্টাফ" })}</li>
                  {Number(p.landing_page_limit) > 0 && (
                    <li><b>{p.landing_page_limit}</b> {pick({ en: "landing pages", bn: "ল্যান্ডিং পেজ" })}</li>
                  )}
                </ul>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {feats.map((k) => (
                    <li key={k} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-none text-[color:var(--orzen-success)]" />
                      <span>{pick(FEATURE_LABELS[k]!)}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth"
                  className={cn(
                    "mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition",
                    popular
                      ? "bg-[color:var(--orzen-blue)] text-white hover:bg-[color:var(--orzen-blue-600)]"
                      : "border border-[color:var(--orzen-border)] text-[color:var(--orzen-navy)] hover:border-[color:var(--orzen-navy)]",
                  )}
                >
                  {price === 0 ? pick({ en: "Start free", bn: "ফ্রিতে শুরু করুন" }) : pick({ en: "Choose plan", bn: "প্যাকেজ নিন" })}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const HIGHLIGHTS: { icon: typeof Inbox; title: Bi; desc: Bi }[] = [
  { icon: Inbox, title: { en: "Omni Inbox", bn: "Omni Inbox" }, desc: { en: "Messenger, WhatsApp and Web Chat in one inbox with customer CRM, AI/human takeover.", bn: "Messenger, WhatsApp ও Web Chat এক ইনবক্সে — কাস্টমার CRM ও এক ক্লিকে AI/হিউম্যান টেকওভার।" } },
  { icon: Camera, title: { en: "Photo product search", bn: "ছবি দিয়ে প্রোডাক্ট খোঁজা" }, desc: { en: "Customers send a photo — AI finds the matching product from your store only.", bn: "কাস্টমার ছবি পাঠালেই AI শুধু আপনার স্টোর থেকে মিলিয়ে প্রোডাক্ট দেখায়।" } },
  { icon: ShieldCheck, title: { en: "Spam & fraud shield", bn: "স্প্যাম ও ফ্রড সুরক্ষা" }, desc: { en: "AI pauses on abusive chats; duplicate and fake orders are blocked automatically.", bn: "গালি বা অযথা মেসেজে AI নিজে থামে; ডুপ্লিকেট ও ভুয়া অর্ডার আটকে যায়।" } },
  { icon: Globe, title: { en: "Website Integration", bn: "Website Integration" }, desc: { en: "Connect WooCommerce or any landing page — orders and status sync both ways.", bn: "WooCommerce বা যেকোনো ল্যান্ডিং পেজ যুক্ত করুন — অর্ডার ও স্ট্যাটাস দুই দিকেই সিঙ্ক।" } },
  { icon: Truck, title: { en: "Courier & COD finance", bn: "কুরিয়ার ও COD হিসাব" }, desc: { en: "Book Steadfast, Pathao, RedX & more; track COD collection, fees and payouts.", bn: "Steadfast, Pathao, RedX সহ বুকিং; COD কালেকশন, চার্জ ও পেমেন্ট হিসাব এক জায়গায়।" } },
  { icon: PhoneCall, title: { en: "Call center", bn: "কল সেন্টার" }, desc: { en: "Call customers from the browser via Bangladeshi providers, with recordings.", bn: "বাংলাদেশি প্রোভাইডার দিয়ে ব্রাউজার থেকেই কাস্টমারকে কল ও রেকর্ডিং।" } },
];

export function PlatformHighlights() {
  const { pick } = useLang();
  return (
    <section className="py-10 md:py-12">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--orzen-blue)]">
            <Sparkles className="h-3.5 w-3.5" /> {pick({ en: "New in ORZEN", bn: "ORZEN-এ নতুন" })}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {pick({ en: "Built to sell more, with less work", bn: "কম পরিশ্রমে বেশি বিক্রির জন্য তৈরি" })}
          </h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title.en} className="rounded-2xl border border-[color:var(--orzen-border)] bg-white p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]">
              <span className="inline-grid h-11 w-11 place-items-center rounded-xl bg-[color:var(--orzen-blue)]/10 text-[color:var(--orzen-blue)]">
                <h.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold">{pick(h.title)}</h3>
              <p className="mt-1.5 text-sm text-[color:var(--orzen-muted)]">{pick(h.desc)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
