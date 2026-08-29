import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, CheckCircle2, Wallet, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
import { Textarea } from "@/components/ui/textarea";
import { getMyWallet, payPlanWithWallet } from "@/lib/wallet.functions";

const searchSchema = z.object({
  cycle: z.enum(["monthly", "3m", "6m", "yearly"]).default("monthly").catch("monthly"),
});

export const Route = createFileRoute("/_authenticated/admin/billing/checkout/$packageId")({
  head: () => ({
    meta: [
      { title: "Plan Checkout — ORZEN Merchant Panel" },
      { name: "description", content: "Complete your subscription plan purchase." },
      { property: "og:title", content: "Plan Checkout — ORZEN Merchant Panel" },
      { property: "og:description", content: "Complete your subscription plan purchase." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: CheckoutPage,
});

const CYCLE_LABEL: Record<CycleKey, string> = {
  monthly: "Monthly",
  "3m": "3 Months",
  "6m": "6 Months",
  yearly: "Yearly",
};

const BD_PHONE = /^01[3-9]\d{8}$/;
const TXN_RE = /^[A-Za-z0-9]{6,32}$/;

type MethodKey = "bkash" | "nagad" | "rocket";

function copyToClipboard(text: string, label: string) {
  try {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Copy failed");
  }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="flex items-stretch gap-2">
        <div className="flex-1 rounded-2xl border border-border bg-muted/40 px-4 py-3 font-mono text-base font-semibold sm:text-lg">
          {value}
        </div>
        <button
          type="button"
          onClick={() => copyToClipboard(value, label)}
          className="inline-flex min-w-[52px] items-center justify-center rounded-2xl border border-border bg-background px-3 text-sm font-medium hover:bg-muted active:scale-95"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

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
  const { data: sessionRes } = useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 5 * 60_000,
  });

  const pkg = (plans ?? []).find((p: any) => p.id === packageId) as any;
  const [cycle, setCycle] = useState<CycleKey>(initialCycle);
  const [method, setMethod] = useState<MethodKey>("bkash");
  const [txnId, setTxnId] = useState("");
  const [sender, setSender] = useState("");
  const [email, setEmail] = useState<string>("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Auto-fill email from session
  useMemo(() => {
    if (sessionRes?.email && !email) setEmail(sessionRes.email);
  }, [sessionRes?.email]);

  const walletFn = useServerFn(getMyWallet);
  const payWalletFn = useServerFn(payPlanWithWallet);
  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ["admin", "wallet"],
    queryFn: () => walletFn(),
  });
  const [walletPaying, setWalletPaying] = useState(false);

  if (!pkg) return <div className="p-8 text-sm text-muted-foreground">Loading plan…</div>;

  const s = settings ?? { discount_3m: 5, discount_6m: 10, discount_yearly: 20 };
  const calc = computeCycleTotal(Number(pkg.price), cycle, s);

  const enabledMethods = (["bkash", "nagad", "rocket"] as const).filter(
    (k) => methods?.[k]?.enabled,
  );
  const m = methods?.[method];
  const merchantNumber = m?.number ?? "";
  const merchantName = (m as any)?.merchant_name ?? "";
  const rawInstructions = m?.instructions ?? "";

  const instructions = useMemo<string[]>(() => {
    if (rawInstructions?.trim()) {
      return rawInstructions
        .split(/\r?\n/)
        .map((x: string) => x.trim())
        .filter(Boolean);
    }
    return [
      `Open your ${method.toUpperCase()} app and choose "Send Money".`,
      `Send exactly ৳${calc.total.toLocaleString()} to ${merchantNumber || "the merchant number above"}.`,
      "Copy the Transaction ID from your app.",
      "Fill the form below and submit.",
    ];
  }, [rawInstructions, method, calc.total, merchantNumber]);

  const errors = {
    sender: sender && !BD_PHONE.test(sender.trim()) ? "Enter a valid BD number (11 digits)" : "",
    txn: txnId && !TXN_RE.test(txnId.trim()) ? "6–32 letters or digits only" : "",
    email:
      email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email" : "",
  };
  const canSubmit =
    !!merchantNumber &&
    BD_PHONE.test(sender.trim()) &&
    TXN_RE.test(txnId.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await submit({
        data: {
          packageId,
          cycle,
          method,
          txn_id: txnId.trim(),
          sender_number: sender.trim(),
          customer_email: email.trim(),
          customer_note: note.trim() || undefined,
        },
      });
      setSuccessId(res.paymentId);
      toast.success("Payment request submitted");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Success state
  if (successId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pb-10">
        <Link
          to="/admin/billing" search={{} as never}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to billing
        </Link>
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Payment request submitted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your subscription will be activated after manual verification. We've sent a confirmation
            to <b>{email}</b> — you'll get another email once it's approved or rejected.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/admin/subscription" })}
              className="w-full"
            >
              View my requests
            </Button>
            <Button onClick={() => navigate({ to: "/admin" })} className="w-full">
              Go to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const cycleOptions: { key: CycleKey; label: string; discount: number }[] = [
    { key: "monthly", label: "Monthly", discount: 0 },
    { key: "3m", label: "3 Months", discount: s.discount_3m },
    { key: "6m", label: "6 Months", discount: s.discount_6m },
    { key: "yearly", label: "Yearly", discount: s.discount_yearly },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-16">
      <Link
        to="/admin/billing" search={{} as never}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {/* Plan summary */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Complete your payment</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="text-xl font-bold">{pkg.name}</div>
          <div className="text-xl font-bold">৳{calc.total.toLocaleString()}</div>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
          <span>{CYCLE_LABEL[cycle]} · {calc.months} mo</span>
          {calc.discountPct > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Save {calc.discountPct}%
            </span>
          )}
        </div>
      </div>

      {/* Cycle chips */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Billing cycle</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cycleOptions.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCycle(c.key)}
              className={`rounded-xl border p-3 text-left text-xs transition ${
                cycle === c.key
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "hover:bg-muted"
              }`}
            >
              <div className="font-semibold">{c.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {c.discount > 0 ? `Save ${c.discount}%` : "Standard"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pay from wallet */}
      {(() => {
        const balance = Number(wallet?.balance ?? 0);
        const enough = balance >= calc.total;
        return (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Wallet className="h-4 w-4" /> Pay from wallet
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Balance ৳{balance.toLocaleString()} · Instant activation, no manual approval.
                </div>
              </div>
              <Button
                disabled={!enough || walletPaying}
                onClick={async () => {
                  setWalletPaying(true);
                  try {
                    const res = (await payWalletFn({ data: { package_id: packageId, cycle } })) as any;
                    if (!res?.ok) {
                      const msg = res?.error ?? "Wallet payment failed";
                      const detail =
                        res?.required && res?.balance != null
                          ? ` (balance ৳${Number(res.balance).toLocaleString()} of ৳${Number(res.required).toLocaleString()})`
                          : "";
                      throw new Error(msg + detail);
                    }
                    await refetchWallet();
                    toast.success("Plan activated from wallet balance");
                    navigate({ to: "/admin/billing", search: {} as never });
                  } catch (err) {
                    await refetchWallet().catch(() => null);
                    toast.error((err as Error).message);
                  } finally {
                    setWalletPaying(false);
                  }
                }}
                className="shrink-0 gap-1.5"
              >
                {walletPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Pay ৳{calc.total.toLocaleString()}
              </Button>
            </div>
            {!enough && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                Not enough balance — you need ৳{(calc.total - balance).toLocaleString()} more.{" "}
                <Link to="/admin/billing" search={{} as never} className="font-semibold underline">
                  Add fund
                </Link>
              </div>
            )}
          </div>
        );
      })()}

      {enabledMethods.length === 0 ? (
        <div className="rounded-2xl border bg-amber-50 p-4 text-sm text-amber-900">
          No payment methods are currently enabled. Please contact the platform owner.
        </div>
      ) : (
        <>
          {/* Method tabs */}
          {enabledMethods.length > 1 && (
            <div className="flex gap-2 overflow-x-auto rounded-2xl border bg-card p-2 shadow-sm">
              {enabledMethods.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMethod(k)}
                  className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                    method === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          )}

          {/* Merchant details with copy */}
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            {merchantName && (
              <div className="text-sm">
                <span className="text-muted-foreground">Send Money to </span>
                <b>{merchantName}</b>
              </div>
            )}
            {merchantNumber ? (
              <CopyRow label={`${method.toUpperCase()} number`} value={merchantNumber} />
            ) : (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Merchant number not configured for {method.toUpperCase()}. Contact the platform owner.
              </div>
            )}
            <CopyRow label="Amount" value={`৳${calc.total.toLocaleString()}`} />

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Instructions
              </div>
              <ol className="space-y-1.5 text-sm">
                {instructions.map((step: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Payment form */}
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold">Confirm your payment</div>

            <div className="space-y-1.5">
              <Label>Sender {method.toUpperCase()} number</Label>
              <Input
                inputMode="numeric"
                required
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="h-11"
              />
              {errors.sender && <p className="text-xs text-red-600">{errors.sender}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Transaction ID</Label>
              <Input
                required
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
                placeholder="e.g. 9A7B2C3D4E"
                className="h-11 font-mono"
              />
              {errors.txn && <p className="text-xs text-red-600">{errors.txn}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11"
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>
                Note <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything the admin should know"
                maxLength={500}
              />
            </div>

            <Button
              type="submit"
              disabled={saving || !canSubmit}
              className="h-12 w-full text-base"
            >
              {saving ? "Submitting…" : `Submit Payment · ৳${calc.total.toLocaleString()}`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Your subscription activates once the platform owner verifies the payment.
            </p>
          </form>
        </>
      )}

      {methods?.sslcommerz?.enabled && (
        <div className="rounded-2xl border bg-card p-4 text-sm">
          <div className="font-semibold">Pay with SSLCommerz (card / bank)</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Online checkout via SSLCommerz is coming soon. Use a manual method above for now.
          </p>
        </div>
      )}
    </div>
  );
}
