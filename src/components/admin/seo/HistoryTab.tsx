import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listSeoHistory, rollbackSeo } from "@/lib/seo-history.functions";

const SOURCE_LABEL: Record<string, string> = {
  manual_edit: "Manual edit",
  ai_apply: "AI suggestion",
  rollback: "Restored",
};

function summary(m: any): string {
  if (!m || typeof m !== "object") return "—";
  const t = m.title || m.meta_title;
  const d = m.description || m.meta_description;
  return [t, d].filter(Boolean).join(" · ") || "(empty — automatic)";
}

export function HistoryTab() {
  const fetchHistory = useServerFn(listSeoHistory);
  const doRollback = useServerFn(rollbackSeo);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "seo-history"],
    queryFn: () => fetchHistory(),
  });

  async function restore(id: string) {
    setBusy(id);
    try {
      await doRollback({ data: { id } });
      toast.success("Previous SEO restored");
      await qc.invalidateQueries({ queryKey: ["admin", "seo-history"] });
      qc.invalidateQueries({ queryKey: ["admin", "seo-overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="font-medium">SEO change history</h2>
        <p className="text-xs text-muted-foreground">
          Every SEO change is saved. Restore any earlier version with one click. Design-only changes
          never trigger AI review. Items waiting for SEO review: {data.pendingReview}
        </p>
      </div>
      {data.history.length === 0 && (
        <p className="text-sm text-muted-foreground">No SEO changes yet.</p>
      )}
      <ul className="divide-y">
        {data.history.map((h: any) => (
          <li key={h.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 text-sm">
              <div className="font-medium">
                {h.label}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  · {SOURCE_LABEL[h.change_source] ?? h.change_source} ·{" "}
                  {new Date(h.created_at).toLocaleString()}
                </span>
              </div>
              <div className="truncate text-xs text-muted-foreground">Before: {summary(h.metadata_before)}</div>
              <div className="truncate text-xs text-muted-foreground">After: {summary(h.metadata_after)}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy === h.id || !!h.rolled_back_at}
              onClick={() => restore(h.id)}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {h.rolled_back_at ? "Restored" : "Restore"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
