import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { myBillingStatus, listPublicPlans } from "@/lib/billing.functions";
import { FEATURE_LABELS, type FeatureKey } from "@/lib/features";

const FEATURE_DESCRIPTIONS: Partial<Record<FeatureKey, string>> = {
  ai_agent: "24/7 AI sales agent that talks to your customers and closes orders automatically.",
  ai_messenger: "Reply to Messenger chats instantly with a trained AI that understands your catalog.",
  ai_product_builder: "Generate professional product listings from a single photo or idea.",
  pixel: "Track every event with Meta Pixel & Conversion API for accurate ad optimization.",
  courier: "Push orders to Steadfast, Pathao, RedX and more in one click.",
  inventory: "Real-time stock tracking, low-stock alerts and movement history.",
  coupons: "Percent / fixed / free-shipping coupons with usage limits and expiry.",
  invoice: "Custom invoice numbering, prefixes and branded PDF invoices.",
  analytics: "Business analytics: sales trends, top products, customer retention.",
  import_export: "Bulk import & export products via CSV / Excel with SKU matching.",
  bulk_actions: "Bulk update, delete and manage products, orders and customers.",
  staff: "Invite staff members with role-based access.",
  customer_notes: "Add private notes to customers and orders for your team.",
  returns: "Full returns & exchanges workflow with reason tracking.",
  custom_domain: "Connect your own domain with automatic SSL.",
  fraud_checker: "Screen every order against BD Courier fraud database before shipping.",
};

type UpgradeCtx = {
  open: (feature: FeatureKey) => void;
};

const Ctx = createContext<UpgradeCtx | null>(null);

export function useUpgradePrompt() {
  const c = useContext(Ctx);
  if (!c) {
    // Provider not mounted — fail gracefully as a no-op that still navigates.
    return { open: () => {} };
  }
  return c;
}

type Plan = {
  id: string;
  name: string;
  price: number;
  plan_tier?: string | null;
  is_trial?: boolean | null;
  features?: Record<string, boolean> | null;
  sort_order?: number | null;
};

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<FeatureKey | null>(null);
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const statusFn = useServerFn(myBillingStatus);
  const plansFn = useServerFn(listPublicPlans);
  const { data: status } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => statusFn(),
    staleTime: 5 * 60_000,
    enabled: !!feature,
  });
  const { data: plansRaw } = useQuery({
    queryKey: ["admin", "billingPlans"],
    queryFn: () => plansFn(),
    staleTime: 5 * 60_000,
    enabled: !!feature,
  });

  const plans = (plansRaw ?? []) as Plan[];
  const store: any = status?.store;
  const currentPlan: Plan | null = store?.subscription_packages ?? null;
  const currentPlanName = store?.subscription_status === "trialing"
    ? "Trial"
    : currentPlan?.name ?? "Free Plan";

  const recommended = useMemo<Plan | null>(() => {
    if (!feature) return null;
    const eligible = plans
      .filter((p) => !p.is_trial && p.features?.[feature] === true)
      .sort((a, b) => Number(a.price) - Number(b.price));
    return eligible[0] ?? null;
  }, [plans, feature]);

  const open = useCallback((f: FeatureKey) => setFeature(f), []);
  const close = useCallback(() => setFeature(null), []);

  function goToBilling() {
    close();
    navigate({
      to: "/admin/billing",
      search: {
        highlight: feature,
        plan: recommended?.id,
        from: currentPath,
      } as any,
    });
  }

  const label = feature ? FEATURE_LABELS[feature] : "";
  const description = feature ? FEATURE_DESCRIPTIONS[feature] ?? "Unlock this premium feature to grow your business." : "";

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <Dialog open={!!feature} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary shadow-sm">
                <Lock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <Badge variant="secondary" className="mb-1 h-5 gap-1 px-1.5 text-[10px] font-semibold uppercase tracking-wide">
                  <Sparkles className="h-3 w-3" /> Premium Feature
                </Badge>
                <DialogHeader className="p-0 space-y-0">
                  <DialogTitle className="text-base font-semibold leading-tight">
                    {label}
                  </DialogTitle>
                </DialogHeader>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-muted-foreground">{description}</p>

            <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 text-xs sm:text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Current plan</div>
                <div className="mt-0.5 font-semibold truncate">{currentPlanName}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Required</div>
                <div className="mt-0.5 font-semibold text-primary truncate">
                  {recommended?.name ?? "Any paid plan"}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs text-foreground/80 sm:text-sm">
                  <span className="font-semibold text-foreground">Why upgrade? </span>
                  Unlock <span className="font-medium">{label}</span> plus every other feature included in the {recommended?.name ?? "upgrade"} plan.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-5 py-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={close} className="sm:w-auto">
              Maybe later
            </Button>
            <Button size="sm" onClick={goToBilling} className="gap-1.5 sm:w-auto">
              Upgrade Plan <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
