import { describe, it, expect } from "vitest";
import { classifyStorePlan, fillPromoTemplate } from "./promo-audience";

describe("promo audience", () => {
  it("trialing store is trial", () => expect(classifyStorePlan({ subscription_status: "trialing", package: { price: 1700 } })).toBe("trial"));
  it("free package is free", () => expect(classifyStorePlan({ subscription_status: "active", package: { price: 0 } })).toBe("free"));
  it("no package is free", () => expect(classifyStorePlan({ subscription_status: "active", package: null })).toBe("free"));
  it("paid package is paid", () => expect(classifyStorePlan({ subscription_status: "active", package: { price: 1700 } })).toBe("paid"));
  it("fills code", () => expect(fillPromoTemplate("Use {{code}}", { code: "EID50" })).toBe("Use EID50"));
});

import { promoValidity, recipientName } from "./promo-audience";
describe("promo email personalisation", () => {
  it("uses the account owner's name, not the store name", () => {
    expect(recipientName({ owner_name: "রহিম" }, null)).toBe("রহিম");
    expect(recipientName({}, "")).toBe("সম্মানিত মার্চেন্ট");
  });
  it("shows days left and Bangla end date", () => {
    const v = promoValidity("2026-11-15T17:59:00Z", new Date("2026-11-12T18:00:00Z"));
    expect(v.daysLeft).toBe(3);
    expect(v.date).toBe("১৫ নভেম্বর ২০২৬");
  });
});

import { promoDiscountHeadline } from "./promo-audience";
describe("promo discount headline", () => {
  it("uses the largest per-plan amount when base is 0", () =>
    expect(promoDiscountHeadline({ type: "percent", value: 0, plan_amounts: { a: 700, b: 1000 } })).toBe("৳১০০০ পর্যন্ত ছাড়"));
  it("fixed base vs plans takes max", () =>
    expect(promoDiscountHeadline({ type: "fixed", value: 300, plan_amounts: { a: 200 } })).toBe("৳৩০০ পর্যন্ত ছাড়"));
});

describe("inactive promo audience", () => {
  const now = new Date("2026-11-13T00:00:00Z");
  it("expired status is inactive", () => expect(classifyStorePlan({ subscription_status: "expired", package: { price: 1700 } }, now)).toBe("inactive"));
  it("trial past its end date is inactive", () => expect(classifyStorePlan({ subscription_status: "trialing", trial_ends_at: "2026-11-01T00:00:00Z", package: { is_trial: true } }, now)).toBe("inactive"));
  it("running trial stays trial", () => expect(classifyStorePlan({ subscription_status: "trialing", trial_ends_at: "2026-12-01T00:00:00Z" }, now)).toBe("trial"));
  it("paid plan past expiry is inactive", () => expect(classifyStorePlan({ subscription_status: "active", expires_at: "2026-11-01T00:00:00Z", package: { price: 1700 } }, now)).toBe("inactive"));
});
