// Order cards for the non-physical product types. The physical card
// (OrderCard.tsx) is untouched — these render alongside it.
import { Link } from "@tanstack/react-router";
import {
  Eye, Printer, Mail, Copy, KeyRound, Ban, CheckCircle2, MoreHorizontal,
  CalendarClock, CalendarCheck, RefreshCw, XCircle, Download, Phone,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminOrderRow, OrderKind } from "@/lib/orders-admin.functions";
import { Thumb, PaymentBadge, money } from "@/components/admin/orders/OrderCard";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const TYPE_LABEL: Record<OrderKind, string> = {
  physical: "Physical",
  digital: "Digital",
  service: "Service",
  subscription: "Subscription",
};

const TYPE_TONE: Record<OrderKind, string> = {
  physical: "bg-muted text-muted-foreground",
  digital: "bg-violet-500/12 text-violet-700 dark:text-violet-400",
  service: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  subscription: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
};

export function TypeBadge({ type }: { type: OrderKind }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${TYPE_TONE[type]}`}>
      {TYPE_LABEL[type]}
    </span>
  );
}

export function ConfirmationBadge({ status }: { status: string }) {
  const ok = status === "confirmed";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
        ok
          ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400"
          : "bg-amber-500/12 text-amber-700 ring-amber-500/20 dark:text-amber-400"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ok ? "Confirmed" : "Pending"}
    </span>
  );
}

export function AccessBadge({ order }: { order: AdminOrderRow }) {
  const a = order.access;
  if (!a) return <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">No access</span>;
  const tone =
    a.status === "active"
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
      : a.status === "revoked"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  const label = a.status === "active" ? "Access granted" : a.status === "revoked" ? "Access disabled" : "Locked";
  return <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{label}</span>;
}

export type TypeCardActions = {
  onView: () => void;
  onConfirm: () => void;
  onGrantAccess?: () => void;
  onResendEmail?: () => void;
  onRefund?: () => void;
  onSchedule?: () => void;
  onComplete?: () => void;
  onExtend?: () => void;
  onCancel?: () => void;
};

function Btn({
  onClick, icon: Icon, label, primary, disabled,
}: { onClick?: () => void; icon: any; label: string; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 disabled:opacity-50 ${
        primary ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15" : "hover:bg-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function InvoiceLink({ id }: { id: string }) {
  return (
    <Link
      to="/admin/invoice/$orderId"
      params={{ orderId: id }}
      target="_blank"
      className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors duration-150 hover:bg-muted"
    >
      <Printer className="h-3.5 w-3.5" /> Invoice
    </Link>
  );
}

function Shell({
  order, right, children, actions,
}: { order: AdminOrderRow; right: React.ReactNode; children: React.ReactNode; actions: React.ReactNode }) {
  const invoice = order.invoice_no ?? `#${order.id.slice(0, 8).toUpperCase()}`;
  const when = new Date(order.created_at).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <article className="group rounded-2xl border bg-card p-3 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md sm:p-4 lg:rounded-xl lg:px-3 lg:py-2">
      {/* Desktop: compact single row */}
      <div className="hidden lg:grid lg:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1.3fr)_auto_auto_minmax(0,1.4fr)] lg:items-center lg:gap-4">
        <div className="flex flex-col items-center gap-1">
          <Thumb url={order.items[0]?.image} alt={order.items[0]?.name ?? "Product"} className="h-12 w-12" />
          <TypeBadge type={order.order_type} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{order.customer_name}</div>
          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" /> {order.phone}
          </div>
          {order.email && <div className="truncate text-[11px] text-muted-foreground">{order.email}</div>}
          <div className="font-mono text-[10px] text-muted-foreground">{invoice} · {when}</div>
        </div>
        <div className="min-w-0 [&>div:first-child]:mt-0">{children}</div>
        <div className="flex flex-col items-start gap-1">{right}</div>
        <div className="flex flex-col items-end gap-1 text-right">
          <div className="text-base font-bold leading-tight">{money(order.total)}</div>
          <PaymentBadge order={order} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 [&_a]:h-7 [&_a]:px-2 [&_button]:h-7 [&_button]:px-2">{actions}</div>
      </div>

      {/* Mobile / tablet: unchanged */}
      <div className="lg:hidden">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <Thumb url={order.items[0]?.image} alt={order.items[0]?.name ?? "Product"} className="h-14 w-14 sm:h-16 sm:w-16" />
          <TypeBadge type={order.order_type} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] text-muted-foreground">{invoice}</span>
            <span className="text-[11px] text-muted-foreground">{when}</span>
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold">{order.customer_name}</div>
          {order.email && <div className="truncate text-xs text-muted-foreground">{order.email}</div>}
          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" /> {order.phone}
          </div>
          {children}
        </div>
        <div className="flex flex-col items-end gap-1.5 text-right">
          <div className="text-base font-bold leading-tight sm:text-lg">{money(order.total)}</div>
          <PaymentBadge order={order} />
          {right}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-2.5">{actions}</div>
      </div>
    </article>
  );
}

export function DigitalOrderCard({ order, a }: { order: AdminOrderRow; a: TypeCardActions }) {
  const first = order.items[0];
  function copyLink() {
    const url = `${window.location.origin}/admin/orders?order=${order.id}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("Download link copied"),
      () => toast.error("Copy failed"),
    );
  }
  return (
    <Shell
      order={order}
      right={
        <>
          <ConfirmationBadge status={order.confirmation_status} />
          <AccessBadge order={order} />
          {order.access && (
            <div className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Download className="h-3 w-3" /> {order.access.downloads} downloads
            </div>
          )}
        </>
      }
      actions={
        <>
          <Btn onClick={a.onView} icon={Eye} label="View" primary />
          <InvoiceLink id={order.id} />
          <Btn
            onClick={a.onGrantAccess}
            icon={CheckCircle2}
            label="Grant Access"
            disabled={order.access?.status === "active"}
          />
          <Btn onClick={a.onResendEmail} icon={Mail} label="Resend Email" />
          <Btn onClick={copyLink} icon={Copy} label="Copy Link" />
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs hover:bg-muted">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {order.confirmation_status !== "confirmed" && (
                <DropdownMenuItem onClick={a.onConfirm} className="text-xs">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirm order
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={a.onRefund} className="text-xs">
                <Ban className="mr-1.5 h-3.5 w-3.5" /> Refund / cancel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={a.onView} className="text-xs">
                <KeyRound className="mr-1.5 h-3.5 w-3.5" /> License & logs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <div className="mt-1 truncate text-xs">
        {first ? `${first.name}${order.items.length > 1 ? ` +${order.items.length - 1}` : ""}` : "—"}
      </div>
    </Shell>
  );
}

export function ServiceOrderCard({ order, a }: { order: AdminOrderRow; a: TypeCardActions }) {
  const f = order.fulfillment ?? {};
  const rawState = f.service_state;
  const state =
    typeof rawState === "string"
      ? rawState
      : rawState && typeof rawState === "object"
        ? typeof rawState.stage === "string"
          ? rawState.stage
          : rawState.cancel_requested
            ? "cancel_requested"
            : "requested"
        : "requested";
  const done = state === "completed";
  return (
    <Shell
      order={order}
      right={
        <>
          <ConfirmationBadge status={order.confirmation_status} />
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
            {state.replace(/_/g, " ")}
          </span>
        </>
      }
      actions={
        <>
          <Btn onClick={a.onView} icon={Eye} label="View" primary />
          <Btn onClick={a.onSchedule} icon={CalendarClock} label="Schedule" />
          <Btn onClick={a.onConfirm} icon={CheckCircle2} label="Confirm" disabled={order.confirmation_status === "confirmed"} />
          <Btn onClick={a.onComplete} icon={CalendarCheck} label="Complete" disabled={done} />
          <InvoiceLink id={order.id} />
        </>
      }
    >
      <div className="mt-1 truncate text-xs">{order.items[0]?.name ?? "Service"}</div>
      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarClock className="h-3 w-3" />
        {f.booking_date ? `${f.booking_date}${f.booking_time ? ` · ${f.booking_time}` : ""}` : "Not scheduled"}
      </div>
      {f.staff && <div className="text-[11px] text-muted-foreground">Staff: {f.staff}</div>}
    </Shell>
  );
}

export function SubscriptionOrderCard({ order, a }: { order: AdminOrderRow; a: TypeCardActions }) {
  const f = order.fulfillment ?? {};
  const state = f.subscription_state ?? "pending";
  return (
    <Shell
      order={order}
      right={
        <>
          <ConfirmationBadge status={order.confirmation_status} />
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
            {state}
          </span>
        </>
      }
      actions={
        <>
          <Btn onClick={a.onView} icon={Eye} label="View" primary />
          <Btn onClick={a.onExtend} icon={RefreshCw} label="Extend" />
          <Btn onClick={a.onConfirm} icon={CheckCircle2} label="Confirm" disabled={order.confirmation_status === "confirmed"} />
          <Btn onClick={a.onCancel} icon={XCircle} label="Cancel" disabled={state === "cancelled"} />
          <InvoiceLink id={order.id} />
        </>
      }
    >
      <div className="mt-1 truncate text-xs">{f.plan ?? order.items[0]?.name ?? "Subscription"}</div>
      <div className="mt-0.5 text-xs capitalize text-muted-foreground">
        {(f.billing_cycle ?? "monthly").replace(/_/g, " ")} ·{" "}
        {f.renewal_at ? `renews ${new Date(f.renewal_at).toLocaleDateString()}` : "no renewal date"}
      </div>
    </Shell>
  );
}
