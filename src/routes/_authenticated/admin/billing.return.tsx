// Return / verification landing page for the subscription checkout.
// Called by the payment provider after redirect. Runs verification
// server-side, then routes back to /admin/billing.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { verifyAndActivateSubscription } from "@/lib/subscription-pay/pay.functions";
import { Button } from "@/components/ui/button";

const search = z.object({ invoice: z.string().optional(), val_id: z.string().optional() });

export const Route = createFileRoute("/_authenticated/admin/billing/return")({
  head: () => ({
    meta: [
      { title: "Payment Result — ORZEN Merchant Panel" },
      { name: "description", content: "Subscription payment confirmation." },
      { property: "og:title", content: "Payment Result — ORZEN Merchant Panel" },
      { property: "og:description", content: "Subscription payment confirmation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: search,
  component: ReturnPage,
});

function ReturnPage() {
  const { invoice, val_id } = Route.useSearch();
  const navigate = useNavigate();
  const verifyFn = useServerFn(verifyAndActivateSubscription);
  const { data, isLoading, error } = useQuery({
    queryKey: ["subPay", "verify", invoice, val_id],
    queryFn: () => verifyFn({ data: { invoice_no: invoice!, provider_payload: val_id ? { val_id } : {} } }),
    enabled: !!invoice,
    retry: false,
  });

  const paid = data?.status === "paid";
  const isTopup = (data as any)?.purpose === "wallet_topup";
  const missingRef = !invoice;

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        {missingRef ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="mt-3 text-lg font-semibold">No payment reference</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This page opens automatically after a payment. Open Billing &amp; Plans to check your subscription status.
            </p>
            <Link to="/admin/billing" search={{} as never}>
              <Button variant="outline" className="mt-4 w-full">Back to plans</Button>
            </Link>
          </>
        ) : isLoading ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground" />
            <h1 className="mt-3 text-lg font-semibold">Verifying your payment…</h1>
          </>
        ) : paid ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-3 text-lg font-semibold">
              {isTopup ? "Fund added to wallet" : "Subscription activated"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isTopup
                ? `Invoice ${invoice}. Your wallet balance has been updated.`
                : `Invoice ${invoice}. A receipt has been emailed.`}
            </p>
            <Button className="mt-4 w-full" onClick={() => navigate({ to: "/admin/billing", search: {} as never })}>Continue</Button>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-700">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="mt-3 text-lg font-semibold">Payment not completed</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {error ? (error as Error).message : "The payment could not be verified. You can try again."}
            </p>
            <Link to="/admin/billing" search={{} as never}><Button variant="outline" className="mt-4 w-full">Back to plans</Button></Link>
          </>
        )}
      </div>
    </div>
  );
}
