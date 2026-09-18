import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Activity, CheckCircle2, Clock, XCircle } from "lucide-react";
import { emailDeliveryStats, listEmailDeliveryLog } from "@/lib/email-ops.functions";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/owner/communication/activity")({
  component: ActivityPage,
  head: () => ({
    meta: [
      { title: "Email Activity — ORZEN Owner" },
      { name: "description", content: "See every platform email ORZEN sent, with delivery status and failures." },
      { property: "og:title", content: "Email Activity — ORZEN Owner" },
      { property: "og:description", content: "See every platform email ORZEN sent, with delivery status and failures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ActivityPage() {
  const statsFn = useServerFn(emailDeliveryStats);
  const logFn = useServerFn(listEmailDeliveryLog);
  const [status, setStatus] = useState<"all" | "sent" | "failed">("all");
  const [search, setSearch] = useState("");

  const { data: stats } = useQuery({ queryKey: ["email-stats"], queryFn: () => statsFn() });
  const { data: log, isLoading } = useQuery({
    queryKey: ["email-log", status, search],
    queryFn: () => logFn({ data: { limit: 100, status, search: search || null } }),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Activity} label="Total (30 days)" value={stats?.total ?? 0} />
        <Stat icon={CheckCircle2} label="Delivered" value={stats?.sent ?? 0} tone="ok" />
        <Stat icon={XCircle} label="Failed" value={stats?.failed ?? 0} tone="bad" />
        <Stat icon={Clock} label="Last 24 hours" value={stats?.last24h ?? 0} />
      </div>

      {(stats?.templates?.length ?? 0) > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 text-sm font-semibold">By email type (30 days)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {stats!.templates.map((t) => (
              <div key={t.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="truncate font-medium">{t.name}</span>
                <span className="flex shrink-0 gap-2 text-xs">
                  <span className="text-emerald-600">{t.sent} sent</span>
                  {t.failed > 0 && <span className="text-rose-600">{t.failed} failed</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-semibold">Delivery log</div>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipient email"
              className="h-9 sm:w-64"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">All</option>
              <option value="sent">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (log?.items.length ?? 0) === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No emails recorded yet.</div>
        ) : (
          <div className="divide-y">
            {log!.items.map((r) => (
              <div key={r.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.recipient_email}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · {r.template_name}
                  </div>
                  {r.error_message && (
                    <div className="mt-1 truncate text-xs text-rose-600">{r.error_message}</div>
                  )}
                </div>
                <span
                  className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    r.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: "ok" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
