import { STATE_LABEL, type ChannelState } from "@/lib/notify-settings";

const styles: Record<ChannelState, string> = {
  connected: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  not_configured: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  disabled: "bg-muted text-muted-foreground border-border",
  error: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ state }: { state: ChannelState }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles[state]}`}>
      {STATE_LABEL[state]}
    </span>
  );
}
