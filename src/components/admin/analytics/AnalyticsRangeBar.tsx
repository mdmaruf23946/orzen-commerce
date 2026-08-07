import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_RANGES,
  COMPARE_OPTIONS,
  type AnalyticsRangeKey,
  type CompareKey,
  type DateRange,
} from "@/lib/analytics-ui";

export function AnalyticsRangeBar({
  rangeKey,
  onRangeKey,
  custom,
  onCustom,
  compare,
  onCompare,
}: {
  rangeKey: AnalyticsRangeKey;
  onRangeKey: (k: AnalyticsRangeKey) => void;
  custom: DateRange;
  onCustom: (v: DateRange) => void;
  compare: CompareKey;
  onCompare: (k: CompareKey) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ANALYTICS_RANGES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onRangeKey(t.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              rangeKey === t.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {rangeKey === "custom" && (
          <>
            <Input
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) => onCustom({ ...custom, from: e.target.value })}
              className="h-9 sm:w-40"
            />
            <Input
              type="date"
              value={custom.to}
              min={custom.from}
              onChange={(e) => onCustom({ ...custom, to: e.target.value })}
              className="h-9 sm:w-40"
            />
          </>
        )}
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="shrink-0 text-[11px] text-muted-foreground">Compare with</span>
          <select
            value={compare}
            onChange={(e) => onCompare(e.target.value as CompareKey)}
            className="h-9 flex-1 rounded-md border bg-background px-2 text-xs sm:flex-none"
          >
            {COMPARE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
