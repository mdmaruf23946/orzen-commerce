import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ToggleLeft } from "lucide-react";
import { listFeatureFlags, upsertFeatureFlag, deleteFeatureFlag } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/features")({ component: Page });

function Page() {
  const list = useServerFn(listFeatureFlags);
  const upsert = useServerFn(upsertFeatureFlag);
  const del = useServerFn(deleteFeatureFlag);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner", "flags"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ flag_key: "", enabled: false, description: "", category: "general" });

  const grouped = (data as any[]).reduce((acc: Record<string, any[]>, f: any) => {
    (acc[f.category ?? "general"] ??= []).push(f);
    return acc;
  }, {});

  async function toggle(f: any, v: boolean) {
    await upsert({ data: { flag_key: f.flag_key, enabled: v, description: f.description, category: f.category } });
    qc.invalidateQueries({ queryKey: ["owner", "flags"] });
  }
  async function save() {
    try {
      await upsert({ data: form });
      toast.success("Saved");
      setOpen(false);
      setForm({ flag_key: "", enabled: false, description: "", category: "general" });
      qc.invalidateQueries({ queryKey: ["owner", "flags"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <OwnerPageHeader title="Feature Flags" description="Platform-wide toggles read by every FeatureGate."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />New flag</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New feature flag</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Key</Label><Input value={form.flag_key} onChange={(e) => setForm({ ...form, flag_key: e.target.value })} placeholder="ai_agent" /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /> Enabled</label>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {Object.keys(grouped).length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center">
          <ToggleLeft className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No flags yet. Create one to start.</p>
        </div>
      )}
      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, flags]) => (
          <div key={cat}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{cat}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(flags as any[]).map((f) => (
                <div key={f.flag_key} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-semibold">{f.flag_key}</div>
                    {f.description && <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={f.enabled} onCheckedChange={(v) => toggle(f, v)} />
                    <Button variant="ghost" size="icon" onClick={async () => { if (confirm("Delete?")) { await del({ data: { flag_key: f.flag_key } }); qc.invalidateQueries({ queryKey: ["owner", "flags"] }); } }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
