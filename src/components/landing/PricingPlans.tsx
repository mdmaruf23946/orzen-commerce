import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight, Check, X, Camera, Globe, PhoneCall, Truck, ShieldCheck, Inbox, Sparkles,
} from "lucide-react";
import { getPublicPricing, computeCycleTotal } from "@/lib/billing.functions";
import { ALWAYS_INCLUDED, FEATURE_LABELS as CORE_LABELS, formatLimit } from "@/lib/features";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Bi = { en: string; bn: string };


type Cycle = "monthly" | "3m" | "6m" | "yearly";

// Mirrors the Merchant panel "Billing & Subscription" plan cards. Plans and
// cycle discounts are read live from the database, so editing a package in the
// admin panel updates this section automatically.
export function PricingPlans() {
  const { pick } = useLang();
  const fetchPricing = useServerFn(getPublicPricing);
  const { data, isError } = useQuery({
    queryKey: ["platform", "public-pricing"],
    queryFn: () => fetchPricing(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const plans = ((data?.plans ?? []) as any[]);
  const s = data?.discounts ?? { discount_3m: 5, discount_6m: 10, discount_yearly: 20 };
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const cycles: { key: Cycle; en: string; bn: string; off: number }[] = [
    { key: "monthly", en: "Monthly", bn: "মাসিক", off: 0 },
    { key: "3m", en: "3 Months", bn: "৩ মাস", off: s.discount_3m },
    { key: "6m", en: "6 Months", bn: "৬ মাস", off: s.discount_6m },
    { key: "yearly", en: "Yearly", bn: "বাৎসরিক", off: s.discount_yearly },
  ];
  const paid = plans.filter((p) => Number(p.price) > 0).sort((a, b) => Number(a.price) - Number(b.price));
  // Pro is the recommended "Best Choice" plan.
  const popularId =
    (paid.find((p) => (p.name ?? "").trim().toLowerCase() === "pro") ??
      paid.find((p) => p.plan_tier === "business") ??
      paid[0])?.id ?? null;

  return (
    <section id="pricing" className="scroll-mt-24 py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--orzen-blue)]">
            {pick({ en: "Pricing", bn: "প্যাকেজ" })}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {pick({ en: "Pick the plan that fits your business", bn: "আপনার ব্যবসার জন্য সঠিক প্যাকেজ বেছে নিন" })}
          </h2>
          <p className="mt-3 text-sm text-[color:var(--orzen-muted)] sm:text-base">
            {pick({ en: "Start free. Upgrade anytime. Longer cycles save more.", bn: "ফ্রিতে শুরু করুন, যেকোনো সময় আপগ্রেড করুন। লম্বা মেয়াদে বেশি সাশ্রয়।" })}
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
          {cycles.map((c) => {
            const active = cycle === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCycle(c.key)}
                aria-pressed={active}
                className={cn(
                  "relative rounded-xl border bg-white p-3 text-left transition",
                  active ? "border-[color:var(--orzen-blue)] ring-2 ring-[color:var(--orzen-blue)]/25" : "border-[color:var(--orzen-border)] hover:border-[color:var(--orzen-navy)]",
                )}
              >
                <div className="text-sm font-semibold">{pick(c)}</div>
                <div className="mt-0.5 text-[11px] text-[color:var(--orzen-muted)]">
                  {c.off > 0 ? pick({ en: `Save ${c.off}%`, bn: `${c.off}% সাশ্রয়` }) : pick({ en: "No discount", bn: "ছাড় নেই" })}
                </div>
                {c.off > 0 && (
                  <span className="absolute -top-2 right-2 rounded-full bg-[color:var(--orzen-success)] px-1.5 py-0.5 text-[10px] font-bold text-white">-{c.off}%</span>
                )}
              </button>
            );
          })}
        </div>

        {isError && (
          <p className="mt-8 text-center text-sm text-[color:var(--orzen-muted)]">
            <Link to="/pricing" className="underline">{pick({ en: "View all plans", bn: "সব প্যাকেজ দেখুন" })}</Link>
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((p) => {
            const tier = p.plan_tier ?? "";
            const isCustom = tier === "custom";
            const isFree = !isCustom && Number(p.price) === 0;
            const isPopular = !isCustom && !isFree && popularId === p.id;
            const calc = !isFree && !isCustom ? computeCycleTotal(Number(p.price), cycle, s) : null;
            const f = (p.features ?? {}) as Record<string, boolean>;
            const any = (...ks: string[]) => isCustom || ks.some((k) => !!f[k]);
            const items: { key: string; label: Bi; on: boolean }[] = [
              { key: "ai_agent", label: { en: "AI Sales Agent", bn: "AI Sales Agent" }, on: any("ai_agent") },
              { key: "messaging", label: { en: "AI Messaging", bn: "AI মেসেজিং" }, on: any("ai_messenger", "whatsapp", "messenger_inbox") },
              { key: "facebook", label: { en: "Facebook Comment & Posts", bn: "ফেসবুক কমেন্ট ও পোস্ট" }, on: any("facebook_page") },
              { key: "call", label: { en: "Call Center", bn: "কল সেন্টার" }, on: any("call_center") },
              { key: "builder", label: { en: "AI Product Builder", bn: "AI প্রোডাক্ট বিল্ডার" }, on: any("ai_product_builder") },
              { key: "lp_create", label: { en: "Landing Pages", bn: "ল্যান্ডিং পেজ" }, on: any("landing_page_create") || (f.landing_page_create === undefined && !!f.landing_pages) },
              { key: "lp_connect", label: { en: "Website Integration", bn: "Website Integration" }, on: any("landing_page_connect") || (f.landing_page_connect === undefined && !!f.landing_pages) },
              { key: "courier", label: { en: "Courier Integration", bn: "কুরিয়ার" }, on: any("courier") },
              { key: "fraud", label: { en: "Fraud Checker", bn: "ফ্রড চেকার" }, on: any("fraud_checker", "duplicate_protection") },
              { key: "pixel", label: { en: "Facebook Pixel", bn: "Facebook Pixel" }, on: any("pixel") },
              { key: "domain", label: { en: "Custom Domain", bn: "নিজস্ব ডোমেইন" }, on: any("custom_domain") },
              { key: "coupons", label: { en: "Coupons", bn: "কুপন" }, on: any("coupons") },
              { key: "inventory", label: { en: "Inventory & Bulk", bn: "ইনভেন্টরি ও বাল্ক" }, on: any("inventory", "bulk_actions", "import_export", "quick_order") },
              { key: "analytics", label: { en: "Analytics", bn: "Analytics" }, on: any("analytics") },
              { key: "returns", label: { en: "Returns", bn: "রিটার্ন" }, on: any("returns") },
              { key: "reviews", label: { en: "Product Reviews", bn: "প্রোডাক্ট রিভিউ" }, on: any("product_reviews") },
              { key: "staff", label: { en: "Staff Management", bn: "স্টাফ ম্যানেজমেন্ট" }, on: any("staff") },
            ];
            const visible = items.filter((i) => !f[`hide_${i.key}`]);
            const enabled = visible.filter((i) => i.on);
            return (
              <article
                key={p.id}
                className={cn(
                  "relative flex min-w-0 flex-col rounded-2xl border bg-white p-4 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]",
                  isPopular ? "border-[color:var(--orzen-blue)] ring-2 ring-[color:var(--orzen-blue)]/25" : "border-[color:var(--orzen-border)]",
                )}
              >
                {isPopular && (
                  <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-[color:var(--orzen-blue)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    <Sparkles className="h-3 w-3" /> {pick({ en: "Best Choice", bn: "সেরা পছন্দ" })}
                  </span>
                )}
                <h3 className="text-base font-bold">{p.name}</h3>
                {p.description && <p className="mt-0.5 truncate text-xs text-[color:var(--orzen-muted)]" title={p.description}>{p.description}</p>}

                <div className="mt-3">
                  {isCustom ? (
                    <div className="text-2xl font-extrabold">Custom</div>
                  ) : isFree ? (
                    <div className="text-2xl font-extrabold">৳0<span className="text-sm font-normal text-[color:var(--orzen-muted)]"> / {pick({ en: "forever", bn: "সবসময়" })}</span></div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-extrabold">৳{calc!.total.toLocaleString()}</div>
                        {calc!.discountPct > 0 && (
                          <div className="text-xs text-[color:var(--orzen-muted)] line-through">৳{(Number(p.price) * calc!.months).toLocaleString()}</div>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[color:var(--orzen-muted)]">
                        ৳{calc!.perMonth.toLocaleString()}/mo · every {calc!.months} mo
                      </div>
                      {calc!.saved > 0 && (
                        <div className="mt-1 inline-block rounded bg-[color:var(--orzen-success)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--orzen-success)]">
                          Save ৳{calc!.saved.toLocaleString()}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {Number(p.ai_credits_included) > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[color:var(--orzen-blue)]/30 bg-[color:var(--orzen-blue)]/10 px-2 py-1.5 text-xs font-semibold text-[color:var(--orzen-blue)]">
                    <Sparkles className="h-3.5 w-3.5" /> {Number(p.ai_credits_included).toLocaleString()} AI credits free
                  </div>
                )}

                <ul className="mt-3 space-y-1 text-[13px]">
                  <Limit label={pick({ en: "Products", bn: "প্রোডাক্ট" })} value={formatLimit(p.product_limit, undefined)} />
                  <Limit label={pick({ en: "Orders / month", bn: "অর্ডার / মাস" })} value={formatLimit(p.order_limit, undefined)} />
                  <Limit label={pick({ en: "Storage", bn: "স্টোরেজ" })} value={formatLimit(p.storage_mb, "MB")} />
                  <Limit label={pick({ en: "Staff", bn: "স্টাফ" })} value={formatLimit(p.staff_limit, undefined)} />
                  {(isCustom || !!f.landing_page_create) && (
                    <Limit label={pick({ en: "Landing Pages", bn: "ল্যান্ডিং পেজ" })} value={formatLimit(p.landing_page_limit, undefined)} />
                  )}
                </ul>

                <ul className="mt-3 flex-1 space-y-1.5 border-t border-[color:var(--orzen-border)] pt-3 text-[13px]">
                  {[...enabled, ...visible.filter((i) => !i.on)].map((i) => (
                    <li key={i.key} className="flex min-w-0 items-center gap-1.5" title={pick(i.label)}>
                      {i.on ? (
                        <Check className="h-3.5 w-3.5 flex-none text-[color:var(--orzen-success)]" />
                      ) : (
                        <X className="h-3.5 w-3.5 flex-none text-destructive/70" />
                      )}
                      <span className={cn("truncate whitespace-nowrap", !i.on && "text-[color:var(--orzen-muted)] line-through opacity-70")}>{pick(i.label)}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/auth"
                  className={cn(
                    "mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition",
                    isPopular
                      ? "bg-[color:var(--orzen-blue)] text-white hover:bg-[color:var(--orzen-blue-600)]"
                      : "border border-[color:var(--orzen-border)] text-[color:var(--orzen-navy)] hover:border-[color:var(--orzen-navy)]",
                  )}
                >
                  {isCustom ? pick({ en: "Contact Sales", bn: "যোগাযোগ করুন" }) : isFree ? pick({ en: "Start free", bn: "ফ্রিতে শুরু করুন" }) : pick({ en: "Choose plan", bn: "প্যাকেজ নিন" })}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-[color:var(--orzen-border)] bg-[color:var(--orzen-slate-50)] p-4">
          <div className="text-sm font-semibold">{pick({ en: "Included in every plan", bn: "প্রতিটি প্যাকেজে অন্তর্ভুক্ত" })}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Physical Products", ...ALWAYS_INCLUDED.filter((k) => !["digital_products", "service_products", "subscription_products"].includes(k)).map((k) => CORE_LABELS[k])].map((l) => (
              <span key={l} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--orzen-border)] bg-white px-2.5 py-1 text-xs">
                <Check className="h-3.5 w-3.5 text-[color:var(--orzen-success)]" />{l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-[color:var(--orzen-muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
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
