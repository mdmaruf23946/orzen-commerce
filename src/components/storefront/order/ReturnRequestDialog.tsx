// Shared read-only view of a submitted return / exchange request.
import { STATUS_LABEL, KIND_LABEL } from "@/lib/returns-pricing";
import { useStoreT } from "@/lib/store-i18n";

function img(p?: string | null) {
  if (!p) return null;
  const raw = p.trim();
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  return `/api/img/${raw}`;
}

const bdt = (n: number) => `৳${Number(n || 0).toFixed(0)}`;

export function ReturnStatusCard({ r }: { r: any }) {
  const { t } = useStoreT();
  const kind = (r.request_kind ?? (r.type === "exchange" ? "exchange_same" : "return")) as
    | "return"
    | "exchange_same"
    | "exchange_other";
  const lines: any[] = Array.isArray(r.lines) ? r.lines : Array.isArray(r.items) ? r.items : [];
  const replacements: any[] = Array.isArray(r.replacement_items) ? r.replacement_items : [];
  const timeline: any[] = Array.isArray(r.timeline) ? r.timeline : [];

  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{KIND_LABEL[kind] ?? t("return.status.requestLabel")}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium">
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      </div>

      {lines.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {lines.map((it: any, i: number) => (
            <li key={i} className="flex items-center gap-2">
              {img(it.image ?? it.image_url) && (
                <img
                  src={img(it.image ?? it.image_url)!}
                  alt=""
                  className="h-8 w-8 rounded object-cover"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-xs">
                {it.name}
                {it.variant ? ` · ${it.variant}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">×{it.qty}</span>
            </li>
          ))}
        </ul>
      )}

      {replacements.length > 0 && (
        <div className="mt-2 rounded-md bg-background p-2 text-xs">
          <p className="mb-1 font-medium">{t("return.status.replacement")}</p>
          {replacements.map((it: any, i: number) => (
            <p key={i} className="truncate text-muted-foreground">
              {it.name}
              {it.variant ? ` · ${it.variant}` : ""} ×{it.qty}
            </p>
          ))}
        </div>
      )}

      {r.reason && <p className="mt-2 text-xs text-muted-foreground">{r.reason}</p>}
      {r.customer_note && <p className="mt-1 text-xs text-muted-foreground">{r.customer_note}</p>}
      {r.resolution_note && <p className="mt-1 text-xs">{t("return.status.storeNote")} {r.resolution_note}</p>}

      <div className="mt-2 space-y-0.5 text-xs">
        {Number(r.refund_amount ?? 0) > 0 && (
          <p>
            {t("return.status.refund")} <span className="font-semibold">{bdt(r.refund_amount)}</span>
            {r.refund_status === "paid" ? ` · ${t("return.status.refundProcessed")}` : ` · ${t("return.status.refundPending")}`}
          </p>
        )}
        {Number(r.extra_payment_due ?? 0) > 0 && (
          <p>
            {t("return.status.extraPayable")} <span className="font-semibold">{bdt(r.extra_payment_due)}</span>
          </p>
        )}
      </div>

      {r.courier_tracking_id && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("return.status.trackingLabel")} {r.courier_name ? `${r.courier_name} · ` : ""}
          <span className="font-mono">{r.courier_tracking_id}</span>
        </p>
      )}

      {timeline.length > 0 && (
        <ol className="mt-2 space-y-1 border-t pt-2">
          {timeline.map((t: any, i: number) => (
            <li key={i} className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{STATUS_LABEL[t.status] ?? t.status}</span>
              <span>{new Date(t.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-1 text-[11px] text-muted-foreground">
        {t("return.status.requestedOn", { date: new Date(r.created_at).toLocaleDateString() })}
      </p>
    </div>
  );
}
