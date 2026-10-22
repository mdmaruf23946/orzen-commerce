import { createFileRoute } from "@tanstack/react-router";
import { csvCell } from "@/lib/csv-safe";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw } from "lucide-react";
import { ownerAiUsageReport } from "@/lib/owner.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/ai-usage")({ component: AiUsagePage });

const num = (n: number) => n.toLocaleString();
const usd = (n: number) => `$${n.toFixed(2)}`;

function AiUsagePage() {
  const fn = useServerFn(ownerAiUsageReport);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["owner", "ai-usage"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  function exportCsv() {
    if (!data) return;
    const lines = [
      "scope,name,requests,tokens,cost_usd",
      ...data.byStore.map((g) => `store,${csvCell(g.name)},${g.requests},${g.tokens},${g.cost.toFixed(4)}`),
      ...data.byModel.map((g) => `model,${csvCell(g.key)},${g.requests},${g.tokens},${g.cost.toFixed(4)}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const w = data?.windows;
  const cards = [
    { label: "Requests (7d)", value: w ? num(w.d7.requests) : "—" },
    { label: "Requests (30d)", value: w ? num(w.d30.requests) : "—" },
    { label: "Tokens (30d)", value: w ? num(w.d30.tokens) : "—" },
    { label: "Cost (30d)", value: w ? usd(w.d30.cost) : "—" },
    { label: "Requests (90d)", value: w ? num(w.d90.requests) : "—" },
    { label: "Tokens (90d)", value: w ? num(w.d90.tokens) : "—" },
    { label: "Cost (90d)", value: w ? usd(w.d90.cost) : "—" },
    { label: "Cost (7d)", value: w ? usd(w.d7.cost) : "—" },
  ];

  const maxDaily = Math.max(1, ...(data?.daily ?? []).map((d) => d.tokens));

  return (
    <div className="min-w-0 space-y-4">
      <OwnerPageHeader
        title="AI Usage"
        description="Token, cost and per-store AI consumption across the platform."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="min-w-0 rounded-xl border bg-card p-3">
            <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="mt-1 truncate text-lg font-bold sm:text-xl">{isLoading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Tokens · last 30 days</h2>
        {(data?.daily ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No AI usage recorded yet.</p>
        ) : (
          <div className="flex h-28 items-end gap-1">
            {data!.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date} · ${num(d.tokens)} tokens · ${num(d.requests)} requests`}
                className="min-w-0 flex-1 rounded-t bg-primary/70"
                style={{ height: `${Math.max(2, (d.tokens / maxDaily) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupTable title="By store (30d)" rows={data?.byStore.map((g) => ({ ...g, key: g.name })) ?? []} loading={isLoading} />
        <GroupTable title="By model (30d)" rows={data?.byModel ?? []} loading={isLoading} />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent AI calls</h2>
        {(data?.recent ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-muted-foreground">
                  <th className="pb-2">Time</th><th className="pb-2">Store</th><th className="pb-2">Model</th>
                  <th className="pb-2">Kind</th><th className="pb-2 text-right">Tokens</th><th className="pb-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data!.recent.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1.5 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-1.5 max-w-[140px] truncate">{r.store_name}</td>
                    <td className="py-1.5 max-w-[160px] truncate">{r.model}</td>
                    <td className="py-1.5">{r.kind ?? "—"}</td>
                    <td className="py-1.5 text-right">{num(r.tokens)}</td>
                    <td className="py-1.5 text-right">{usd(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupTable({
  title, rows, loading,
}: { title: string; rows: { key: string; requests: number; tokens: number; cost: number }[]; loading: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No usage in this period.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase text-muted-foreground">
              <th className="pb-2">Name</th><th className="pb-2 text-right">Req</th>
              <th className="pb-2 text-right">Tokens</th><th className="pb-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.key} className="border-t">
                <td className="max-w-[180px] truncate py-1.5">{g.key}</td>
                <td className="py-1.5 text-right">{num(g.requests)}</td>
                <td className="py-1.5 text-right">{num(g.tokens)}</td>
                <td className="py-1.5 text-right">{usd(g.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
