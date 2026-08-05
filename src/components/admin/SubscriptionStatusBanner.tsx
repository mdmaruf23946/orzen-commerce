import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myBillingStatus } from "@/lib/billing.functions";

export function SubscriptionStatusBanner() {
  const fn = useServerFn(myBillingStatus);
  const { data } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
  const store = (data?.store ?? null) as any;
  if (!store) return null;
  const status = store.subscription_status ?? "active";
  const days = data?.days_left ?? 0;

  let tone = "";
  let msg: React.ReactNode = null;

  if (status === "suspended") {
    tone = "bg-red-50 text-red-900 border-red-200";
    msg = <>Your store is <strong>suspended</strong> by the platform owner. Contact support to reactivate.</>;
  } else if (status === "expired" || status === "cancelled") {
    tone = "bg-red-50 text-red-900 border-red-200";
    msg = <>Your subscription has <strong>expired</strong>. Your store is read-only — renew to continue selling.</>;
  } else if (status === "trialing") {
    tone = days <= 1 ? "bg-amber-50 text-amber-900 border-amber-200" : "bg-blue-50 text-blue-900 border-blue-200";
    msg = <>You're on a free trial — <strong>{days} day{days === 1 ? "" : "s"} left</strong>. Upgrade anytime to keep premium features.</>;
  } else if (days > 0 && days <= 3) {
    tone = "bg-amber-50 text-amber-900 border-amber-200";
    msg = <>Subscription expires in <strong>{days} day{days === 1 ? "" : "s"}</strong>. Renew now to avoid downtime.</>;
  }

  if (!msg) return null;
  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2 text-sm ${tone}`}>
      <span>{msg}</span>
      <Link to="/admin/billing" search={{} as never} className="rounded-md bg-white/60 px-3 py-1 text-xs font-medium hover:bg-white">View plans</Link>
    </div>
  );
}
