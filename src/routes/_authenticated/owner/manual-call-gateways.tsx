import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Radio } from "lucide-react";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listManualGateways, saveManualGateway, deleteManualGateway } from "@/lib/manual-call.functions";

export const Route = createFileRoute("/_authenticated/owner/manual-call-gateways")({
  component: GatewaysPage,
  head: () => ({
    meta: [
      { title: "Manual Call Gateways — Winner Admin" },
      { name: "description", content: "Add the phone and IP providers merchants can use for manual calls." },
      { property: "og:title", content: "Manual Call Gateways — Winner Admin" },
      { property: "og:description", content: "Add the phone and IP providers merchants can use for manual calls." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const EMPTY = { id: undefined as string | undefined, name: "", kind: "sip" as "sip" | "mobile" | "ip", wss_url: "wss://", sip_domain: "", help_text: "", is_active: true };

function GatewaysPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listManualGateways);
  const saveFn = useServerFn(saveManualGateway);
  const delFn = useServerFn(deleteManualGateway);
  const q = useQuery({ queryKey: ["manual-gateways"], queryFn: () => listFn() });
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const set = (k: string, v: any) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const refresh = () => qc.invalidateQueries({ queryKey: ["manual-gateways"] });

  return (
    <div>
      <OwnerPageHeader title="Manual Call Gateways" description="Providers merchants can connect their own line to (SIP over secure WebSocket)."
        actions={<Button size="sm" onClick={() => setForm({ ...EMPTY })}><Plus className="mr-1 h-4 w-4" />Add gateway</Button>} />
      <div className="space-y-2">
        {(q.data ?? []).map((g: any) => (
          <div key={g.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <Radio className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{g.name} {!g.is_active && <span className="text-xs text-muted-foreground">(off)</span>}</div>
              <div className="truncate text-xs text-muted-foreground">{g.kind} · {g.wss_url} · {g.sip_domain}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setForm({ ...EMPTY, ...g, help_text: g.help_text ?? "" })}>Edit</Button>
            <Button size="icon" variant="ghost" aria-label="Delete gateway" onClick={async () => { await delFn({ data: { id: g.id } }); refresh(); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {!q.data?.length && !form && <p className="text-sm text-muted-foreground">No gateways yet.</p>}
      </div>
      {form && (
        <div className="mt-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1"><Label>Provider name</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1"><Label>Type</Label>
            <Select value={form.kind} onValueChange={(v) => set("kind", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sip">SIP / IP-PBX</SelectItem><SelectItem value="mobile">Mobile operator</SelectItem><SelectItem value="ip">IP telephony</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Secure WebSocket URL</Label><Input value={form.wss_url} onChange={(e) => set("wss_url", e.target.value)} placeholder="wss://sip.provider.com:7443" /></div>
          <div className="space-y-1"><Label>SIP domain</Label><Input value={form.sip_domain} onChange={(e) => set("sip_domain", e.target.value)} placeholder="sip.provider.com" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Help for merchants</Label><Textarea value={form.help_text} onChange={(e) => set("help_text", e.target.value)} placeholder="Where merchants find their ID and password" /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />Available to merchants</label>
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={async () => {
              try { await saveFn({ data: { ...form, help_text: form.help_text || null } }); toast.success("Saved"); setForm(null); refresh(); } catch (e: any) { toast.error(e.message); }
            }}>Save</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
