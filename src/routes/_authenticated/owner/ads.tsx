import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, Megaphone, Power, Clock } from "lucide-react";
import {
  getAdSettings,
  updateAdSettings,
  listAdSlots,
  upsertAdSlot,
  toggleAdSlot,
  deleteAdSlot,
  adAdminStats,
} from "@/lib/ads.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/owner/ads")({ component: AdsPage });

const PLAN_OPTIONS = ["free", "basic", "business", "custom"];
const SLOT_KEYS = [
  { key: "admin_dashboard_bottom", label: "Admin Dashboard – Bottom" },
  { key: "admin_analytics_bottom", label: "Admin Analytics – Bottom" },
  { key: "admin_reports_bottom", label: "Admin Reports – Bottom" },
  { key: "admin_settings_bottom", label: "Admin Settings – Bottom" },
  { key: "admin_mobile_sticky_bottom", label: "Admin Mobile – Sticky Bottom (320×50)" },
];
const FORMATS = [
  { v: "responsive", l: "Responsive" },
  { v: "banner_728x90", l: "Banner 728×90" },
  { v: "banner_320x50", l: "Banner 320×50 (Mobile)" },
  { v: "banner_300x250", l: "Banner 300×250" },
  { v: "native", l: "Native" },
];

function AdsPage() {
  const qc = useQueryClient();
  const settingsFn = useServerFn(getAdSettings);
  const statsFn = useServerFn(adAdminStats);
  const slotsFn = useServerFn(listAdSlots);
  const saveSettings = useServerFn(updateAdSettings);
  const toggle = useServerFn(toggleAdSlot);
  const del = useServerFn(deleteAdSlot);

  const { data: settings } = useQuery({ queryKey: ["owner", "ad-settings"], queryFn: () => settingsFn() });
  const { data: stats } = useQuery({ queryKey: ["owner", "ad-stats"], queryFn: () => statsFn() });
  const { data: slots } = useQuery({ queryKey: ["owner", "ad-slots"], queryFn: () => slotsFn() });

  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (settings && !form) {
      setForm({
        enabled: settings.enabled,
        provider: settings.provider,
        show_on_plans: settings.show_on_plans ?? ["free"],
      });
    }
  }, [settings]);

  const [editing, setEditing] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState<any | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["owner", "ad-slots"] });
    qc.invalidateQueries({ queryKey: ["owner", "ad-stats"] });
    qc.invalidateQueries({ queryKey: ["owner", "ad-settings"] });
    qc.invalidateQueries({ queryKey: ["my-ads"] });
  };

  async function saveGlobal() {
    if (!form) return;
    try {
      await saveSettings({ data: form });
      toast.success("Settings saved");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onToggle(id: string, is_active: boolean) {
    await toggle({ data: { id, is_active } });
    invalidate();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this ad slot?")) return;
    await del({ data: { id } });
    toast.success("Deleted");
    invalidate();
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Advertisement Management"
        description="Centralized control of Adsterra / provider ads shown inside the Store Admin panel for eligible plans."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Megaphone} label="Total Slots" value={stats?.totalSlots ?? 0} />
        <StatCard icon={Power} label="Active Slots" value={stats?.activeSlots ?? 0} tone={stats?.activeSlots ? "text-emerald-600" : ""} />
        <StatCard icon={Power} label="Global Status" value={stats?.enabledGlobal ? "ON" : "OFF"} tone={stats?.enabledGlobal ? "text-emerald-600" : "text-red-600"} />
        <StatCard icon={Clock} label="Last Updated" value={stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : "—"} small />
      </div>

      {/* Global settings */}
      {form && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Global Advertisement Switch</div>
              <p className="text-xs text-muted-foreground">Turn all ads ON or OFF instantly across every store.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adsterra">Adsterra</SelectItem>
                  <SelectItem value="adsense">Google AdSense</SelectItem>
                  <SelectItem value="monetag">Monetag</SelectItem>
                  <SelectItem value="custom">Custom / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Show ads to plans</Label>
              <div className="flex flex-wrap gap-2">
                {PLAN_OPTIONS.map((p) => {
                  const on = form.show_on_plans.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          show_on_plans: on
                            ? form.show_on_plans.filter((x: string) => x !== p)
                            : [...form.show_on_plans, p],
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-xs capitalize ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <Button onClick={saveGlobal}>Save settings</Button>
        </div>
      )}

      {/* Slots */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div className="font-semibold">Ad Slots</div>
          <Button size="sm" onClick={() => setEditing({ slot_key: "", name: "", provider: form?.provider ?? "adsterra", code: "", format: "responsive", is_active: true })}>
            <Plus className="mr-1 h-4 w-4" /> Add slot
          </Button>
        </div>
        <div className="divide-y">
          {(slots ?? []).length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No ad slots yet.</div>
          )}
          {(slots ?? []).map((s: any) => (
            <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{s.slot_key}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.provider} · {s.format} · Updated {new Date(s.updated_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={s.is_active} onCheckedChange={(v) => onToggle(s.id, v)} />
                <Button variant="outline" size="sm" onClick={() => setPreviewing(s)}><Eye className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => onDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <SlotDialog
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); }}
        />
      )}
      {previewing && <PreviewDialog slot={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  );
}

function SlotDialog({ value, onClose, onSaved }: { value: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>(value);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(upsertAdSlot);

  async function submit() {
    if (!f.slot_key || !f.name) return toast.error("Slot key and name required");
    setSaving(true);
    try {
      await save({
        data: {
          id: f.id,
          slot_key: f.slot_key,
          name: f.name,
          description: f.description ?? null,
          provider: f.provider || "adsterra",
          code: f.code ?? "",
          format: f.format,
          is_active: !!f.is_active,
          starts_at: f.starts_at || null,
          ends_at: f.ends_at || null,
        },
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{f.id ? "Edit ad slot" : "Add ad slot"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Slot key</Label>
              <Select value={f.slot_key} onValueChange={(v) => setF({ ...f, slot_key: v, name: f.name || SLOT_KEYS.find(x => x.key === v)?.label || "" })}>
                <SelectTrigger><SelectValue placeholder="Choose placement" /></SelectTrigger>
                <SelectContent>
                  {SLOT_KEYS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Input value={f.provider ?? ""} onChange={(e) => setF({ ...f, provider: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={f.format} onValueChange={(v) => setF({ ...f, format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.map((x) => <SelectItem key={x.v} value={x.v}>{x.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ad code (HTML/JS snippet)</Label>
            <Textarea rows={8} className="font-mono text-xs" value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder='<script type="text/javascript">…</script>' />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} />
            <span className="text-sm">Active</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({ slot, onClose }: { slot: any; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Preview – {slot.name}</DialogTitle></DialogHeader>
        <div className="rounded border bg-muted/30 p-3">
          <iframe
            title="ad-preview"
            srcDoc={`<!doctype html><html><body style="margin:0;font-family:system-ui">${slot.code || "<em>No code</em>"}</body></html>`}
            sandbox="allow-scripts allow-popups allow-same-origin"
            className="h-[300px] w-full border-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon: Icon, label, value, tone, small }: { icon: any; label: string; value: any; tone?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`mt-2 font-semibold ${small ? "text-sm" : "text-2xl"} ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
