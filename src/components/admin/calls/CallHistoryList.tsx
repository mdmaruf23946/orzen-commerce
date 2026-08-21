import { formatDuration, timeAgo, type CallRow } from "@/lib/call-center";
import { CallResultBadge, CallStatusBadge } from "@/components/admin/calls/CallStatusBadge";

/** Compact call history used inside the order drawer and customer sheet. */
export function CallHistoryList({ calls, empty = "No calls yet" }: { calls: CallRow[]; empty?: string }) {
  if (!calls.length) return <div className="text-xs text-muted-foreground">{empty}</div>;
  return (
    <ul className="divide-y rounded-lg border">
      {calls.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CallStatusBadge status={c.status} />
              <span className="text-[11px] text-muted-foreground">{timeAgo(c.created_at)}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{formatDuration(c.duration_sec)}</span>
            </div>
            {c.note && <div className="mt-0.5 truncate text-xs text-muted-foreground">{c.note}</div>}
          </div>
          <CallResultBadge result={c.result} />
        </li>
      ))}
    </ul>
  );
}
