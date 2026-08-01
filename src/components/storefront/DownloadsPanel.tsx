import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download, KeyRound, Lock, Clock } from "lucide-react";
import { listOrderDownloads, requestDownload } from "@/lib/digital.functions";

/** Digital delivery block shown on the order confirmation page. */
export function DownloadsPanel({ orderId }: { orderId: string }) {
  const { data } = useQuery({
    queryKey: ["order-downloads", orderId],
    queryFn: () => listOrderDownloads({ data: { orderId } }),
    refetchInterval: 30_000,
  });
  const download = useServerFn(requestDownload);
  const [busy, setBusy] = useState<string | null>(null);

  const rows: any[] = (data as any)?.downloads ?? [];
  if (rows.length === 0) return null;
  const licenses: any[] = (data as any)?.licenses ?? [];
  const instructions: string[] = (data as any)?.instructions ?? [];

  const start = async (id: string) => {
    setBusy(id);
    try {
      const res: any = await download({ data: { downloadId: id, orderId } });
      window.open(res.url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the download");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <Download className="h-3 w-3" /> Your downloads
      </div>
      <ul className="space-y-2">
        {rows.map((r) => {
          const locked = r.status !== "active";
          const expired = r.expires_at && new Date(r.expires_at) < new Date();
          const used = r.max_downloads != null && r.download_count >= r.max_downloads;
          return (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {r.product_name}
                  {r.file_label ? ` — ${r.file_label}` : ""}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                  {r.version && <span>v{r.version}</span>}
                  {r.max_downloads != null && (
                    <span>
                      {Math.max(0, r.max_downloads - r.download_count)} of {r.max_downloads} left
                    </span>
                  )}
                  {r.expires_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {new Date(r.expires_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              {locked ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                  <Lock className="h-3 w-3" /> {r.status === "revoked" ? "Revoked" : "Awaiting payment"}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy === r.id || !!expired || used}
                  onClick={() => start(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {expired ? "Expired" : used ? "Limit reached" : busy === r.id ? "Preparing…" : "Download"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {licenses.length > 0 && (
        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase text-muted-foreground">
            <KeyRound className="h-3 w-3" /> License key{licenses.length > 1 ? "s" : ""}
          </div>
          {licenses.map((k, i) => (
            <div key={i} className="font-mono text-sm">
              {k.key_value}
            </div>
          ))}
        </div>
      )}

      {instructions.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {instructions.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      )}
    </div>
  );
}
