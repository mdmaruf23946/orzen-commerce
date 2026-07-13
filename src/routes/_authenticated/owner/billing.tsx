import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
  revenueStats,
  listPayments,
  verifyPayment,
  retryEmailLog,
} from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefreshCw, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/billing")({
  component: BillingPage,
});

function BillingPage() {
  const statsFn = useServerFn(revenueStats);
  const payFn = useServerFn(listPayments);
  const verify = useServerFn(verifyPayment);
  const retry = useServerFn(retryEmailLog);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("pending");
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: stats } = useQuery({ queryKey: ["owner", "billingStats"], queryFn: () => statsFn() });
  const { data: payments } = useQuery({
    queryKey: ["owner", "payments", status],
    queryFn: () => payFn({ data: { status: status || undefined } }),
  });

  async function approve(id: string) {
    setBusyId(id);
    try {
      await verify({ data: { id, approve: true } });
      toast.success("Payment verified — subscription activated");
      qc.invalidateQueries({ queryKey: ["owner", "payments"] });
      qc.invalidateQueries({ queryKey: ["owner", "billingStats"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 10) {
      toast.error("Please provide a reason (at least 10 characters).");
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      await verify({ data: { id: rejectTarget.id, approve: false, notes: rejectReason.trim() } });
      toast.success("Payment rejected");
      setRejectTarget(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["owner", "payments"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function doRetry(logId: string) {
    try {
      const res: any = await retry({ data: { id: logId } });
      if (res?.ok) toast.success("Email resent");
      else toast.error(res?.error ?? "Retry failed");
      qc.invalidateQueries({ queryKey: ["owner", "payments"] });
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
      <h1 className="text-2xl font-semibold">Subscription Requests</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-sm">
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

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Store</th>
              <th className="p-3">Email</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Method</th>
              <th className="p-3">Sender</th>
              <th className="p-3">Txn ID</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Submitted</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p: any) => (
              <Fragment key={p.id}>
                <tr className="border-b last:border-0 align-top">
                  <td className="p-3">
                    <div className="font-medium">{p.stores?.name ?? "—"}</div>
                    {p.invoice_no && <div className="text-[11px] text-muted-foreground">{p.invoice_no}</div>}
                  </td>
                  <td className="p-3 text-xs">{p.customer_email ?? "—"}</td>
                  <td className="p-3 text-xs">{p.subscription_packages?.name ?? "—"}</td>
                  <td className="p-3 text-xs uppercase">{p.method ?? "—"}</td>
                  <td className="p-3 font-mono text-[11px]">{p.sender_number ?? "—"}</td>
                  <td className="p-3 font-mono text-[11px]">{p.txn_id ?? "—"}</td>
                  <td className="p-3 text-right font-semibold">৳{Number(p.amount).toFixed(0)}</td>
                  <td className="p-3 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                      p.status === "paid" ? "bg-emerald-100 text-emerald-700"
                      : p.status === "rejected" ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.status === "paid" ? "Approved" : p.status}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {p.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setRejectTarget(p); setRejectReason(""); }} disabled={busyId === p.id}>Reject</Button>
                          <Button size="sm" onClick={() => approve(p.id)} disabled={busyId === p.id}>Approve</Button>
                        </>
                      )}
                      <button
                        onClick={() => setExpanded((s) => ({ ...s, [p.id]: !s[p.id] }))}
                        className="ml-1 rounded-md p-1 hover:bg-muted"
                        aria-label="Expand"
                      >
                        <ChevronDown className={`h-4 w-4 transition ${expanded[p.id] ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded[p.id] && (
                  <tr className="border-b bg-muted/30">
                    <td colSpan={10} className="p-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          {p.customer_note && (
                            <div className="mb-2 text-xs"><span className="text-muted-foreground">Note: </span>{p.customer_note}</div>
                          )}
                          {p.rejection_reason && (
                            <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">
                              <b>Rejection reason: </b>{p.rejection_reason}
                            </div>
                          )}
                          {!p.customer_note && !p.rejection_reason && (
                            <div className="text-xs text-muted-foreground">No additional notes.</div>
                          )}
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Email log</div>
                          {(p.email_logs ?? []).length === 0 ? (
                            <div className="text-xs text-muted-foreground">No emails logged.</div>
                          ) : (
                            <ul className="space-y-1 text-xs">
                              {p.email_logs.map((l: any) => (
                                <li key={l.id} className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1">
                                  <div className="min-w-0">
                                    <span className="font-medium">{l.template}</span>
                                    <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                                      l.status === "sent" ? "bg-emerald-100 text-emerald-700"
                                      : l.status === "failed" ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                                    }`}>{l.status}</span>
                                    {l.last_error && (
                                      <div className="mt-0.5 truncate text-[10px] text-red-600" title={l.last_error}>{l.last_error}</div>
                                    )}
                                  </div>
                                  {l.status !== "sent" && (
                                    <button onClick={() => doRetry(l.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 hover:bg-muted">
                                      <RefreshCw className="h-3 w-3" /> Retry
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {(payments ?? []).length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-sm text-muted-foreground">No payments</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This will notify <b>{rejectTarget?.customer_email ?? "the customer"}</b> with the reason below.
            </p>
            <div className="space-y-1.5">
              <Label>Rejection reason</Label>
              <Textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Transaction ID not found in our bKash statement."
              />
              <p className="text-xs text-muted-foreground">{rejectReason.trim().length} / 10 minimum</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button onClick={confirmReject} disabled={rejectReason.trim().length < 10 || busyId === rejectTarget?.id}>
              Reject payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
