import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const FB_BLUE = "#1877F2";

export function FacebookMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", className)}
      style={{ backgroundColor: FB_BLUE }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#fff">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.25 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22C18.34 21.25 22 17.08 22 12.06z" />
      </svg>
    </span>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    connected: "border-[#1877F2]/30 bg-[#1877F2]/10 text-[#1877F2]",
    error: "border-destructive/20 bg-destructive/10 text-destructive",
    pending: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  const cls = map[status] ?? "border-border bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize", cls)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

/** Renders a short, honest note when a Meta permission is missing. */
export function MissingPermission({ scope }: { scope: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
      <Info className="h-3 w-3" /> requires {scope}
    </span>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed bg-muted/40 p-8 text-center">
      {icon}
      <div className="mt-2 text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function NotConnected() {
  return (
    <EmptyState
      icon={<FacebookMark />}
      title="No Facebook Page connected"
      hint="Go to Page Settings to connect your Facebook Page, or import the page you already use for Messenger."
    />
  );
}

export function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Small status chip shown next to every Facebook action, so the owner can see
 * at a glance whether Meta actually allows that action with the current token.
 */
export function CapBadge({ ok, scope, className }: { ok: boolean; scope: string; className?: string }) {
  return (
    <span
      title={ok ? `Allowed by ${scope}` : `Your page token is missing ${scope}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        ok
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
      {ok ? "Ready" : `Needs ${scope.replace("pages_", "")}`}
    </span>
  );
}

/** Wraps an action button with its capability chip underneath. */
export function CapAction({
  ok,
  scope,
  children,
}: {
  ok: boolean;
  scope: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {children}
      <CapBadge ok={ok} scope={scope} />
    </span>
  );
}


/**
 * Shows, per action, whether Facebook actually allows it with the stored Page
 * token: verified, refused, or not checked yet.
 */
export function PermissionsGrid({
  states,
  labels,
  scopes,
}: {
  states: Record<string, boolean | null>;
  labels: Record<string, string>;
  scopes: Record<string, string>;
}) {
  const keys = Object.keys(labels);
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {keys.map((k) => {
        const v = states?.[k] ?? null;
        const tone =
          v === true
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : v === false
              ? "border-destructive/20 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-muted-foreground";
        return (
          <div key={k} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-2.5 py-1.5">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{labels[k]}</div>
              <div className="truncate text-[10px] text-muted-foreground">{scopes[k]}</div>
            </div>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", tone)}>
              {v === true ? "Verified" : v === false ? "Missing" : "Not checked"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
