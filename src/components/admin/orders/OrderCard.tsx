// Premium order card + shared badges for the Merchant Panel → Orders screen.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CallButton } from "@/components/admin/calls/CallButton";
import {
  Eye, Printer, Truck, MessageCircle, Copy, MoreHorizontal,
  ImageOff, ChevronDown, ShieldCheck, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { COURIERS } from "@/components/admin/couriers/providers";
import { STATUS_LABEL, STATUS_TONE, type ParcelStatus } from "@/lib/couriers/status";
import type { AdminOrderRow } from "@/lib/orders-admin.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const money = (n: unknown) => `৳${Number(n ?? 0).toLocaleString("en-BD")}`;

export const ORDER_STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  confirmed: "bg-primary/12 text-primary ring-primary/20",
  processing: "bg-sky-500/12 text-sky-700 dark:text-sky-400 ring-sky-500/20",
  delivered: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  cancelled: "bg-destructive/10 text-destructive ring-destructive/20",
};

export function courierMeta(key: string | null | undefined) {
  if (!key) return null;
  return COURIERS.find((c) => c.key === key) ?? { key, label: key.replace(/_/g, " "), brandColor: "#6b7280" } as any;
}

export function resolveImg(url: string | null | undefined) {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  // Already absolute (http/https, data:) or already proxied/root-relative.
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  return `/api/img/${raw}`;
}

export function Thumb({ url, alt, className = "" }: { url?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  const src = resolveImg(url);
  if (!src || err) {
    return (
      <div className={`grid place-items-center rounded-xl bg-muted ${className}`}>
        <ImageOff className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setErr(true)}
      className={`rounded-xl border object-cover ${className}`}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${ORDER_STATUS_TONE[status] ?? "bg-muted text-muted-foreground ring-border"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function PaymentBadge({ order }: { order: AdminOrderRow }) {
  const cod = order.payment_method === "cod";
  const paid = order.payment_status === "paid";
  const label = cod ? "COD" : paid ? "Online Paid" : order.payment_status === "partial" ? "Partial" : "Unpaid";
  const tone = cod
    ? "bg-muted text-foreground/80"
    : paid
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
      : "bg-amber-500/12 text-amber-700 dark:text-amber-400";
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>{label}</span>;
}

export function CourierBadge({ order }: { order: AdminOrderRow }) {
  const meta = courierMeta(order.courier_key);
  if (!meta) return <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">No courier</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ backgroundColor: `${meta.brandColor}1A`, color: meta.brandColor }}
    >
      <Truck className="h-3 w-3" /> {meta.label}
    </span>
  );
}

export function ParcelBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status as ParcelStatus;
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[s] ?? "bg-muted text-muted-foreground"}`}>
      {STATUS_LABEL[s] ?? status}
    </span>
  );
}

const TAG_LABEL: Record<string, { label: string; tone: string }> = {
  new_order: { label: "NEW", tone: "bg-primary text-primary-foreground" },
  repeat: { label: "Repeat", tone: "bg-violet-500/12 text-violet-700 dark:text-violet-400" },
  new_customer: { label: "New Customer", tone: "bg-sky-500/12 text-sky-700 dark:text-sky-400" },
  high_value: { label: "High Value", tone: "bg-amber-500/12 text-amber-700 dark:text-amber-400" },
  outside_dhaka: { label: "Outside Dhaka", tone: "bg-muted text-muted-foreground" },
  risk: { label: "Risk", tone: "bg-destructive/10 text-destructive" },
};

export function Tag({ tag }: { tag: string }) {
  const t = TAG_LABEL[tag];
  if (!t) return null;
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${t.tone}`}>{t.label}</span>;
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("880") ? digits : `88${digits.replace(/^0?/, "0")}`;
  return `https://wa.me/${intl}`;
}

type Props = {
  order: AdminOrderRow;
  onView: () => void;
  onFraud: () => void;
  onStatus: (status: string) => void;
  selected?: boolean;
  onSelectChange?: (v: boolean) => void;
};

const STATUSES = ["pending", "confirmed", "processing", "delivered", "cancelled"] as const;

export function OrderCard({ order, onView, onFraud, onStatus, selected, onSelectChange }: Props) {
  const [open, setOpen] = useState(false);
  const first = order.items[0];

  function copyAddress() {
    const text = `${order.customer_name}\n${order.phone}\n${order.address}${order.area ? `, ${order.area}` : ""}`;
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Address copied"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <article
      className={`group rounded-2xl border bg-card p-3 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md sm:p-4 ${selected ? "border-primary ring-1 ring-primary/30" : ""}`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
        {/* Left */}
        <div className="flex flex-col items-center gap-1.5">
          {onSelectChange && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => onSelectChange(e.target.checked)}
              aria-label={`Select order ${order.invoice_no ?? order.id.slice(0, 8)}`}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
          )}
          <Thumb url={first?.image} alt={first?.name ?? "Product"} className="h-14 w-14 sm:h-16 sm:w-16" />
          {order.tags.includes("new_order") && <Tag tag="new_order" />}
        </div>


        {/* Center */}
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 text-left sm:cursor-default" type="button">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] text-muted-foreground">
              {order.invoice_no ?? `#${order.id.slice(0, 8).toUpperCase()}`}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(order.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold">{order.customer_name}</div>
          <div className="truncate text-xs text-muted-foreground">{order.phone}</div>
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{order.area ? `${order.area} · ` : ""}{order.address}</span>
          </div>
          <div className="mt-1 truncate text-xs">
            {first ? `${first.name}${order.items.length > 1 ? ` +${order.items.length - 1}` : ""}` : "—"}
            <span className="text-muted-foreground"> × {order.qty}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {order.tags.filter((t) => t !== "new_order").map((t) => <Tag key={t} tag={t} />)}
          </div>
        </button>

        {/* Right */}
        <div className="flex flex-col items-end gap-1.5 text-right">
          <div className="text-base font-bold leading-tight sm:text-lg">{money(order.total)}</div>
          <div className="text-[10px] text-muted-foreground">Delivery {money(order.delivery)}</div>
          {order.profit != null && (
            <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              Profit ≈ {money(order.profit)}
            </div>
          )}
          <PaymentBadge order={order} />
          <StatusBadge status={order.status} />
          <div className="flex flex-wrap justify-end gap-1">
            <CourierBadge order={order} />
            <ParcelBadge status={order.parcel?.status} />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className={`mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5 ${open ? "" : "max-sm:hidden"}`}>
        <Action onClick={onView} icon={Eye} label="View" primary />
        <Link
          to="/admin/invoice/$orderId"
          params={{ orderId: order.id }}
          target="_blank"
          className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 hover:bg-muted"
        >
          <Printer className="h-3.5 w-3.5" /> Invoice
        </Link>
        <Link
          to="/admin/courier-orders"
          search={{ tab: "ready" }}
          className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 hover:bg-muted"
        >
          <Truck className="h-3.5 w-3.5" /> Send to Courier
        </Link>
        <CallButton
          phone={order.phone}
          customerName={order.customer_name}
          orderId={order.id}
          variant="outline"
          label="Call"
        />
        <a
          href={waLink(order.phone)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 hover:bg-muted"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
        <Action onClick={copyAddress} icon={Copy} label="Copy" />
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 hover:bg-muted">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onStatus(s)} className="text-xs capitalize">
                Mark {s}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onFraud} className="text-xs">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Fraud check
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground sm:hidden"
      >
        {open ? "Less" : "Actions"}
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
    </article>
  );
}

function Action({
  onClick, icon: Icon, label, primary,
}: { onClick: () => void; icon: any; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 ${primary ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted"}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
