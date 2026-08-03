import { Link } from "@tanstack/react-router";
import { CheckCircle2, RefreshCw, CalendarClock, ReceiptText, ShoppingBag } from "lucide-react";

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function SubscriptionOrderView({ order, slug }: { order: any; slug: string }) {
  const meta = (order.fulfillment_meta ?? {}) as any;
  const sub = meta.subscription ?? {};
  const paid = order.payment_status === "paid";
  const total =
    Number(order.subtotal ?? 0) + Number(order.delivery_amount ?? 0) - Number(order.discount_amount ?? 0);

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-3 text-2xl font-semibold">{paid ? "Subscription active" : "Subscription created"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {paid ? "Your plan is ready to use." : "We'll activate your plan as soon as the payment is confirmed."}
        </p>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <RefreshCw className="h-3 w-3" /> Subscription
        </div>
        <Row label="Plan" value={sub.plan_name ?? (order.items as any[])?.[0]?.name_snapshot} />
        <Row label="Status" value={(sub.status ?? (paid ? "active" : "pending")).toUpperCase()} />
        <Row label="Billing cycle" value={sub.billing_cycle ? String(sub.billing_cycle).replace(/_/g, " ") : null} />
        <Row label="Started" value={new Date(order.created_at).toLocaleDateString()} />
        <Row label="Renewal date" value={sub.renews_at ? new Date(sub.renews_at).toLocaleDateString() : null} />
        <Row label="Next payment" value={sub.next_amount ? `৳${Number(sub.next_amount).toFixed(0)}` : `৳${total.toFixed(0)}`} />
        <Row label="Trial ends" value={sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : null} />
        <Row label="Renewal mode" value={sub.renewal_mode} />
      </div>

      {Array.isArray(sub.usage) && sub.usage.length > 0 && (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <div className="mb-2 text-xs uppercase text-muted-foreground">Usage</div>
          {sub.usage.map((u: any, i: number) => (
            <Row key={i} label={u.metric} value={u.unlimited ? "Unlimited" : `${u.used ?? 0} / ${u.limit}`} />
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <ReceiptText className="h-3 w-3" /> Payment
        </div>
        <Row label="Status" value={String(order.payment_status ?? "pending").toUpperCase()} />
        <Row label="Amount" value={`৳${total.toFixed(0)}`} />
        <Row label="Method" value={String(order.payment_method ?? "").toUpperCase()} />
        <Row label="Transaction ID" value={order.txn_id ? <span className="font-mono">{order.txn_id}</span> : null} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={`/api/invoice/${order.id}`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium">
          <ReceiptText className="h-4 w-4" /> Invoice
        </a>
        <Link to="/store/$slug/account" params={{ slug }} search={{ tab: "orders" as any }}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium">
          <CalendarClock className="h-4 w-4" /> Manage subscription
        </Link>
        <Link to="/store/$slug" params={{ slug }}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-md border text-sm font-medium">
          <ShoppingBag className="h-4 w-4" /> Continue shopping
        </Link>
      </div>
    </div>
  );
}
