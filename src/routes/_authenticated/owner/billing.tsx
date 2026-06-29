import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { revenueStats, listPayments, verifyPayment } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/billing")({
  component: BillingPage,
});

function BillingPage() {
  const statsFn = useServerFn(revenueStats);
  const payFn = useServerFn(listPayments);
  const verify = useServerFn(verifyPayment);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("pending");

  const { data: stats } = useQuery({ queryKey: ["owner", "billingStats"], queryFn: () => statsFn() });
  const { data: payments } = useQuery({
    queryKey: ["owner", "payments", status],
    queryFn: () => payFn({ data: { status: status || undefined } }),
  });

  async function act(id: string, approve: boolean) {
    const notes = approve ? undefined : prompt("Reason for rejection?") ?? undefined;
    try {
      await verify({ data: { id, approve, notes } });
      toast.success(approve ? "Payment verified" : "Payment rejected");
      qc.invalidateQueries({ queryKey: ["owner", "payments"] });
      qc.invalidateQueries({ queryKey: ["owner", "billingStats"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const cards = [
    { label: "Today", value: `৳${(stats?.today ?? 0).toFixed(0)}` },
    { label: "This Month", value: `৳${(stats?.month ?? 0).toFixed(0)}` },
    { label: "This Year", value: `৳${(stats?.year ?? 0).toFixed(0)}` },
    { label: "Total Revenue", value: `৳${(stats?.total ?? 0).toFixed(0)}` },
    { label: "Active", value: stats?.active ?? 0 },
    { label: "Trial", value: stats?.trialing ?? 0 },
    { label: "Expired", value: stats?.expired ?? 0 },
    { label: "Renewal Rate", value: `${stats?.renewal_rate ?? 0}%` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing & Revenue</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {["pending", "paid", "rejected", ""].map((s) => (
          <button key={s || "all"}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Store</th>
              <th className="p-3">Package</th>
              <th className="p-3">Method</th>
              <th className="p-3">Txn ID</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p: any) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-3 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="p-3">{p.stores?.name ?? "—"}</td>
                <td className="p-3 text-xs">{p.subscription_packages?.name ?? "—"}</td>
                <td className="p-3 text-xs uppercase">{p.method ?? "—"}</td>
                <td className="p-3 font-mono text-[11px]">{p.txn_id ?? "—"}</td>
                <td className="p-3 text-right">৳{Number(p.amount).toFixed(0)}</td>
                <td className="p-3 capitalize">{p.status}</td>
                <td className="p-3">
                  {p.status === "pending" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => act(p.id, false)}>Reject</Button>
                      <Button size="sm" onClick={() => act(p.id, true)}>Verify</Button>
                    </div>
                  )}
                  {p.invoice_no && <span className="text-[11px] text-muted-foreground">{p.invoice_no}</span>}
                </td>
              </tr>
            ))}
            {(payments ?? []).length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">No payments</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
