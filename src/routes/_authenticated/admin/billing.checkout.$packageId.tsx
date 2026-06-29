import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { listPublicPlans, getEnabledPaymentMethods, submitManualPayment } from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/billing/checkout/$packageId")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { packageId } = Route.useParams();
  const navigate = useNavigate();
  const plansFn = useServerFn(listPublicPlans);
  const methodsFn = useServerFn(getEnabledPaymentMethods);
  const submit = useServerFn(submitManualPayment);
  const { data: plans } = useQuery({ queryKey: ["admin", "billingPlans"], queryFn: () => plansFn() });
  const { data: methods } = useQuery({ queryKey: ["admin", "paymentMethods"], queryFn: () => methodsFn() });

  const pkg = (plans ?? []).find((p: any) => p.id === packageId) as any;
  const [method, setMethod] = useState<"bkash" | "nagad" | "rocket">("bkash");
  const [txnId, setTxnId] = useState("");
  const [sender, setSender] = useState("");
  const [saving, setSaving] = useState(false);

  if (!pkg) return <div className="p-8 text-sm text-muted-foreground">Loading plan…</div>;

  const m = methods?.[method];
  const enabledMethods = (["bkash", "nagad", "rocket"] as const).filter((k) => methods?.[k]?.enabled);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await submit({ data: { packageId, method, txn_id: txnId.trim(), sender_number: sender.trim(), amount: Number(pkg.price) } });
      toast.success("Payment submitted! Awaiting verification by platform owner.");
      navigate({ to: "/admin/billing" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link to="/admin/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>

      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs uppercase text-muted-foreground">Renew / Upgrade</div>
        <div className="mt-1 text-xl font-bold">{pkg.name}</div>
        <div className="text-sm text-muted-foreground">{pkg.duration_days} days · {pkg.billing_cycle ?? "monthly"}</div>
        <div className="mt-2 text-2xl font-bold">৳{Number(pkg.price).toFixed(0)}</div>
      </div>

      {enabledMethods.length === 0 ? (
        <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">
          No payment methods are currently enabled. Please contact the platform owner.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-4">
          <div>
            <Label>Payment method</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {enabledMethods.map((k) => (
                <button key={k} type="button" onClick={() => setMethod(k)}
                  className={`rounded-md border p-2 text-sm capitalize ${method === k ? "border-primary bg-primary/5" : ""}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          {m?.number && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="text-xs text-muted-foreground">Send Money to</div>
              <div className="font-mono text-lg font-semibold">{m.number}</div>
              {m.instructions && <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{m.instructions}</p>}
            </div>
          )}

          <div className="space-y-1.5"><Label>Your number (sender)</Label>
            <Input required value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
          <div className="space-y-1.5"><Label>Transaction ID</Label>
            <Input required value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="e.g. 9A7B2C3D4E" />
          </div>

          <Button type="submit" disabled={saving || !txnId || !sender} className="w-full">
            {saving ? "Submitting…" : `Pay ৳${Number(pkg.price).toFixed(0)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Your subscription activates once the platform owner verifies the payment.</p>
        </form>
      )}

      {methods?.sslcommerz?.enabled && (
        <div className="rounded-xl border bg-card p-4 text-sm">
          <div className="font-semibold">Pay with SSLCommerz (card / bank)</div>
          <p className="mt-1 text-xs text-muted-foreground">Online checkout via SSLCommerz is coming soon. Use a manual method above for now.</p>
        </div>
      )}
    </div>
  );
}
