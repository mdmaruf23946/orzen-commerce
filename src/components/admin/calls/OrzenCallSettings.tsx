import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, Loader2, RefreshCw, Package, KeyRound, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  disconnectOrzenCall, getOrzenCallSettings, saveOrzenCallSettings, sendOrzenTestPing,
  regenerateOrzenSecret, syncAllOrzenProducts, syncPendingOrzenOrders,
} from "@/lib/orzen-call.functions";

type Busy = "save" | "disc" | "ping" | "secret" | "products" | "orders" | null;
type OutcomeMap = { confirm: "confirmed" | "processing"; cancel: "cancelled" | "on_hold"; no_answer: "no_response" | "on_hold" | "none" };

function fmt(t: string | null | undefined) {
  if (!t) return "Never";
  return new Date(t).toLocaleString();
}

function CopyBtn({ value }: { value: string }) {
  const [c, setC] = useState(false);
  return (
    <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Copy"
      onClick={() => { navigator.clipboard.writeText(value); setC(true); setTimeout(() => setC(false), 1500); }}>
      {c ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export function OrzenCallSettings() {
  const qc = useQueryClient();
  const getFn = useServerFn(getOrzenCallSettings);
  const saveFn = useServerFn(saveOrzenCallSettings);
  const discFn = useServerFn(disconnectOrzenCall);
  const pingFn = useServerFn(sendOrzenTestPing);
  const secretFn = useServerFn(regenerateOrzenSecret);
  const prodFn = useServerFn(syncAllOrzenProducts);
  const ordFn = useServerFn(syncPendingOrzenOrders);
  const q = useQuery({ queryKey: ["orzen-call", "settings"], queryFn: () => getFn() });
  const [url, setUrl] = useState("");
  const [orders, setOrders] = useState(true);
  const [products, setProducts] = useState(true);
  const [map, setMap] = useState<OutcomeMap>({ confirm: "confirmed", cancel: "cancelled", no_answer: "no_response" });
  const [busy, setBusy] = useState<Busy>(null);

  useEffect(() => {
    if (q.data) {
      setUrl(q.data.webhook_url);
      setOrders(q.data.auto_orders);
      setProducts(q.data.auto_products);
      setMap(q.data.outcome_map as OutcomeMap);
    }
  }, [q.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["orzen-call"] });

  async function run(kind: Busy, fn: () => Promise<any>, okMsg?: string) {
    setBusy(kind);
    try {
      const r = await fn();
      if (r?.ok === false) toast.error(r.message);
      else toast.success(okMsg ? `${okMsg} — ${r?.message ?? ""}` : r?.message ?? "Done");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message?.includes("https") ? "Webhook URL must be a public https:// link." : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const d = q.data;
  const connected = !!d?.connected;
  const cb = d?.callback_url;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">Connection & Settings</p>
          <p className="text-sm text-muted-foreground">AI voice calling — order confirmation calls and product knowledge sync.</p>
        </div>
        {connected ? (
          <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" />Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />Not Configured
          </Badge>
        )}
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="oc-url">Webhook URL</Label>
            <Input id="oc-url" placeholder="https://call.example.com/webhook/..." value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">Your Orzen Call webhook link. This store's orders and products are sent here.</p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Auto-send New Orders</p>
              <p className="text-xs text-muted-foreground">Send every new order to Orzen Call automatically.</p>
            </div>
            <Switch checked={orders} onCheckedChange={setOrders} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Auto-sync Products</p>
              <p className="text-xs text-muted-foreground">Send added or updated products to Orzen Call's AI knowledge.</p>
            </div>
            <Switch checked={products} onCheckedChange={setProducts} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" disabled={!connected || !!busy} onClick={() => run("products", () => prodFn(), "সফলভাবে সিঙ্ক হয়েছে")}>
              {busy === "products" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync All Existing Products
            </Button>
            <Button variant="outline" disabled={!connected || !!busy} onClick={() => run("orders", () => ordFn(), "সফলভাবে সিঙ্ক হয়েছে")}>
              {busy === "orders" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
              Sync Pending Orders
            </Button>
          </div>
          {!connected && <p className="-mt-2 text-xs text-muted-foreground">Save settings first to enable manual sync.</p>}

          <div className="space-y-1.5">
            <Label>Callback URL</Label>
            {cb ? (
              <div className="flex gap-2">
                <Input readOnly value={cb} className="min-w-0 font-mono text-xs" />
                <CopyBtn value={cb} />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Save settings once to get your private callback link.</p>
            )}
            <p className="text-xs text-muted-foreground">Paste this into Orzen Call. Call results update orders here using the mapping below.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" />Verification Secret Key</Label>
            {d?.secret ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex min-w-0 flex-1 gap-2">
                  <Input readOnly type="password" value={d.secret} className="min-w-0 font-mono text-xs" />
                  <CopyBtn value={d.secret} />
                </div>
                <Button variant="outline" disabled={!!busy} onClick={() => {
                  if (confirm("Create a new secret? The old one and old callback link will stop working.")) run("secret", () => secretFn());
                }}>
                  {busy === "secret" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Generate New Secret
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Save settings once to create your secret key.</p>
            )}
            <p className="text-xs text-muted-foreground">Every update from Orzen Call is checked with this key (in the callback link or the <span className="font-mono">X-Orzen-Secret</span> header). Outgoing data is signed with it too.</p>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Call Outcome Status Mapping</p>
              <p className="text-xs text-muted-foreground">What the order becomes on your site after the call.</p>
            </div>
            {([
              ["confirm", "Customer Confirms", [["confirmed", "Confirmed"], ["processing", "Processing"]]],
              ["cancel", "Customer Cancels", [["cancelled", "Cancelled"], ["on_hold", "On Hold"]]],
              ["no_answer", "No Answer / Unreachable", [["no_response", "No Response"], ["on_hold", "On Hold"], ["none", "Keep Pending"]]],
            ] as const).map(([k, label, opts]) => (
              <div key={k} className="grid items-center gap-1.5 sm:grid-cols-[1fr_200px]">
                <span className="text-sm">{label}</span>
                <Select value={map[k]} onValueChange={(v) => setMap((m) => ({ ...m, [k]: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
        {connected ? (
          <Button variant="outline" className="text-destructive" disabled={!!busy} onClick={() => run("disc", async () => { await discFn(); return { ok: true, message: "Orzen Call disconnected" }; })}>
            {busy === "disc" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Disconnect
          </Button>
        ) : <span />}
        <div className="flex flex-col gap-2 sm:flex-row">
          {connected && (
            <Button variant="outline" disabled={!!busy} onClick={() => run("ping", () => pingFn())}>
              {busy === "ping" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send Test Ping
            </Button>
          )}
          <Button disabled={!!busy || !url.trim()} onClick={() => run("save", () => saveFn({ data: { webhook_url: url, auto_orders: orders, auto_products: products, outcome_map: map } }))}>
            {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Settings
          </Button>
        </div>
      </div>

      {d && (
        <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />Last synced: <span className="text-foreground">{fmt(d.last_synced)}</span>
          </div>
          {d.last_test ? (
            <div className={`flex items-center gap-2 ${d.last_test_ok ? "text-primary" : "text-destructive"}`}>
              {d.last_test_ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              <span className="min-w-0">Test ping {d.last_test_ok ? "succeeded" : "failed"}{d.last_test_message ? ` — ${d.last_test_message}` : ""} ({fmt(d.last_test)})</span>
            </div>
          ) : (
            <div className="text-muted-foreground">No test ping sent yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
