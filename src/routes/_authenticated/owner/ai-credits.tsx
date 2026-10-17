import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import {
  getAiCreditAdmin, saveAiCreditSettings, upsertAiCreditBundle, deleteAiCreditBundle,
  setPackageAiCredits, adjustStoreAiCredits,
} from "@/lib/ai-credits.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/owner/ai-credits")({
  head: () => ({ meta: [{ title: "AI Credits — Winner Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const load = useServerFn(getAiCreditAdmin);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "aiCredits"], queryFn: () => load() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["owner", "aiCredits"] });
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="space-y-4">
      <OwnerPageHeader title="AI Credits" description="Messenger, WhatsApp ও Web chat AI-এর credit system। এখনো merchant-দের কাছে দেখানো হচ্ছে না।" />
      <SettingsCard tpc={data.settings.tokens_per_credit} onDone={refresh} />
      <BundlesCard bundles={data.bundles} onDone={refresh} />
      <PackagesCard packages={data.packages} onDone={refresh} />
      <StoresCard stores={data.stores} onDone={refresh} />
    </div>
  );
}

function SettingsCard({ tpc, onDone }: { tpc: number; onDone: () => void }) {
  const save = useServerFn(saveAiCreditSettings);
  const [v, setV] = useState(String(tpc));
  useEffect(() => setV(String(tpc)), [tpc]);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Credit rate</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div><Label>১ credit = কত token</Label><Input type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} className="w-40" /></div>
        <Button onClick={async () => { try { await save({ data: { tokens_per_credit: Number(v) } }); toast.success("Saved"); onDone(); } catch (e) { toast.error((e as Error).message); } }}><Save className="mr-1 h-4 w-4" />Save</Button>
      </CardContent>
    </Card>
  );
}

function BundlesCard({ bundles, onDone }: { bundles: any[]; onDone: () => void }) {
  const up = useServerFn(upsertAiCreditBundle);
  const del = useServerFn(deleteAiCreditBundle);
  const [n, setN] = useState({ name: "", credits: "100", price_bdt: "" });
  const run = async (f: () => Promise<unknown>) => { try { await f(); toast.success("Saved"); onDone(); } catch (e) { toast.error((e as Error).message); } };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Credit packs (দাম)</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {bundles.map((b) => <BundleRow key={b.id} b={b} onSave={(r) => run(() => up({ data: r }))} onDelete={() => run(() => del({ data: { id: b.id } }))} />)}
        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <Input placeholder="নাম (যেমন Starter)" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} className="w-44" />
          <Input type="number" placeholder="Credits" value={n.credits} onChange={(e) => setN({ ...n, credits: e.target.value })} className="w-28" />
          <Input type="number" placeholder="দাম ৳" value={n.price_bdt} onChange={(e) => setN({ ...n, price_bdt: e.target.value })} className="w-28" />
          <Button onClick={() => run(async () => { await up({ data: { name: n.name, credits: Number(n.credits), price_bdt: Number(n.price_bdt), is_active: true } }); setN({ name: "", credits: "100", price_bdt: "" }); })}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BundleRow({ b, onSave, onDelete }: { b: any; onSave: (r: any) => void; onDelete: () => void }) {
  const [r, setR] = useState({ name: b.name, credits: String(b.credits), price_bdt: String(b.price_bdt), is_active: b.is_active });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} className="w-44" />
      <Input type="number" value={r.credits} onChange={(e) => setR({ ...r, credits: e.target.value })} className="w-28" />
      <Input type="number" value={r.price_bdt} onChange={(e) => setR({ ...r, price_bdt: e.target.value })} className="w-28" />
      <Switch checked={r.is_active} onCheckedChange={(v) => setR({ ...r, is_active: v })} />
      <Button size="sm" variant="outline" onClick={() => onSave({ id: b.id, name: r.name, credits: Number(r.credits), price_bdt: Number(r.price_bdt), is_active: r.is_active })}><Save className="h-4 w-4" /></Button>
      <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function PackagesCard({ packages, onDone }: { packages: any[]; onDone: () => void }) {
  const set = useServerFn(setPackageAiCredits);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Package-এ ফ্রি credit</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {packages.map((p) => <PkgRow key={p.id} p={p} onSave={async (c) => { try { await set({ data: { packageId: p.id, credits: c } }); toast.success("Saved"); onDone(); } catch (e) { toast.error((e as Error).message); } }} />)}
      </CardContent>
    </Card>
  );
}

function PkgRow({ p, onSave }: { p: any; onSave: (c: number) => void }) {
  const [v, setV] = useState(String(p.ai_credits_included ?? 0));
  return (
    <div className="flex items-center gap-2">
      <div className="w-48 truncate text-sm">{p.name} <span className="text-muted-foreground">৳{p.price}</span></div>
      <Input type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} className="w-28" />
      <Button size="sm" variant="outline" onClick={() => onSave(Number(v))}><Save className="h-4 w-4" /></Button>
    </div>
  );
}

function StoresCard({ stores, onDone }: { stores: any[]; onDone: () => void }) {
  const adj = useServerFn(adjustStoreAiCredits);
  const [q, setQ] = useState("");
  const [amt, setAmt] = useState<Record<string, string>>({});
  const list = stores.filter((s) => !q || `${s.name} ${s.slug}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Store credit balance</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Input placeholder="Store খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {list.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
            <div className="w-48 truncate">{s.name}</div>
            <div className={`w-28 font-medium ${s.balance < 0 ? "text-destructive" : ""}`}>{s.balance.toLocaleString()} cr</div>
            <div className="w-28 text-muted-foreground">used {s.used.toLocaleString()}</div>
            <Input type="number" placeholder="+/- credit" value={amt[s.id] ?? ""} onChange={(e) => setAmt({ ...amt, [s.id]: e.target.value })} className="w-28" />
            <Button size="sm" variant="outline" onClick={async () => { try { await adj({ data: { storeId: s.id, credits: Number(amt[s.id]) } }); setAmt({ ...amt, [s.id]: "" }); toast.success("Updated"); onDone(); } catch (e) { toast.error((e as Error).message); } }}>Apply</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
