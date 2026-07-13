import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, ArrowLeft } from "lucide-react";
import {
  getPlanFeatureMatrix,
  bulkSetPlanFeatures,
  upsertFeatureFlag,
  deleteFeatureFlag,
} from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/plan-features")({
  component: PlanFeaturesPage,
});

type Matrix = Awaited<ReturnType<typeof getPlanFeatureMatrix>>;

function PlanFeaturesPage() {
  const load = useServerFn(getPlanFeatureMatrix);
  const bulk = useServerFn(bulkSetPlanFeatures);
  const addFlag = useServerFn(upsertFeatureFlag);
  const delFlag = useServerFn(deleteFeatureFlag);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["owner", "planFeatureMatrix"],
    queryFn: () => load() as Promise<Matrix>,
  });

  // Local edits keyed as `${packageId}::${featureKey}` → boolean
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [newFlag, setNewFlag] = useState({
    flag_key: "", label: "", description: "", category: "general",
  });

  const grouped = useMemo(() => {
    const g: Record<string, Matrix["features"]> = {};
    (data?.features ?? []).forEach((f) => {
      (g[f.category] ??= []).push(f);
    });
    return g;
  }, [data]);

  function currentValue(pkgId: string, key: string, orig: boolean) {
    const k = `${pkgId}::${key}`;
    return edits[k] ?? orig;
  }

  function toggle(pkgId: string, key: string, orig: boolean) {
    const k = `${pkgId}::${key}`;
    const next = !(edits[k] ?? orig);
    setEdits((e) => {
      const copy = { ...e };
      if (next === orig) delete copy[k];
      else copy[k] = next;
      return copy;
    });
  }

  async function saveAll() {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    try {
      const byPkg: Record<string, Record<string, boolean>> = {};
      for (const [k, v] of Object.entries(edits)) {
        const [pkgId, featureKey] = k.split("::");
        (byPkg[pkgId] ??= {})[featureKey] = v;
      }
      const updates = Object.entries(byPkg).map(([packageId, features]) => ({ packageId, features }));
      await bulk({ data: { updates } });
      toast.success("Feature access updated");
      setEdits({});
      qc.invalidateQueries({ queryKey: ["owner", "planFeatureMatrix"] });
      qc.invalidateQueries({ queryKey: ["owner", "packages"] });
      qc.invalidateQueries({ queryKey: ["admin", "billing"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addNew() {
    if (!newFlag.flag_key.trim()) return toast.error("Feature key required");
    try {
      await addFlag({ data: { ...newFlag, enabled: false, sort_order: 999 } });
      toast.success("Feature registered");
      setNewFlag({ flag_key: "", label: "", description: "", category: "general" });
      setOpenAdd(false);
      qc.invalidateQueries({ queryKey: ["owner", "planFeatureMatrix"] });
      qc.invalidateQueries({ queryKey: ["owner", "flags"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  async function removeFeature(key: string) {
    if (!confirm(`Remove feature "${key}" from the registry? Plans that reference it will keep the stored value but the row will disappear from this manager.`)) return;
    try {
      await delFlag({ data: { flag_key: key } });
      qc.invalidateQueries({ queryKey: ["owner", "planFeatureMatrix"] });
      qc.invalidateQueries({ queryKey: ["owner", "flags"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const packages = data?.packages ?? [];
  const dirtyCount = Object.keys(edits).length;

  return (
    <div>
      <OwnerPageHeader
        title="Plan Feature Access"
        description="Control which features each subscription plan unlocks. Changes apply instantly to every store on that plan."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/owner/packages"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Plans</Button></Link>
            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />Add feature</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Register a new feature</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Key <span className="text-xs text-muted-foreground">(lowercase, snake_case)</span></Label>
                    <Input value={newFlag.flag_key}
                      onChange={(e) => setNewFlag({ ...newFlag, flag_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                      placeholder="e.g. loyalty_points" />
                  </div>
                  <div><Label>Label</Label>
                    <Input value={newFlag.label} onChange={(e) => setNewFlag({ ...newFlag, label: e.target.value })} placeholder="Loyalty Points" />
                  </div>
                  <div><Label>Category</Label>
                    <Input value={newFlag.category} onChange={(e) => setNewFlag({ ...newFlag, category: e.target.value })} />
                  </div>
                  <div><Label>Description</Label>
                    <Textarea rows={2} value={newFlag.description} onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })} />
                  </div>
                </div>
                <DialogFooter><Button onClick={addNew}>Add</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={saveAll} disabled={saving || dirtyCount === 0}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving…" : dirtyCount ? `Save (${dirtyCount})` : "Save"}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
      ) : packages.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No subscription plans yet. Create one from the Packages page.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, feats]) => (
            <div key={cat} className="rounded-xl border bg-card">
              <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cat}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Feature</th>
                      {packages.map((p) => (
                        <th key={p.id} className="px-3 py-2 text-center font-medium">
                          <div className="whitespace-nowrap">{p.name}</div>
                          {p.is_trial && <div className="text-[10px] text-amber-600">Trial (all on)</div>}
                          {!p.is_active && <div className="text-[10px] text-muted-foreground">Inactive</div>}
                        </th>
                      ))}
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {feats.map((f) => (
                      <tr key={f.key} className="border-b last:border-b-0">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{f.label}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{f.key}</div>
                          {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                        </td>
                        {packages.map((p) => {
                          const orig = !!p.features[f.key];
                          const val = p.is_trial ? true : currentValue(p.id, f.key, orig);
                          const dirty = !p.is_trial && (edits[`${p.id}::${f.key}`] !== undefined);
                          return (
                            <td key={p.id} className="px-3 py-2 text-center">
                              <div className="inline-flex items-center">
                                <Switch
                                  checked={val}
                                  disabled={p.is_trial}
                                  onCheckedChange={() => toggle(p.id, f.key, orig)}
                                  className={dirty ? "ring-2 ring-primary/50" : ""}
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right">
                          <button
                            onClick={() => removeFeature(f.key)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Remove feature from registry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
