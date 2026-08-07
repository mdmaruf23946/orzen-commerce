import { NOTIFY_EVENTS, type EventMap } from "@/lib/notify-settings";
import { Checkbox } from "@/components/ui/checkbox";

export function EventMatrix({
  value,
  onChange,
  disabled,
}: {
  value: EventMap;
  onChange: (next: EventMap) => void;
  disabled?: boolean;
}) {
  const set = (key: string, who: "admin" | "customer", v: boolean) =>
    onChange({ ...value, [key]: { ...(value[key] ?? { admin: false, customer: false }), [who]: v } });

  return (
    <div className="rounded-lg border">
      <div className="hidden grid-cols-[1fr_auto_auto] items-center gap-4 border-b bg-muted/40 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid">
        <span>Event</span>
        <span className="w-16 text-center">Admin</span>
        <span className="w-16 text-center">Customer</span>
      </div>
      {NOTIFY_EVENTS.map((e) => {
        const a = value[e.key] ?? { admin: false, customer: false };
        return (
          <div
            key={e.key}
            className="flex flex-col gap-2 border-b px-3 py-2.5 last:border-b-0 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{e.label}</div>
              <div className="text-xs text-muted-foreground">{e.hint}</div>
            </div>
            <label className="flex items-center gap-2 text-xs sm:w-16 sm:justify-center">
              <Checkbox
                disabled={disabled}
                checked={!!a.admin}
                onCheckedChange={(v) => set(e.key, "admin", !!v)}
              />
              <span className="sm:hidden">Admin</span>
            </label>
            <label className="flex items-center gap-2 text-xs sm:w-16 sm:justify-center">
              <Checkbox
                disabled={disabled}
                checked={!!a.customer}
                onCheckedChange={(v) => set(e.key, "customer", !!v)}
              />
              <span className="sm:hidden">Customer</span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
