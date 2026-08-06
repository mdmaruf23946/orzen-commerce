// Shared read-only view of a submitted return / exchange request.
import { STATUS_LABEL, KIND_LABEL } from "@/lib/returns-pricing";

/** Shared read-only view of a submitted request. */
export function ReturnStatusCard({ r }: { r: any }) {
  const STATUS_LABEL: Record<string, string> = {
    requested: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
    refunded: "Refunded",
    completed: "Completed",
  };
  const rp = r.replacement_product;
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium capitalize">{r.type} request</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium">
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      </div>
      {r.reason && <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>}
      {r.customer_note && <p className="mt-1 text-xs text-muted-foreground">{r.customer_note}</p>}
      {r.resolution_note && <p className="mt-1 text-xs">Store: {r.resolution_note}</p>}
      {Number(r.refund_amount ?? 0) > 0 && (
        <p className="mt-1 text-xs">Refund: ৳{Number(r.refund_amount).toFixed(0)}</p>
      )}
      {rp && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-background p-2">
          {rp.image && (
            <img
              src={rp.image.startsWith("http") || rp.image.startsWith("/") ? rp.image : `/api/img/${rp.image}`}
              alt=""
              className="h-9 w-9 rounded object-cover"
            />
          )}
          <span className="min-w-0 flex-1 truncate text-xs">Replacement: {rp.name}</span>
        </div>
      )}
      {r.courier_tracking_id && (
        <p className="mt-1 text-xs text-muted-foreground">
          Return tracking: {r.courier_name ? `${r.courier_name} · ` : ""}
          <span className="font-mono">{r.courier_tracking_id}</span>
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Requested {new Date(r.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
