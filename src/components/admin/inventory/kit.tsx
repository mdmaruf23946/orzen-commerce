import type { ReactNode } from "react";
import { csvCell } from "@/lib/csv-safe";
import { cn } from "@/lib/utils";

export function money(n: number | string | null | undefined) {
  return `৳${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function KpiStrip({ items }: { items: { label: string; value: ReactNode; tone?: string; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-xl border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
          <div className={cn("mt-1 text-lg font-semibold tabular-nums sm:text-xl", k.tone)}>{k.value}</div>
          {k.hint && <div className="text-[11px] text-muted-foreground">{k.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "green" | "amber" | "red" | "gray" | "blue"; children: ReactNode }) {
  const map = {
    green: "bg-emerald-100 text-emerald-800 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-800 dark:text-amber-300",
    red: "bg-destructive/10 text-destructive",
    gray: "bg-muted text-muted-foreground",
    blue: "bg-sky-100 text-sky-800",
  } as const;
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", map[tone])}>{children}</span>;
}

export function ItemCard({
  image,
  title,
  subtitle,
  right,
  children,
}: {
  image?: string | null;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const src = image
    ? image.startsWith("http") || image.startsWith("data:") || image.startsWith("/api/img/")
      ? image
      : `/api/img/${image.replace(/^\/+/, "")}`
    : null;
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
          {src ? <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-[11px] text-muted-foreground">{f.label}</dt>
          <dd className="truncate text-sm font-medium tabular-nums">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyBox({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const esc = csvCell;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function fmtBytes(bytes?: number | null) {
  if (!bytes) return "—";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), u.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleString() : "—";
}
