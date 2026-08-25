import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Package, Clock, FileSpreadsheet } from "lucide-react";
import { getImportExportHistory } from "@/lib/business.functions";
import { ImportDialog } from "@/components/admin/import-export/ImportDialog";
import { ExportDialog } from "@/components/admin/import-export/ExportDialog";

export const Route = createFileRoute("/_authenticated/admin/import-export")({
  head: () => ({
    meta: [
      { title: "Import & Export Products — ORZEN Merchant Panel" },
      { name: "description", content: "Bulk import and export your product catalog via CSV, Excel, or Google Sheets." },
      { property: "og:title", content: "Import & Export Products — ORZEN Merchant Panel" },
      { property: "og:description", content: "Bulk import and export your product catalog via CSV, Excel, or Google Sheets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeatureGate feature="import_export">
      <ImportExportPage />
    </FeatureGate>
  ),
});

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

function ImportExportPage() {
  const historyFn = useServerFn(getImportExportHistory);
  const { data, refetch } = useQuery({
    queryKey: ["import-export-history"],
    queryFn: () => historyFn(),
  });
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const history = data?.history ?? [];
  const totalProducts = data?.totalProducts ?? 0;
  const lastImport = history.find((h: any) => h.kind === "import");
  const lastExport = history.find((h: any) => h.kind === "export");

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Import & Export Products</h1>
        <p className="text-sm text-muted-foreground">Bulk update your catalog with CSV, Excel, or Google Sheets.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={<Package className="w-4 h-4" />} label="Total Products" value={String(totalProducts)} />
        <StatCard
          icon={<Upload className="w-4 h-4" />}
          label="Last Import"
          value={lastImport ? `${lastImport.imported + lastImport.updated} rows` : "—"}
          sub={lastImport ? timeAgo(lastImport.created_at) : "No imports yet"}
        />
        <StatCard
          icon={<Download className="w-4 h-4" />}
          label="Last Export"
          value={lastExport ? `${lastExport.total} rows` : "—"}
          sub={lastExport ? timeAgo(lastExport.created_at) : "No exports yet"}
        />
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard
          icon={<Upload className="w-6 h-6" />}
          title="Import Products"
          desc="Upload CSV, Excel, or link a Google Sheet. Preview and validate before saving."
          cta="Start Import"
          onClick={() => setImportOpen(true)}
        />
        <ActionCard
          icon={<Download className="w-6 h-6" />}
          title="Export Products"
          desc="Filter by category, brand, stock, date, then download as CSV or Excel."
          cta="Start Export"
          onClick={() => setExportOpen(true)}
          variant="secondary"
        />
      </div>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" />Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No activity yet.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">File</th>
                      <th className="py-2 pr-3">Format</th>
                      <th className="py-2 pr-3">Total</th>
                      <th className="py-2 pr-3">Imported</th>
                      <th className="py-2 pr-3">Updated</th>
                      <th className="py-2 pr-3">Skipped</th>
                      <th className="py-2 pr-3">Failed</th>
                      <th className="py-2 pr-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h: any) => (
                      <tr key={h.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <Badge variant={h.kind === "import" ? "default" : "secondary"}>{h.kind}</Badge>
                        </td>
                        <td className="py-2 pr-3 max-w-[200px] truncate">{h.file_name ?? "—"}</td>
                        <td className="py-2 pr-3">{h.format ?? "—"}</td>
                        <td className="py-2 pr-3">{h.total}</td>
                        <td className="py-2 pr-3 text-green-600">{h.imported || "—"}</td>
                        <td className="py-2 pr-3 text-blue-600">{h.updated || "—"}</td>
                        <td className="py-2 pr-3 text-amber-600">{h.skipped || "—"}</td>
                        <td className="py-2 pr-3 text-red-600">{h.failed || "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{timeAgo(h.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile card list */}
              <div className="md:hidden space-y-2">
                {history.map((h: any) => (
                  <div key={h.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={h.kind === "import" ? "default" : "secondary"}>{h.kind}</Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(h.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate text-xs">{h.file_name ?? "—"}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      <MiniStat label="Total" v={h.total} />
                      <MiniStat label="OK" v={h.imported + h.updated} tone="green" />
                      <MiniStat label="Skip" v={h.skipped} tone="amber" />
                      <MiniStat label="Fail" v={h.failed} tone="red" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onDone={() => refetch()} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} onDone={() => refetch()} />
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-xl sm:text-2xl font-bold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ActionCard({ icon, title, desc, cta, onClick, variant }: { icon: React.ReactNode; title: string; desc: string; cta: string; onClick: () => void; variant?: "default" | "secondary" }) {
  return (
    <Card className="group hover:shadow-md transition">
      <CardContent className="p-5 sm:p-6 flex flex-col h-full">
        <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">{icon}</div>
        <div className="text-base font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground mt-1 flex-1">{desc}</div>
        <Button size="lg" variant={variant} className="mt-4 w-full sm:w-auto self-start" onClick={onClick}>{cta}</Button>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, v, tone }: { label: string; v: number; tone?: "green" | "amber" | "red" }) {
  const cls = tone === "green" ? "text-green-600" : tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="text-center border rounded p-1">
      <div className={`font-semibold ${cls}`}>{v || 0}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
