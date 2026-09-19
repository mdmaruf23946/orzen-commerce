import type { ReactNode } from "react";
import { CheckCircle2, AlertCircle, FlaskConical, PowerOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type StatusKind = "connected" | "test" | "not_configured" | "error";

export function StatusBadge({ kind, label }: { kind: StatusKind; label?: string }) {
  const map: Record<StatusKind, { text: string; cls: string; icon: ReactNode }> = {
    connected: { text: "Connected", cls: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    test: { text: "Test Mode", cls: "bg-amber-100 text-amber-800", icon: <FlaskConical className="h-3.5 w-3.5" /> },
    not_configured: { text: "Not Configured", cls: "bg-muted text-muted-foreground", icon: <PowerOff className="h-3.5 w-3.5" /> },
    error: { text: "Error", cls: "bg-destructive/10 text-destructive", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  };
  const m = map[kind];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", m.cls)}>
      {m.icon}
      {label ?? m.text}
    </span>
  );
}

export function Card({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {status}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Row({
  label,
  hint,
  checked,
  onCheckedChange,
  children,
  error,
}: {
  label: string;
  hint?: string;
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  children?: ReactNode;
  error?: string | false;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm">{label}</Label>
        {onCheckedChange && <Switch checked={!!checked} onCheckedChange={onCheckedChange} />}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function TestResult({ result }: { result: { ok: boolean; text: string } | null }) {
  if (!result) return null;
  return (
    <div
      className={cn(
        "rounded-md border p-2 text-xs",
        result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {result.text}
    </div>
  );
}

export const AUTO_EVENTS =
  "PageView · ViewContent · Search · AddToCart · InitiateCheckout · AddPaymentInfo · Purchase · CompleteRegistration";
