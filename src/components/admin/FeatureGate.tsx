import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Sparkles } from "lucide-react";
import { myBillingStatus } from "@/lib/billing.functions";
import { hasFeature, FEATURE_LABELS, type FeatureKey } from "@/lib/features";
import { useUpgradePrompt } from "@/components/admin/UpgradeModal";
import { cn } from "@/lib/utils";
import type { MouseEvent, ReactNode } from "react";

type GateMode = "soft" | "badge" | "passthrough";

type Props = {
  feature: FeatureKey;
  children: ReactNode;
  mode?: GateMode;
  /** @deprecated kept for backwards compatibility — no longer used */
  inline?: boolean;
  className?: string;
};

/**
 * Soft-lock feature gate.
 *
 * - Always renders the original UI so users can preview the feature.
 * - When the feature is not included in the current plan, an invisible
 *   click-blocker overlays the content and a "Premium" badge is shown.
 *   Interacting with the content opens the shared Upgrade modal.
 * - `mode="badge"` shows only the badge and leaves clicks passing through
 *   (useful when the page already gates its own actions via `useFeature`).
 */
export function FeatureGate({ feature, children, mode = "soft", className }: Props) {
  const fn = useServerFn(myBillingStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  const { open } = useUpgradePrompt();

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-muted/40" />;
  }

  const allowed = hasFeature(data?.store as any, feature);
  if (allowed || mode === "passthrough") return <>{children}</>;

  const label = FEATURE_LABELS[feature];

  function handleCapture(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    open(feature);
  }

  return (
    <div className={cn("relative", className)}>
      {/* Corner badge */}
      <div className="pointer-events-none absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
        <button
          type="button"
          onClick={() => open(feature)}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background/95 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
          aria-label={`Upgrade to unlock ${label}`}
        >
          <Lock className="h-3 w-3" /> Premium
        </button>
      </div>

      {mode === "soft" && (
        <>
          {/* Click blocker */}
          <div
            className="absolute inset-0 z-10 cursor-pointer bg-background/10"
            onClickCapture={handleCapture}
            onMouseDownCapture={handleCapture}
            role="button"
            aria-label={`${label} is a premium feature — click to upgrade`}
          />

          {/* Center upgrade nudge */}
          <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center sm:top-16">
            <button
              type="button"
              onClick={() => open(feature)}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg transition hover:brightness-110"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade to unlock {label}
            </button>
          </div>
        </>
      )}

      {/* Original UI — kept fully visible */}
      <div
        aria-hidden={mode === "soft" ? true : undefined}
        className={mode === "soft" ? "select-none opacity-90" : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Hook variant. Returns `allowed`, `loading`, plus helpers to guard
 * event handlers and imperatively prompt the upgrade modal.
 */
export function useFeature(feature: FeatureKey) {
  const fn = useServerFn(myBillingStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "billing"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  const { open } = useUpgradePrompt();
  const allowed = hasFeature(data?.store as any, feature);

  function promptUpgrade() {
    open(feature);
  }

  function guard<T extends (...args: any[]) => any>(handler: T) {
    return ((...args: Parameters<T>) => {
      if (!allowed) {
        open(feature);
        return undefined as any;
      }
      return handler(...args);
    }) as T;
  }

  return { allowed, loading: isLoading, promptUpgrade, guard };
}
