import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { disconnectOrzenCall, getOrzenCallSettings, saveOrzenCallSettings } from "@/lib/orzen-call.functions";

export function OrzenCallModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getOrzenCallSettings);
  const saveFn = useServerFn(saveOrzenCallSettings);
  const discFn = useServerFn(disconnectOrzenCall);
  const q = useQuery({ queryKey: ["orzen-call", "settings"], queryFn: () => getFn(), enabled: open });
  const [url, setUrl] = useState("");
  const [orders, setOrders] = useState(true);
  const [products, setProducts] = useState(true);
  const [busy, setBusy] = useState<"save" | "disc" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (q.data) {
      setUrl(q.data.webhook_url);
      setOrders(q.data.auto_orders);
      setProducts(q.data.auto_products);
    }
  }, [q.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["orzen-call", "settings"] });

  async function save() {
    setBusy("save");
    try {
      const r = await saveFn({ data: { webhook_url: url, auto_orders: orders, auto_products: products } });
      r.ok ? toast.success(r.message) : toast.error(r.message);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message?.includes("https") ? "Webhook URL must be a public https:// link." : "Could not save settings.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disc");
    try {
      await discFn();
      toast.success("Orzen Call disconnected");
      await refresh();
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  }

  const cb = q.data?.callback_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Orzen Call</DialogTitle>
          <DialogDescription>AI voice calling — order confirmation calls and product knowledge sync.</DialogDescription>
        </DialogHeader>
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
            <div className="space-y-1.5">
              <Label>Callback URL</Label>
              {cb ? (
                <div className="flex gap-2">
                  <Input readOnly value={cb} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(cb); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Save settings once to get your private callback link.</p>
              )}
              <p className="text-xs text-muted-foreground">Paste this into Orzen Call. When a customer confirms or cancels on the call, the order updates to Confirmed or Cancelled here.</p>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {q.data?.connected ? (
            <Button variant="outline" className="text-destructive" disabled={!!busy} onClick={disconnect}>
              {busy === "disc" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Disconnect
            </Button>
          ) : <span />}
          <Button disabled={!!busy || !url.trim()} onClick={save}>
            {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
