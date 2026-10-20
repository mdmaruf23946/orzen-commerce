import { describe, it, expect } from "vitest";
import { stepBudget, allowedToolsFor } from "./specialists";

describe("Phase 3 step budget", () => {
  it("focus colour question → 1 step", () => {
    const tools = [...allowedToolsFor("এটার কালার কি?", { hasFocus: true })];
    expect(tools.some((t) => ["searchProducts", "sendProductCard"].includes(t))).toBe(false);
    expect(stepBudget(["escalateToHuman"])).toBe(1);
  });
  it("catalog card → 2 steps", () => {
    expect(stepBudget(["searchProducts", "sendProductCard"])).toBe(2);
  });
  it("delivery lookup → 2 steps (tool + reply)", () => {
    expect(stepBudget(["getDeliveryCharge"])).toBe(2);
  });
  it("live order → 3 steps, never more", () => {
    expect(stepBudget(["collectOrderInfo", "finalizeOrder"], { orderInProgress: true })).toBe(3);
    expect(stepBudget(["collectOrderInfo", "finalizeOrder"])).toBe(2);
  });
});
