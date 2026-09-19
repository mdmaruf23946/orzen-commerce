// Merchant Wallet — balance, Add Fund, auto-renewal and transaction history.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Wallet,
  Plus,
  RefreshCcw,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyWallet,
  listWalletTransactions,
  initiateWalletTopup,
  setWalletAutoRenew,
  getWalletTopupOptions,
  submitWalletTopupManual,
} from "@/lib/wallet.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CycleKey } from "@/lib/billing.functions";
import {
  MethodTabs,
  BrandCopyRow,
  BrandSteps,
  brandOf,
} from "@/components/admin/payments/ManualPayBlock";

const QUICK = [500, 1000, 2000, 5000];

const CYCLES: Array<{ key: CycleKey; label: string }> = [
  { key: "monthly", label: "Monthly" },
  { key: "3m", label: "3 Months" },
  { key: "6m", label: "6 Months" },
  { key: "yearly", label: "Yearly" },
];

const TYPE_LABEL: Record<string, string> = {
  topup: "Fund added",
  plan_payment: "Plan purchase",
  auto_renewal: "Auto renewal",
  refund: "Refund",
  adjustment: "Adjustment",
};

export function money(n: number) {
  return `৳${Number(n ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

export default function WalletPanel() {
  const qc = useQueryClient();
  const walletFn = useServerFn(getMyWallet);
  const txFn = useServerFn(listWalletTransactions);
  const topupFn = useServerFn(initiateWalletTopup);
  const autoFn = useServerFn(setWalletAutoRenew);
  const optionsFn = useServerFn(getWalletTopupOptions);
  const manualFn = useServerFn(submitWalletTopupManual);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["admin", "wallet"],
    queryFn: () => walletFn(),
  });
  const { data: txs } = useQuery({
    queryKey: ["admin", "walletTx"],
    queryFn: () => txFn({ data: { limit: 50 } }),
  });

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("1000");
  const [showAll, setShowAll] = useState(false);
  const [method, setMethod] = useState<"bkash" | "nagad" | "rocket">("bkash");
  const [sender, setSender] = useState("");
  const [txnId, setTxnId] = useState("");
  const [email, setEmail] = useState("");

  const walletBrand = brandOf(method);
  const amountNum = Math.round(Number(amount) || 0);
  const valid = amountNum >= 50 && amountNum <= 1_000_000;

  const { data: options } = useQuery({
    queryKey: ["admin", "walletTopupOptions"],
    queryFn: () => optionsFn(),
    staleTime: 5 * 60 * 1000,
  });
  const hasGateway = !!(options as any)?.gateway;
  const manualKeys = useMemo(
    () =>
      (["bkash", "nagad", "rocket"] as const).filter(
        (k) => (options as any)?.manual?.[k]?.enabled,
      ),
    [options],
  );
  const activeManual = (options as any)?.manual?.[method];
  const manualNumber = activeManual?.number ?? null;
  const manualName = activeManual?.merchant_name ?? null;
  const canSubmitManual =
    valid &&
    manualKeys.includes(method) &&
    /^01[3-9]\d{8}$/.test(sender.trim()) &&
    /^[A-Za-z0-9]{6,32}$/.test(txnId.trim()) &&
    /^\S+@\S+\.\S+$/.test(email.trim());

  const topup = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user?.email) throw new Error("Your account has no email address");
      return topupFn({
        data: {
          amount: amountNum,
          customer_name: (user.user_metadata as any)?.full_name || user.email,
          customer_email: user.email,
          return_origin: window.location.origin,
        },
      });
    },
    onSuccess: (res: any) => {
      if (res?.redirect_url) {
        window.location.href = res.redirect_url;
      } else {
        toast.error("Payment gateway did not return a checkout link");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not start the payment"),
  });

  const manualTopup = useMutation({
    mutationFn: async () =>
      manualFn({
        data: {
          amount: amountNum,
          method,
          txn_id: txnId.trim(),
          sender_number: sender.trim(),
          customer_email: email.trim(),
        },
      }),
    onSuccess: () => {
      setOpen(false);
      setTxnId("");
      setSender("");
      void qc.invalidateQueries({ queryKey: ["admin", "walletTx"] });
      toast.success("Top-up submitted. Your wallet will be credited after verification.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not submit the top-up"),
  });

  const saveAuto = useMutation({
    mutationFn: (vars: { auto_renew: boolean; auto_renew_cycle?: CycleKey }) =>
      autoFn({ data: vars }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "wallet"] });
      toast.success("Auto renewal settings saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const rows = useMemo(() => {
    const list = (txs ?? []) as any[];
    return showAll ? list : list.slice(0, 6);
  }, [txs, showAll]);

  return (
    <section className="rounded-lg border bg-card p-2.5 sm:rounded-xl sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
            <Wallet className="h-3.5 w-3.5" /> Wallet balance
          </div>
          <div className="mt-0.5 text-xl font-bold sm:text-3xl">
            {isLoading ? "…" : money(wallet?.balance ?? 0)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-sm">
            Add funds and pay for plans or renewals instantly.
          </p>
        </div>
        <Button
          onClick={async () => {
            if (manualKeys.length && !manualKeys.includes(method)) setMethod(manualKeys[0]!);
            if (!email) {
              const { data } = await supabase.auth.getUser();
              if (data.user?.email) setEmail(data.user.email);
            }
            setOpen(true);
          }}
          className="h-9 w-full gap-1.5 sm:w-auto"
        >
          <Plus className="h-4 w-4" /> Add Fund
        </Button>
      </div>

      {/* Auto renewal */}
      <div className="mt-3 rounded-lg border bg-muted/30 p-2.5 sm:mt-4 sm:p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <RefreshCcw className="h-3.5 w-3.5" /> Auto Renewal
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
              When your plan expires, the amount is deducted from the wallet and the plan renews
              automatically. If the balance is not enough, nothing is charged and you are notified.
            </p>
          </div>
          <Switch
            checked={!!wallet?.auto_renew}
            disabled={!wallet || saveAuto.isPending}
            onCheckedChange={(v) =>
              saveAuto.mutate({ auto_renew: v, auto_renew_cycle: (wallet?.auto_renew_cycle ?? "monthly") as CycleKey })
            }
            aria-label="Toggle auto renewal"
          />
        </div>

        {wallet?.auto_renew && (
          <div className="mt-2.5">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Renewal period
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {CYCLES.map((c) => {
                const active = (wallet?.auto_renew_cycle ?? "monthly") === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={saveAuto.isPending}
                    onClick={() => saveAuto.mutate({ auto_renew: true, auto_renew_cycle: c.key })}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition sm:text-xs ${
                      active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:border-foreground/30"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="mt-3 sm:mt-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
          <History className="h-3.5 w-3.5" /> Transaction history
        </div>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground sm:text-sm">
            No wallet transactions yet.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((t) => {
              const credit = Number(t.amount) > 0;
              return (
                <li key={t.id} className="flex items-center gap-2.5 p-2.5">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      credit ? "bg-emerald-100 text-emerald-700 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {credit ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium sm:text-sm">
                      {TYPE_LABEL[t.type] ?? t.type}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground sm:text-[11px]">
                      {new Date(t.created_at).toLocaleString()}
                      {t.reference ? ` · ${t.reference}` : ""}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-xs font-semibold sm:text-sm ${credit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {credit ? "+" : "−"}
                      {money(Math.abs(Number(t.amount)))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Bal {money(t.balance_after)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {(txs?.length ?? 0) > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-1.5 text-[11px] font-medium text-primary hover:underline sm:text-xs"
          >
            {showAll ? "Show less" : `Show all (${txs?.length})`}
          </button>
        )}
      </div>

      {/* Add Fund dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Fund</DialogTitle>
            <DialogDescription>
              Uses the same payment process as subscription plans. Your balance is credited only
              after the payment is verified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                    amountNum === q ? "border-primary bg-primary/5" : "hover:border-foreground/30"
                  }`}
                >
                  ৳{q}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-amount">Amount (BDT)</Label>
              <Input
                id="wallet-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="1000"
              />
              {!valid && amount !== "" && (
                <p className="text-[11px] text-red-600 dark:text-red-400">Enter an amount between ৳50 and ৳1,000,000.</p>
              )}
            </div>

            {hasGateway ? null : manualKeys.length === 0 ? (
              <p className="rounded-lg border border-dashed p-2.5 text-[11px] text-muted-foreground">
                No payment method is available right now. Please contact support.
              </p>
            ) : (
              <div
                className="space-y-3 rounded-xl border-2 bg-card p-3"
                style={{ borderColor: walletBrand.brandColor }}
              >
                <MethodTabs methods={manualKeys} value={method} onChange={setMethod} compact />
                {manualNumber && (
                  <>
                    <BrandCopyRow
                      label={`${walletBrand.label} number`}
                      value={manualNumber}
                      brand={walletBrand}
                    />
                    <BrandCopyRow
                      label="Amount"
                      value={money(amountNum)}
                      brand={walletBrand}
                      mono={false}
                    />
                    <BrandSteps
                      brand={walletBrand}
                      steps={[
                        `Open your ${walletBrand.label} app and choose "Send Money".`,
                        `Send exactly ${money(amountNum)} to ${manualNumber}${manualName ? ` (${manualName})` : ""}.`,
                        "Copy the Transaction ID from your app.",
                        "Fill the form below and submit.",
                      ]}
                    />
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="wt-sender">Sender {walletBrand.label} number</Label>
                  <Input
                    id="wt-sender"
                    inputMode="numeric"
                    value={sender}
                    onChange={(e) => setSender(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wt-txn">Transaction ID</Label>
                  <Input
                    id="wt-txn"
                    value={txnId}
                    onChange={(e) => setTxnId(e.target.value)}
                    placeholder="e.g. 9A7B2C3D4E"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wt-email">Email address</Label>
                  <Input
                    id="wt-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Your wallet is credited as soon as the platform verifies this payment.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            {hasGateway ? (
              <Button
                disabled={!valid || topup.isPending}
                onClick={() => topup.mutate()}
                className="w-full gap-1.5 sm:w-auto"
              >
                {topup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Pay {valid ? money(amountNum) : ""}
              </Button>
            ) : (
              <Button
                disabled={!canSubmitManual || manualTopup.isPending}
                onClick={() => manualTopup.mutate()}
                className="w-full gap-1.5 text-white hover:opacity-90 sm:w-auto"
                style={{ background: walletBrand.brandColor }}
              >
                {manualTopup.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Submit {valid ? money(amountNum) : ""}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
