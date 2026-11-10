/** Shared client helpers for the Business Finance page. */

export const EXPENSE_CATEGORIES = [
  { id: "ads", label: "Ads" },
  { id: "courier", label: "Courier" },
  { id: "product_purchase", label: "Product Purchase" },
  { id: "packaging", label: "Packaging" },
  { id: "payment_gateway", label: "Payment Gateway" },
  { id: "staff", label: "Staff" },
  { id: "other", label: "Other" },
] as const;

/** Legacy enum values still present in older rows. */
const LEGACY_LABELS: Record<string, string> = {
  fb_ads: "Ads (Facebook)",
  salary: "Staff",
  misc: "Other",
};

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function categoryLabel(id: string) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? LEGACY_LABELS[id] ?? id;
}

export const money = (n: number | string | null | undefined) =>
  `৳${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const iso = (d: Date) => {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
};

export type RangeKey = "today" | "7d" | "month" | "last_month" | "custom";

export const RANGE_TABS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "custom", label: "Custom" },
];

export function rangeFor(key: RangeKey, custom?: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  switch (key) {
    case "today":
      return { from: iso(now), to: iso(now) };
    case "7d": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { from: iso(s), to: iso(now) };
    }
    case "month":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    case "last_month":
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    default:
      return {
        from: custom?.from || iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: custom?.to || iso(now),
      };
  }
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
