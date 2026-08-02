import { Pencil, Trash2, Download, Repeat, CalendarClock, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ProductType = "physical" | "digital" | "service" | "subscription";

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  physical: "Physical",
  digital: "Digital",
  service: "Service",
  subscription: "Subscription",
};

function typeOf(p: any): ProductType {
  const t = p?.product_type ?? p?.meta?.product_type ?? "physical";
  return (["physical", "digital", "service", "subscription"] as const).includes(t) ? t : "physical";
}

function imgSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith("http") ? url : `/api/img/${url}`;
}

function MetaLine({ p }: { p: any }) {
  const type = typeOf(p);
  const meta = p?.meta ?? {};
  const price = `৳${Number(p.price ?? 0).toFixed(0)}`;
  const old =
    p.old_price && Number(p.old_price) > Number(p.price) ? (
      <span className="ml-1 line-through opacity-70">৳{Number(p.old_price).toFixed(0)}</span>
    ) : null;

  if (type === "digital") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span>
          {price}
          {old}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Download className="h-3 w-3" />
          {p.download_count ?? 0} downloads
        </span>
        <span>·</span>
        <span>{meta?.digital?.download?.mode === "manual" ? "Manual delivery" : "Instant delivery"}</span>
      </span>
    );
  }
  if (type === "service") {
    const booking = meta?.service?.booking_type ?? "scheduled";
    const eta = meta?.service?.delivery_time;
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span>
          {price}
          {old}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          {booking === "instant" ? "Instant" : booking === "request" ? "On request" : "Scheduled"}
        </span>
        {eta && (
          <>
            <span>·</span>
            <span>{eta}</span>
          </>
        )}
      </span>
    );
  }
  if (type === "subscription") {
    const cycle = meta?.subscription?.billing_cycle ?? "monthly";
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span>
          {price}
          {old} / {cycle}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Repeat className="h-3 w-3" />
          {p.active_subscribers ?? 0} active
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span>
        {price}
        {old}
      </span>
      <span>·</span>
      <span className="inline-flex items-center gap-1">
        <Package className="h-3 w-3" />
        Stock {p.stock ?? 0}
      </span>
    </span>
  );
}

export function ProductRow({
  product,
  selected,
  showTypeBadge,
  onToggle,
  onEdit,
  onDelete,
}: {
  product: any;
  selected: boolean;
  showTypeBadge?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const src = imgSrc(product.primary_image_url);
  const type = typeOf(product);
  return (
    <li className="flex items-center gap-3 p-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-4 w-4 shrink-0"
        aria-label={`Select ${product.name}`}
      />
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
        {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="line-clamp-1 text-sm font-medium">{product.name}</p>
          {showTypeBadge && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {PRODUCT_TYPE_LABEL[type]}
            </Badge>
          )}
          <Badge
            variant={product.status === "active" ? "default" : "outline"}
            className="h-5 px-1.5 text-[10px] capitalize"
          >
            {String(product.status ?? "").replace("_", " ")}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <MetaLine p={product} />
        </p>
      </div>
      <button onClick={onEdit} className="rounded p-2 hover:bg-muted" aria-label="Edit">
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        className="rounded p-2 text-destructive hover:bg-destructive/10"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export { typeOf as productTypeOf };
