import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Sparkles, Crown } from "lucide-react";
import { myBillingStatus, listPublicPlans } from "@/lib/billing.functions";
import { PLAN_ROWS, supportTypeFor, formatLimit, type PlanRow } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
  trial_days?: number | null;
  product_limit?: number | null;
  order_limit?: number | null;
  storage_mb?: number | null;
  staff_limit?: number | null;
  features?: Record<string, any> | null;
};

function planCellValue(plan: Plan, row: PlanRow): { kind: "bool"; on: boolean } | { kind: "text"; text: string } {
  if (row.kind === "trial") {
    return { kind: "text", text: plan.is_trial ? `${plan.trial_days ?? 3} days free` : "—" };
  }
  if (row.kind === "limit") {
    return { kind: "text", text: formatLimit(plan[row.key] as number | null | undefined, row.unit) };
  }
  if (row.kind === "support") {
    return { kind: "text", text: supportTypeFor(plan) };
  }
  // feature
  const on = !!plan.is_trial || !!plan.features?.[row.key];
  return { kind: "bool", on };
}

function BillingPage() {
  const statusFn = useServerFn(myBillingStatus);
  const plansFn = useServerFn(listPublicPlans);
  const { data: status } = useQuery({ queryKey: ["admin", "billing"], queryFn: () => statusFn() });
  const { data: plansRaw } = useQuery({ queryKey: ["admin", "billingPlans"], queryFn: () => plansFn() });

  const plans = (plansRaw ?? []) as Plan[];
  const store = status?.store as any;
  const pkg = store?.subscription_packages as Plan | undefined;
  const subStatus = (store?.subscription_status ?? "trialing") as string;
  const daysLeft = status?.days_left ?? 0;
  const currentId = store?.package_id as string | undefined;

  // Trial countdown
  const trialPlan = plans.find((p) => p.is_trial);
  const trialTotal = trialPlan?.trial_days ?? pkg?.trial_days ?? 3;
  const trialProgress = subStatus === "trialing" ? Math.max(0, Math.min(100, (daysLeft / trialTotal) * 100)) : 0;

  // Pick "most popular" — Business by name, else middle paid plan
  const paidPlans = plans.filter((p) => !p.is_trial);
  const popularId =
    paidPlans.find((p) => /business/i.test(p.name))?.id ??
    (paidPlans.length >= 2 ? paidPlans[Math.floor(paidPlans.length / 2)]?.id : undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground">Manage your plan, view limits, and upgrade anytime.</p>
      </div>

      {/* Current status */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="truncate text-xl font-bold">{pkg?.name ?? "No plan"}</span>
              <Badge variant={
                subStatus === "active" ? "default" :
                subStatus === "trialing" ? "secondary" :
                "destructive"
              } className="capitalize">{subStatus}</Badge>
            </div>
            {pkg && (
              <div className="mt-1 text-sm text-muted-foreground">
                {pkg.is_trial ? "Free trial" : `৳${Number(pkg.price).toFixed(0)} · ${pkg.billing_cycle ?? "monthly"}`}
              </div>
            )}
          </div>
          <div className="text-left sm:text-right">
            {store?.expires_at && (
              <>
                <div className="text-xs uppercase text-muted-foreground">{subStatus === "trialing" ? "Trial ends" : "Renews / expires"}</div>
                <div className="text-sm font-medium">{new Date(store.expires_at).toLocaleDateString()}</div>
              </>
            )}
          </div>
        </div>

        {subStatus === "trialing" && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-semibold">
                {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining in your free trial
              </div>
              <div className="text-xs opacity-80">Full premium access</div>
            </div>
            <Progress value={trialProgress} className="mt-2 h-2 bg-amber-200/60" />
            <p className="mt-2 text-xs opacity-80">
              After the trial ends, your store moves to a limited plan until you upgrade.
            </p>
          </div>
        )}

        {(subStatus === "expired" || subStatus === "cancelled") && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/30 dark:text-red-200">
            Your subscription has expired. Upgrade to restore full access.
          </div>
        )}
      </div>

      {/* Plan cards */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Available plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => {
            const isCurrent = currentId === p.id;
            const isPopular = !p.is_trial && popularId === p.id;
            const isCustom = /custom|enterprise/i.test(p.name);
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-xl border bg-card p-4 ${
                  isPopular ? "border-primary ring-2 ring-primary/30" : ""
                } ${isCurrent ? "border-emerald-500" : ""}`}
              >
                {isPopular && (
                  <div className="absolute -top-2 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Most popular
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-2 right-4 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    <Crown className="h-3 w-3" /> Current Plan
                  </div>
                )}

                <div className="mt-1 text-base font-semibold">{p.name}</div>
                {p.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</p>}

                <div className="mt-3">
                  {p.is_trial ? (
                    <div className="text-2xl font-extrabold">Free</div>
                  ) : (
                    <div className="text-2xl font-extrabold">
                      ৳{Number(p.price).toFixed(0)}
                      <span className="text-sm font-normal text-muted-foreground"> / {p.billing_cycle ?? "monthly"}</span>
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {p.is_trial ? `${p.trial_days ?? 3}-day free trial` : "Trial: not included"}
                  </div>
                </div>

                <ul className="mt-4 space-y-1.5 text-sm">
                  {PLAN_ROWS.filter((r) => r.kind !== "trial").map((row) => {
                    const v = planCellValue(p, row);
                    return (
                      <li key={`${row.kind}-${"key" in row ? row.key : row.label}`} className="flex items-start gap-2">
                        {v.kind === "bool" ? (
                          v.on ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          ) : (
                            <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                          )
                        ) : (
                          <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full bg-muted text-center text-[10px] leading-4 text-muted-foreground">•</span>
                        )}
                        <span className="min-w-0 flex-1 text-xs">
                          <span className="text-muted-foreground">{row.label}: </span>
                          <span className={v.kind === "bool" && !v.on ? "text-muted-foreground/70" : "font-medium"}>
                            {v.kind === "text" ? v.text : v.on ? "Included" : "—"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4">
                  {isCurrent ? (
                    <Button disabled className="w-full" variant="secondary">Current Plan</Button>
                  ) : p.is_trial ? (
                    <Button disabled className="w-full" variant="outline">
                      {subStatus === "trialing" ? "Trial Active" : "Trial Used"}
                    </Button>
                  ) : isCustom ? (
                    <a href="mailto:support@example.com?subject=Custom%20Plan%20Inquiry" className="block">
                      <Button variant="outline" className="w-full">Contact Sales</Button>
                    </a>
                  ) : (
                    <Link to="/admin/billing/checkout/$packageId" params={{ packageId: p.id }} className="block">
                      <Button className="w-full">Upgrade</Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          {plans.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
              No plans available yet.
            </div>
          )}
        </div>
      </section>

      {/* Compare plans */}
      {plans.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Compare plans</h2>

          {/* Desktop / tablet table */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/50 p-3">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} className="p-3 text-center">
                      <div className="font-semibold text-foreground">{p.name}</div>
                      <div className="font-normal normal-case text-muted-foreground">
                        {p.is_trial ? "Free" : `৳${Number(p.price).toFixed(0)}`}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_ROWS.map((row) => (
                  <tr key={`${row.kind}-${"key" in row ? row.key : row.label}`} className="border-b last:border-0">
                    <th className="sticky left-0 z-10 bg-card p-3 text-left font-medium">{row.label}</th>
                    {plans.map((p) => {
                      const v = planCellValue(p, row);
                      return (
                        <td key={p.id} className="p-3 text-center">
                          {v.kind === "bool" ? (
                            v.on ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <X className="mx-auto h-4 w-4 text-muted-foreground/50" />
                          ) : (
                            <span className="text-xs">{v.text}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked per-plan */}
          <div className="space-y-2 sm:hidden">
            {plans.map((p) => (
              <details key={p.id} className="rounded-xl border bg-card p-3" open={currentId === p.id}>
                <summary className="flex cursor-pointer items-center justify-between gap-2 font-semibold">
                  <span className="truncate">{p.name}</span>
                  <span className="text-sm text-muted-foreground">{p.is_trial ? "Free" : `৳${Number(p.price).toFixed(0)}`}</span>
                </summary>
                <ul className="mt-3 space-y-1.5">
                  {PLAN_ROWS.map((row) => {
                    const v = planCellValue(p, row);
                    return (
                      <li key={`${row.kind}-${"key" in row ? row.key : row.label}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        {v.kind === "bool" ? (
                          v.on ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-muted-foreground/50" />
                        ) : (
                          <span className="font-medium">{v.text}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Payment history */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Payment history</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Date</th><th className="p-3">Invoice</th><th className="p-3">Method</th><th className="p-3">Txn ID</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {(status?.payments ?? []).map((p: any) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="p-3 font-mono text-[11px]">{p.invoice_no ?? "—"}</td>
                  <td className="p-3 uppercase">{p.method ?? "—"}</td>
                  <td className="p-3 font-mono text-[11px]">{p.txn_id ?? "—"}</td>
                  <td className="p-3 text-right">৳{Number(p.amount).toFixed(0)}</td>
                  <td className="p-3 capitalize">{p.status}</td>
                </tr>
              ))}
              {(status?.payments ?? []).length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No payments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
