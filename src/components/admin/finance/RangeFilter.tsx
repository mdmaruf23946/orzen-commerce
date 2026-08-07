import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RANGE_TABS, type RangeKey } from "@/lib/finance-ui";

export function RangeFilter({
  value,
  onChange,
  custom,
  onCustomChange,
}: {
  value: RangeKey;
  onChange: (k: RangeKey) => void;
  custom: { from: string; to: string };
  onCustomChange: (v: { from: string; to: string }) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {RANGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              value === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="date"
            value={custom.from}
            max={custom.to}
            onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            className="h-9 sm:w-44"
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">to</span>
          <Input
            type="date"
            value={custom.to}
            min={custom.from}
            onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            className="h-9 sm:w-44"
          />
        </div>
      )}
    </div>
  );
}
