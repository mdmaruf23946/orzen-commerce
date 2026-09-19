// Shared comparison table used by the Courier and Payment mini dashboards.
// Desktop renders a sortable table; mobile collapses to one card per row.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export type ColumnDef<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Sort value (numbers sort descending first). */
  value: (row: T) => number | string;
  render?: (row: T) => React.ReactNode;
  /** Hide on the mobile card layout. */
  hideOnMobile?: boolean;
};

export function rateTone(pct: number) {
  if (pct >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 65) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export function ComparisonTable<T extends { key: string; label: string }>({
  rows,
  columns,
  defaultSort,
  bestKey,
  accentOf,
  leading,
  onRowClick,
  exportName,
  emptyText,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
  defaultSort: string;
  bestKey?: string;
  accentOf?: (row: T) => string;
  leading?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  exportName: string;
  emptyText: string;
}) {
  const [sort, setSort] = useState(defaultSort);
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (typeof av === "number" && typeof bv === "number") return dir === "desc" ? bv - av : av - bv;
      return dir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return copy;
  }, [rows, columns, sort, dir]);

  function toggle(key: string) {
    if (key === sort) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(key);
      setDir("desc");
    }
  }

  function exportCsv() {
    const header = ["Name", ...columns.map((c) => c.label)].join(",");
    const lines = sorted.map((r) =>
      [r.label, ...columns.map((c) => String(c.value(r)).replace(/,/g, ""))].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) {
    return <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
        <h2 className="text-sm font-semibold">Comparison</h2>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Name</th>
              {columns.map((c) => (
                <th key={c.key} className={cn("px-3 py-2 font-medium", c.align === "left" ? "text-left" : "text-right")}>
                  <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                    {c.label}
                    {sort === c.key &&
                      (dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.key}
                onClick={() => onRowClick?.(r)}
                className={cn("border-b last:border-0", onRowClick && "cursor-pointer hover:bg-muted/50")}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {leading?.(r)}
                    <span className="font-medium">{r.label}</span>
                    {bestKey === r.key && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Best
                      </span>
                    )}
                  </div>
                </td>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5 tabular-nums", c.align === "left" ? "text-left" : "text-right")}>
                    {c.render ? c.render(r) : c.value(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="divide-y md:hidden">
        {sorted.map((r) => (
          <div
            key={r.key}
            onClick={() => onRowClick?.(r)}
            className={cn("p-3", onRowClick && "active:bg-muted/50")}
            style={accentOf ? { borderLeft: `3px solid ${accentOf(r)}` } : undefined}
          >
            <div className="flex items-center gap-2">
              {leading?.(r)}
              <span className="text-sm font-semibold">{r.label}</span>
              {bestKey === r.key && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Best
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</dt>
                    <dd className="truncate text-sm tabular-nums">{c.render ? c.render(r) : c.value(r)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
