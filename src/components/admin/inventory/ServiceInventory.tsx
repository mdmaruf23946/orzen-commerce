import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Pause, Play } from "lucide-react";
import { inventoryService, updateServiceCapacity, setServiceBookingStatus } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiStrip, Pill, ItemCard, Facts, EmptyBox, money, exportCsv } from "./kit";

export function ServiceInventory({ search }: { search: string }) {
  const listFn = useServerFn(inventoryService);
  const capFn = useServerFn(updateServiceCapacity);
  const pauseFn = useServerFn(setServiceBookingStatus);
  const qc = useQueryClient();
  const [capFor, setCapFor] = useState<any | null>(null);

  const { data: items = [] } = useQuery({ queryKey: ["inv", "service"], queryFn: () => listFn() });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items as any[]).filter((p) => !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
  }, [items, search]);

  const kpis = useMemo(() => {
    const all = items as any[];
    const avg = all.filter((p) => p.avgCompletionHours != null);
    return [
      { label: "Services", value: all.length },
      { label: "Active orders", value: all.reduce((s, p) => s + p.active, 0) },
      { label: "Pending orders", value: all.reduce((s, p) => s + p.pending, 0) },
      { label: "Completed", value: all.reduce((s, p) => s + p.completed, 0) },
      {
        label: "Avg completion",
        value: avg.length ? `${Math.round(avg.reduce((s, p) => s + p.avgCompletionHours, 0) / avg.length)}h` : "—",
      },
    ];
  }, [items]);

  async function togglePause(p: any) {
    try {
      await pauseFn({ data: { productId: p.id, paused: !p.paused } });
      qc.invalidateQueries({ queryKey: ["inv", "service"] });
      toast.success(p.paused ? "Booking resumed" : "Booking paused");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <KpiStrip items={kpis} />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportCsv(
              "inventory-service.csv",
              (items as any[]).map((p) => ({
                Service: p.name,
                Active: p.active,
                Pending: p.pending,
                Completed: p.completed,
                "Capacity/day": p.capacityPerDay ?? "Unlimited",
                "Booked today": p.bookedToday,
                Booking: p.paused ? "Paused" : "Open",
              })),
            )
          }
        >
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyBox>No service products yet.</EmptyBox>
      ) : (
        <div className="space-y-2">
          {rows.map((p: any) => (
            <ItemCard
              key={p.id}
              image={p.image}
              title={p.name}
              subtitle={p.sku ? `SKU ${p.sku}` : undefined}
              right={p.paused ? <Pill tone="gray">Booking paused</Pill> : <Pill tone="green">Accepting bookings</Pill>}
            >
              <Facts
                items={[
                  { label: "Active orders", value: p.active },
                  { label: "Pending", value: p.pending },
                  { label: "Completed", value: p.completed },
                  { label: "Cancelled", value: p.cancelled },
                  { label: "Capacity / day", value: p.capacityPerDay ?? "Unlimited" },
                  { label: "Capacity / week", value: p.capacityPerWeek ?? "Unlimited" },
                  { label: "Available today", value: p.availableToday ?? "Unlimited" },
                  { label: "Avg completion", value: p.avgCompletionHours != null ? `${p.avgCompletionHours}h` : "—" },
                  { label: "Price", value: money(p.price) },
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setCapFor(p)}>
                  Update capacity
                </Button>
                <Button size="sm" variant={p.paused ? "default" : "outline"} onClick={() => togglePause(p)}>
                  {p.paused ? (
                    <>
                      <Play className="mr-1 h-4 w-4" /> Resume booking
                    </>
                  ) : (
                    <>
                      <Pause className="mr-1 h-4 w-4" /> Pause booking
                    </>
                  )}
                </Button>
              </div>
            </ItemCard>
          ))}
        </div>
      )}

      {capFor && (
        <CapacityDialog
          product={capFor}
          onClose={() => setCapFor(null)}
          onSave={async (perDay, perWeek) => {
            try {
              await capFn({ data: { productId: capFor.id, capacityPerDay: perDay, capacityPerWeek: perWeek } });
              qc.invalidateQueries({ queryKey: ["inv", "service"] });
              toast.success("Capacity updated");
              setCapFor(null);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function CapacityDialog({
  product,
  onClose,
  onSave,
}: {
  product: any;
  onClose: () => void;
  onSave: (perDay: number | null, perWeek: number | null) => Promise<void>;
}) {
  const [day, setDay] = useState<string>(product.capacityPerDay?.toString() ?? "");
  const [week, setWeek] = useState<string>(product.capacityPerWeek?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Capacity — {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Orders per day (blank = unlimited)</Label>
            <Input type="number" min={0} value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Orders per week (blank = unlimited)</Label>
            <Input type="number" min={0} value={week} onChange={(e) => setWeek(e.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(day === "" ? null : Number(day), week === "" ? null : Number(week));
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save capacity"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
