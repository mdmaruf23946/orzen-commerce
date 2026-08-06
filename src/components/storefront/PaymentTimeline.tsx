import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, CheckCircle2, XCircle, Clock, Info, Wallet } from "lucide-react";
import { getOrderPaymentTimeline } from "@/lib/storefront.functions";
import { isCodMethod } from "@/lib/order-display";

/** Cash on delivery has no gateway: show a plain, honest status card. */
function CodPaymentCard({ paid, refunded }: { paid: boolean; refunded: boolean }) {
  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <Wallet className="h-3 w-3" /> Payment status
      </div>
      <p
        className={`text-sm font-semibold ${
          refunded ? "text-sky-600" : paid ? "text-emerald-600" : "text-amber-600"
        }`}
      >
        {refunded ? "Refunded" : paid ? "Paid" : "Pay on Delivery"}
      </p>
      <div className="mt-1 text-xs text-muted-foreground">Payment method: Cash on Delivery</div>
      {!paid && !refunded && (
        <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
          ডেলিভারির সময় পণ্য বুঝে নিয়ে পেমেন্ট করবেন। · Payment will be collected in cash when
          your order is delivered.
        </p>
      )}
      {paid && (
        <p className="mt-3 rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
          Cash payment received. Thank you!
        </p>
      )}
    </div>
  );
}


const STATUS_TEXT: Record<string, string> = {
  paid: "পেমেন্ট সফল হয়েছে",
  failed: "পেমেন্ট ব্যর্থ হয়েছে",
  cancelled: "পেমেন্ট বাতিল করা হয়েছে",
  refunded: "পেমেন্ট ফেরত দেওয়া হয়েছে",
  expired: "পেমেন্টের সময় শেষ হয়েছে",
  pending: "পেমেন্ট এখনও নিশ্চিত হয়নি",
  processing: "পেমেন্ট যাচাই করা হচ্ছে",
};

function tone(ok: boolean | null | undefined) {
  if (ok === true) return "text-emerald-600";
  if (ok === false) return "text-destructive";
  return "text-muted-foreground";
}

function Icon({ ok }: { ok: boolean | null }) {
  if (ok === true) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (ok === false) return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

export function PaymentTimeline({ orderId, refreshKey }: { orderId: string; refreshKey?: string }) {
  const fn = useServerFn(getOrderPaymentTimeline);
  const { data } = useQuery({
    queryKey: ["order-payment-timeline", orderId, refreshKey ?? ""],
    queryFn: () => fn({ data: { orderId } }),
  });

  if (!data) return null;
  const paid = data.payment_status === "paid";
  const failed = ["failed", "cancelled", "expired"].includes(data.payment_status);
  const lastMessage = [...data.events].reverse().find((e) => e.message)?.message ?? null;

  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <CreditCard className="h-3 w-3" /> Payment status
      </div>

      <p className={`text-sm font-semibold ${paid ? "text-emerald-600" : failed ? "text-destructive" : "text-amber-600"}`}>
        {STATUS_TEXT[data.payment_status] ?? data.payment_status}
      </p>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {data.gateway_label && <div>Gateway: {data.gateway_label}</div>}
        <div>Method: {String(data.payment_method).toUpperCase()}</div>
        {data.reference && (
          <div>
            Reference: <span className="font-mono">{data.reference}</span>
          </div>
        )}
      </div>

      {lastMessage && !paid && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{lastMessage}</span>
        </div>
      )}

      <ol className="mt-4 space-y-3">
        <li className="flex items-start gap-3">
          <Icon ok={true} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">পেমেন্ট শুরু হয়েছে</p>
            <p className="text-xs text-muted-foreground">{new Date(data.initiated_at).toLocaleString()}</p>
          </div>
        </li>

        {data.events.map((e, i) => (
          <li key={i} className="flex items-start gap-3">
            <Icon ok={e.ok} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${tone(e.ok)}`}>
                {e.source} — {String(e.status ?? "update").toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.at).toLocaleString()}
                {e.amount != null ? ` · ${e.currency ?? "BDT"} ${e.amount}` : ""}
              </p>
              {e.message && <p className="mt-0.5 text-xs text-destructive">{e.message}</p>}
            </div>
          </li>
        ))}

        {data.settled_at && (
          <li className="flex items-start gap-3">
            <Icon ok={true} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-600">পেমেন্ট নিশ্চিত হয়েছে</p>
              <p className="text-xs text-muted-foreground">{new Date(data.settled_at).toLocaleString()}</p>
            </div>
          </li>
        )}

        {data.events.length === 0 && !paid && (
          <li className="text-xs text-muted-foreground">
            গেটওয়ে থেকে এখনও কোনো আপডেট আসেনি। নিশ্চিত হলে এই পেজে স্ট্যাটাস আপডেট হবে।
          </li>
        )}
      </ol>
    </div>
  );
}
