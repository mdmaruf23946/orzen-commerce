import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { inventoryDigital, updateDigitalDownloadLimit, digitalDownloadLog } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KpiStrip, Pill, ItemCard, Facts, EmptyBox, money, exportCsv, fmtBytes, fmtDate } from "./kit";
import { LICENSE_LABELS, type LicenseType } from "@/lib/digital";

export function DigitalInventory({ search }: { search: string }) {
  const listFn = useServerFn(inventoryDigital);
  const limitFn = useServerFn(updateDigitalDownloadLimit);
  const logFn = useServerFn(digitalDownloadLog);
  const qc = useQueryClient();
  const [limitFor, setLimitFor] = useState<any | null>(null);
  const [logFor, setLogFor] = useState<any | null>(null);

  const { data: items = [] } = useQuery({ queryKey: ["inv", "digital"], queryFn: () => listFn() });
  const { data: log = [] } = useQuery({
    queryKey: ["inv", "digital", "log", logFor?.id],
    queryFn: () => logFn({ data: { productId: logFor.id } }),
    enabled: !!logFor,
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items as any[]).filter((p) => !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
  }, [items, search]);

  const kpis = useMemo(() => {
    const all = items as any[];
    return [
      { label: "Products", value: all.length },
      { label: "Total sales", value: all.reduce((s, p) => s + p.sales, 0) },
      { label: "Total downloads", value: all.reduce((s, p) => s + p.downloads, 0) },
      { label: "Active licenses", value: all.reduce((s, p) => s + p.activeEntitlements, 0) },
    ];
  }, [items]);

  return (
    <div className="space-y-4">
      <KpiStrip items={kpis} />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportCsv(
              "inventory-digital.csv",
              (items as any[]).map((p) => ({
                Product: p.name,
                Sales: p.sales,
                Downloads: p.downloads,
                Remaining: p.unlimited ? "Unlimited" : p.remaining,
                License: p.licenseType ?? "",
                Version: p.version ?? "",
                Files: p.fileCount,
                Delivery: p.delivery,
              })),
            )
          }
        >
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyBox>No digital products yet.</EmptyBox>
      ) : (
        <div className="space-y-2">
          {rows.map((p: any) => (
            <ItemCard
              key={p.id}
              image={p.image}
              title={p.name}
              subtitle={p.sku ? `SKU ${p.sku}` : undefined}
              right={p.delivery === "instant" ? <Pill tone="green">Instant delivery</Pill> : <Pill tone="amber">Manual delivery</Pill>}
            >
              <Facts
                items={[
                  { label: "Sales", value: p.sales },
                  { label: "Downloads", value: p.downloads },
                  { label: "Remaining", value: p.unlimited ? "Unlimited" : (p.remaining ?? 0) },
                  { label: "License", value: p.licenseType ? LICENSE_LABELS[p.licenseType as LicenseType] : "—" },
                  { label: "Version", value: p.version ?? "—" },
                  { label: "Files", value: `${p.fileCount} · ${fmtBytes(p.fileSize)}` },
                  { label: "Price", value: money(p.price) },
                  { label: "Last download", value: fmtDate(p.lastDownload) },
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={`/admin/products?edit=${p.id}`}>Update file</a>
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLimitFor(p)}>
                  Change download limit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLogFor(p)}>
                  Download history
                </Button>
              </div>
            </ItemCard>
          ))}
        </div>
      )}

      {limitFor && (
        <LimitDialog
          product={limitFor}
          onClose={() => setLimitFor(null)}
          onSave={async (value) => {
            try {
              await limitFn({ data: { productId: limitFor.id, maxDownloads: value } });
              qc.invalidateQueries({ queryKey: ["inv", "digital"] });
              toast.success("Download limit updated");
              setLimitFor(null);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}

      {logFor && (
        <Dialog open onOpenChange={(o) => !o && setLogFor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">Download history — {logFor.name}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {(log as any[]).length === 0 && <p className="text-sm text-muted-foreground">No downloads yet.</p>}
              {(log as any[]).map((d) => (
                <div key={d.id} className="rounded-lg border p-2.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{d.who}</span>
                    <span className="text-muted-foreground">{fmtDate(d.created_at)}</span>
                  </div>
                  <div className="mt-1 truncate text-muted-foreground">{d.file}</div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function LimitDialog({ product, onClose, onSave }: { product: any; onClose: () => void; onSave: (v: number | null) => Promise<void> }) {
  const [unlimited, setUnlimited] = useState(product.maxDownloads == null);
  const [value, setValue] = useState<number>(product.maxDownloads ?? 5);
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Download limit — {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={unlimited ? "default" : "outline"} className="flex-1" onClick={() => setUnlimited(true)}>
              Unlimited
            </Button>
            <Button variant={!unlimited ? "default" : "outline"} className="flex-1" onClick={() => setUnlimited(false)}>
              Limited
            </Button>
          </div>
          {!unlimited && (
            <div className="space-y-1.5">
              <Label>Max downloads per order</Label>
              <Input type="number" min={1} value={value} onChange={(e) => setValue(Math.max(1, Number(e.target.value)))} />
            </div>
          )}
          <Button
            className="w-full"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(unlimited ? null : value);
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
