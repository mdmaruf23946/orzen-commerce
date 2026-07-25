import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2 } from "lucide-react";
import { exportProductsFiltered, listExportFacets } from "@/lib/business.functions";
import { EXPORT_COLUMNS, writeCsv, writeXlsx } from "./io";
import { DEFAULT_EXPORT_COLUMNS } from "./schema";

export function ExportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const exportFn = useServerFn(exportProductsFiltered);
  const facetsFn = useServerFn(listExportFacets);

  const [facets, setFacets] = useState<{ categories: any[]; brands: string[] }>({ categories: [], brands: [] });
  const [cols, setCols] = useState<string[]>(DEFAULT_EXPORT_COLUMNS);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [stockStatus, setStockStatus] = useState<"all" | "in_stock" | "out_of_stock" | "low_stock">("all");
  const [status, setStatus] = useState<"all" | "active" | "draft" | "out_of_stock">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => { if (open) facetsFn().then(setFacets).catch(() => {}); }, [open, facetsFn]);

  function toggle<T>(arr: T[], v: T, set: (a: T[]) => void) {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  async function run() {
    if (!cols.length) return toast.error("Pick at least one column");
    setRunning(true);
    try {
      const res = await exportFn({
        data: {
          columns: cols,
          filters: {
            categoryIds: categoryIds.length ? categoryIds : undefined,
            brands: brands.length ? brands : undefined,
            stockStatus, status,
            from: from || undefined, to: to || undefined,
          },
          format,
          fileName: `products-${new Date().toISOString().slice(0, 10)}`,
        },
      });
      if (!res.rows.length) { toast.error("No products match your filters"); return; }
      const name = `products-${new Date().toISOString().slice(0, 10)}`;
      if (format === "xlsx") writeXlsx(res.header, res.rows, name);
      else writeCsv(res.header, res.rows, name);
      toast.success(`Exported ${res.rows.length} products`);
      onDone();
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message ?? "Export failed"); }
    finally { setRunning(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b">
          <DialogTitle className="text-lg sm:text-xl">Export Products</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="out_of_stock">Out of stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Stock</Label>
                <Select value={stockStatus} onValueChange={(v: any) => setStockStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="in_stock">In stock</SelectItem>
                    <SelectItem value="low_stock">Low stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Created from</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm">Created to</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div>
                <Label className="text-sm">Format</Label>
                <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {facets.categories.length > 0 && (
              <div>
                <Label className="text-sm mb-2 block">Categories</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                  {facets.categories.map((c: any) => (
                    <label key={c.id} className={`text-xs px-2 py-1 rounded border cursor-pointer ${categoryIds.includes(c.id) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                      <input type="checkbox" hidden checked={categoryIds.includes(c.id)} onChange={() => toggle(categoryIds, c.id, setCategoryIds)} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {facets.brands.length > 0 && (
              <div>
                <Label className="text-sm mb-2 block">Brands</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                  {facets.brands.map((b) => (
                    <label key={b} className={`text-xs px-2 py-1 rounded border cursor-pointer ${brands.includes(b) ? "bg-primary text-primary-foreground border-primary" : ""}`}>
                      <input type="checkbox" hidden checked={brands.includes(b)} onChange={() => toggle(brands, b, setBrands)} />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Columns to export</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setCols(EXPORT_COLUMNS.map((c) => c.key))}>All</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCols(DEFAULT_EXPORT_COLUMNS)}>Reset</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border rounded-lg p-3">
                {EXPORT_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-xs">
                    <Checkbox checked={cols.includes(c.key)} onCheckedChange={() => toggle(cols, c.key, setCols)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            {running && <Progress value={80} className="animate-pulse" />}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 sm:p-6 pt-3 border-t flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Cancel</Button>
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
