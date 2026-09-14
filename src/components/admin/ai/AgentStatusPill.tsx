const STYLES: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  needs_setup: { label: "Needs Setup", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  paused: { label: "Paused", className: "bg-muted text-muted-foreground" },
  error: { label: "Error", className: "bg-destructive/10 text-destructive" },
};

export function AgentStatusPill({ status }: { status: string }) {
  const s = STYLES[status] ?? STYLES.paused;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
