import { describe, expect, it } from "vitest";
import { addCalendarMonths, computePlanExpiry } from "./plan-period";

describe("plan expiry", () => {
  const now = new Date("2026-10-17T04:46:55.696Z");
  it("1/2/3/12 months land on the same date", () => {
    expect(addCalendarMonths(now, 1).toISOString().slice(0, 10)).toBe("2026-11-17");
    expect(addCalendarMonths(now, 2).toISOString().slice(0, 10)).toBe("2026-12-17");
    expect(addCalendarMonths(now, 3).toISOString().slice(0, 10)).toBe("2027-01-17");
    expect(addCalendarMonths(now, 12).toISOString().slice(0, 10)).toBe("2027-10-17");
  });
  it("month end is clamped", () => {
    expect(addCalendarMonths("2026-01-31T12:00:00Z", 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
  it("paid plan never stacks on free plan time", () => {
    const r = computePlanExpiry({ now, months: 1, targetPackageId: "basic", currentPackageId: "free", currentExpiresAt: "2026-11-03T04:46:46Z", currentPackagePaid: false });
    expect(r.expires.toISOString().slice(0, 10)).toBe("2026-11-17");
  });
  it("same paid plan renewal keeps remaining time", () => {
    const r = computePlanExpiry({ now, months: 1, targetPackageId: "basic", currentPackageId: "basic", currentExpiresAt: "2026-11-17T04:46:55Z", currentPackagePaid: true });
    expect(r.expires.toISOString().slice(0, 10)).toBe("2026-12-17");
  });
});
