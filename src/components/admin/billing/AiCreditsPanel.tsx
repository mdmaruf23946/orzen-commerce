import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Lock, Wallet, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyAiCredits, buyAiCreditsWithWallet, submitAiCreditPayment } from "@/lib/ai-credit-purchase.functions";
import { getEnabledPaymentMethods } from "@/lib/billing.functions";

const REASON: Record<string, string> = {
  trial: "Free trial-এ AI credit কেনা যায় না।",
  no_ai: "আপনার plan-এ WhatsApp / Messenger / Web Chat AI নেই।",
  expired: "আপনার plan-এর মেয়াদ শেষ।",
  no_plan: "কোনো plan চালু নেই।",
};

export default function AiCreditsPanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getMyAiCredits);
  const walletFn = useServerFn(buyAiCreditsWithWallet);
  const payFn = useServerFn(submitAiCreditPayment);
  const methodsFn = useServerFn(getEnabledPaymentMethods);
  const { data } = useQuery({ queryKey: ["admin", "myAiCredits"], queryFn: () => getFn() });
  const { data: methods } = useQuery({ queryKey: ["admin", "paymentMethods"], queryFn: () => methodsFn() });
  const [packId, setPackId] = useState<string | null>(null);
  const [mode, setMode] = useState<"wallet" | "mobile">("wallet");
  const [method, setMethod] = useState<"bkash" | "nagad" | "rocket">("bkash");
  const [txn, setTxn] = useState("");
  const [sender, setSender] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data) return null;
  const pack = data.packs.find((p) => p.id === packId) ?? null;
  const enabled = (["bkash", "nagad", "rocket"] as const).filter((k) => (methods as any)?.[k]?.enabled);
  const number = (methods as any)?.[method]?.number ?? "";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "myAiCredits"] }); qc.invalidateQueries({ queryKey: ["admin", "wallet"] }); };

  async function buyWallet() {
    if (!pack) return;
    setBusy(true);
    try { await walletFn({ data: { bundleId: pack.id } }); toast.success(`${pack.credits} credit যোগ হয়েছে`); setPackId(null); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function buyMobile() {
    if (!pack) return;
    setBusy(true);
    try {
      await payFn({ data: { bundleId: pack.id, method, txn_id: txn.trim(), sender_number: sender.trim(), customer_email: email.trim() } });
      toast.success("Payment জমা হয়েছে — যাচাই হলে credit যোগ হবে"); setTxn(""); setSender(""); setPackId(null);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI Credits</h2>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["মোট বাকি", data.balance],
          ["আজকের খরচ", (data as any).usedToday ?? 0],
          ["এই মাসের খরচ", (data as any).usedMonth ?? 0],
          ["সর্বমোট খরচ", data.used],
        ].map(([label, v], i) => (
          <div key={i} className={`rounded-xl border p-3 ${i === 0 ? "border-primary/30 bg-primary/5" : "bg-muted/30"}`}>
            <div className="text-xs text-muted-foreground">{label as string}</div>
            <div className={`mt-1 font-bold tabular-nums ${i === 0 ? "text-2xl text-primary" : "text-lg"}`}>{Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Messenger, WhatsApp ও Web Chat-এর AI উত্তর এই credit থেকে কাটে।</p>

      {!data.eligible ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{REASON[data.reason ?? ""] ?? "Credit কেনা যাবে না।"} AI credit কিনতে AI-সহ plan-এ upgrade করুন।</span>
        </div>
      ) : data.packs.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">এখন কোনো credit pack নেই।</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.packs.map((p) => (
              <button key={p.id} type="button" onClick={() => setPackId(p.id)}
                className={`rounded-xl border p-3 text-left ${packId === p.id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:border-foreground/30"}`}>
                <div className="font-semibold">{p.credits.toLocaleString()} credits</div>
                <div className="text-sm text-muted-foreground">৳{p.price.toLocaleString()}</div>
                <div className="truncate text-[11px] text-muted-foreground">{p.name}</div>
              </button>
            ))}
          </div>

          {pack && (
            <div className="mt-4 space-y-3 rounded-xl border p-4">
              <div className="flex gap-2">
                <Button size="sm" variant={mode === "wallet" ? "default" : "outline"} onClick={() => setMode("wallet")}><Wallet className="mr-1 h-4 w-4" />Ad Fund</Button>
                <Button size="sm" variant={mode === "mobile" ? "default" : "outline"} onClick={() => setMode("mobile")}><Smartphone className="mr-1 h-4 w-4" />bKash / Nagad</Button>
              </div>
              {mode === "wallet" ? (
                <div className="space-y-2 text-sm">
                  <div>Ad Fund ব্যালেন্স: <b>৳{data.walletBalance.toLocaleString()}</b></div>
                  {data.walletBalance < pack.price && <div className="text-destructive">যথেষ্ট টাকা নেই — আরও ৳{(pack.price - data.walletBalance).toLocaleString()} লাগবে।</div>}
                  <Button disabled={busy || data.walletBalance < pack.price} onClick={buyWallet}>
                    {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}৳{pack.price.toLocaleString()} দিয়ে কিনুন
                  </Button>
                </div>
              ) : enabled.length === 0 ? (
                <p className="text-sm text-muted-foreground">এখন কোনো মোবাইল পেমেন্ট চালু নেই।</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    {enabled.map((k) => (
                      <Button key={k} size="sm" variant={method === k ? "default" : "outline"} onClick={() => setMethod(k)}>{k.toUpperCase()}</Button>
                    ))}
                  </div>
                  <div>এই নম্বরে <b>৳{pack.price.toLocaleString()}</b> Send Money করুন: <b>{number}</b></div>
                  <Input placeholder="যে নম্বর থেকে পাঠিয়েছেন" value={sender} onChange={(e) => setSender(e.target.value)} />
                  <Input placeholder="Transaction ID" value={txn} onChange={(e) => setTxn(e.target.value)} />
                  <Input placeholder="ইমেইল" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Button disabled={busy || !txn || !sender || !email} onClick={buyMobile}>
                    {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Payment জমা দিন
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
