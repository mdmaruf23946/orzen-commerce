import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, KeyRound, Copy, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoreBySlug } from "@/lib/storefront.functions";
import { listMyDigitalPurchases, requestDigitalDownload } from "@/lib/digital.functions";
import { formatBytes, LICENSE_LABELS, type LicenseType } from "@/lib/digital";
import { getDeviceId } from "@/lib/fingerprint";
import { useStoreT } from "@/lib/store-i18n";

const FILTERS = ["all", "active", "expired"] as const;
type Filter = (typeof FILTERS)[number];

/** Customer dashboard: every digital item bought from this store. */
export function MyDownloads({ slug, token }: { slug: string; token: string }) {
  const { t } = useStoreT();
  const getStore = useServerFn(getStoreBySlug);
  const listMine = useServerFn(listMyDigitalPurchases);
  const requestDl = useServerFn(requestDigitalDownload);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: store } = useQuery({
    queryKey: ["store", slug],
    queryFn: () => getStore({ data: { slug } }),
  });
  const { data: rows = [], isLoading, refetch } = useQuery({
    enabled: !!store?.id,
    queryKey: ["myDownloads", store?.id],
    queryFn: () => listMine({ data: { storeId: store!.id, token } }),
  });

  const expired = (r: any) => !!r.expiresAt && new Date(r.expiresAt) < new Date();
  const items = (rows as any[]).filter((r) =>
    filter === "all" ? true : filter === "expired" ? expired(r) : r.status === "active" && !expired(r),
  );

  async function download(entitlementId: string, fileIndex: number) {
    const key = `${entitlementId}:${fileIndex}`;
    setBusy(key);
    try {
      const res = await requestDl({
        data: {
          entitlementId,
          fileIndex,
          storeId: store!.id,
          token,
          deviceId: getDeviceId() || undefined,
        },
      });
      window.open(res.url, "_blank", "noopener");
      refetch();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <p className="py-6 text-sm text-neutral-500">{t("digital.myDownloads.loading")}</p>;
  if (!rows.length)
    return <p className="py-6 text-sm text-neutral-500">{t("digital.myDownloads.empty")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
              filter === f ? "border-sf-accent bg-sf-accent-soft text-sf-accent" : "border-neutral-200 text-neutral-600 hover:border-sf-accent hover:text-sf-accent"
            }`}
          >
            {t(`digital.myDownloads.filter.${f}`)}
          </button>
        ))}
      </div>

      {items.map((r) => (
        <div key={r.id} className="rounded-xl border p-3">
          <div className="flex gap-3">
            {r.image ? (
              <img src={r.image} alt={r.name} className="h-16 w-16 rounded-lg border object-cover" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-lg border bg-muted">
                <Download className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.version ? t("digital.myDownloads.versionPrefix", { version: r.version }) : ""}
                {t("digital.myDownloads.purchased", { date: new Date(r.purchasedAt).toLocaleDateString() })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("digital.downloadsCount", { count: r.downloadCount })}
                {r.maxDownloads == null ? t("digital.unlimited") : ` / ${r.maxDownloads}`}
                {r.expiresAt ? (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {new Date(r.expiresAt).toLocaleDateString()}
                  </span>
                ) : null}
              </p>
            </div>
            <span
              className={`h-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${
                expired(r)
                  ? "bg-neutral-100 text-neutral-600"
                  : r.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {expired(r) ? t("digital.myDownloads.expired") : r.status === "active" ? t("digital.myDownloads.active") : t("digital.myDownloads.locked")}
            </span>
          </div>

          {r.status === "active" && !expired(r) && (
            <div className="mt-3 space-y-2">
              {(r.files as any[]).map((f) => (
                <div
                  key={f.index}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{f.name}</p>
                    {f.size ? (
                      <p className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    className="bg-sf-accent text-white hover:bg-sf-accent-hover"
                    onClick={() => download(r.id, f.index)}
                    disabled={busy === `${r.id}:${f.index}`}
                  >
                    {busy === `${r.id}:${f.index}` ? "…" : t("digital.download")}
                  </Button>
                </div>
              ))}
              {r.hasExternal && (
                <Button size="sm" variant="outline" className="border-sf-accent text-sf-accent hover:bg-sf-accent-soft hover:text-sf-accent" onClick={() => download(r.id, -1)}>
                  {t("digital.openExternalLink")}
                </Button>
              )}
            </div>
          )}

          {r.license && (
            <div className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              <code className="flex-1 truncate text-xs">{r.license.key}</code>
              <span className="text-[11px] text-muted-foreground">
                {LICENSE_LABELS[(r.license.type ?? "personal") as LicenseType]}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-sf-accent hover:bg-sf-accent-soft hover:text-sf-accent"
                onClick={() => {
                  navigator.clipboard.writeText(r.license.key);
                  toast.success(t("digital.licenseCopied"));
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
