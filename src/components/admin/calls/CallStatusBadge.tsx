import { STATUS_LABEL, STATUS_TONE, RESULT_LABEL, type CallResult, type CallStatus } from "@/lib/call-center";

export function CallStatusBadge({ status }: { status: CallStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_TONE[status] ?? "bg-muted text-muted-foreground ring-border"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function CallResultBadge({ result }: { result?: CallResult | string | null }) {
  if (!result) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
      {RESULT_LABEL[result as CallResult] ?? result}
    </span>
  );
}
