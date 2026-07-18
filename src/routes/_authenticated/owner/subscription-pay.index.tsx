import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, CheckCircle2, XCircle, Clock, TrendingUp, Settings } from "lucide-react";
import { subscriptionPaymentsStats, listSubscriptionPayments } from "@/lib/subscription-pay/pay.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/subscription-pay/")({
  component: DashPage,
});

function StatCard({ icon: Icon, label, value, tone = "default" }: any) {
  const tones: Record<string, string> = {
    default: "bg-card",
    success: "bg-emerald-50 dark:bg-emerald-950/30",
    danger: "bg-red-50 dark:bg-red-950/30",
    warn: "bg-amber-50 dark:bg-amber-950/30",
    primary: "bg-blue-50 dark:bg-blue-950/30",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function DashPage() {
  const statsFn = useServerFn(subscriptionPaymentsStats);
  const listFn = useServerFn(listSubscriptionPayments);
  const { data: stats } = useQuery({ queryKey: ["owner", "subPayStats"], queryFn: () => statsFn() });
  const { data: rows } = useQuery({
    queryKey: ["owner", "subPayList"],
    queryFn: () => listFn({ data: { limit: 20 } }),
  });
  const active = stats?.active_provider as any;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Subscription Payments</h1>
          <p className="text-sm text-muted-foreground">
            ORZEN subscription-plan billing dashboard.
          </p>
        </div>
        <Link to="/owner/subscription-pay/providers">
          <Button variant="outline" className="gap-2"><Settings className="h-4 w-4" /> Providers</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CreditCard}
          label="Gateway status"
          value={active ? `${active.label}${active.sandbox ? " · Sandbox" : ""}` : "Not connected"}
          tone={active ? "primary" : "warn"}
        />
        <StatCard icon={TrendingUp} label="Monthly revenue" value={`৳${(stats?.monthly_revenue ?? 0).toLocaleString()}`} tone="success" />
        <StatCard icon={CheckCircle2} label="Successful" value={stats?.successful ?? 0} tone="success" />
        <StatCard icon={Clock} label="Pending" value={stats?.pending ?? 0} tone="warn" />
        <StatCard icon={XCircle} label="Failed" value={stats?.failed ?? 0} tone="danger" />
        <StatCard icon={CreditCard} label="Total payments" value={stats?.total_payments ?? 0} />
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Recent transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Invoice</th>
                <th>Cycle</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 font-mono text-xs">{r.invoice_no}</td>
                  <td>{r.billing_cycle}</td>
                  <td>৳{Number(r.total).toLocaleString()}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      r.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                      r.status === "failed" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{r.status}</span>
                  </td>
                  <td className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(!rows || rows.length === 0) && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No subscription payments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
