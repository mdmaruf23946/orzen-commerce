/** Client helpers for the Store Admin analytics dashboard. */
import { iso } from "@/lib/finance-ui";

export type AnalyticsRangeKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

export const ANALYTICS_RANGES: { key: AnalyticsRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
  { key: "last_year", label: "Last Year" },
  { key: "custom", label: "Custom Range" },
];

export type CompareKey = "previous_period" | "previous_month" | "previous_year";

export const COMPARE_OPTIONS: { key: CompareKey; label: string }[] = [
  { key: "previous_period", label: "Previous Period" },
  { key: "previous_month", label: "Previous Month" },
  { key: "previous_year", label: "Previous Year" },
];

export type DateRange = { from: string; to: string };

export function analyticsRange(key: AnalyticsRangeKey, custom?: DateRange): DateRange {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case "today":
      return { from: iso(now), to: iso(now) };
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return { from: iso(d), to: iso(d) };
    }
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: iso(d), to: iso(now) };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: iso(d), to: iso(now) };
    }
    case "this_month":
      return { from: iso(new Date(y, m, 1)), to: iso(now) };
    case "last_month":
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "this_year":
      return { from: iso(new Date(y, 0, 1)), to: iso(now) };
    case "last_year":
      return { from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)) };
    default:
      return { from: custom?.from || iso(new Date(y, m, 1)), to: custom?.to || iso(now) };
  }
}

export function compareRange(range: DateRange, key: CompareKey): DateRange {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T00:00:00`);
  if (key === "previous_month") {
    const f = new Date(from);
    f.setMonth(f.getMonth() - 1);
    const t = new Date(to);
    t.setMonth(t.getMonth() - 1);
    return { from: iso(f), to: iso(t) };
  }
  if (key === "previous_year") {
    const f = new Date(from);
    f.setFullYear(f.getFullYear() - 1);
    const t = new Date(to);
    t.setFullYear(t.getFullYear() - 1);
    return { from: iso(f), to: iso(t) };
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const t = new Date(from);
  t.setDate(t.getDate() - 1);
  const f = new Date(t);
  f.setDate(f.getDate() - (days - 1));
  return { from: iso(f), to: iso(t) };
}

export function pctChange(current: number, previous: number) {
  if (previous > 0) return ((current - previous) / previous) * 100;
  if (current > 0) return 100;
  return 0;
}

export const compactMoney = (n: number) => {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `৳${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `৳${(v / 1000).toFixed(0)}K`;
  return `৳${Math.round(v).toLocaleString("en-US")}`;
};

export function bucketLabel(bucket: string, mode: "day" | "week" | "month") {
  const d = new Date(`${bucket}T00:00:00`);
  if (mode === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function relativeTime(at: string) {
  const diff = Date.now() - Date.parse(at);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
