import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Download, KeyRound, Lock, Clock, CloudDownload } from "lucide-react";
import { listMyDownloads, requestDownload } from "@/lib/digital.functions";

/** "My Downloads" list for the store customer account page. */
export function MyDownloads({ storeId, token }: { storeId: string; token: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["my-downloads", storeId, token],
    queryFn: () => listMyDownloads({ data: { storeId, token } }),
  });
  const download = useServerFn(requestDownload);
  const [busy, setBusy] = useState<string | null>(null);

  const rows: any[] = (data as any)?.downloads ?? [];
  const licenses: any[] = (data as any)?.licenses ?? [];

  const start = async (r: any) => {
    setBusy(r.id);
    try {
      const res: any = await download({ data: { downloadId: r.id, orderId: r.order_id } });
      window.open(res.url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the download");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center">
        <CloudDownload className="mx-auto h-8 w-8 text-neutral-300" />
        <p className="mt-2 text-sm text-neutral-500">You have no digital purchases yet.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const locked = r.status !== "active";
        const expired = r.expires_at && new Date(r.expires_at) < new Date();
        const used = r.max_downloads != null && r.download_count >= r.max_downloads;
        const keys = licenses.filter((k) => k.product_id === r.product_id && k.order_id === r.order_id);
        return (
          <li key={r.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-neutral-900">
                  {r.product_name}
                  {r.file_label ? ` — ${r.file_label}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
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
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                  <Lock className="h-3 w-3" /> {r.status === "revoked" ? "Revoked" : "Pending"}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy === r.id || !!expired || used}
                  onClick={() => start(r)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {expired ? "Expired" : used ? "Limit reached" : busy === r.id ? "Preparing…" : "Download"}
                </button>
              )}
            </div>
            {keys.length > 0 && (
              <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-500">
                  <KeyRound className="h-3 w-3" /> License key
                </div>
                {keys.map((k, i) => (
                  <div key={i} className="font-mono text-sm text-neutral-900">
                    {k.key_value}
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
