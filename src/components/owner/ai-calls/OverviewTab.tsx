import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PhoneIncoming, PhoneOutgoing, CheckCircle2, XCircle, Clock, Building2, Bot, Hash } from "lucide-react";
import { aiCallOverview, listAllAiCalls } from "@/lib/ai-call-center.functions";
import { AI_RESULT_LABEL, AI_RESULT_TONE, AI_STATUS_LABEL, AI_STATUS_TONE, formatMinutes } from "@/lib/ai-call-center";

function Stat({ icon: Icon, label, value, tone = "" }: { icon: any; label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export function OverviewTab() {
  const overviewFn = useServerFn(aiCallOverview);
  const listFn = useServerFn(listAllAiCalls);
  const { data: s } = useQuery({ queryKey: ["ai-call", "overview"], queryFn: () => overviewFn() });
  const { data: calls } = useQuery({
    queryKey: ["ai-call", "recent"],
    queryFn: () => listFn({ data: { storeId: null, limit: 25 } }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat icon={PhoneOutgoing} label="Outbound" value={s?.outbound ?? 0} />
        <Stat icon={PhoneIncoming} label="Inbound" value={s?.inbound ?? 0} />
        <Stat icon={CheckCircle2} label="Confirmed" value={s?.confirmed ?? 0} tone="text-emerald-600" />
        <Stat icon={XCircle} label="Cancelled" value={s?.cancelled ?? 0} tone="text-destructive" />
        <Stat icon={Clock} label="Minutes" value={s?.minutes ?? 0} />
        <Stat icon={Building2} label="Active Stores" value={s?.active_stores ?? 0} />
        <Stat icon={Bot} label="Active Agents" value={s?.active_agents ?? 0} />
        <Stat icon={Hash} label="Active Numbers" value={s?.active_numbers ?? 0} />
      </div>

      <div className="rounded-2xl border bg-card">
        <div className="border-b px-3 py-2 text-sm font-semibold">Recent AI Calls</div>
        {!calls?.length ? (
          <div className="p-6 text-sm text-muted-foreground">No AI calls yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Store</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Direction</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(calls as any[]).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">{c.stores?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.customer_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </td>
                    <td className="px-3 py-2 text-xs capitalize">{c.direction}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatMinutes(c.duration_sec ?? 0)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${AI_STATUS_TONE[c.status as keyof typeof AI_STATUS_TONE] ?? ""}`}>
                        {AI_STATUS_LABEL[c.status as keyof typeof AI_STATUS_LABEL] ?? c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {c.result ? (
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${AI_RESULT_TONE[c.result as keyof typeof AI_RESULT_TONE] ?? ""}`}>
                          {AI_RESULT_LABEL[c.result as keyof typeof AI_RESULT_LABEL] ?? c.result}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
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
