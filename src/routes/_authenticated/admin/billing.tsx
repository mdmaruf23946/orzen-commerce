import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, X, Sparkles, Crown, Sparkle, Download } from "lucide-react";
import {
  myBillingStatus,
  listPublicPlans,
  getBillingSettings,
  computeCycleTotal,
  type CycleKey,
} from "@/lib/billing.functions";
import { FEATURE_KEYS, FEATURE_LABELS, formatLimit } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/billing")({
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

function BillingPage() {
  const statusFn = useServerFn(myBillingStatus);
  const plansFn = useServerFn(listPublicPlans);
  const settingsFn = useServerFn(getBillingSettings);

  const { data: status } = useQuery({ queryKey: ["admin", "billing"], queryFn: () => statusFn() });
  const { data: plansRaw } = useQuery({ queryKey: ["admin", "billingPlans"], queryFn: () => plansFn() });
  const { data: settings } = useQuery({
    queryKey: ["admin", "billingSettings"],
    queryFn: () => settingsFn(),
    staleTime: 5 * 60_000,
  });

  const [cycle, setCycle] = useState<CycleKey>("monthly");

  const plans = (plansRaw ?? []) as Plan[];
  const store = status?.store as any;
  const pkg = store?.subscription_packages as Plan | undefined;
  const subStatus = (store?.subscription_status ?? "active") as string;
  const daysLeft = status?.days_left ?? 0;
  const isTrialing = subStatus === "trialing";

  const tierMap = useMemo(() => {
    const m = new Map<string, Plan>();
    for (const p of plans) {
      const t = tierOf(p);
      if (t && !m.has(t)) m.set(t, p);
    }
    return m;
  }, [plans]);

  const currentTier = pkg ? tierOf(pkg) : isTrialing ? null : "free";
  const s = settings ?? { discount_3m: 5, discount_6m: 10, discount_yearly: 20 };

  const cycleOptions: { key: CycleKey; label: string; discount: number }[] = [
    { key: "monthly", label: "Monthly", discount: 0 },
    { key: "3m", label: "3 Months", discount: s.discount_3m },
    { key: "6m", label: "6 Months", discount: s.discount_6m },
    { key: "yearly", label: "Yearly", discount: s.discount_yearly },
  ];

  return (
    <div className="space-y-4 pb-10 max-w-full overflow-x-hidden sm:space-y-6">

      {/* 1. Free Trial Banner — only when trialing */}
      {isTrialing && (
        <div className="rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3 sm:rounded-xl sm:p-4 dark:border-amber-900/50 dark:from-amber-950/30 dark:to-orange-950/30">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                <Sparkle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs font-semibold sm:text-sm">🎉 Free Trial Active</span>
              </div>
              <div className="mt-0.5 text-base font-bold text-amber-950 sm:text-lg dark:text-amber-100">
                {daysLeft} Day{daysLeft === 1 ? "" : "s"} Remaining
              </div>
              <p className="mt-0.5 text-[11px] text-amber-800/80 sm:text-xs dark:text-amber-200/80">
                All Premium Features unlocked.
              </p>
            </div>
            {tierMap.get("business") && (
              <Link
                to="/admin/billing/checkout/$packageId"
                params={{ packageId: tierMap.get("business")!.id }}
                search={{ cycle } as any}
              >
                <Button size="sm" className="h-8 bg-amber-600 px-2.5 text-xs hover:bg-amber-700 sm:h-9 sm:px-3 sm:text-sm">Upgrade</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-lg font-semibold sm:text-2xl">Billing & Subscription</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Pick the plan that fits your business — change anytime.</p>
      </div>

      {/* 8. Current Plan Section */}
      <div className="rounded-lg border bg-card p-3 sm:rounded-xl sm:p-5">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">Current plan</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="truncate text-base font-bold sm:text-xl">
                {isTrialing ? "Free Plan" : (currentTier ? TIER_NAME[currentTier] : "Free Plan")}
              </span>
              <Badge
                variant={subStatus === "active" ? "default" : isTrialing ? "secondary" : "destructive"}
                className="h-5 px-1.5 text-[10px] capitalize sm:h-6 sm:text-xs"
              >
                {isTrialing ? "Trial Active" : subStatus}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {isTrialing
                ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining · all premium unlocked`
                : pkg
                  ? `৳${Number(pkg.price).toFixed(0)} · ${pkg.billing_cycle ?? "monthly"}`
                  : "Limited features. Upgrade for more."}
            </div>
          </div>
          <div className="text-left sm:text-right">
            {isTrialing && store?.trial_ends_at ? (
              <>
                <div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Trial ends</div>
                <div className="text-xs font-medium sm:text-sm">{new Date(store.trial_ends_at).toLocaleDateString()}</div>
              </>
            ) : store?.expires_at ? (
              <>
                <div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Renews / expires</div>
                <div className="text-xs font-medium sm:text-sm">{new Date(store.expires_at).toLocaleDateString()}</div>
              </>
            ) : null}
          </div>
        </div>

        {(subStatus === "expired" || subStatus === "cancelled") && (
          <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-900 sm:mt-3 sm:rounded-lg sm:p-3 sm:text-sm dark:bg-red-950/30 dark:text-red-200">
            Your subscription has expired. Upgrade to restore full access.
          </div>
        )}
      </div>

      {/* 3. Billing Cycle Selector */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold sm:text-lg">Choose your billing cycle</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                <div className="text-xs font-semibold sm:text-sm">{c.label}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
                  {c.discount > 0 ? `Save ${c.discount}%` : "No discount"}
                </div>
                {c.discount > 0 && (
                  <span className="absolute -top-2 right-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white sm:text-[10px]">
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
        <h2 className="mb-3 text-lg font-semibold">Available plans</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {TIER_ORDER.map((tier) => {
            const p = tierMap.get(tier);
            const isCurrent = currentTier === tier && !isTrialing;
            const isPopular = tier === "business";
            const isCustom = tier === "custom";
            const isFree = tier === "free";

            if (!p) {
              return (
                <div key={tier} className="rounded-xl border border-dashed bg-card/40 p-4 text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">{TIER_NAME[tier]}</div>
                  <p className="mt-2">Coming soon.</p>
                </div>
              );
            }

            const calc = !isFree && !isCustom ? computeCycleTotal(Number(p.price), cycle, s) : null;

            return (
              <div
                key={tier}
                className={`relative flex flex-col rounded-xl border bg-card p-4 ${
                  isPopular ? "border-primary ring-2 ring-primary/30" : ""
                } ${isCurrent ? "border-emerald-500" : ""}`}
              >
                {isPopular && (
                  <div className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Most Popular
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-2 right-4 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    <Crown className="h-3 w-3" /> Current Plan
                  </div>
                )}

                <div className="mt-1 truncate text-base font-semibold">{TIER_NAME[tier]}</div>
                {p.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</p>}

                <div className="mt-3">
                  {isCustom ? (
                    <div className="text-2xl font-extrabold">Custom</div>
                  ) : isFree ? (
                    <div className="text-2xl font-extrabold">
                      ৳0<span className="text-sm font-normal text-muted-foreground"> / forever</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-extrabold">৳{calc!.total.toLocaleString()}</div>
                        {calc!.discountPct > 0 && (
                          <div className="text-xs text-muted-foreground line-through">
                            ৳{(Number(p.price) * calc!.months).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        ৳{calc!.perMonth.toLocaleString()}/mo · billed every {calc!.months} mo
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
                <ul className="mt-4 space-y-1.5 text-xs">
                  <LimitRow label="Products" value={formatLimit(p.product_limit, undefined)} />
                  <LimitRow label="Orders / month" value={formatLimit(p.order_limit, undefined)} />
                  <LimitRow label="Storage" value={formatLimit(p.storage_mb, "MB")} />
                  <LimitRow label="Staff" value={formatLimit(p.staff_limit, undefined)} />
                </ul>

                {/* Summary bullets */}
                {p.feature_summary && p.feature_summary.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {p.feature_summary.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                        <span className="min-w-0">{s}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Features */}
                <ul className="mt-3 space-y-1 border-t pt-3 text-xs">
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

                <div className="mt-4">
                  {isCurrent ? (
                    <Button disabled className="w-full" variant="secondary">Current Plan</Button>
                  ) : isCustom ? (
                    <a href="mailto:support@example.com?subject=Custom%20Plan%20Inquiry" className="block">
                      <Button variant="outline" className="w-full">Contact Sales</Button>
                    </a>
                  ) : isFree ? (
                    <Button disabled className="w-full" variant="outline">
                      {isTrialing ? "After trial" : "Free Forever"}
                    </Button>
                  ) : (
                    <Link to="/admin/billing/checkout/$packageId" params={{ packageId: p.id }} search={{ cycle } as any} className="block">
                      <Button className="w-full">Upgrade</Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Compare Plans */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Compare plans</h2>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/50 p-3">Feature</th>
                {TIER_ORDER.map((t) => (
                  <th key={t} className="p-3 text-center">
                    <div className="font-semibold text-foreground">{TIER_NAME[t]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareLimitRow label="Products" tierMap={tierMap} accessor={(p) => formatLimit(p.product_limit)} />
              <CompareLimitRow label="Orders / month" tierMap={tierMap} accessor={(p) => formatLimit(p.order_limit)} />
              <CompareLimitRow label="Storage" tierMap={tierMap} accessor={(p) => formatLimit(p.storage_mb, "MB")} />
              <CompareLimitRow label="Staff" tierMap={tierMap} accessor={(p) => formatLimit(p.staff_limit)} />
              {FEATURE_KEYS.map((k) => (
                <tr key={k} className="border-b last:border-0">
                  <th className="sticky left-0 z-10 bg-card p-3 text-left font-medium">{FEATURE_LABELS[k]}</th>
                  {TIER_ORDER.map((t) => {
                    const p = tierMap.get(t);
                    const on = t === "custom" ? true : !!p?.features?.[k];
                    return (
                      <td key={t} className="p-3 text-center">
                        {p ? (
                          on ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-600" />
                          ) : (
                            <X className="mx-auto h-4 w-4 text-muted-foreground/50" />
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
          {TIER_ORDER.map((t) => {
            const p = tierMap.get(t);
            if (!p) return null;
            return (
              <details key={t} className="rounded-xl border bg-card p-3" open={currentTier === t}>
                <summary className="flex cursor-pointer items-center justify-between gap-2 font-semibold">
                  <span className="truncate">{TIER_NAME[t]}</span>
                  <span className="text-xs text-muted-foreground">
                    {t === "custom" ? "Custom" : t === "free" ? "Free" : `৳${Number(p.price).toFixed(0)}/mo`}
                  </span>
                </summary>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <MobileRow label="Products" value={formatLimit(p.product_limit)} />
                  <MobileRow label="Orders / month" value={formatLimit(p.order_limit)} />
                  <MobileRow label="Storage" value={formatLimit(p.storage_mb, "MB")} />
                  <MobileRow label="Staff" value={formatLimit(p.staff_limit)} />
                  {FEATURE_KEYS.map((k) => {
                    const on = t === "custom" ? true : !!p.features?.[k];
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
        <h2 className="mb-3 text-lg font-semibold">Payment history</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
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
                        onClick={() => window.print()}
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
  label,
  tierMap,
  accessor,
}: {
  label: string;
  tierMap: Map<string, Plan>;
  accessor: (p: Plan) => string;
}) {
  return (
    <tr className="border-b last:border-0">
      <th className="sticky left-0 z-10 bg-card p-3 text-left font-medium">{label}</th>
      {TIER_ORDER.map((t) => {
        const p = tierMap.get(t);
        return (
          <td key={t} className="p-3 text-center text-xs">
            {p ? accessor(p) : "—"}
          </td>
        );
      })}
    </tr>
  );
}
