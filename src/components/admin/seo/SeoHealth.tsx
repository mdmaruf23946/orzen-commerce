import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { HealthItem } from "@/lib/seo";

export function SeoHealth({ items }: { items: HealthItem[] }) {
  const score = Math.round(
    (items.reduce((a, i) => a + (i.state === "ok" ? 1 : i.state === "warn" ? 0.5 : 0), 0) /
      Math.max(items.length, 1)) *
      100,
  );
  const tone = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-destructive";

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">SEO health</h3>
        <span className={`text-lg font-semibold ${tone}`}>{score}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-destructive"}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-start gap-2">
            {i.state === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : i.state === "warn" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">{i.label}</p>
              <p className="text-xs text-muted-foreground">{i.hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
