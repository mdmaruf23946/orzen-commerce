import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { bulkImportProducts, exportProductsCsv } from "@/lib/business.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/import-export")({
  component: ImportExportPage,
});

// Minimal CSV parser supporting quoted fields and escaped quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") {/* skip */}
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function ImportExportPage() {
  const importFn = useServerFn(bulkImportProducts);
  const exportFn = useServerFn(exportProductsCsv);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result ?? ""));
      if (rows.length < 2) { toast.error("CSV must have a header and at least one row"); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const errs: string[] = [];
      const out = rows.slice(1).map((r, idx) => {
        const obj: any = {};
        header.forEach((h, i) => (obj[h] = r[i]?.trim() ?? ""));
        if (!obj.name) errs.push(`Row ${idx + 2}: missing name`);
        if (isNaN(Number(obj.price))) errs.push(`Row ${idx + 2}: invalid price`);
        return {
          name: obj.name,
          price: Number(obj.price || 0),
          old_price: obj.old_price ? Number(obj.old_price) : null,
          cost_price: obj.cost_price ? Number(obj.cost_price) : 0,
          stock: obj.stock ? Number(obj.stock) : 0,
          sku: obj.sku || null,
          status: (obj.status || "active") as "active" | "draft" | "out_of_stock",
          description: obj.description || null,
        };
      });
      setPreview(out); setErrors(errs);
    };
    reader.readAsText(f);
  }

  async function commit() {
    if (errors.length) { toast.error("Fix validation errors first"); return; }
    setLoading(true);
    try {
      const res = await importFn({ data: { rows: preview } });
      toast.success(`Imported ${res.count} products`);
      setPreview([]);
    } catch (err) { toast.error((err as Error).message); }
    finally { setLoading(false); }
  }

  async function download() {
    const csv = await exportFn();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `products-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Import / Export Products</h1>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Upload className="h-4 w-4" /> Import CSV</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Required header: <code>name,price</code>. Optional: <code>sku,old_price,cost_price,stock,status,description</code>.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="mt-3 block w-full text-sm" />
        {errors.length > 0 && (
          <ul className="mt-3 list-disc rounded-md bg-destructive/10 p-3 pl-6 text-xs text-destructive">
            {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        {preview.length > 0 && (
          <>
            <div className="mt-3 overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-left">
                  <tr><th className="p-2">Name</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Stock</th><th className="p-2">Status</th></tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-right">৳{p.price}</td>
                      <td className="p-2 text-right">{p.stock}</td>
                      <td className="p-2">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{preview.length} rows ready · showing first 20</p>
            <Button onClick={commit} disabled={loading || errors.length > 0} className="mt-3">
              {loading ? "Importing…" : `Import ${preview.length} products`}
            </Button>
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" /> Export CSV</div>
        <p className="mt-1 text-xs text-muted-foreground">Downloads all products with pricing and stock data.</p>
        <Button onClick={download} variant="outline" className="mt-3">Download CSV</Button>
      </div>
    </div>
  );
}
