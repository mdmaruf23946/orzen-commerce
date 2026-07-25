import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getMyStore,
  updateDelivery,
  listDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  setDefaultDeliveryZone,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, MapPin, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  head: () => ({ meta: [{ title: "Delivery Zones" }] }),
  component: DeliveryPage,
});

type Zone = {
  id: string;
  name: string;
  charge: number;
  eta: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  courier_code: string | null;
};

function DeliveryPage() {
  const qc = useQueryClient();
  const fetchStore = useServerFn(getMyStore);
  const saveDelivery = useServerFn(updateDelivery);
  const listZones = useServerFn(listDeliveryZones);
  const createZone = useServerFn(createDeliveryZone);
  const updateZone = useServerFn(updateDeliveryZone);
  const deleteZone = useServerFn(deleteDeliveryZone);
  const setDefault = useServerFn(setDefaultDeliveryZone);

  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["admin", "delivery-zones"],
    queryFn: () => listZones() as Promise<Zone[]>,
  });

  const [freeMin, setFreeMin] = useState(0);
  const [cod, setCod] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const d = (store as any)?.delivery ?? {};
    setFreeMin(Number(d.free_min ?? 0));
    setCod(d.cod_enabled !== false);
  }, [store]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [form, setForm] = useState({
    name: "",
    charge: 0,
    eta: "",
    is_active: true,
    is_default: false,
  });

  function openNew() {
    setEditing(null);
    setForm({
      name: "",
      charge: 0,
      eta: "",
      is_active: true,
      is_default: zones.length === 0,
    });
    setDialogOpen(true);
  }

  function openEdit(z: Zone) {
    setEditing(z);
    setForm({
      name: z.name,
      charge: Number(z.charge),
      eta: z.eta ?? "",
      is_active: z.is_active,
      is_default: z.is_default,
    });
    setDialogOpen(true);
  }

  const saveZone = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        charge: Number(form.charge) || 0,
        eta: form.eta.trim() || null,
        is_active: form.is_active,
        is_default: form.is_default,
      };
      if (editing) await updateZone({ data: { id: editing.id, ...payload } });
      else await createZone({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Zone updated" : "Zone added");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin", "delivery-zones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeZone = useMutation({
    mutationFn: (id: string) => deleteZone({ data: { id } }),
    onSuccess: () => {
      toast.success("Zone deleted");
      qc.invalidateQueries({ queryKey: ["admin", "delivery-zones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (z: Zone) => updateZone({ data: { id: z.id, is_active: !z.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "delivery-zones"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const makeDefault = useMutation({
    mutationFn: (id: string) => setDefault({ data: { id } }),
    onSuccess: () => {
      toast.success("Default zone updated");
      qc.invalidateQueries({ queryKey: ["admin", "delivery-zones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function saveGeneralSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await saveDelivery({ data: { free_min: freeMin, cod_enabled: cod } });
      qc.invalidateQueries({ queryKey: ["admin", "store"] });
      toast.success("Settings saved");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Delivery Zones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create delivery zones with custom charges and estimated delivery times. Customers pick a
          zone at checkout and the correct charge is applied automatically.
        </p>
      </div>

      {/* General settings */}
      <form onSubmit={saveGeneralSettings} className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">General settings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Free Delivery Minimum (৳, 0 = disabled)</Label>
            <Input
              type="number"
              min={0}
              value={freeMin}
              onChange={(e) => setFreeMin(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end justify-between rounded-md border p-3">
            <Label>Cash on Delivery</Label>
            <Switch checked={cod} onCheckedChange={setCod} />
          </div>
        </div>
        <Button type="submit" disabled={savingSettings} size="sm">
          {savingSettings ? "Saving…" : "Save settings"}
        </Button>
      </form>

      {/* Zones */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-sm font-semibold">Delivery zones</h2>
            <p className="text-xs text-muted-foreground">
              {zones.length} zone{zones.length === 1 ? "" : "s"} configured
            </p>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Add zone
          </Button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : zones.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/50" />
            <div className="text-sm font-medium">No delivery zones yet</div>
            <p className="max-w-sm text-xs text-muted-foreground">
              Add your first zone (e.g. "Dhaka City – ৳70") to start collecting shipping charges at
              checkout.
            </p>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Add your first zone
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Zone</th>
                    <th className="px-4 py-2 font-medium">Charge</th>
                    <th className="px-4 py-2 font-medium">ETA</th>
                    <th className="px-4 py-2 font-medium">Default</th>
                    <th className="px-4 py-2 font-medium">Active</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{z.name}</td>
                      <td className="px-4 py-3">৳{Number(z.charge).toFixed(0)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{z.eta || "—"}</td>
                      <td className="px-4 py-3">
                        {z.is_default ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Star className="h-3 w-3" /> Default
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => makeDefault.mutate(z.id)}
                          >
                            Set default
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={z.is_active}
                          onCheckedChange={() => toggleActive.mutate(z)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(z)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete zone "${z.name}"?`)) removeZone.mutate(z.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y sm:hidden">
              {zones.map((z) => (
                <div key={z.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{z.name}</div>
                        {z.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <Star className="h-2.5 w-2.5" /> Default
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        ৳{Number(z.charge).toFixed(0)} · {z.eta || "No ETA"}
                      </div>
                    </div>
                    <Switch
                      checked={z.is_active}
                      onCheckedChange={() => toggleActive.mutate(z)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!z.is_default && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => makeDefault.mutate(z.id)}
                      >
                        <Star className="mr-1 h-3 w-3" /> Set default
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => openEdit(z)}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive"
                      onClick={() => {
                        if (confirm(`Delete zone "${z.name}"?`)) removeZone.mutate(z.id);
                      }}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit zone" : "Add delivery zone"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Zone name</Label>
              <Input
                placeholder="e.g. Dhaka City"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Delivery charge (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.charge}
                  onChange={(e) => setForm((f) => ({ ...f, charge: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estimated time</Label>
                <Input
                  placeholder="e.g. 1-2 Days"
                  value={form.eta}
                  onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Shown to customers at checkout</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Set as default</Label>
                <p className="text-xs text-muted-foreground">Pre-selected at checkout</p>
              </div>
              <Switch
                checked={form.is_default}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_default: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveZone.mutate()}
              disabled={saveZone.isPending || !form.name.trim()}
            >
              {saveZone.isPending ? "Saving…" : editing ? "Save changes" : "Add zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
