import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROVIDERS, getConfigs, saveConfig, validateConfig, type ProviderConfig, type Transport } from "@/lib/call-providers";

export function ConnectProviderDialog({ providerId, onClose }: { providerId: string | null; onClose: () => void }) {
  const [f, setF] = useState<Partial<ProviderConfig>>({});
  const [show, setShow] = useState(false);
  const [adv, setAdv] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!providerId) return;
    const ex = getConfigs()[providerId];
    setF(ex ?? { providerId, mode: "byoc", transport: "WSS", host: "", username: "", password: "", callerId: "" });
    setAdv(!!(ex?.stun || ex?.wsUrl || ex?.prefix)); setTest(null); setShow(false);
  }, [providerId]);

  const set = (k: keyof ProviderConfig, v: any) => { setF((p) => ({ ...p, [k]: v })); setTest(null); };
  const p = PROVIDERS.find((x) => x.id === providerId);

  async function runTest() {
    const err = validateConfig(f);
    setTesting(true);
    await new Promise((r) => setTimeout(r, 900));
    setTesting(false);
    setTest(err ? { ok: false, msg: err } : { ok: true, msg: `Settings look correct for ${f.host}. Live registration happens on first call.` });
  }
  function save() {
    const err = validateConfig(f);
    if (err) return toast.error(err);
    saveConfig({ ...(f as ProviderConfig), connectedAt: new Date().toISOString() });
    toast.success(`${p?.name} connected`);
    onClose();
  }

  return (
    <Dialog open={!!providerId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Connect Your Provider</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Connection Mode</Label>
            <RadioGroup value={f.mode} onValueChange={(v) => set("mode", v)} className="grid gap-2 sm:grid-cols-2">
              {[["byoc", "BYOC", "Use my own number"], ["rented", "Rented", "Buy a number from ORZEN"]].map(([v, t, d]) => (
                <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${f.mode === v ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value={v} className="mt-0.5" />
                  <span><span className="block text-sm font-medium">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1"><Label>Provider Name</Label><Input value={p?.name ?? ""} disabled /></div>
          <div className="space-y-1"><Label>SIP Domain / Host *</Label><Input value={f.host ?? ""} onChange={(e) => set("host", e.target.value)} placeholder={p?.host ?? "sip.brilliant.com.bd"} /></div>
          <div className="space-y-1"><Label>SIP Username / DID Number *</Label><Input value={f.username ?? ""} onChange={(e) => set("username", e.target.value)} placeholder="09638XXXXX" autoComplete="off" /></div>
          <div className="space-y-1">
            <Label>SIP Password / Secret *</Label>
            <div className="relative">
              <Input type={show ? "text" : "password"} value={f.password ?? ""} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" className="pr-10" />
              <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Caller ID / Display Number *</Label><Input value={f.callerId ?? ""} onChange={(e) => set("callerId", e.target.value)} placeholder="09638XXXXX" /></div>
            <div className="space-y-1"><Label>Extension (Optional)</Label><Input value={f.extension ?? ""} onChange={(e) => set("extension", e.target.value)} placeholder="101" /></div>
          </div>
          <div className="space-y-1">
            <Label>Transport</Label>
            <Select value={f.transport} onValueChange={(v) => set("transport", v as Transport)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["WSS", "UDP", "TCP", "TLS"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium">Advanced Settings<Switch checked={adv} onCheckedChange={setAdv} /></label>
          {adv && (
            <div className="space-y-3 rounded-lg bg-muted/50 p-3">
              <div className="space-y-1"><Label>STUN Server</Label><Input value={f.stun ?? ""} onChange={(e) => set("stun", e.target.value)} placeholder="stun:stun.l.google.com:19302" /></div>
              <div className="space-y-1"><Label>WebSocket URL</Label><Input value={f.wsUrl ?? ""} onChange={(e) => set("wsUrl", e.target.value)} placeholder="wss://sip.example.com:7443" /></div>
              <div className="space-y-1"><Label>Prefix</Label><Input value={f.prefix ?? ""} onChange={(e) => set("prefix", e.target.value)} placeholder="e.g. 0 or +880" /></div>
            </div>
          )}
          {test && <p className={`rounded-lg p-3 text-sm ${test.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{test.msg}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={runTest} disabled={testing}>{testing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Test Connection</Button>
          <Button onClick={save}>Save & Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
