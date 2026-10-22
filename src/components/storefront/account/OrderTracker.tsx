// Instant Order Tracker — search by Order ID or phone number.
// Used on the public /track-order page and inside the account Orders tab.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  PackageCheck,
  CheckCircle2,
  Circle,
  Truck,
  Box,
  ClipboardList,
  Loader2,
  XCircle,
} from "lucide-react";
import { trackOrderPublic } from "@/lib/storefront.functions";
import { taka } from "@/lib/order-display";

const STAGE_META: Record<string, { label: string; icon: any }> = {
  placed: { label: "Placed", icon: ClipboardList },
  confirmed: { label: "Confirmed", icon: CheckCircle2 },
  packed: { label: "Packed", icon: Box },
  shipped: { label: "Shipped", icon: Truck },
  delivered: { label: "Delivered", icon: PackageCheck },
};

export function OrderTracker({
  slug,
  initialQuery = "",
  compact = false,
  showDetailLink = false,
}: {
  slug: string;
  initialQuery?: string;
  compact?: boolean;
  showDetailLink?: boolean;
}) {
  const trackFn = useServerFn(trackOrderPublic);
  const [value, setValue] = useState(initialQuery);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q.length < 2 || phone.replace(/\D/g, "").length < 9) {
      setError("Enter your Order ID and the phone number used for the order.");
      setOrders(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res: any = await trackFn({ data: { slug, query: q, phone: phone.trim() } });
      if (!res?.ok) {
        setOrders(null);
        setError(res?.error ?? "No order found.");
      } else {
        setOrders(res.orders);
      }
    } catch (err) {
      setOrders(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border border-black/5 bg-white shadow-sm ${compact ? "p-3.5" : "p-5"}`}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-sf-accent-soft text-sf-accent">
            <Truck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-neutral-900">Instant Order Tracker</h2>
            <p className="text-[11px] text-neutral-500">
              Enter your Order ID and the phone number used at checkout.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Order ID (e.g. #1002)"
              className="h-11 w-full rounded-full border border-neutral-200 bg-white pl-9 pr-4 text-sm outline-none transition focus:border-sf-accent focus:ring-2 focus:ring-sf-accent/20"
            />
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="Phone number"
            className="h-11 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm outline-none transition focus:border-sf-accent focus:ring-2 focus:ring-sf-accent/20 sm:w-44"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-sf-accent px-6 text-sm font-bold text-white shadow-sm transition hover:bg-sf-accent-hover disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Track Order
          </button>
        </form>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
            <XCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}
      </div>

      {orders?.map((o) => (
        <div key={o.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-mono text-sm font-bold text-neutral-900">#{o.ref}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                {new Date(o.created_at).toLocaleString()} · {o.customer_name} · {o.phone}
                {o.area ? ` · ${o.area}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-neutral-900">{taka(o.total)}</div>
              <span
                className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${
                  o.payment_status === "paid"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : "bg-amber-50 text-amber-700 ring-amber-200"
                }`}
              >
                {o.payment_status}
              </span>
            </div>
          </div>

          {o.cancelled ? (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
              This order was cancelled.
            </p>
          ) : (
            <ol className="mt-4 space-y-0">
              {o.timeline.map((s: any, i: number) => {
                const meta = STAGE_META[s.stage];
                const Icon = s.done ? meta.icon : Circle;
                const last = i === o.timeline.length - 1;
                return (
                  <li key={s.stage} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full ${
                          s.done ? "bg-sf-accent text-white" : "bg-neutral-100 text-neutral-400"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {!last && (
                        <span
                          className={`w-px flex-1 ${s.done ? "bg-sf-accent/40" : "bg-neutral-200"}`}
                        />
                      )}
                    </div>
                    <div className={`pb-4 ${last ? "pb-0" : ""}`}>
                      <div
                        className={`text-xs font-semibold ${s.done ? "text-neutral-900" : "text-neutral-400"}`}
                      >
                        {meta.label}
                      </div>
                      {s.at && (
                        <div className="text-[10px] text-neutral-500">
                          {new Date(s.at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {(o.courier_name || o.courier_tracking_id) && (
            <div className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
              <span className="font-semibold text-neutral-800">Shipping:</span>{" "}
              {o.courier_name ?? "Courier"}
              {o.courier_tracking_id ? ` · ${o.courier_tracking_id}` : ""}
              {o.courier_status ? ` · ${o.courier_status}` : ""}
            </div>
          )}

          {showDetailLink && (
            <Link
              to="/store/$slug/order/$orderId"
              params={{ slug, orderId: o.id }}
              className="mt-3 inline-flex text-xs font-semibold text-sf-accent hover:underline"
            >
              View full details →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
