import { describe, it, expect } from "vitest";
import { evaluatePromo, type PromoCoupon } from "./promo-code";

const base: PromoCoupon = { id: "c1", code: "SAVE", type: "percent", value: 20, active: true };
const run = (c: Partial<PromoCoupon>, amount = 1000, packageId = "pro", cycle = "monthly") =>
  evaluatePromo({ ...base, ...c }, { packageId, cycle, amount, now: new Date("2026-11-12") });

describe("subscription promo codes", () => {
  it("percent discount", () => expect(run({})).toMatchObject({ ok: true, discount: 200, total: 800 }));
  it("percent capped by max discount", () => expect(run({ max_discount: 150 })).toMatchObject({ discount: 150 }));
  it("fixed taka discount", () => expect(run({ type: "fixed", value: 300 })).toMatchObject({ discount: 300, total: 700 }));
  it("per-plan amount overrides", () => expect(run({ plan_amounts: { pro: 500 } })).toMatchObject({ discount: 500 }));
  it("never exceeds the price", () => expect(run({ type: "fixed", value: 5000 })).toMatchObject({ discount: 1000, total: 0 }));
  it("rejects other plans", () => expect(run({ applies_to_packages: ["basic"] }).ok).toBe(false));
  it("rejects other cycles", () => expect(run({ applies_to_cycles: ["yearly"] }).ok).toBe(false));
  it("rejects expired", () => expect(run({ expires_at: "2026-11-01" }).ok).toBe(false));
  it("rejects inactive", () => expect(run({ active: false }).ok).toBe(false));
  it("usage limit counts pending", () =>
    expect(evaluatePromo({ ...base, usage_limit: 2, used_count: 1 }, { packageId: "pro", cycle: "monthly", amount: 1000, pendingUses: 1 }).ok).toBe(false));
});
