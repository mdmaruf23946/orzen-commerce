import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";
import { listInventory, listStockMovements, adjustStock } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  component: () => <FeatureGate feature="inventory"><InventoryPage /></FeatureGate>,
});

function InventoryPage() {
  const inv = useServerFn(listInventory);
  const mv = useServerFn(listStockMovements);
  const adj = useServerFn(adjustStock);
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["inventory"], queryFn: () => inv() });
  const { data: moves } = useQuery({ queryKey: ["stock-movements"], queryFn: () => mv({ data: {} }) });
  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const [edit, setEdit] = useState<{ id: string; name: string; stock: number } | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inventory</h1>
      <div className="flex gap-2 border-b">
        {(["stock", "movements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-primary font-medium" : "text-muted-foreground"}`}
          >
            {t === "stock" ? "Current Stock" : "Stock Movements"}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-right">Profit/unit</th>
                <th className="p-3 text-right">Stock</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((p: any) => {
                const profit = Number(p.price) - Number(p.cost_price ?? 0);
                const low = (p.stock ?? 0) <= (p.low_stock_threshold ?? 5);
                const out = (p.stock ?? 0) === 0;
                return (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      {p.sku && <div className="text-xs text-muted-foreground">SKU {p.sku}</div>}
                    </td>
                    <td className="p-3 text-right">৳{Number(p.cost_price ?? 0).toFixed(0)}</td>
                    <td className="p-3 text-right">৳{Number(p.price).toFixed(0)}</td>
                    <td className={`p-3 text-right ${profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>৳{profit.toFixed(0)}</td>
                    <td className="p-3 text-right font-mono">{p.stock}</td>
                    <td className="p-3">
                      {out ? (
                        <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Out of stock</span>
                      ) : low ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Low stock</span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">In stock</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, name: p.name, stock: p.stock })}>
                        Adjust
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(items ?? []).length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">No products.</div>
          )}
        </div>
      )}

      {tab === "movements" && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Product</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Change</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(moves ?? []).map((m: any) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</td>
                  <td className="p-3">{m.products?.name ?? "—"}</td>
                  <td className="p-3 text-xs capitalize">{m.type.replace("_", " ")}</td>
                  <td className={`p-3 text-right font-mono ${m.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{m.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(moves ?? []).length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">No movements yet.</div>
          )}
        </div>
      )}

      {edit && (
        <AdjustDialog
          product={edit}
          onClose={() => setEdit(null)}
          onSave={async (delta, reason) => {
            try {
              await adj({ data: { productId: edit.id, delta, reason } });
              qc.invalidateQueries({ queryKey: ["inventory"] });
              qc.invalidateQueries({ queryKey: ["stock-movements"] });
              toast.success("Stock updated");
              setEdit(null);
            } catch (err) { toast.error((err as Error).message); }
          }}
        />
      )}
    </div>
  );
}

function AdjustDialog({
  product, onClose, onSave,
}: { product: { id: string; name: string; stock: number }; onClose: () => void; onSave: (delta: number, reason: string) => Promise<void> }) {
  const [amount, setAmount] = useState(1);
  const [sign, setSign] = useState<1 | -1>(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function go() {
    setSaving(true);
    await onSave(sign * amount, reason);
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock — {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Current stock: <b>{product.stock}</b></p>
          <div className="flex gap-2">
            <Button type="button" variant={sign === 1 ? "default" : "outline"} onClick={() => setSign(1)} className="flex-1">
              <Plus className="h-4 w-4" /> Increase
            </Button>
            <Button type="button" variant={sign === -1 ? "default" : "outline"} onClick={() => setSign(-1)} className="flex-1">
              <Minus className="h-4 w-4" /> Decrease
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged, received from supplier" />
          </div>
          <Button onClick={go} disabled={saving} className="w-full">
            {saving ? "Saving…" : `Apply ${sign > 0 ? "+" : "-"}${amount}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
