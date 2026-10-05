// Extra ePBX integration cards on the Provider tab: API endpoint, webhook info and a live test call.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, PhoneOutgoing, ShieldCheck, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendEpbxTestCall } from "@/lib/voice.functions";

const API_BASE = "https://epbx.bd/api/v1";

function Box({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-primary" /> {title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{desc}</p>
      {children}
    </section>
  );
}

function CopyField({ value }: { value: string }) {
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" />
      <Button size="icon" variant="outline" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function EpbxEndpointsCard() {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://orzen.top";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Box icon={Link2} title="API endpoint" desc="ORZEN talks to ePBX through this address. Calls, balance, history and recordings all use it.">
        <CopyField value={API_BASE} />
      </Box>
      <Box icon={ShieldCheck} title="Webhook / call results" desc="Set up automatically — nothing to paste in ePBX.">
        <CopyField value={`${origin}/api/public/voice/epbx`} />
        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          <li>• Every call gets its own signed link, so fake results are rejected.</li>
          <li>• Results (answered, 1 = confirm, 2 = cancel, no answer, recording) come back here and update the order.</li>
        </ul>
      </Box>
    </div>
  );
}

export function EpbxTestCallCard() {
  const fn = useServerFn(sendEpbxTestCall);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const valid = /^(\+?88)?01[3-9]\d{8}$/.test(phone);
  return (
    <Box icon={PhoneOutgoing} title="Send a test call" desc="Your own phone gets the same order-confirmation call a customer would get, using your current script and audio. No order is changed.">
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-end">
        <div className="space-y-1"><Label className="text-xs">Your mobile number</Label>
          <Input inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 14))} /></div>
        <div className="space-y-1"><Label className="text-xs">Test amount (৳)</Label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || "1", 10) || 1))} /></div>
        <Button disabled={busy || !valid} onClick={async () => {
          setBusy(true); setResult(null);
          try { const r = await fn({ data: { phone, amount } }); setResult(r); r.ok ? toast.success(r.message) : toast.error(r.message); }
          catch (e) { setResult({ ok: false, message: (e as Error).message }); }
          finally { setBusy(false); }
        }}>{busy ? "Calling…" : "Send Test Call"}</Button>
      </div>
      {result && (
        <p className={`mt-2 rounded-lg p-2 text-xs ${result.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{result.message}</p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">The call needs ePBX balance and an active SIP trunk.</p>
    </Box>
  );
}
