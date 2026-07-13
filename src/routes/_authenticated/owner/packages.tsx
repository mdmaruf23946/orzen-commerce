import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, SlidersHorizontal } from "lucide-react";
import { listPackages, upsertPackage, deletePackage, getOwnerBillingSettings, updateBillingSettings } from "@/lib/owner.functions";
import { listFeatureFlags } from "@/lib/owner-ext.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { BILLING_CYCLES } from "@/lib/features";

export const Route = createFileRoute("/_authenticated/owner/packages")({
  component: PackagesPage,
});

function PackagesPage() {
  const list = useServerFn(listPackages);
  const del = useServerFn(deletePackage);
  const qc = useQueryClient();
  const { data: packages } = useQuery({ queryKey: ["owner", "packages"], queryFn: () => list() });
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  async function remove(id: string) {
    if (!confirm("Delete package?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["owner", "packages"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Packages</h1>
        <div className="flex items-center gap-2">
          <Link to="/owner/plan-features">
            <Button variant="outline" size="sm"><SlidersHorizontal className="mr-1 h-4 w-4" />Feature Access</Button>
          </Link>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> New package
          </Button>
        </div>
      </div>

      <DiscountSettingsCard />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(packages ?? []).map((p: any) => (
          <div key={p.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{p.name}</div>
                  {p.is_trial && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase text-amber-700">Trial</span>}
                  {!p.is_active && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">Inactive</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  ৳{Number(p.price).toFixed(0)} · {p.duration_days} days · {p.billing_cycle ?? "monthly"}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(p); setOpen(true); }} className="rounded p-2 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(p.id)} className="rounded p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {p.description && <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>}
            <div className="mt-3 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
              <div>Products: {p.product_limit ?? "∞"}</div>
              <div>Orders: {p.order_limit ?? "∞"}</div>
              <div>Customers: {p.customer_limit ?? "∞"}</div>
              <div>Staff: {p.staff_limit ?? "∞"}</div>
              <div>Storage: {p.storage_mb ? `${p.storage_mb} MB` : "∞"}</div>
              <div>Sort: {p.sort_order ?? 0}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries((p.features ?? {}) as Record<string, boolean>)
                .filter(([, v]) => p.is_trial || v)
                .slice(0, 6)
                .map(([k]) => (
                  <span key={k} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">{k}</span>
                ))}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <PackageDialog
          editing={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["owner", "packages"] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PackageDialog({ editing, onClose, onSaved }: { editing: any; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(upsertPackage);
  const [form, setForm] = useState<any>(() => ({
    id: editing?.id,
    name: editing?.name ?? "",
    description: editing?.description ?? "",
    price: editing?.price ?? 0,
    duration_days: editing?.duration_days ?? 30,
    billing_cycle: editing?.billing_cycle ?? "monthly",
    product_limit: editing?.product_limit ?? 100,
    order_limit: editing?.order_limit ?? 0,
    customer_limit: editing?.customer_limit ?? 0,
    staff_limit: editing?.staff_limit ?? 0,
    storage_mb: editing?.storage_mb ?? 0,
    is_active: editing?.is_active ?? true,
    is_trial: editing?.is_trial ?? false,
    trial_days: editing?.trial_days ?? 0,
    features: (editing?.features ?? {}) as Record<string, boolean>,
    sort_order: editing?.sort_order ?? 0,
  }));
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleFeature = (k: FeatureKey) => set("features", { ...form.features, [k]: !form.features[k] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({
        data: {
          ...form,
          price: Number(form.price),
          duration_days: Number(form.duration_days),
          product_limit: Number(form.product_limit),
          order_limit: Number(form.order_limit) || null,
          customer_limit: Number(form.customer_limit) || null,
          staff_limit: Number(form.staff_limit) || null,
          storage_mb: Number(form.storage_mb) || null,
          trial_days: Number(form.trial_days) || 0,
          sort_order: Number(form.sort_order) || 0,
        },
      });
      toast.success("Saved");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Tabs defaultValue="general">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
              <TabsTrigger value="limits" className="flex-1">Limits</TabsTrigger>
              <TabsTrigger value="features" className="flex-1">Features</TabsTrigger>
              <TabsTrigger value="trial" className="flex-1">Trial</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-3">
              <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Price</Label><Input type="number" min={0} required value={form.price} onChange={(e) => set("price", e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Billing cycle</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={form.billing_cycle}
                    onChange={(e) => {
                      const cyc = BILLING_CYCLES.find((c) => c.value === e.target.value);
                      set("billing_cycle", e.target.value);
                      if (cyc && cyc.value !== "custom") set("duration_days", cyc.days);
                    }}>
                    {BILLING_CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Duration (days)</Label><Input type="number" min={1} required value={form.duration_days} onChange={(e) => set("duration_days", e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} /> Active</label>
            </TabsContent>

            <TabsContent value="limits" className="space-y-3">
              {([
                ["product_limit", "Product limit"],
                ["order_limit", "Order limit / month"],
                ["customer_limit", "Customer limit"],
                ["staff_limit", "Staff limit"],
                ["storage_mb", "Storage (MB)"],
              ] as const).map(([k, label]) => (
                <div key={k} className="space-y-1.5">
                  <Label>{label} <span className="text-xs text-muted-foreground">(0 = unlimited)</span></Label>
                  <Input type="number" min={0} value={form[k] ?? 0} onChange={(e) => set(k, e.target.value)} />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="features" className="space-y-2">
              <p className="text-xs text-muted-foreground">Enable individual features for this package. Trial packages unlock everything automatically.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FEATURE_KEYS.map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <span>{FEATURE_LABELS[k]}</span>
                    <Switch checked={!!form.features[k]} onCheckedChange={() => toggleFeature(k)} />
                  </label>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="trial" className="space-y-3">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_trial} onCheckedChange={(v) => set("is_trial", v)} /> This is a trial package</label>
              <div className="space-y-1.5">
                <Label>Trial duration (days)</Label>
                <Input type="number" min={0} max={365} value={form.trial_days} onChange={(e) => set("trial_days", e.target.value)} />
                <p className="text-xs text-muted-foreground">When a new store is created, it auto-starts on the active trial package for this many days.</p>
              </div>
            </TabsContent>
          </Tabs>

          <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Save package"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DiscountSettingsCard() {
  const getFn = useServerFn(getOwnerBillingSettings);
  const saveFn = useServerFn(updateBillingSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["owner", "billingSettings"], queryFn: () => getFn() });
  const [form, setForm] = useState<{ discount_3m: number; discount_6m: number; discount_yearly: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const current = form ?? data ?? { discount_3m: 5, discount_6m: 10, discount_yearly: 20 };

  async function save() {
    setSaving(true);
    try {
      await saveFn({
        data: {
          discount_3m: Number(current.discount_3m),
          discount_6m: Number(current.discount_6m),
          discount_yearly: Number(current.discount_yearly),
        },
      });
      toast.success("Billing discounts updated");
      qc.invalidateQueries({ queryKey: ["owner", "billingSettings"] });
      qc.invalidateQueries({ queryKey: ["admin", "billingSettings"] });
      setForm(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: "discount_3m" | "discount_6m" | "discount_yearly", v: any) =>
    setForm((f) => ({ ...(f ?? current), [k]: Number(v) }));

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm font-semibold">Billing cycle discounts</div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Percent off the equivalent monthly price for longer billing cycles. Applied automatically at checkout.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>3 Months (%)</Label>
          <Input type="number" min={0} max={100} value={current.discount_3m} onChange={(e) => set("discount_3m", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>6 Months (%)</Label>
          <Input type="number" min={0} max={100} value={current.discount_6m} onChange={(e) => set("discount_6m", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Yearly (%)</Label>
          <Input type="number" min={0} max={100} value={current.discount_yearly} onChange={(e) => set("discount_yearly", e.target.value)} />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={save} disabled={saving || !form}>{saving ? "Saving…" : "Save discounts"}</Button>
      </div>
    </div>
  );
}
