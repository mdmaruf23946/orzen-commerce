import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Sparkles } from "lucide-react";
import { myBillingStatus } from "@/lib/billing.functions";
import { hasFeature, FEATURE_LABELS, type FeatureKey } from "@/lib/features";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

type Props = { feature: FeatureKey; children: ReactNode; inline?: boolean };

export function FeatureGate({ feature, children, inline = false }: Props) {
  const fn = useServerFn(myBillingStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-muted/40" />;
  }

  if (hasFeature(data?.store as any, feature)) return <>{children}</>;

  const label = FEATURE_LABELS[feature];
  return (
    <div
      className={`mx-auto flex ${inline ? "" : "min-h-[60vh]"} w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 text-center`}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <Lock className="h-6 w-6" />
      </div>
      <div className="text-lg font-semibold">Upgrade Required</div>
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{label}</span> is not included in your current plan.
      </p>
      <Link to="/admin/billing" className="w-full">
        <Button className="w-full gap-1.5">
          <Sparkles className="h-4 w-4" /> View Plans
        </Button>
      </Link>
    </div>
  );
}

export function useFeature(feature: FeatureKey): { allowed: boolean; loading: boolean } {
  const fn = useServerFn(myBillingStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  return { allowed: hasFeature(data?.store as any, feature), loading: isLoading };
}
