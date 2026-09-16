import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { myBillingStatus, listPublicPlans, activateFreePlan } from "@/lib/billing.functions";

/** Statuses where the store has no usable plan at all. */
const LOCKED = ["expired", "cancelled", "suspended", "past_due"];

/**
 * Hard gate for the merchant panel: when the trial (or paid plan) has ended,
 * nothing in the panel can be used until a Free or paid plan is activated.
 * Billing pages stay reachable so the merchant can get back in.
 */
export function PlanLockGate({ path, children }: { path: string; children: ReactNode }) {
  const statusFn = useServerFn(myBillingStatus);
  const plansFn = useServerFn(listPublicPlans);
  const activateFn = useServerFn(activateFreePlan);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({ queryKey: ["admin", "billing"], queryFn: () => statusFn(), staleTime: 60_000 });
  const store = (data as any)?.store ?? null;
  const status = (store?.subscription_status ?? "active") as string;
  const locked = !!store && LOCKED.includes(status);

  const { data: plans } = useQuery({
    queryKey: ["public", "plans"],
    queryFn: () => plansFn(),
    staleTime: 300_000,
    enabled: locked,
  });

  const freePlan = ((plans ?? []) as any[]).find(
    (p) => Number(p.price) === 0 && (p.plan_tier === "free" || /free/i.test(p.name ?? "")),
  );

  const onBillingPage = path.startsWith("/admin/billing");
  if (!locked || onBillingPage) return <>{children}</>;

  async function activateFree() {
    if (!freePlan) return;
    setBusy(true);
    try {
      const res = (await activateFn({ data: { package_id: freePlan.id } })) as any;
      if (!res?.ok) throw new Error(res?.error ?? "Could not activate the free plan");
      toast.success("Free plan activated");
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const suspended = status === "suspended";

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">
        {suspended ? "Your store is suspended" : "Your plan has ended"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {suspended
          ? "The platform owner suspended this store. Please contact support to restore access."
          : "আপনার ট্রায়াল/প্ল্যানের মেয়াদ শেষ হয়েছে। প্যানেল ব্যবহার করতে একটি প্ল্যান চালু করুন — ফ্রি প্ল্যান সাথে সাথেই চালু হবে।"}
      </p>

      {!suspended && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {freePlan && (
            <Button onClick={activateFree} disabled={busy}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              {busy ? "Activating…" : `Activate ${freePlan.name}`}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to="/admin/billing" search={{} as never}>
              View paid plans
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
