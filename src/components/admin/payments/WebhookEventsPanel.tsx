import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listStorePaymentWebhookEvents } from "@/lib/store-payments.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, ChevronDown, ChevronRight, Copy, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getBrand } from "./providers";

type Row = {
  id: string;
  provider_id: string;
  source: string;
  signature_valid: boolean | null;
  verified_status: string | null;
  provider_ref: string | null;
  method: string | null;
  amount: number | null;
  currency: string | null;
  payload_summary: any;
  status_code: number | null;
  error_message: string | null;
  received_at: string;
};

function StatusPill({ row }: { row: Row }) {
  const ok = (row.status_code ?? 0) < 400 && !row.error_message;
  const color = ok
    ? "bg-emerald-100 text-emerald-800 dark:text-emerald-300 border-emerald-200"
    : "bg-red-100 text-red-800 dark:text-red-300 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${color}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {row.status_code ?? "—"}
    </span>
  );
}

export function WebhookEventsPanel({
  storeId,
  providers,
}: {
  storeId: string;
  providers: { provider_id: string; label: string }[];
}) {
  const listFn = useServerFn(listStorePaymentWebhookEvents);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["storeWebhookEvents", storeId, filter],
    queryFn: () =>
      listFn({
        data: {
          storeId,
          limit: 25,
          ...(filter !== "all" ? { providerId: filter } : {}),
        },
      }) as Promise<Row[]>,
    refetchOnWindowFocus: false,
  });

  const rows = data ?? [];

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Recent webhook events</h2>
          <p className="text-xs text-muted-foreground">
            Last 25 deliveries received from your payment gateways.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.provider_id} value={p.provider_id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          No webhook events received yet. Trigger a test from the gateway settings sheet to verify delivery.
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const brand = getBrand(row.provider_id);
            const isOpen = expanded === row.id;
            return (
              <li key={row.id} className="px-4 py-3">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                >
                  {isOpen ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: brand.brandColor }}>
                        {brand.label}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {row.source}
                      </Badge>
                      <StatusPill row={row} />
                      {row.verified_status && (
                        <Badge variant="secondary" className="text-[10px]">
                          {row.verified_status}
                        </Badge>
                      )}
                      {row.signature_valid === true && (
                        <Badge className="bg-emerald-500 text-white text-[10px]">signed</Badge>
                      )}
                      {row.signature_valid === false && (
                        <Badge className="bg-red-500 text-white text-[10px]">bad signature</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.provider_ref ? (
                        <>
                          ref <span className="font-mono">{row.provider_ref}</span>
                          {row.amount != null && (
                            <> · {row.amount} {row.currency ?? ""}</>
                          )}
                          {row.method && <> · {row.method}</>}
                        </>
                      ) : (
                        row.error_message ?? "—"
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(row.received_at).toLocaleString()}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-2 rounded-md border bg-muted/40 p-3">
                    {row.error_message && (
                      <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:text-red-300">
                        {row.error_message}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Payload summary
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(row.payload_summary, null, 2));
                          toast.success("Payload copied");
                        }}
                      >
                        <Copy className="mr-1 h-3 w-3" /> Copy
                      </Button>
                    </div>
                    <pre className="max-h-64 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed">
{JSON.stringify(row.payload_summary ?? {}, null, 2)}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
