import { useState, useMemo, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, XCircle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { bulkImportProducts, fetchGoogleSheetCsv } from "@/lib/business.functions";
import {
  readFileAsRows, csvTextToObjects, validateRows, downloadSampleCsv, downloadSampleXlsx,
  writeErrorReport, type ValidatedRow,
} from "./io";
import { IMPORT_COLUMNS } from "./schema";

type Mode = "add" | "update" | "upsert";
type MatchKey = "sku" | "product_code";
type Step = "source" | "mode" | "preview" | "import" | "done";

const CHUNK = 100;

export function ImportDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const importFn = useServerFn(bulkImportProducts);
  const fetchSheet = useServerFn(fetchGoogleSheetCsv);

  const [step, setStep] = useState<Step>("source");
  const [file, setFile] = useState<File | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [raw, setRaw] = useState<Record<string, any>[]>([]);
  const [validated, setValidated] = useState<ValidatedRow[]>([]);
  const [mode, setMode] = useState<Mode>("add");
  const [matchKey, setMatchKey] = useState<MatchKey>("sku");
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; failed: number; errors: { index: number; reason: string; raw: Record<string, any> }[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const ok = validated.filter((v) => v.status === "ok").length;
    const err = validated.length - ok;
    return { total: validated.length, ok, err };
  }, [validated]);

  function reset() {
    setStep("source"); setFile(null); setSheetUrl(""); setRaw([]); setValidated([]);
    setMode("add"); setMatchKey("sku"); setSkipInvalid(true); setProgress(0); setRunning(false); setResult(null);
  }
  function close() { onOpenChange(false); setTimeout(reset, 200); }

  async function handleFile(f: File) {
    setFile(f);
    try {
      const rows = await readFileAsRows(f);
      if (!rows.length) { toast.error("File is empty"); return; }
      setRaw(rows);
      setValidated(validateRows(rows));
      toast.success(`Parsed ${rows.length} rows`);
    } catch (e: any) { toast.error(e.message ?? "Failed to read file"); }
  }

  async function loadSheet() {
    if (!sheetUrl.trim()) { toast.error("Paste a Google Sheets URL"); return; }
    try {
      const { csv } = await fetchSheet({ data: { url: sheetUrl.trim() } });
      const rows = csvTextToObjects(csv);
      if (!rows.length) { toast.error("Sheet is empty"); return; }
      setRaw(rows);
      setValidated(validateRows(rows));
      setFile(new File([csv], "google-sheet.csv"));
      toast.success(`Loaded ${rows.length} rows`);
    } catch (e: any) { toast.error(e.message ?? "Failed to load sheet"); }
  }

  async function runImport() {
    setRunning(true); setStep("import"); setProgress(0);
    const toSend = validated.filter((v) => v.status === "ok" || !skipInvalid).map((v) => v.row);
    const totalErrors: { index: number; reason: string; raw: Record<string, any> }[] = validated
      .filter((v) => v.status === "error" && skipInvalid)
      .map((v) => ({ index: v.index, reason: v.reason ?? "Invalid", raw: v.raw }));
    let imported = 0, updated = 0, skipped = 0, failed = 0;
    const chunks: any[][] = [];
    for (let i = 0; i < toSend.length; i += CHUNK) chunks.push(toSend.slice(i, i + CHUNK));

    for (let idx = 0; idx < chunks.length; idx++) {
      const isFinal = idx === chunks.length - 1;
      try {
        const res = await importFn({
          data: {
            rows: chunks[idx],
            mode, matchKey,
            fileName: file?.name,
            isFinalChunk: isFinal,
            totalRows: toSend.length,
          },
        });
        imported += res.imported; updated += res.updated; skipped += res.skipped; failed += res.failed;
        for (const e of res.errors) {
          const globalIdx = idx * CHUNK + e.index;
          const orig = validated.filter((v) => v.status === "ok" || !skipInvalid)[globalIdx];
          totalErrors.push({ index: orig?.index ?? globalIdx, reason: e.reason, raw: orig?.raw ?? {} });
        }
      } catch (e: any) {
        failed += chunks[idx].length;
        toast.error(e.message ?? "Chunk failed");
      }
      setProgress(Math.round(((idx + 1) / chunks.length) * 100));
    }

    if (!chunks.length) {
      // no rows to send but log history anyway
      try {
        await importFn({ data: { rows: [{ name: "__noop__", price: 0 }], mode, matchKey, fileName: file?.name, isFinalChunk: true, totalRows: 0 } as any });
      } catch { /* ignore */ }
    }

    setResult({ imported, updated, skipped, failed, errors: totalErrors });
    setRunning(false); setStep("done");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b">
          <DialogTitle className="text-lg sm:text-xl">Import Products</DialogTitle>
          <StepBar step={step} />
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
          {step === "source" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault(); setDragging(false);
                  const f = e.dataTransfer.files?.[0]; if (f) await handleFile(f);
                }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 sm:p-10 text-center cursor-pointer transition ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <div className="font-medium">Drop CSV or Excel file here</div>
                <div className="text-xs text-muted-foreground mt-1">or click to browse. Accepts .csv, .xlsx</div>
                {file && <div className="mt-3 text-sm inline-flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />{file.name} · {raw.length} rows</div>}
                <input ref={inputRef} type="file" accept=".csv,.xlsx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={downloadSampleCsv}><Download className="w-4 h-4 mr-2" />Sample CSV</Button>
                <Button variant="outline" size="sm" onClick={downloadSampleXlsx}><Download className="w-4 h-4 mr-2" />Sample Excel</Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Or import from Google Sheets URL</Label>
                <div className="flex gap-2">
                  <Input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
                  <Button variant="secondary" onClick={loadSheet}>Load</Button>
                </div>
                <div className="text-xs text-muted-foreground">Make sure the sheet is shared as "Anyone with the link — Viewer".</div>
              </div>

              <ColumnsHelp />
            </div>
          )}

          {step === "mode" && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm mb-2 block">Import Mode</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-2">
                  <ModeOption v="add" cur={mode} title="Add new products only" desc="Skip rows whose SKU already exists." />
                  <ModeOption v="update" cur={mode} title="Update existing only" desc="Only update products matching the key. Skip unknown ones." />
                  <ModeOption v="upsert" cur={mode} title="Add + Update" desc="Insert new products and update existing ones." />
                </RadioGroup>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Match existing by</Label>
                <Select value={matchKey} onValueChange={(v) => setMatchKey(v as MatchKey)}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sku">SKU</SelectItem>
                    <SelectItem value="product_code">Product Code</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Total {totals.total}</Badge>
                <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/15">Valid {totals.ok}</Badge>
                <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/15">Errors {totals.err}</Badge>
                <label className="ml-auto flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} />
                  Skip invalid rows
                </label>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validated.slice(0, 20).map((v) => (
                      <TableRow key={v.index} className={v.status === "error" ? "bg-red-500/5" : ""}>
                        <TableCell>{v.index + 2}</TableCell>
                        <TableCell>
                          {v.status === "ok" ? (
                            <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 hover:bg-green-500/15">OK</Badge>
                          ) : (
                            <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 hover:bg-red-500/15">Error</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">{v.raw.name}</TableCell>
                        <TableCell>{v.raw.sku ?? "—"}</TableCell>
                        <TableCell>{v.raw.price ?? "—"}</TableCell>
                        <TableCell>{v.raw.stock ?? "—"}</TableCell>
                        <TableCell className="text-xs text-red-600">{v.reason ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-xs text-muted-foreground">Showing first {Math.min(20, validated.length)} of {validated.length} rows.</div>
              {totals.err > 0 && !skipInvalid && (
                <Alert variant="destructive"><AlertCircle className="w-4 h-4" /><AlertDescription>Fix errors in your file or enable "Skip invalid rows".</AlertDescription></Alert>
              )}
            </div>
          )}

          {step === "import" && (
            <div className="space-y-4 py-6">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <div className="mt-3 font-medium">Importing products…</div>
                <div className="text-sm text-muted-foreground">Do not close this window.</div>
              </div>
              <Progress value={progress} />
              <div className="text-center text-sm text-muted-foreground">{progress}%</div>
            </div>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
                <div className="mt-2 text-lg font-semibold">Import complete</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Stat label="Total" value={totals.total} />
                <Stat label="Imported" value={result.imported} tone="green" />
                <Stat label="Updated" value={result.updated} tone="blue" />
                <Stat label="Skipped" value={result.skipped} tone="amber" />
                <Stat label="Failed" value={result.failed} tone="red" />
              </div>
              {result.errors.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => writeErrorReport(result.errors)}>
                  <Download className="w-4 h-4 mr-2" />Download error report ({result.errors.length})
                </Button>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-4 sm:p-6 pt-3 border-t flex-row gap-2 justify-between sm:justify-end">
          {step === "done" ? (
            <Button onClick={close} className="w-full sm:w-auto">Done</Button>
          ) : step === "import" ? null : (
            <>
              <Button variant="outline" onClick={() => {
                if (step === "mode") setStep("source");
                else if (step === "preview") setStep("mode");
                else close();
              }} disabled={running}><ArrowLeft className="w-4 h-4 mr-1" />{step === "source" ? "Cancel" : "Back"}</Button>
              <Button
                onClick={() => {
                  if (step === "source") { if (!raw.length) return toast.error("Upload a file or load a sheet first"); setStep("mode"); }
                  else if (step === "mode") setStep("preview");
                  else if (step === "preview") {
                    if (!skipInvalid && totals.err > 0) return toast.error("Fix errors or enable skip");
                    if (totals.ok === 0) return toast.error("No valid rows to import");
                    runImport();
                  }
                }}
                disabled={running}
              >
                {step === "preview" ? "Start Import" : "Next"}<ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepBar({ step }: { step: Step }) {
  const steps: { k: Step; label: string }[] = [
    { k: "source", label: "Source" },
    { k: "mode", label: "Mode" },
    { k: "preview", label: "Preview" },
    { k: "import", label: "Import" },
    { k: "done", label: "Done" },
  ];
  const idx = steps.findIndex((s) => s.k === step);
  return (
    <div className="flex items-center gap-1 mt-2 overflow-x-auto">
      {steps.map((s, i) => (
        <div key={s.k} className="flex items-center gap-1 shrink-0">
          <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
          <span className={`text-xs ${i === idx ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
          {i < steps.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
        </div>
      ))}
    </div>
  );
}

function ModeOption({ v, cur, title, desc }: { v: string; cur: string; title: string; desc: string }) {
  return (
    <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${cur === v ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}>
      <RadioGroupItem value={v} className="mt-0.5" />
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "blue" | "amber" | "red" }) {
  const cls = tone === "green" ? "text-green-600" : tone === "blue" ? "text-blue-600" : tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="border rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ColumnsHelp() {
  return (
    <details className="border rounded-lg p-3">
      <summary className="cursor-pointer text-sm font-medium">Column reference ({IMPORT_COLUMNS.length})</summary>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {IMPORT_COLUMNS.map((c) => (
          <div key={c.key} className="border rounded p-2">
            <div className="font-medium flex items-center gap-2">
              <code className="bg-muted px-1 rounded">{c.key}</code>
              {c.required && <Badge variant="destructive" className="text-[10px]">required</Badge>}
            </div>
            <div className="text-muted-foreground mt-1">{c.description}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
