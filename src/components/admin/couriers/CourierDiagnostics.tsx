import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourierDiagnostics } from "./providers";

export function CourierDiagnosticsPanel({
  diagnostics,
  onRetry,
  busy,
}: {
  diagnostics?: CourierDiagnostics;
  onRetry: () => void;
  busy?: boolean;
}) {
  const d = diagnostics ?? {};
  const status = d.lastStatus ?? "unknown";
  const dot =
    status === "connected"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-muted-foreground/40";
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <Row label="API status">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <span className="capitalize">{status}</span>
          </span>
        </Row>
        <Row label="Auth">
          <span className="capitalize">
            {status === "connected" ? "OK" : status === "error" ? "Failed" : "—"}
          </span>
        </Row>
        <Row label="Last sync">
          <span>{d.lastConnectedAt ? new Date(d.lastConnectedAt).toLocaleString() : "—"}</span>
        </Row>
        <Row label="Latency">
          <span>{d.latencyMs != null ? `${d.latencyMs} ms` : "—"}</span>
        </Row>
      </div>
      {d.lastError && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {d.lastError}
        </div>
      )}
      {d.lastResponse && (
        <details className="rounded border bg-background p-2 text-xs">
          <summary className="cursor-pointer select-none text-muted-foreground">
            Last API response
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">
            {d.lastResponse}
          </pre>
        </details>
      )}
      <Button size="sm" variant="outline" onClick={onRetry} disabled={busy}>
        <RefreshCw className={`mr-1 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        Retry connection
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-background px-2 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{children}</span>
    </div>
  );
}
