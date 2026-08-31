import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, X, Sparkles, Crown, Sparkle, Download, Loader2 } from "lucide-react";
import {
  myBillingStatus,
  listPublicPlans,
  getBillingSettings,
  computeCycleTotal,
  activateFreePlan,
  type CycleKey,
} from "@/lib/billing.functions";
import { FEATURE_KEYS, FEATURE_LABELS, formatLimit } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import WalletPanel from "@/components/admin/billing/WalletPanel";
import { getFooterSettings } from "@/lib/footer.functions";
import { openSubscriptionInvoice } from "@/lib/subscription-invoice-print";
import { usePlatformBranding, resolvePlacement } from "@/lib/platform-branding";

export const Route = createFileRoute("/_authenticated/admin/billing/")({
  head: () => ({
    meta: [
      { title: "Billing & Plans — ORZEN Merchant Panel" },
      { name: "description", content: "Compare subscription plans, upgrade and view payment history." },
      { property: "og:title", content: "Billing & Plans — ORZEN Merchant Panel" },
      { property: "og:description", content: "Compare subscription plans, upgrade and view payment history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    highlight: typeof s.highlight === "string" ? s.highlight : undefined,
    plan: typeof s.plan === "string" ? s.plan : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
  }),
  component: BillingPage,
});

type Plan = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  billing_cycle?: string | null;
  is_trial?: boolean | null;
  plan_tier?: "free" | "basic" | "business" | "custom" | null;
  product_limit?: number | null;
  order_limit?: number | null;
  storage_mb?: number | null;
  staff_limit?: number | null;
  features?: Record<string, any> | null;
  feature_summary?: string[] | null;
};

const TIER_ORDER: Array<"free" | "basic" | "business" | "custom"> = ["free", "basic", "business", "custom"];
const TIER_NAME: Record<string, string> = {
  free: "Free Plan",
  basic: "Basic Plan",
  business: "Business Plan",
  custom: "Custom Plan",
};

function tierOf(p: Plan): "free" | "basic" | "business" | "custom" | null {
  if (p.plan_tier) return p.plan_tier;
  const n = (p.name ?? "").toLowerCase();
  if (n.includes("free")) return "free";
  if (n.includes("basic") || n.includes("starter")) return "basic";
  if (n.includes("business") || n.includes("pro")) return "business";
  if (n.includes("custom") || n.includes("enterprise")) return "custom";
  return null;
}

// Invoice rendering lives in `subscription-invoice-print` — it opens a clean,
// standalone A4 receipt window so the billing page never enters the PDF.


function BillingPage() {
  const statusFn = useServerFn(myBillingStatus);
  const plansFn = useServerFn(listPublicPlans);
  const settingsFn = useServerFn(getBillingSettings);
  const search = Route.useSearch();

  const { data: status } = useQuery({ queryKey: ["admin", "billing"], queryFn: () => statusFn() });
  const { data: plansRaw } = useQuery({ queryKey: ["admin", "billingPlans"], queryFn: () => plansFn() });
  const { data: settings } = useQuery({
    queryKey: ["admin", "billingSettings"],
    queryFn: () => settingsFn(),
    staleTime: 5 * 60_000,
  });

  const { data: branding } = usePlatformBranding();
  const footerFn = useServerFn(getFooterSettings);
  const { data: footer } = useQuery({
    queryKey: ["platform", "footer"],
    queryFn: () => footerFn(),
    staleTime: 10 * 60_000,
  });
  const invoiceBrand = useMemo(() => {
    const r = resolvePlacement(branding ?? null, "invoice", false);
    return {
      logoUrl: r?.logo?.url ?? null,
      wordmarkUrl: r?.wordmark?.url ?? null,
      supportEmail: footer?.contact?.email ?? null,
    };
  }, [branding, footer]);

  const [cycle, setCycle] = useState<CycleKey>("monthly");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const plans = (plansRaw ?? []) as Plan[];
  const store = status?.store as any;
  const pkg = store?.subscription_packages as Plan | undefined;
  const subStatus = (store?.subscription_status ?? "active") as string;
  const daysLeft = status?.days_left ?? 0;
  const isTrialing = subStatus === "trialing";

  function openInvoice(p: any) {
    void openSubscriptionInvoice(p, store, invoiceBrand);
  }

  const tierMap = useMemo(() => {
    const m = new Map<string, Plan>();
    for (const p of plans) {
      const t = tierOf(p);
      if (t && !m.has(t)) m.set(t, p);
    }
    return m;
  }, [plans]);

  const currentTier = pkg ? tierOf(pkg) : isTrialing ? null : "free";
  // Expired / cancelled / suspended → the plan is no longer active, so the
  // merchant must be able to renew (update) it manually again.
  const isInactive = ["expired", "cancelled", "suspended", "past_due"].includes(subStatus);
  const s = settings ?? { discount_3m: 5, discount_6m: 10, discount_yearly: 20 };

  // Free plan activates instantly — no transaction ID or phone number needed.
  const queryClient = useQueryClient();
  const activateFreeFn = useServerFn(activateFreePlan);
  const [activatingFreeId, setActivatingFreeId] = useState<string | null>(null);
  async function handleActivateFree(packageId: string) {
    setActivatingFreeId(packageId);
    try {
      const res = (await activateFreeFn({ data: { package_id: packageId } })) as any;
      if (!res?.ok) throw new Error(res?.error ?? "Could not activate the free plan");
      toast.success("Free plan activated");
      await queryClient.invalidateQueries({ queryKey: ["admin", "billing"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActivatingFreeId(null);
    }
  }

  // Highlight logic: prefer explicit `plan` id, else the cheapest paid plan
  // that includes the requested `highlight` feature key.
  const highlightedPlanId = useMemo<string | null>(() => {
    if (search.plan) return search.plan;
    if (!search.highlight) return null;
    const eligible = plans
      .filter((p) => !p.is_trial && p.features?.[search.highlight as string] === true)
      .sort((a, b) => Number(a.price) - Number(b.price));
    return eligible[0]?.id ?? null;
  }, [plans, search.plan, search.highlight]);

  useEffect(() => {
    if (!highlightedPlanId) return;
    const el = cardRefs.current[highlightedPlanId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedPlanId]);

  const cycleOptions: { key: CycleKey; label: string; discount: number }[] = [
    { key: "monthly", label: "Monthly", discount: 0 },
    { key: "3m", label: "3 Months", discount: s.discount_3m },
    { key: "6m", label: "6 Months", discount: s.discount_6m },
    { key: "yearly", label: "Yearly", discount: s.discount_yearly },
  ];

  return (
    <div className="space-y-3 pb-6 max-w-full overflow-x-hidden sm:space-y-6 sm:pb-10">

      {search.highlight && FEATURE_LABELS[search.highlight as keyof typeof FEATURE_LABELS] && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground">
              Upgrade to unlock {FEATURE_LABELS[search.highlight as keyof typeof FEATURE_LABELS]}
            </div>
            <p className="text-xs text-muted-foreground">
              We highlighted the plan that includes this feature.
            </p>
          </div>
        </div>
      )}


      {/* 1. Free Trial Banner — only when trialing */}
      {isTrialing && (
        <div className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-2.5 sm:rounded-xl sm:p-4 dark:border-amber-900/50 dark:from-amber-950/30 dark:to-orange-950/30">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-amber-900 dark:text-amber-200">
                <Sparkle className="h-3 w-3 shrink-0" />
                <span className="truncate text-[11px] font-semibold sm:text-sm">🎉 Trial Active</span>
              </div>
              <div className="mt-0.5 truncate text-sm font-bold text-amber-950 sm:text-lg dark:text-amber-100">
                {daysLeft} Day{daysLeft === 1 ? "" : "s"} Left
              </div>
              <p className="mt-0.5 truncate text-[10px] text-amber-800/80 sm:text-xs dark:text-amber-200/80">
                All Premium Features unlocked.
              </p>
            </div>
            {tierMap.get("business") && (
              <Link
                to="/admin/billing/checkout/$packageId"
                params={{ packageId: tierMap.get("business")!.id }}
                search={{ cycle } as any}
                className="shrink-0"
              >
                <Button size="sm" className="h-8 bg-amber-600 px-2.5 text-xs hover:bg-amber-700 sm:h-9 sm:px-3 sm:text-sm">Upgrade</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-base font-semibold sm:text-2xl">Billing & Subscription</h1>
        <p className="text-[11px] text-muted-foreground sm:text-sm">Pick the plan that fits your business — change anytime.</p>
      </div>

      {/* 8. Current Plan Section */}
      <div className="rounded-lg border bg-card p-2.5 sm:rounded-xl sm:p-5">
        <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Current plan</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-bold sm:text-xl">
                {isTrialing ? "Free Plan" : (currentTier ? TIER_NAME[currentTier] : "Free Plan")}
              </span>
              <Badge
                variant={subStatus === "active" ? "default" : isTrialing ? "secondary" : "destructive"}
                className="h-4 px-1.5 text-[9px] capitalize sm:h-6 sm:text-xs"
              >
                {isTrialing ? "Trial" : subStatus}
              </Badge>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground sm:text-sm">
              {isTrialing
                ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining · all premium unlocked`
                : pkg
                  ? `৳${Number(pkg.price).toFixed(0)} · ${pkg.billing_cycle ?? "monthly"}`
                  : "Limited features. Upgrade for more."}
            </div>
            {((isTrialing && store?.trial_ends_at) || store?.expires_at) && (
              <div className="mt-0.5 text-[10px] text-muted-foreground sm:hidden">
                {isTrialing && store?.trial_ends_at
                  ? `Trial ends ${new Date(store.trial_ends_at).toLocaleDateString()}`
                  : `Renews ${new Date(store.expires_at).toLocaleDateString()}`}
              </div>
            )}
          </div>
          <div className="hidden text-right sm:block">
            {isTrialing && store?.trial_ends_at ? (
              <>
                <div className="text-xs uppercase text-muted-foreground">Trial ends</div>
                <div className="text-sm font-medium">{new Date(store.trial_ends_at).toLocaleDateString()}</div>
              </>
            ) : store?.expires_at ? (
              <>
                <div className="text-xs uppercase text-muted-foreground">Renews / expires</div>
                <div className="text-sm font-medium">{new Date(store.expires_at).toLocaleDateString()}</div>
              </>
            ) : null}
          </div>
        </div>

        {isInactive && (
          <div className="mt-2 flex flex-col gap-2 rounded-md bg-red-50 p-2 text-[11px] text-red-900 sm:mt-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-lg sm:p-3 sm:text-sm dark:bg-red-950/30 dark:text-red-200">
            <span>Your subscription has expired. The Free plan is active now — renew to restore full access.</span>
            {pkg?.id && (
              <Link to="/admin/billing/checkout/$packageId" params={{ packageId: pkg.id }} search={{ cycle } as any} className="shrink-0">
                <Button size="sm" className="h-8 w-full text-xs sm:w-auto">Update</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Merchant Wallet */}
      <WalletPanel />

      {/* 3. Billing Cycle Selector */}
      <section>
        <div className="mb-1.5 flex items-center justify-between sm:mb-2">
          <h2 className="sr-only text-sm font-semibold sm:not-sr-only sm:text-lg">Choose your billing cycle</h2>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          {cycleOptions.map((c) => {
            const active = cycle === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCycle(c.key)}
                className={`relative rounded-lg border p-2 text-left transition sm:p-3 ${
                  active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:border-foreground/30"
                }`}
              >
                <div className="truncate text-[11px] font-semibold sm:text-sm">{c.label}</div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
                  {c.discount > 0 ? `Save ${c.discount}%` : "No discount"}
                </div>
                {c.discount > 0 && (
                  <span className="absolute -top-1.5 right-1.5 rounded-full bg-emerald-500 px-1 py-0.5 text-[8px] font-bold text-white sm:-top-2 sm:right-2 sm:px-1.5 sm:text-[10px]">
                    -{c.discount}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>



      {/* 4-6. Plan Cards */}
      <section>
        <h2 className="mb-2 text-sm font-semibold sm:mb-3 sm:text-lg">Available plans</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {plans.map((p) => {
            const tier = tierOf(p);
            const isOwnPlan = pkg?.id === p.id && !isTrialing;
            const isCurrent = isOwnPlan && !isInactive;
            const needsRenew = isOwnPlan && isInactive;
            const isCustom = tier === "custom";
            const isFree = !isCustom && Number(p.price) === 0;
            const isPopular = !isCustom && !isFree && popularPlanId === p.id;

            const calc = !isFree && !isCustom ? computeCycleTotal(Number(p.price), cycle, s) : null;

            const isHighlighted = highlightedPlanId === p.id;

            return (
              <div
                key={p.id}

                ref={(el) => { cardRefs.current[p.id] = el; }}
                className={`relative flex flex-col rounded-xl border bg-card p-3 transition sm:p-4 ${
                  isHighlighted ? "border-primary ring-4 ring-primary/40 shadow-lg" : isPopular ? "border-primary ring-2 ring-primary/30" : ""
                } ${isCurrent ? "border-emerald-500" : ""}`}
              >
                {isHighlighted && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase text-primary-foreground shadow sm:text-[10px]">
                    <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Recommended
                  </div>
                )}
                {isPopular && !isHighlighted && (
                  <div className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground sm:left-4 sm:px-2 sm:text-[10px]">
                    <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Popular
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white sm:right-4 sm:px-2 sm:text-[10px]">
                    <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Current
                  </div>
                )}
                {needsRenew && (
                  <div className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white sm:right-4 sm:px-2 sm:text-[10px]">
                    <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Expired
                  </div>
                )}

                <div className="mt-0.5 truncate text-sm font-semibold sm:text-base">{TIER_NAME[tier]}</div>
                {p.description && <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 sm:text-xs">{p.description}</p>}

                <div className="mt-2 sm:mt-3">
                  {isCustom ? (
                    <div className="text-lg font-extrabold sm:text-2xl">Custom</div>
                  ) : isFree ? (
                    <div className="text-lg font-extrabold sm:text-2xl">
                      ৳0<span className="text-[11px] font-normal text-muted-foreground sm:text-sm"> / forever</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="text-lg font-extrabold sm:text-2xl">৳{calc!.total.toLocaleString()}</div>
                        {calc!.discountPct > 0 && (
                          <div className="text-[11px] text-muted-foreground line-through sm:text-xs">
                            ৳{(Number(p.price) * calc!.months).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                        ৳{calc!.perMonth.toLocaleString()}/mo · every {calc!.months} mo
                      </div>
                      {calc!.saved > 0 && (
                        <div className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Save ৳{calc!.saved.toLocaleString()}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Limits */}
                <ul className="mt-3 space-y-1 text-[11px] sm:space-y-1.5 sm:text-xs">
                  <LimitRow label="Products" value={formatLimit(p.product_limit, undefined)} />
                  <LimitRow label="Orders / month" value={formatLimit(p.order_limit, undefined)} />
                  <LimitRow label="Storage" value={formatLimit(p.storage_mb, "MB")} />
                  <LimitRow label="Staff" value={formatLimit(p.staff_limit, undefined)} />
                </ul>

                {/* Summary bullets */}
                {p.feature_summary && p.feature_summary.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground sm:mt-3 sm:space-y-1 sm:text-xs">
                    {p.feature_summary.slice(0, 3).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                        <span className="min-w-0">{s}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Features — always visible on ≥sm, collapsible on mobile */}
                <ul className="mt-2 hidden space-y-1 border-t pt-2 text-xs sm:mt-3 sm:block sm:pt-3">
                  {FEATURE_KEYS.map((k) => {
                    const on = isCustom ? true : !!p.features?.[k];
                    return (
                      <li key={k} className="flex items-start gap-2">
                        {on ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                        )}
                        <span className={on ? "" : "text-muted-foreground/70 line-through"}>
                          {FEATURE_LABELS[k]}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <details className="mt-2 border-t pt-2 sm:hidden">
                  <summary className="cursor-pointer text-[11px] font-medium text-primary">Show all features</summary>
                  <ul className="mt-2 space-y-1 text-[11px]">
                    {FEATURE_KEYS.map((k) => {
                      const on = isCustom ? true : !!p.features?.[k];
                      return (
                        <li key={k} className="flex items-start gap-1.5">
                          {on ? (
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                          ) : (
                            <X className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                          )}
                          <span className={on ? "min-w-0" : "min-w-0 text-muted-foreground/70 line-through"}>
                            {FEATURE_LABELS[k]}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>

                <div className="mt-3 sm:mt-4">
                  {isCurrent ? (
                    <Button disabled className="h-9 w-full text-xs sm:h-10 sm:text-sm" variant="secondary">Current Plan</Button>
                  ) : needsRenew && !isFree && !isCustom ? (
                    <Link to="/admin/billing/checkout/$packageId" params={{ packageId: p.id }} search={{ cycle } as any} className="block">
                      <Button className="h-9 w-full text-xs sm:h-10 sm:text-sm">Update</Button>
                    </Link>
                  ) : isCustom ? (
                    <a href="mailto:support@example.com?subject=Custom%20Plan%20Inquiry" className="block">
                      <Button variant="outline" className="h-9 w-full text-xs sm:h-10 sm:text-sm">Contact Sales</Button>
                    </a>
                  ) : isFree ? (
                    isInactive ? (
                      <Button
                        className="h-9 w-full gap-1.5 text-xs sm:h-10 sm:text-sm"
                        disabled={activatingFreeId === p.id}
                        onClick={() => handleActivateFree(p.id)}
                      >
                        {activatingFreeId === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {activatingFreeId === p.id ? "Activating…" : "Update"}
                      </Button>
                    ) : (
                      <Button disabled className="h-9 w-full text-xs sm:h-10 sm:text-sm" variant="outline">
                        {isTrialing ? "After trial" : "Free Forever"}
                      </Button>
                    )
                  ) : (
                    <Link to="/admin/billing/checkout/$packageId" params={{ packageId: p.id }} search={{ cycle } as any} className="block">
                      <Button className="h-9 w-full text-xs sm:h-10 sm:text-sm">Upgrade</Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>


      {/* 7. Compare Plans — desktop only */}
      <section className="hidden sm:block">
        <h2 className="mb-2 text-sm font-semibold sm:mb-3 sm:text-lg">Compare plans</h2>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/50 p-3">Feature</th>
                {plans.map((p) => (
                  <th key={p.id} className="p-3 text-center">
                    <div className="font-semibold text-foreground">{p.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareLimitRow label="Products" plans={plans} accessor={(p) => formatLimit(p.product_limit)} />
              <CompareLimitRow label="Orders / month" plans={plans} accessor={(p) => formatLimit(p.order_limit)} />
              <CompareLimitRow label="Storage" plans={plans} accessor={(p) => formatLimit(p.storage_mb, "MB")} />
              <CompareLimitRow label="Staff" plans={plans} accessor={(p) => formatLimit(p.staff_limit)} />
              {FEATURE_KEYS.map((k) => (
                <tr key={k} className="border-b last:border-0">
                  <th className="sticky left-0 z-10 bg-card p-3 text-left font-medium">{FEATURE_LABELS[k]}</th>
                  {plans.map((p) => {
                    const on = tierOf(p) === "custom" ? true : !!p.features?.[k];
                    return (
                      <td key={p.id} className="p-3 text-center">
                        {on ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-muted-foreground/50" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>


        {/* Mobile: per-plan accordion */}
        <div className="space-y-2 sm:hidden">
          {plans.map((p) => {
            const isCustom = tierOf(p) === "custom";
            return (
              <details key={p.id} className="rounded-xl border bg-card p-3" open={pkg?.id === p.id}>
                <summary className="flex cursor-pointer items-center justify-between gap-2 font-semibold">
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {isCustom ? "Custom" : Number(p.price) === 0 ? "Free" : `৳${Number(p.price).toFixed(0)}/mo`}
                  </span>
                </summary>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <MobileRow label="Products" value={formatLimit(p.product_limit)} />
                  <MobileRow label="Orders / month" value={formatLimit(p.order_limit)} />
                  <MobileRow label="Storage" value={formatLimit(p.storage_mb, "MB")} />
                  <MobileRow label="Staff" value={formatLimit(p.staff_limit)} />
                  {FEATURE_KEYS.map((k) => {
                    const on = isCustom ? true : !!p.features?.[k];
                    return (
                      <li key={k} className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{FEATURE_LABELS[k]}</span>
                        {on ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground/50" />}
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      </section>


      {/* 9. Payment history */}
      <section>
        <h2 className="mb-2 text-sm font-semibold sm:mb-3 sm:text-lg">Payment history</h2>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Invoice</th>
                <th className="p-3">Package</th>
                <th className="p-3">Period</th>
                <th className="p-3">Method</th>
                <th className="p-3">Txn ID</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3">Paid</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(status?.payments ?? []).map((p: any) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3 font-mono text-[11px]">{p.invoice_no ?? "—"}</td>
                  <td className="p-3 text-xs">{p.subscription_packages?.name ?? "—"}</td>
                  <td className="p-3 text-[11px] text-muted-foreground">
                    {p.cycle_start ? new Date(p.cycle_start).toLocaleDateString() : "—"}
                    {p.cycle_end ? ` → ${new Date(p.cycle_end).toLocaleDateString()}` : ""}
                  </td>
                  <td className="p-3 uppercase">{p.method ?? "—"}</td>
                  <td className="p-3 font-mono text-[11px]">{p.txn_id ?? "—"}</td>
                  <td className="p-3 text-right">৳{Number(p.amount).toFixed(0)}</td>
                  <td className="p-3 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="p-3 capitalize">
                    <Badge
                      variant={p.status === "paid" ? "default" : p.status === "pending" ? "secondary" : "destructive"}
                      className="capitalize"
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {p.status === "paid" && (
                      <button
                        type="button"
                        onClick={() => openInvoice(p)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" /> Invoice
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(status?.payments ?? []).length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">No payments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: card list */}
        <div className="space-y-2 sm:hidden">
          {(status?.payments ?? []).length === 0 ? (
            <div className="rounded-xl border bg-card p-4 text-center text-xs text-muted-foreground">No payments yet</div>
          ) : (
            (status?.payments ?? []).map((p: any) => (
              <div key={p.id} className="rounded-xl border bg-card p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{p.subscription_packages?.name ?? "—"}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{p.invoice_no ?? "—"}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()} · <span className="uppercase">{p.method ?? "—"}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold">৳{Number(p.amount).toFixed(0)}</div>
                    <Badge
                      variant={p.status === "paid" ? "default" : p.status === "pending" ? "secondary" : "destructive"}
                      className="mt-1 h-4 px-1.5 text-[9px] capitalize"
                    >
                      {p.status}
                    </Badge>
                  </div>
                </div>
                {p.status === "paid" && (
                  <button
                    type="button"
                    onClick={() => openInvoice(p)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" /> Invoice
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}

function MobileRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}

function CompareLimitRow({
  plans,
  label,
  accessor,
}: {
  plans: Plan[];
  label: string;
  accessor: (p: Plan) => string;
}) {
  return (
    <tr className="border-b last:border-0">
      <th className="sticky left-0 z-10 bg-card p-3 text-left font-medium">{label}</th>
      {plans.map((p) => (
        <td key={p.id} className="p-3 text-center text-xs">
          {accessor(p)}
        </td>
      ))}
    </tr>
  );
}

