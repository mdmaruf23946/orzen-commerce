import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { listCoupons, upsertCoupon, deleteCoupon } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  component: () => <FeatureGate feature="coupons"><CouponsPage /></FeatureGate>,
});

function CouponsPage() {
  const list = useServerFn(listCoupons);
  const save = useServerFn(upsertCoupon);
  const del = useServerFn(deleteCoupon);
  const qc = useQueryClient();
  const { data: coupons } = useQuery({ queryKey: ["coupons"], queryFn: () => list() });
  const [edit, setEdit] = useState<any>(null);
  const [open, setOpen] = useState(false);

  async function remove(id: string) {
    if (!confirm("Delete this coupon?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["coupons"] });
    toast.success("Deleted");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Coupons</h1>
        <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />New coupon</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Type</th>
              <th className="p-3 text-right">Value</th>
              <th className="p-3 text-right">Min order</th>
              <th className="p-3 text-right">Used / Limit</th>
              <th className="p-3">Expires</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(coupons ?? []).map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-mono font-medium">{c.code}</td>
                <td className="p-3 text-xs capitalize">{c.type.replace("_", " ")}</td>
                <td className="p-3 text-right">
                  {c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? `৳${c.value}` : "—"}
                </td>
                <td className="p-3 text-right">৳{Number(c.min_order).toFixed(0)}</td>
                <td className="p-3 text-right">{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                <td className="p-3 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</td>
                <td className="p-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${c.active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => { setEdit(c); setOpen(true); }} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(c.id)} className="ml-1 rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(coupons ?? []).length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No coupons yet.</div>}
      </div>

      {open && (
        <CouponDialog
          editing={edit}
          onClose={() => setOpen(false)}
          onSave={async (d) => {
            await save({ data: d });
            qc.invalidateQueries({ queryKey: ["coupons"] });
            toast.success("Saved");
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CouponDialog({ editing, onClose, onSave }: { editing: any; onClose: () => void; onSave: (d: any) => Promise<void> }) {
  const [code, setCode] = useState(editing?.code ?? "");
  const [type, setType] = useState<"percent" | "fixed" | "free_shipping">(editing?.type ?? "percent");
  const [value, setValue] = useState<number>(editing?.value ?? 10);
  const [minOrder, setMinOrder] = useState<number>(editing?.min_order ?? 0);
  const [usageLimit, setUsageLimit] = useState<string>(editing?.usage_limit ? String(editing.usage_limit) : "");
  const [expires, setExpires] = useState<string>(editing?.expires_at ? editing.expires_at.slice(0, 10) : "");
  const [active, setActive] = useState<boolean>(editing?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        code: code.trim(),
        type,
        value: type === "free_shipping" ? 0 : Number(value),
        min_order: Number(minOrder),
        usage_limit: usageLimit ? Number(usageLimit) : null,
        expires_at: expires || null,
        active,
      });
    } catch (err) { toast.error((err as Error).message); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required placeholder="WELCOME10" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="flex h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="percent">Percentage discount</option>
              <option value="fixed">Fixed amount discount</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </div>
          {type !== "free_shipping" && (
            <div className="space-y-1.5">
              <Label>{type === "percent" ? "Percent (%)" : "Amount (৳)"}</Label>
              <Input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min order (৳)</Label>
              <Input type="number" min={0} value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Usage limit</Label>
              <Input type="number" min={0} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Unlimited" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Expiry date</Label>
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Save coupon"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
