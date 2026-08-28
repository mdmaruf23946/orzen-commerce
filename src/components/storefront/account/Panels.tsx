// Active services, notifications, payment methods, privacy and support panels.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  CreditCard,
  LifeBuoy,
  Mail,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { listMyOrders, listMyNotifications, listMyPaymentMethods, getMyAccountSummary } from "@/lib/customer-account.functions";
import { paymentTone, statusTone, taka } from "@/lib/order-display";
import { EmptyState } from "./EmptyState";

export function ActiveServicesPanel({ slug, token }: { slug: string; token: string }) {
  const listFn = useServerFn(listMyOrders);
  const { data, isLoading } = useQuery({
    queryKey: ["my-services", slug, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token, type: "service" as const } }),
  });
  const rows = ((data ?? []) as any[]).filter((o) => o.status !== "cancelled");

  if (isLoading) return <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>;
  if (rows.length === 0)
    return <EmptyState title="No active services." icon={<Wrench className="h-5 w-5" />} />;

  return (
    <ul className="space-y-3">
      {rows.map((o) => (
        <li key={o.id} className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{o.product_name}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                {new Date(o.created_at).toLocaleDateString()} · {taka(o.total)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${statusTone(o.status)}`}
            >
              {o.status}
            </span>
          </div>
          <Link
            to="/store/$slug/order/$orderId"
            params={{ slug, orderId: o.id }}
            className="mt-3 inline-flex rounded-full bg-sf-accent px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-sf-accent-hover"
          >
            Manage service
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NotificationsPanel({ slug, token }: { slug: string; token: string }) {
  const listFn = useServerFn(listMyNotifications);
  const { data, isLoading } = useQuery({
    queryKey: ["my-notifications", slug, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token } }),
  });
  const rows = (data ?? []) as any[];

  if (isLoading) return <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>;
  if (rows.length === 0)
    return <EmptyState title="No notifications yet." icon={<Bell className="h-5 w-5" />} />;

  return (
    <ul className="divide-y divide-neutral-100">
      {rows.map((n) => (
        <li key={n.id} className="flex gap-3 py-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600">
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900">{n.title}</p>
            {n.body && <p className="text-xs text-neutral-600">{n.body}</p>}
            <p className="mt-0.5 text-[11px] text-neutral-400">
              {new Date(n.created_at).toLocaleString()}
            </p>
          </div>
          {n.order_id && (
            <Link
              to="/store/$slug/order/$orderId"
              params={{ slug, orderId: n.order_id }}
              className="self-center text-[11px] font-semibold text-neutral-900 hover:underline"
            >
              View
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function PaymentMethodsPanel({ slug, token }: { slug: string; token: string }) {
  const listFn = useServerFn(listMyPaymentMethods);
  const { data, isLoading } = useQuery({
    queryKey: ["my-payment-methods", slug, token],
    queryFn: () => listFn({ data: { storeSlug: slug, token } }),
  });
  const rows = (data ?? []) as any[];

  if (isLoading) return <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>;
  if (rows.length === 0)
    return (
      <EmptyState
        title="No payment methods used yet."
        hint="Methods you pay with will be listed here."
        icon={<CreditCard className="h-5 w-5" />}
      />
    );

  return (
    <ul className="space-y-2">
      {rows.map((m) => (
        <li
          key={m.label}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3"
        >
          <CreditCard className="h-4 w-4 text-neutral-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold capitalize text-neutral-900">{m.label}</p>
            <p className="text-[11px] text-neutral-500">
              Used {m.uses} time{m.uses === 1 ? "" : "s"} · last{" "}
              {new Date(m.last_used).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${paymentTone(m.paid > 0 ? "paid" : "pending")}`}
          >
            {m.paid > 0 ? "paid" : "pending"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PrivacyPanel({
  slug,
  onChangePassword,
}: {
  slug: string;
  onChangePassword: () => void;
}) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
        <div>
          <p className="font-semibold text-neutral-900">Account security</p>
          <p className="text-xs text-neutral-500">
            Your session is stored only on this device and is scoped to this store.
          </p>
          <button
            type="button"
            onClick={onChangePassword}
            className="mt-2 rounded-full bg-sf-accent px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-sf-accent-hover"
          >
            Change password
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-neutral-200 p-3">
        <p className="font-semibold text-neutral-900">Your data</p>
        <p className="text-xs text-neutral-500">
          We only keep the details needed to process your orders for {slug}.
        </p>
        <a
          href="/data-deletion"
          className="mt-2 inline-flex text-xs font-semibold text-rose-600 underline hover:text-rose-700"
        >
          Request data deletion
        </a>
      </div>
    </div>
  );
}

export function SupportPanel({ slug, token }: { slug: string; token: string }) {
  const sumFn = useServerFn(getMyAccountSummary);
  const { data } = useQuery({
    queryKey: ["my-account-summary", slug, token],
    queryFn: () => sumFn({ data: { storeSlug: slug, token } }),
  });
  const s = (data as any)?.support ?? {};

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3">
        <LifeBuoy className="h-4 w-4 text-neutral-500" />
        <span className="text-neutral-700">Need help with an order? Reach out to {s.name ?? "the store"}.</span>
      </div>
      {s.phone && (
        <a
          href={`tel:${s.phone}`}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 hover:bg-neutral-50"
        >
          <Phone className="h-4 w-4 text-neutral-500" /> {s.phone}
        </a>
      )}
      {s.email && (
        <a
          href={`mailto:${s.email}`}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 hover:bg-neutral-50"
        >
          <Mail className="h-4 w-4 text-neutral-500" /> {s.email}
        </a>
      )}
      {s.facebook && (
        <a
          href={s.facebook}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 hover:bg-neutral-50"
        >
          <LifeBuoy className="h-4 w-4 text-neutral-500" /> Message on Facebook
        </a>
      )}
      {!s.phone && !s.email && !s.facebook && (
        <EmptyState title="No support channels published yet." icon={<LifeBuoy className="h-5 w-5" />} />
      )}
    </div>
  );
}
