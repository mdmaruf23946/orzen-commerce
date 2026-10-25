import { describe, it, expect } from "vitest";
import { collectAmount } from "./collect-amount";

describe("collectAmount", () => {
  it("COD order collects the full grand total without adding delivery again", () => {
    expect(collectAmount({ subtotal: 2440, payment_method: "cod", payment_status: "unpaid" })).toBe(2440);
  });
  it("fully prepaid order collects nothing", () => {
    expect(collectAmount({ subtotal: 2440, payment_method: "bkash", payment_status: "paid" })).toBe(0);
  });
  it("advance payment collects only the remaining amount", () => {
    expect(collectAmount({ subtotal: 2440, paid_amount: 200, payment_method: "cod", payment_status: "partial" })).toBe(2240);
  });
  it("never goes negative", () => {
    expect(collectAmount({ subtotal: 500, paid_amount: 900, payment_method: "cod" })).toBe(0);
  });
});
