import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Webhook, Play } from "lucide-react";
import { listWebhooks, upsertWebhook, deleteWebhook, testWebhook } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/webhooks")({ component: Page });

const events = ["payment.paid", "payment.failed", "store.created", "store.suspended", "subscription.renewed", "subscription.expired"];

function Page() {
  const list = useServerFn(listWebhooks);
  const upsert = useServerFn(upsertWebhook);
  const del = useServerFn(deleteWebhook);
  const test = useServerFn(testWebhook);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner", "webhooks"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", url: "", event: events[0], secret: "", is_active: true });

  async function save() {
    try { await upsert({ data: form }); toast.success("Saved"); setOpen(false); setForm({ name: "", url: "", event: events[0], secret: "", is_active: true }); qc.invalidateQueries({ queryKey: ["owner", "webhooks"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <OwnerPageHeader title="Webhooks" description="Deliver platform events to external services."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New webhook</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? "Edit webhook" : "New webhook"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></div>
                <div><Label>Event</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })}>
                    {events.map((ev) => <option key={ev}>{ev}</option>)}
                  </select>
                </div>
                <div><Label>Secret (optional)</Label><Input type="password" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> Active</label>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {(data as any[]).length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center"><Webhook className="mx-auto mb-2 h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">No webhooks configured.</p></div>
      ) : (
        <div className="space-y-2">
          {(data as any[]).map((w) => (
            <div key={w.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate font-semibold">{w.name}</div>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px]">{w.event}</span>
                    {w.is_active ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">Active</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Paused</span>}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{w.url}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Last: {w.last_delivery_at ? `${new Date(w.last_delivery_at).toLocaleString()} · HTTP ${w.last_status ?? "—"}` : "—"}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={async () => { const r = await test({ data: { id: w.id } }); toast.info(`Test → HTTP ${r.status}`); qc.invalidateQueries({ queryKey: ["owner", "webhooks"] }); }}><Play className="mr-1 h-3 w-3" />Test</Button>
                  <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Delete?")) { await del({ data: { id: w.id } }); qc.invalidateQueries({ queryKey: ["owner", "webhooks"] }); } }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
