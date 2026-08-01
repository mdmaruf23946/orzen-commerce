import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ShieldCheck } from "lucide-react";
import {
  STORE_MODES,
  storeMode,
  MODE_EFFECTS,
  MODE_PRESERVED,
  MODE_TRANSITION_STEPS,
  type StoreMode,
} from "@/lib/store-mode";
import { switchStoreMode } from "@/lib/store-mode.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Store Mode picker with a confirmation dialog and a staged transition overlay.
 * The switch itself is one server call; nothing else in the store is touched.
 */
export function StoreModeSwitcher({
  value,
  hasCustomDomain,
  onSwitched,
}: {
  value: string | null | undefined;
  hasCustomDomain?: boolean;
  onSwitched?: (mode: StoreMode) => void;
}) {
  const current = storeMode(value);
  const qc = useQueryClient();
  const doSwitch = useServerFn(switchStoreMode);
  const [target, setTarget] = useState<StoreMode | null>(null);
  const [step, setStep] = useState<number | null>(null);

  async function confirm() {
    if (!target) return;
    const mode = target;
    setTarget(null);
    setStep(0);
    try {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const res = await doSwitch({ data: { mode } });
      setStep(1);
      await wait(350);
      setStep(2);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "store"] }),
        qc.invalidateQueries({ queryKey: ["admin", "products"] }),
        qc.invalidateQueries({ queryKey: ["admin", "categories"] }),
        qc.invalidateQueries({ queryKey: ["admin", "banners"] }),
        qc.invalidateQueries({ queryKey: ["admin", "domains"] }),
        qc.invalidateQueries({ queryKey: ["admin", "disconnected-domains"] }),
      ]);
      setStep(3);
      await wait(300);
      if ((res as any)?.disconnected?.length) {
        toast.warning(
          `Custom domain disconnected: ${(res as any).disconnected.join(", ")}. Reconnect it from Store Settings → Domains.`,
          { duration: 8000 },
        );
      }
      toast.success("Store Mode updated");
      onSwitched?.(mode);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStep(null);
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {STORE_MODES.map((m) => {
          const active = current === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => !active && setTarget(m.value)}
              className={`rounded-xl border p-3 text-left transition ${
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                {m.label}
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Only one mode is active at a time. Switching hides or shows modules — it never deletes
        products, categories, banners or any business data.
      </p>

      {/* Confirmation */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Switch to {STORE_MODES.find((m) => m.value === target)?.label}?
            </DialogTitle>
            <DialogDescription>Here is exactly what changes.</DialogDescription>
          </DialogHeader>

          {target && (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-card p-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Becomes available
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {MODE_EFFECTS[target].enables.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>

              {MODE_EFFECTS[target].hides.length > 0 && (
                <div className="rounded-lg border bg-card p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Gets hidden (not deleted)
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {MODE_EFFECTS[target].hides.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" /> Kept permanently
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                  {MODE_PRESERVED.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-emerald-800/70 dark:text-emerald-200/70">
                  Switch back any time and everything reappears automatically.
                </p>
              </div>

              {hasCustomDomain && (
                <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Your custom domain will be disconnected because the Store Mode changed. The
                    domain record is saved — reconnect it from Store Settings → Domains.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm}>
              Confirm switch
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transition overlay */}
      {step !== null && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-background/85 backdrop-blur-sm">
          <div className="w-[min(92vw,340px)] rounded-2xl border bg-card p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm font-medium">{MODE_TRANSITION_STEPS[step]}</p>
            <div className="mt-4 space-y-1.5 text-left">
              {MODE_TRANSITION_STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`flex items-center gap-2 text-[11px] ${
                    i <= step ? "text-foreground" : "text-muted-foreground/50"
                  }`}
                >
                  {i < step ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <span className="h-3 w-3 rounded-full border" />
                  )}
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
