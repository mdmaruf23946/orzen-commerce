import { useEffect, useState } from "react";
import { AlertTriangle, Copy, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  formatSnapshot,
  readUserContext,
  trackError,
  type ErrorSnapshot,
} from "@/lib/error-context";

type Props = {
  error: unknown;
  scope: string;
  /** Retry handler — usually router.invalidate() + reset(), or refetch(). */
  onRetry?: () => void;
  compact?: boolean;
};

/**
 * Visible, copyable error surface: message, full stack and user context.
 * Also forwards the error to the Lovable error pipeline on mount.
 */
export function RouteErrorPanel({ error, scope, onRetry, compact }: Props) {
  const [snapshot, setSnapshot] = useState<ErrorSnapshot | null>(null);
  const [showStack, setShowStack] = useState(false);

  useEffect(() => {
    let alive = true;
    readUserContext().then((user) => {
      if (!alive) return;
      setSnapshot(trackError(error, scope, user));
    });
    return () => {
      alive = false;
    };
  }, [error, scope]);

  const text = snapshot ? formatSnapshot(snapshot) : "";

  return (
    <div
      className={
        "mx-auto w-full max-w-2xl rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-6 " +
        (compact ? "" : "my-8")
      }
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">
            {scope} — runtime error
          </h2>
          <p className="mt-1 break-words font-mono text-xs text-destructive">
            {snapshot ? `${snapshot.name}: ${snapshot.message}` : String((error as any)?.message ?? error)}
          </p>

          {snapshot && (
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <div><dt className="inline font-medium">Route: </dt><dd className="inline break-all">{snapshot.route}</dd></div>
              <div><dt className="inline font-medium">Time: </dt><dd className="inline">{new Date(snapshot.at).toLocaleString()}</dd></div>
              <div><dt className="inline font-medium">User: </dt><dd className="inline break-all">{snapshot.email ?? snapshot.userId ?? "anonymous"}</dd></div>
              <div><dt className="inline font-medium">Build: </dt><dd className="inline">{snapshot.buildMode}</dd></div>
            </dl>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry && (
              <Button size="sm" onClick={onRetry}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> আবার চেষ্টা করুন
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> রিফ্রেশ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowStack((v) => !v)}>
              {showStack ? "Hide details" : "Show details"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!text}
              onClick={() => {
                navigator.clipboard?.writeText(text);
                toast.success("Error report copied");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
            </Button>
          </div>

          {showStack && (
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {text || "Collecting context…"}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
