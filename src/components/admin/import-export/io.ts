import * as XLSX from "xlsx";
import { csvCell } from "@/lib/csv-safe";
import { IMPORT_COLUMNS, EXPORT_COLUMNS, SAMPLE_ROWS, coerceRow } from "./schema";

// ---------- File parsing ----------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* skip */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => (c ?? "").trim() !== ""));
}

export async function readFileAsRows(file: File): Promise<Record<string, any>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    return csvTextToObjects(text);
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  return json.map(normalizeKeys);
}

export function csvTextToObjects(text: string): Record<string, any>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, any> = {};
    header.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return normalizeKeys(obj);
  });
}

function normalizeKeys(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.trim().toLowerCase().replace(/\s+/g, "_")] = v;
  }
  return out;
}

// ---------- Validation ----------

export type ValidatedRow = {
  index: number;      // 0-based
  row: any;           // coerced row
  raw: Record<string, any>;
  status: "ok" | "error";
  reason?: string;
};

export function validateRows(raw: Record<string, any>[]): ValidatedRow[] {
  return raw.map((r, i) => {
    const { row, error } = coerceRow(r);
    return error
      ? { index: i, row, raw: r, status: "error", reason: error }
      : { index: i, row, raw: r, status: "ok" };
  });
}

// ---------- Sample template ----------

export function downloadSampleCsv() {
  const header = IMPORT_COLUMNS.map((c) => c.key);
  const esc = (v: any) => csvCell(v);
  const lines = [header.join(",")];
  for (const r of SAMPLE_ROWS) lines.push(header.map((h) => esc((r as any)[h])).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, "product-import-template.csv");
}

export function downloadSampleXlsx() {
  const header = IMPORT_COLUMNS.map((c) => c.key);
  const data = [header, ...SAMPLE_ROWS.map((r) => header.map((h) => (r as any)[h] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  triggerDownload(blob, "product-import-template.xlsx");
}

// ---------- Export writers ----------

export function writeCsv(header: string[], rows: Record<string, any>[], fileName: string) {
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) lines.push(header.map((h) => esc(r[h])).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, fileName.endsWith(".csv") ? fileName : `${fileName}.csv`);
}

export function writeXlsx(header: string[], rows: Record<string, any>[], fileName: string) {
  const aoa = [header, ...rows.map((r) => header.map((h) => r[h] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  triggerDownload(blob, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}

export function writeErrorReport(errors: { index: number; reason: string; raw: Record<string, any> }[]) {
  const header = ["row", "reason", ...IMPORT_COLUMNS.map((c) => c.key)];
  const rows = errors.map((e) => {
    const obj: Record<string, any> = { row: e.index + 2, reason: e.reason };
    for (const c of IMPORT_COLUMNS) obj[c.key] = e.raw[c.key] ?? "";
    return obj;
  });
  writeCsv(header, rows, `import-errors-${Date.now()}.csv`);
}

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { EXPORT_COLUMNS };
