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
