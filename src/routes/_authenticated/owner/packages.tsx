import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { listPackages, upsertPackage, deletePackage } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/packages")({
  component: PackagesPage,
});

type Pkg = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  product_limit: number;
  is_active: boolean;
};

function PackagesPage() {
  const list = useServerFn(listPackages);
  const save = useServerFn(upsertPackage);
  const del = useServerFn(deletePackage);
  const qc = useQueryClient();
  const { data: packages } = useQuery({ queryKey: ["owner", "packages"], queryFn: () => list() });
  const [editing, setEditing] = useState<Pkg | null>(null);
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
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> New package
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(packages ?? []).map((p: any) => (
          <div key={p.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  ৳{Number(p.price).toFixed(0)} / {p.duration_days} days
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                  className="rounded p-2 hover:bg-muted"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(p.id)} className="rounded p-2 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Up to {p.product_limit} products · {p.is_active ? "Active" : "Inactive"}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <PackageDialog
          editing={editing}
          onClose={() => setOpen(false)}
          onSave={async (data) => {
            try {
              await save({ data });
              qc.invalidateQueries({ queryKey: ["owner", "packages"] });
              toast.success("Saved");
              setOpen(false);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function PackageDialog({
  editing,
  onClose,
  onSave,
}: {
  editing: Pkg | null;
  onClose: () => void;
  onSave: (d: any) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [price, setPrice] = useState(editing?.price ?? 0);
  const [days, setDays] = useState(editing?.duration_days ?? 30);
  const [limit, setLimit] = useState(editing?.product_limit ?? 50);
  const [active, setActive] = useState(editing?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      id: editing?.id,
      name,
      price: Number(price),
      duration_days: Number(days),
      product_limit: Number(limit),
      is_active: active,
    });
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="n">Name</Label>
            <Input id="n" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p">Price</Label>
              <Input id="p" type="number" min={0} required value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d">Duration (days)</Label>
              <Input id="d" type="number" min={1} required value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l">Product limit</Label>
            <Input id="l" type="number" min={1} required value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
