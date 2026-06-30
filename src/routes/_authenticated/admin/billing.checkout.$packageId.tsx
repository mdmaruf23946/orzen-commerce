import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import {
  listPublicPlans,
  getEnabledPaymentMethods,
  submitManualPayment,
  getBillingSettings,
  computeCycleTotal,
  type CycleKey,
} from "@/lib/billing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  cycle: z.enum(["monthly", "3m", "6m", "yearly"]).default("monthly").catch("monthly"),
});

export const Route = createFileRoute("/_authenticated/admin/billing/checkout/$packageId")({
  validateSearch: searchSchema,
  component: CheckoutPage,
});

const CYCLE_LABEL: Record<CycleKey, string> = {
  monthly: "Monthly",
  "3m": "3 Months",
  "6m": "6 Months",
  yearly: "Yearly",
};

function CheckoutPage() {
  const { packageId } = Route.useParams();
  const { cycle: initialCycle } = Route.useSearch();
  const navigate = useNavigate();
  const plansFn = useServerFn(listPublicPlans);
  const methodsFn = useServerFn(getEnabledPaymentMethods);
  const settingsFn = useServerFn(getBillingSettings);
  const submit = useServerFn(submitManualPayment);
  const { data: plans } = useQuery({ queryKey: ["admin", "billingPlans"], queryFn: () => plansFn() });
  const { data: methods } = useQuery({ queryKey: ["admin", "paymentMethods"], queryFn: () => methodsFn() });
  const { data: settings } = useQuery({
    queryKey: ["admin", "billingSettings"],
    queryFn: () => settingsFn(),
    staleTime: 5 * 60_000,
  });

  const pkg = (plans ?? []).find((p: any) => p.id === packageId) as any;
  const [cycle, setCycle] = useState<CycleKey>(initialCycle);
  const [method, setMethod] = useState<"bkash" | "nagad" | "rocket">("bkash");
  const [txnId, setTxnId] = useState("");
  const [sender, setSender] = useState("");
  const [saving, setSaving] = useState(false);

  if (!pkg) return <div className="p-8 text-sm text-muted-foreground">Loading plan…</div>;

  const s = settings ?? { discount_3m: 5, discount_6m: 10, discount_yearly: 20 };
  const calc = computeCycleTotal(Number(pkg.price), cycle, s);

  const m = methods?.[method];
  const enabledMethods = (["bkash", "nagad", "rocket"] as const).filter((k) => methods?.[k]?.enabled);

  const cycleOptions: { key: CycleKey; label: string; discount: number }[] = [
    { key: "monthly", label: "Monthly", discount: 0 },
    { key: "3m", label: "3 Months", discount: s.discount_3m },
    { key: "6m", label: "6 Months", discount: s.discount_6m },
    { key: "yearly", label: "Yearly", discount: s.discount_yearly },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await submit({
        data: { packageId, cycle, method, txn_id: txnId.trim(), sender_number: sender.trim() },
      });
      toast.success("Payment submitted! Awaiting verification by platform owner.");
      navigate({ to: "/admin/billing" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-10">
      <Link to="/admin/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="rounded-xl border bg-card p-4">
        <div className="text-xs uppercase text-muted-foreground">Upgrade to</div>
        <div className="mt-1 text-xl font-bold">{pkg.name}</div>
        <div className="text-sm text-muted-foreground">৳{Number(pkg.price).toFixed(0)} / month base price</div>
      </div>

      {/* Billing cycle */}
      <div className="rounded-xl border bg-card p-4">
        <Label className="mb-2 block">Billing cycle</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cycleOptions.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCycle(c.key)}
              className={`relative rounded-lg border p-2 text-left text-xs transition ${
                cycle === c.key ? "border-primary bg-primary/5 ring-2 ring-primary/30" : ""
              }`}
            >
              <div className="font-semibold">{c.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {c.discount > 0 ? `Save ${c.discount}%` : "Standard"}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{CYCLE_LABEL[cycle]} ({calc.months} mo × ৳{Number(pkg.price).toFixed(0)})</span>
            <span>৳{(Number(pkg.price) * calc.months).toLocaleString()}</span>
          </div>
          {calc.discountPct > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <span>Discount ({calc.discountPct}%)</span>
              <span>− ৳{calc.saved.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>৳{calc.total.toLocaleString()}</span>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">≈ ৳{calc.perMonth.toLocaleString()}/mo</div>
        </div>
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
                <button
                  key={k}
                  type="button"
                  onClick={() => setMethod(k)}
                  className={`rounded-md border p-2 text-sm capitalize ${method === k ? "border-primary bg-primary/5" : ""}`}
                >
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
            {saving ? "Submitting…" : `Pay ৳${calc.total.toLocaleString()}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Your subscription activates once the platform owner verifies the payment.
          </p>
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
