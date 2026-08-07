import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "./StatusBadge";
import type { ChannelState } from "@/lib/notify-settings";
import { Loader2, Send } from "lucide-react";

export function ChannelCard({
  title,
  description,
  icon,
  state,
  lastError,
  lastTestedAt,
  enabled,
  onEnabledChange,
  onSave,
  onTest,
  saving,
  testing,
  dirty,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  state: ChannelState;
  lastError?: string | null;
  lastTestedAt?: string | null;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  onSave: () => void;
  onTest: () => void;
  saving?: boolean;
  testing?: boolean;
  dirty?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-start gap-3 border-b p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{title}</h2>
            <StatusBadge state={state} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </header>

      <div className="space-y-4 p-4">
        {state === "error" && lastError && (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
            {lastError}
          </p>
        )}
        {children}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t p-3">
        <span className="mr-auto text-[11px] text-muted-foreground">
          {lastTestedAt ? `Last tested ${new Date(lastTestedAt).toLocaleString()}` : "Not tested yet"}
        </span>
        <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
          {testing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
          Send test
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || !dirty}>
          {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Save changes
        </Button>
      </footer>
    </section>
  );
}
