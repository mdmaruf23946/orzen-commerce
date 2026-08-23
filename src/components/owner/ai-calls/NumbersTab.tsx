import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, DownloadCloud, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listPhoneNumbers, savePhoneNumber, setPhoneNumberStatus, releasePhoneNumber, importTwilioNumbers,
  listAgents, listStoreAiCallCenters,
} from "@/lib/ai-call-center.functions";

const EMPTY = {
  id: null as string | null,
  phone_number: "",
  country: "US",
  label: "",
  provider_sid: "",
  store_id: null as string | null,
  agent_id: null as string | null,
  inbound_enabled: true,
  outbound_enabled: true,
  available_to_store: false,
};

export function NumbersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPhoneNumbers);
  const saveFn = useServerFn(savePhoneNumber);
  const statusFn = useServerFn(setPhoneNumberStatus);
  const releaseFn = useServerFn(releasePhoneNumber);
  const importFn = useServerFn(importTwilioNumbers);
  const agentsFn = useServerFn(listAgents);
  const storesFn = useServerFn(listStoreAiCallCenters);

  const numbers = useQuery({ queryKey: ["ai-call", "numbers"], queryFn: () => listFn() });
  const agents = useQuery({ queryKey: ["ai-call", "agents"], queryFn: () => agentsFn() });
  const stores = useQuery({ queryKey: ["ai-call", "stores"], queryFn: () => storesFn() });

  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<any>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["ai-call", "numbers"] });
      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Assign a number to a store and an agent, then enable it to go live for inbound and outbound AI calls.
        </p>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => {
            const r: any = await importFn();
            toast.message(`${r.imported} numbers imported`);
          }, "Numbers synced from Twilio")}>
            <DownloadCloud className="mr-1 h-3.5 w-3.5" /> Import from Twilio
          </Button>
          <Button size="sm" onClick={() => setForm({ ...EMPTY })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Number
          </Button>
        </div>
      </div>

      {form && (
        <section className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label className="text-xs">Phone Number</Label>
            <Input className="mt-1 h-9" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+8801XXXXXXXXX" />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Input className="mt-1 h-9" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Label</Label>
            <Input className="mt-1 h-9" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Twilio SID</Label>
            <Input className="mt-1 h-9" value={form.provider_sid} onChange={(e) => setForm({ ...form, provider_sid: e.target.value })} placeholder="PN…" />
          </div>
          <div>
            <Label className="text-xs">Assigned Store</Label>
            <Select value={form.store_id ?? "none"} onValueChange={(v) => setForm({ ...form, store_id: v === "none" ? null : v })}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {(stores.data as any[] | undefined)?.map((s) => <SelectItem key={s.store_id} value={s.store_id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">AI Agent</Label>
            <Select value={form.agent_id ?? "none"} onValueChange={(v) => setForm({ ...form, agent_id: v === "none" ? null : v })}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {(agents.data as any[] | undefined)?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={form.inbound_enabled} onCheckedChange={(v) => setForm({ ...form, inbound_enabled: v })} /> Inbound
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={form.outbound_enabled} onCheckedChange={(v) => setForm({ ...form, outbound_enabled: v })} /> Outbound
          </label>
          <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-1">
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}>Cancel</Button>
            <Button size="sm" disabled={busy || !form.phone_number} onClick={() => void run(async () => { await saveFn({ data: form as any }); setForm(null); }, "Number saved")}>
              Save
            </Button>
          </div>
        </section>
      )}

      <div className="rounded-2xl border bg-card divide-y">
        {(numbers.data as any[] | undefined)?.map((n) => (
          <div key={n.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="font-mono">{n.phone_number}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${n.status === "active" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "text-muted-foreground"}`}>
                  {n.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {n.stores?.name ?? "Unassigned store"} · {n.ai_call_agents?.name ?? "No agent"} · {n.country}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void run(() => statusFn({ data: { id: n.id, enabled: n.status !== "active" } }), n.status === "active" ? "Number disabled" : "Number enabled")}
              >
                {n.status === "active" ? "Disable" : "Enable"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setForm({
                ...EMPTY, ...n, label: n.label ?? "", provider_sid: n.provider_sid ?? "",
              })}>
                Edit
              </Button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:text-destructive"
                onClick={() => void run(() => releaseFn({ data: { id: n.id } }), "Number released")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {!numbers.data?.length && <div className="p-6 text-sm text-muted-foreground">No phone numbers yet.</div>}
      </div>
    </div>
  );
}
