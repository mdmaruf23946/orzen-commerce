// Premium order card + shared badges for the Merchant Panel → Orders screen.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CallButton } from "@/components/admin/calls/CallButton";
import {
  Eye, Printer, Truck, Lock, MessageCircle, Copy,
  ImageOff, ChevronDown, ShieldCheck, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { COURIERS } from "@/components/admin/couriers/providers";
import { STATUS_LABEL, STATUS_TONE, type ParcelStatus } from "@/lib/couriers/status";
import type { AdminOrderRow } from "@/lib/orders-admin.functions";
import { getCachedFraudCheck } from "@/lib/fraud.functions";
import { orderSourceInfo } from "@/lib/external-sites";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel,
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

const VOICE_BADGE: Record<string, [string, string]> = {
  verified: ["AI Verified", "bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400"],
  cancelled: ["Cancelled by call", "bg-destructive/10 text-destructive ring-destructive/30"],
  needs_agent: ["Needs agent", "bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-400"],
  unanswered: ["Unanswered", "bg-muted text-muted-foreground ring-border"],
};

export function VoiceBadge({ v }: { v?: string | null }) {
  const b = v ? VOICE_BADGE[v] : null;
  if (!b) return null;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${b[1]}`}>{b[0]}</span>;
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

export function SourceBadge({ order }: { order: AdminOrderRow }) {
  const info = orderSourceInfo(order.source, order.source_site?.site_type, order.source_site?.name);
  return (
    <span title={`Order from ${info.label}`} className={`max-w-[160px] truncate rounded-md px-2 py-0.5 text-[10px] font-semibold ${info.tone}`}>
      {info.label}
    </span>
  );
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
  couriers?: { key: string; isDefault?: boolean }[];
  onCourier?: (key: string) => void;
  fraudPreview?: boolean;
};

export const STATUSES = ["pending", "no_response", "on_hold", "incomplete", "confirmed", "processing", "delivered", "cancelled"] as const;
const ORDER_LABEL: Record<string, string> = {
  pending: "Pending", no_response: "No Response", on_hold: "On Hold", incomplete: "Incomplete",
  confirmed: "Confirmed", processing: "Processing", delivered: "Delivered", cancelled: "Cancelled",
};
/** Statuses the merchant may pick next from the current one (backend enforces the same). */
export function nextStatuses(cur: string): string[] {
  if (cur === "pending" || cur === "no_response" || cur === "on_hold" || cur === "incomplete")
    return ["pending", "no_response", "on_hold", "incomplete", "confirmed", "cancelled"].filter((s) => s !== cur);
  if (cur === "confirmed") return ["processing", "cancelled"];
  if (cur === "processing") return ["confirmed", "cancelled"];
  return [];
}
const BTN = "inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 hover:bg-muted";

/** Read-only preview of the last saved fraud report (never triggers a new check). */
export function FraudSummary({ phone }: { phone: string }) {
  const fn = useServerFn(getCachedFraudCheck);
  const { data } = useQuery({
    queryKey: ["fraud-cached", phone],
    queryFn: () => fn({ data: { phone } }),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const d: any = data;
  if (!d) return null;
  const total = Number(d.total_orders ?? 0);
  const ok = Number(d.successful ?? 0);
  const bad = Number(d.cancelled ?? 0);
  const cancelRate = total > 0 ? Math.round((bad / total) * 100) : 0;
  const risk = d.risk as "safe" | "medium" | "high" | undefined;
  const tone =
    risk === "high" ? "bg-destructive/10 text-destructive"
    : risk === "medium" ? "bg-amber-500/12 text-amber-700 dark:text-amber-400"
    : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400";
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/50 px-2.5 py-1.5 text-[11px]">
      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
      <span>Total <b>{total}</b></span>
      <span className="text-emerald-600 dark:text-emerald-400">Delivered <b>{ok}</b></span>
      <span className="text-destructive">Cancelled <b>{bad}</b></span>
      {total > 0 && <span className="text-muted-foreground">Cancel {cancelRate}%</span>}
      {risk && (
        <span className={`ml-auto rounded-md px-1.5 py-0.5 font-semibold ${tone}`}>
          {risk === "safe" ? "Safe" : risk === "medium" ? "Medium Risk" : "High Risk"}
        </span>
      )}
    </div>
  );
}

export function OrderCard({ order, onView, onFraud, onStatus, selected, onSelectChange, couriers = [], onCourier, fraudPreview }: Props) {
  const first = order.items[0];
  const cur = order.status === "pending" && order.followup_status ? order.followup_status : order.status;

  function copyAddress() {
    const text = `${order.customer_name}\n${order.phone}\n${order.address}${order.area ? `, ${order.area}` : ""}`;
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Address copied"),
      () => toast.error("Copy failed"),
    );
  }

  const statusControl = order.locked || nextStatuses(cur).length === 0 ? (
    <span
      title={order.locked ? "কুরিয়ার গ্রহণ করেছে — অর্ডার লক" : undefined}
      className={`inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset ${ORDER_STATUS_TONE[order.status] ?? "bg-muted ring-border"}`}
    >
      {order.locked && <Lock className="h-3 w-3" />} {order.locked ? "Locked" : ORDER_LABEL[cur] ?? cur}
    </span>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors ${ORDER_STATUS_TONE[order.status] ?? "bg-muted ring-border"}`}
      >
        {ORDER_LABEL[cur] ?? cur}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {nextStatuses(cur).map((s) => (
          <DropdownMenuItem key={s} onClick={() => onStatus(s)} className="text-xs">
            <span className={`mr-2 h-2 w-2 rounded-full ${ORDER_STATUS_TONE[s]?.split(" ")[0] ?? "bg-muted-foreground"}`} />
            {ORDER_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const invoiceLabel = order.invoice_no ?? `#${order.id.slice(0, 8).toUpperCase()}`;
  const when = new Date(order.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const ICON = "grid h-7 w-7 place-items-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <article
      className={`group rounded-2xl border bg-card p-3 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md sm:p-4 lg:rounded-xl lg:px-3 lg:py-2.5 ${selected ? "border-primary ring-1 ring-primary/30" : ""}`}
    >
      {/* Desktop: compact single-row layout */}
      <div className="hidden lg:grid lg:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] lg:items-center lg:gap-4">
        <div className="flex items-center gap-2.5">
          {onSelectChange && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => onSelectChange(e.target.checked)}
              aria-label={`Select order ${invoiceLabel}`}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
          )}
          <Thumb url={first?.image} alt={first?.name ?? "Product"} className="h-12 w-12" />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{order.customer_name}</span>
            {order.tags.includes("new_order") && <Tag tag="new_order" />}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">{order.phone}</span>
            <CallButton phone={order.phone} customerName={order.customer_name} orderId={order.id} variant="icon" label="Call" />
            <a href={waLink(order.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md border text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
              <MessageCircle className="h-3 w-3" />
            </a>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">{invoiceLabel} · {when}</div>
        </div>

        <div className="min-w-0">
          <div className="truncate text-xs font-medium">
            {first ? `${first.name}${order.items.length > 1 ? ` +${order.items.length - 1}` : ""}` : "—"}
            <span className="text-muted-foreground"> × {order.qty}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={order.address}>
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{order.area ? `${order.area} · ` : ""}{order.address}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {order.tags.filter((t) => t !== "new_order").map((t) => <Tag key={t} tag={t} />)}
            <VoiceBadge v={order.voice_verification} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-start gap-1">
          <div className="flex flex-wrap gap-1">
            <CourierBadge order={order} />
            <ParcelBadge status={order.parcel?.status} />
          </div>
          <PaymentBadge order={order} />
          <SourceBadge order={order} />
        </div>

        <div className="text-right">
          <div className="text-base font-bold leading-tight">{money(order.total)}</div>
          <div className="text-[10px] text-muted-foreground">Delivery {money(order.delivery)}</div>
          {order.profit != null && (
            <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Profit ≈ {money(order.profit)}</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {statusControl}
          <div className="flex items-center gap-1">
            <button type="button" onClick={onView} title="View" aria-label="View"
              className="grid h-7 w-7 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15">
              <Eye className="h-3.5 w-3.5" />
            </button>
            <Link to="/admin/invoice/$orderId" params={{ orderId: order.id }} target="_blank" title="Invoice" aria-label="Invoice" className={ICON}>
              <Printer className="h-3.5 w-3.5" />
            </Link>
            <button type="button" onClick={copyAddress} title="Copy address" aria-label="Copy address" className={ICON}>
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onFraud} title="Fraud Check" aria-label="Fraud Check" className={ICON}>
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {fraudPreview && <div className="hidden lg:block"><FraudSummary phone={order.phone} /></div>}

      {/* Mobile / tablet: unchanged layout */}
      <div className="lg:hidden">
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
        <div className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] text-muted-foreground">
              {order.invoice_no ?? `#${order.id.slice(0, 8).toUpperCase()}`}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(order.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold">{order.customer_name}</div>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{order.phone}</span>
            <CallButton
              phone={order.phone}
              customerName={order.customer_name}
              orderId={order.id}
              variant="icon"
              label="Call"
            />
            <a
              href={waLink(order.phone)}
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              title="WhatsApp"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          </div>
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
        </div>

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
          <SourceBadge order={order} />
          <StatusBadge status={order.status} />
          {order.followup_status && (
            <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">{ORDER_LABEL[order.followup_status]}</span>
          )}
          <VoiceBadge v={order.voice_verification} />
          <div className="flex flex-wrap justify-end gap-1">
            <CourierBadge order={order} />
            <ParcelBadge status={order.parcel?.status} />
          </div>
        </div>
      </div>

      {fraudPreview && <FraudSummary phone={order.phone} />}

      {/* Exactly 6 actions */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 border-t pt-2.5 sm:flex sm:flex-wrap sm:items-center">
        <Action onClick={onView} icon={Eye} label="View" primary />
        <Link
          to="/admin/invoice/$orderId"
          params={{ orderId: order.id }}
          target="_blank"
          className={BTN}
        >
          <Printer className="h-3.5 w-3.5" /> Invoice
        </Link>
        <Action onClick={copyAddress} icon={Copy} label="Copy" />
        <Action onClick={onFraud} icon={ShieldCheck} label="Fraud Check" />
        {order.locked || nextStatuses(cur).length === 0 ? (
          <span
            title={order.locked ? "কুরিয়ার গ্রহণ করেছে — অর্ডার লক" : undefined}
            className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset ${ORDER_STATUS_TONE[order.status] ?? "bg-muted ring-border"}`}
          >
            {order.locked && <Lock className="h-3 w-3" />} {order.locked ? "Locked" : ORDER_LABEL[cur] ?? cur}
          </span>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset transition-colors ${ORDER_STATUS_TONE[order.status] ?? "bg-muted ring-border"}`}
            >
              {ORDER_LABEL[cur] ?? cur}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {nextStatuses(cur).map((s) => (
                <DropdownMenuItem key={s} onClick={() => onStatus(s)} className="text-xs">
                  <span className={`mr-2 h-2 w-2 rounded-full ${ORDER_STATUS_TONE[s]?.split(" ")[0] ?? "bg-muted-foreground"}`} />
                  {ORDER_LABEL[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      </div>
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
      className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 ${primary ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted"}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
