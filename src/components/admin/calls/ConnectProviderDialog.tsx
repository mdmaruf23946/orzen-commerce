import { useEffect, useState } from "react";
import { Eye, EyeOff, Info, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { KIND_LABEL, getConfigs, getProfile, saveConfig, validateConfig, type CallExtension, type FieldKey, type ProviderConfig } from "@/lib/call-providers";

const BASE_LABEL: Record<FieldKey, string> = {
  host: "SIP Server / Domain", username: "SIP Username", password: "SIP Password / Secret", callerId: "Caller ID",
  extension: "Extension", wsUrl: "WebSocket (WSS) URL", outboundProxy: "Outbound Proxy", stun: "STUN Server", prefix: "Dial Prefix",
};
const ADVANCED: FieldKey[] = ["outboundProxy", "stun", "prefix"];

/** Opens for a new line of `providerId`, or edits line `lineId` when given. */
export function ConnectProviderDialog({ providerId, lineId, onClose }: { providerId: string | null; lineId?: string | null; onClose: () => void }) {
  const p = getProfile(providerId ?? undefined);
  const [f, setF] = useState<Partial<ProviderConfig>>({});
  const [show, setShow] = useState(false);
  const [adv, setAdv] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!providerId) return;
    const prof = getProfile(providerId);
    const ex = lineId ? getConfigs()[lineId] : undefined;
    setF(ex ?? { id: crypto.randomUUID(), extensions: [], providerId, mode: "byoc", transport: "WSS", host: prof?.kind === "webrtc" ? "" : prof?.host ?? "", username: "", password: "", callerId: "" });
    setAdv(!!(ex?.stun || ex?.outboundProxy || ex?.prefix)); setTest(null); setShow(false);
    setNe({ ext: "", password: "", name: "" });
  }, [providerId, lineId]);
  const [ne, setNe] = useState<CallExtension>({ ext: "", password: "", name: "" });
  const exts = f.extensions ?? [];
  const setExts = (list: CallExtension[]) => { setF((x) => ({ ...x, extensions: list })); setTest(null); };
  function addExt() {
    const ext = ne.ext.trim();
    if (!/^[0-9A-Za-z_.-]{2,20}$/.test(ext)) return toast.error("Extension লিখুন (যেমন 101)");
    if (exts.some((e) => e.ext === ext)) return toast.error("এই Extension আগেই আছে");
    if (exts.length >= 50) return toast.error("সর্বোচ্চ ৫০টি Extension");
    setExts([...exts, { ext, ...(ne.password ? { password: ne.password } : {}), ...(ne.name?.trim() ? { name: ne.name.trim() } : {}) }]);
    setNe({ ext: "", password: "", name: "" });
  }

  const set = (k: keyof ProviderConfig, v: string) => { setF((x) => ({ ...x, [k]: v })); setTest(null); };

  async function runTest() {
    const err = validateConfig(f);
    setTesting(true);
    await new Promise((r) => setTimeout(r, 600));
    setTesting(false);
    setTest(err ? { ok: false, msg: err } : { ok: true, msg: "তথ্যগুলো ঠিক ফরম্যাটে আছে। আসল সংযোগ প্রথম কলের সময় যাচাই হবে।" });
  }
  function save() {
    const err = validateConfig(f);
    if (err) return toast.error(err);
    saveConfig({ ...(f as ProviderConfig), extension: undefined, transport: "WSS", connectedAt: new Date().toISOString() });
    toast.success(`${p?.name} connected`);
    onClose();
  }

  if (!p) return null;
  const field = (k: FieldKey) => {
    const req = p.required.includes(k);
    const label = `${p.labels?.[k] ?? BASE_LABEL[k]}${req ? " *" : ""}`;
    const ph = p.placeholders?.[k] ?? (k === "host" ? p.host : k === "wsUrl" ? `wss://${p.host}:8089/ws` : k === "extension" ? "101" : k === "stun" ? "stun:stun.l.google.com:19302" : k === "prefix" ? "0 / +880" : "");
    if (k === "password") return (
      <div key={k} className="space-y-1"><Label>{label}</Label>
        <div className="relative">
          <Input type={show ? "text" : "password"} value={f.password ?? ""} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" className="pr-10" />
          <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
    return <div key={k} className="space-y-1"><Label>{label}</Label><Input value={(f as any)[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={ph} autoComplete="off" /></div>;
  };
  const main = p.fields.filter((k) => !ADVANCED.includes(k));
  const extra = p.fields.filter((k) => ADVANCED.includes(k));

  return (
    <Dialog open={!!providerId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lineId ? "Edit" : "Connect"} {p.name}{lineId ? "" : " number"}</DialogTitle>
          <DialogDescription>{KIND_LABEL[p.kind]} · {p.tagline}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="mb-1 flex items-center gap-1.5 font-medium"><Info className="h-4 w-4" />কীভাবে তথ্য পাবেন</div>
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">{p.guide.map((g) => <li key={g}>{g}</li>)}</ol>
          </div>
          <div className="space-y-1"><Label>Line name (ঐচ্ছিক)</Label><Input value={f.label ?? ""} onChange={(e) => set("label", e.target.value)} placeholder="যেমন Sales / Support" maxLength={40} /></div>
          {main.map(field)}
          <div className="space-y-2 rounded-lg border p-3">
            <div>
              <Label>Extensions {p.kind !== "ip_trunk" && "*"}</Label>
              <p className="text-xs text-muted-foreground">প্রতিটি Extension একসাথে আলাদা একটি কল চালাতে পারে — ৫টি Extension থাকলে একসাথে ৫ জন কল করতে পারবেন। Password খালি রাখলে উপরের SIP Password ব্যবহার হবে।</p>
            </div>
            {exts.map((e) => (
              <div key={e.ext} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                <span><span className="font-mono">{e.ext}</span>{e.name && <span className="ml-2 text-xs text-muted-foreground">{e.name}</span>}{e.password && <span className="ml-2 text-xs text-muted-foreground">• password set</span>}</span>
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${e.ext}`} onClick={() => setExts(exts.filter((x) => x.ext !== e.ext))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Input value={ne.ext} onChange={(e) => setNe({ ...ne, ext: e.target.value })} placeholder="Ext (101)" autoComplete="off" />
              <Input type="password" value={ne.password ?? ""} onChange={(e) => setNe({ ...ne, password: e.target.value })} placeholder="Password" autoComplete="new-password" />
              <Input value={ne.name ?? ""} onChange={(e) => setNe({ ...ne, name: e.target.value })} placeholder="Agent name" autoComplete="off" />
              <Button type="button" variant="outline" onClick={addExt}><Plus className="mr-1 h-4 w-4" />Add</Button>
            </div>
          </div>
          {extra.length > 0 && (
            <>
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium">Advanced Settings<Switch checked={adv} onCheckedChange={setAdv} /></label>
              {adv && <div className="space-y-3 rounded-lg bg-muted/50 p-3">{extra.map(field)}</div>}
            </>
          )}
          {test && <p className={`rounded-lg p-3 text-sm ${test.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{test.msg}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={runTest} disabled={testing}>{testing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Check Details</Button>
          <Button onClick={save}>Save & Connect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
