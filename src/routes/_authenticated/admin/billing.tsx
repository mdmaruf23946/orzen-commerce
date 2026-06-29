import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myBillingStatus, listPublicPlans } from "@/lib/billing.functions";
import { FEATURE_KEYS, FEATURE_LABELS } from "@/lib/features";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/billing")({
  component: BillingPage,
});

function BillingPage() {
  const statusFn = useServerFn(myBillingStatus);
  const plansFn = useServerFn(listPublicPlans);
  const { data: status } = useQuery({ queryKey: ["admin", "billing"], queryFn: () => statusFn() });
  const { data: plans } = useQuery({ queryKey: ["admin", "billingPlans"], queryFn: () => plansFn() });

  const store = status?.store as any;
  const pkg = store?.subscription_packages;
  const subStatus = store?.subscription_status ?? "trialing";
  const daysLeft = status?.days_left ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing & Subscription</h1>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Current plan</div>
            <div className="mt-1 text-xl font-bold">{pkg?.name ?? "No plan"}</div>
            {pkg && <div className="text-sm text-muted-foreground">৳{Number(pkg.price).toFixed(0)} · {pkg.billing_cycle ?? "monthly"}</div>}
          </div>
          <div className="text-right">
            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
              subStatus === "active" ? "bg-emerald-100 text-emerald-700" :
              subStatus === "trialing" ? "bg-amber-100 text-amber-700" :
              subStatus === "expired" ? "bg-red-100 text-red-700" :
              "bg-muted"
            }`}>{subStatus}</span>
            <div className="mt-1 text-sm">{store?.expires_at ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}</div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Available plans</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(plans ?? []).map((p: any) => {
            const enabled = FEATURE_KEYS.filter((k) => p.features?.[k]);
            return (
              <div key={p.id} className="flex flex-col rounded-xl border bg-card p-4">
                <div className="text-lg font-semibold">{p.name}</div>
                {p.description && <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>}
                <div className="mt-2 text-2xl font-bold">৳{Number(p.price).toFixed(0)}<span className="text-sm font-normal text-muted-foreground"> / {p.billing_cycle ?? "monthly"}</span></div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div>{p.product_limit ? `${p.product_limit} products` : "Unlimited products"}</div>
                  {p.order_limit ? <div>{p.order_limit} orders / cycle</div> : null}
                  {p.staff_limit ? <div>{p.staff_limit} staff</div> : null}
                  {p.storage_mb ? <div>{p.storage_mb} MB storage</div> : null}
                </div>
                <ul className="mt-3 flex-1 space-y-1 text-xs">
                  {enabled.slice(0, 6).map((k) => <li key={k}>✓ {FEATURE_LABELS[k]}</li>)}
                  {enabled.length > 6 && <li className="text-muted-foreground">+ {enabled.length - 6} more</li>}
                </ul>
                <Link to="/admin/billing/checkout/$packageId" params={{ packageId: p.id }} className="mt-4">
                  <Button className="w-full">{store?.package_id === p.id ? "Renew" : "Upgrade"}</Button>
                </Link>
              </div>
            );
          })}
          {(plans ?? []).length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No paid plans available yet.</div>
          )}
        </div>
      </section>

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
