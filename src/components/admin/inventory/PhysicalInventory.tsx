import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Minus, Download, History } from "lucide-react";
import { inventoryPhysical, inventoryMovements } from "@/lib/inventory.functions";
import { adjustStock } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiStrip, Pill, ItemCard, Facts, EmptyBox, money, exportCsv, fmtDate } from "./kit";

const MOVEMENT_LABEL: Record<string, string> = {
  order: "Order confirmed",
  manual_in: "Purchase / restock",
  manual_out: "Manual out",
  return: "Return received",
  adjustment: "Admin correction",
};

const REASON_PRESETS = [
  "Purchase / restock",
  "Damage / lost",
  "Exchange completed",
  "Return received",
  "Admin correction",
];

export function PhysicalInventory({ search }: { search: string }) {
  const listFn = useServerFn(inventoryPhysical);
  const movesFn = useServerFn(inventoryMovements);
  const adj = useServerFn(adjustStock);
  const qc = useQueryClient();
  const [view, setView] = useState<"stock" | "movements">("stock");
  const [edit, setEdit] = useState<{ id: string; name: string; stock: number } | null>(null);

  const { data: items = [] } = useQuery({ queryKey: ["inv", "physical"], queryFn: () => listFn() });
  const { data: moves = [] } = useQuery({
    queryKey: ["inv", "movements"],
    queryFn: () => movesFn({ data: {} }),
    enabled: view === "movements",
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items as any[]).filter((p) => !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
  }, [items, search]);

  const kpis = useMemo(() => {
    const all = items as any[];
    const value = all.reduce((s, p) => s + Number(p.cost_price ?? 0) * Number(p.stock ?? 0), 0);
    const low = all.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= (p.low_stock_threshold ?? 5)).length;
    const out = all.filter((p) => (p.stock ?? 0) === 0).length;
    const units = all.reduce((s, p) => s + Number(p.stock ?? 0), 0);
    return [
      { label: "Products", value: all.length },
      { label: "Units in stock", value: units },
      { label: "Stock value", value: money(value) },
      { label: "Low stock", value: low, tone: low ? "text-amber-600 dark:text-amber-400" : "" },
      { label: "Out of stock", value: out, tone: out ? "text-destructive" : "" },
    ];
  }, [items]);

  return (
    <div className="space-y-4">
      <KpiStrip items={kpis} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5">
          {(["stock", "movements"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {v === "stock" ? "Current stock" : "Stock movements"}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() =>
            view === "stock"
              ? exportCsv(
                  "inventory-physical.csv",
                  (items as any[]).map((p) => ({
                    Product: p.name,
                    SKU: p.sku ?? "",
                    Stock: p.stock ?? 0,
                    Cost: p.cost_price ?? 0,
                    Price: p.price,
                    Profit: Number(p.price) - Number(p.cost_price ?? 0),
                  })),
                )
              : exportCsv(
                  "stock-movements.csv",
                  (moves as any[]).map((m) => ({
                    Date: m.created_at,
                    Product: m.product_name,
                    Order: m.invoice_no ?? "",
                    Type: MOVEMENT_LABEL[m.type] ?? m.type,
                    Change: m.delta,
                    Before: m.qty_before ?? "",
                    After: m.qty_after ?? "",
                    Reason: m.reason ?? "",
                    By: m.by,
                  })),
                )
          }
        >
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>

      {view === "stock" &&
        (rows.length === 0 ? (
          <EmptyBox>No physical products yet.</EmptyBox>
        ) : (
          <div className="space-y-2">
            {rows.map((p: any) => {
              const stock = Number(p.stock ?? 0);
              const low = stock > 0 && stock <= (p.low_stock_threshold ?? 5);
              const profit = Number(p.price) - Number(p.cost_price ?? 0);
              return (
                <ItemCard
                  key={p.id}
                  image={p.primary_image_url}
                  title={p.name}
                  subtitle={p.sku ? `SKU ${p.sku}` : undefined}
                  right={
                    stock === 0 ? <Pill tone="red">Out of stock</Pill> : low ? <Pill tone="amber">Low stock</Pill> : <Pill tone="green">In stock</Pill>
                  }
                >
                  <Facts
                    items={[
                      { label: "Stock", value: stock },
                      { label: "Cost", value: money(p.cost_price) },
                      { label: "Price", value: money(p.price) },
                      {
                        label: "Profit / unit",
                        value: <span className={profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{money(profit)}</span>,
                      },
                    ]}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEdit({ id: p.id, name: p.name, stock })}>
                      Adjust stock
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setView("movements")}>
                      <History className="mr-1 h-4 w-4" /> History
                    </Button>
                  </div>
                </ItemCard>
              );
            })}
          </div>
        ))}

      {view === "movements" &&
        ((moves as any[]).length === 0 ? (
          <EmptyBox>No stock movements yet.</EmptyBox>
        ) : (
          <div className="space-y-2">
            {(moves as any[]).map((m) => (
              <div key={m.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{m.product_name}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtDate(m.created_at)}</div>
                  </div>
                  <div className={`shrink-0 font-mono text-sm ${m.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </div>
                </div>
                <Facts
                  items={[
                    { label: "Type", value: MOVEMENT_LABEL[m.type] ?? m.type },
                    {
                      label: "Before → After",
                      value: m.qty_before == null ? "—" : `${m.qty_before} → ${m.qty_after}`,
                    },
                    { label: "Order", value: m.invoice_no ?? "—" },
                    { label: "Updated by", value: m.by },
                  ]}
                />
                {m.reason && <p className="mt-2 text-xs text-muted-foreground">{m.reason}</p>}
              </div>
            ))}
          </div>
        ))}

      {edit && (
        <AdjustDialog
          product={edit}
          onClose={() => setEdit(null)}
          onSave={async (delta, reason) => {
            try {
              await adj({ data: { productId: edit.id, delta, reason } });
              qc.invalidateQueries({ queryKey: ["inv"] });
              toast.success("Stock updated");
              setEdit(null);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function AdjustDialog({
  product,
  onClose,
  onSave,
}: {
  product: { id: string; name: string; stock: number };
  onClose: () => void;
  onSave: (delta: number, reason: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(1);
  const [sign, setSign] = useState<1 | -1>(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const next = Math.max(0, product.stock + sign * amount);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Adjust stock — {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {product.stock} → <b className="text-foreground">{next}</b>
          </p>
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
            <Label>Reason</Label>
            <div className="flex flex-wrap gap-1.5">
              {REASON_PRESETS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${reason === r ? "border-primary bg-primary/10" : "text-muted-foreground"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional note" />
          </div>
          <Button
            onClick={async () => {
              setSaving(true);
              await onSave(sign * amount, reason);
              setSaving(false);
            }}
            disabled={saving}
            className="w-full"
          >
            {saving ? "Saving…" : `Apply ${sign > 0 ? "+" : "-"}${amount}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
