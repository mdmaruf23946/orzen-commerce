// Shared plan-period math: exact calendar months, never stacked on free/trial time.

/** Adds n calendar months, keeping the same day (clamped to month end). */
export function addCalendarMonths(from: Date | string, months: number): Date {
  const d = new Date(from);
  if (Number.isNaN(d.getTime())) return new Date();
  if (months <= 0) return d;
  const day = d.getUTCDate();
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const y = Math.floor(total / 12);
  const m = total % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const r = new Date(d.getTime());
  r.setUTCDate(1);
  r.setUTCFullYear(y, m, Math.min(day, last));
  return r;
}

/** Converts package duration_days to months (30 → 1, 90 → 3, 365 → 12). */
export function daysToMonths(days: number | null | undefined): number {
  const n = Number(days || 30);
  return Math.max(1, Math.round(n / 30.4));
}

/**
 * New expiry for a plan purchase. Remaining time is kept only when renewing
 * the same paid, active plan; otherwise the period starts at `now`.
 */
export function computePlanExpiry(args: {
  now?: Date;
  months: number;
  targetPackageId: string;
  currentPackageId?: string | null;
  currentExpiresAt?: string | null;
  currentPackagePaid?: boolean;
}): { start: Date; expires: Date; stacked: boolean } {
  const now = args.now ?? new Date();
  const cur = args.currentExpiresAt ? new Date(args.currentExpiresAt) : null;
  const stacked = Boolean(
    args.currentPackagePaid &&
      args.currentPackageId &&
      args.currentPackageId === args.targetPackageId &&
      cur && !Number.isNaN(cur.getTime()) && cur > now,
  );
  const start = stacked && cur ? cur : now;
  return { start, expires: addCalendarMonths(start, args.months), stacked };
}
