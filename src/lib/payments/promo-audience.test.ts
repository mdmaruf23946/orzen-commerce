import { describe, it, expect } from "vitest";
import { classifyStorePlan, fillPromoTemplate } from "./promo-audience";

describe("promo audience", () => {
  it("trialing store is trial", () => expect(classifyStorePlan({ subscription_status: "trialing", package: { price: 1700 } })).toBe("trial"));
  it("free package is free", () => expect(classifyStorePlan({ subscription_status: "active", package: { price: 0 } })).toBe("free"));
  it("no package is free", () => expect(classifyStorePlan({ subscription_status: "active", package: null })).toBe("free"));
  it("paid package is paid", () => expect(classifyStorePlan({ subscription_status: "active", package: { price: 1700 } })).toBe("paid"));
  it("fills code", () => expect(fillPromoTemplate("Use {{code}}", { code: "EID50" })).toBe("Use EID50"));
});
