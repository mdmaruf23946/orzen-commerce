import { describe, it, expect } from "vitest";
import { drawerBoundRules } from "../ai-agent.server";

const joined = (t: string, o: Record<string, any> = {}) => drawerBoundRules({ text: t, ...o }).join("\n");

describe("drawer-bound rules (Phase 2)", () => {
  it("delivery question gets delivery rule, not product/order rules", () => {
    const r = joined("ডেলিভারি চার্জ কত?");
    expect(r).toContain("getDeliveryCharge");
    expect(r).not.toContain("searchProducts");
    expect(r).not.toContain("never a name/address");
  });
  it("product question gets product rule, not delivery rule", () => {
    const r = joined("টিশার্টের দাম কত");
    expect(r).toContain("searchProducts");
    expect(r).not.toContain("getDeliveryCharge");
  });
  it("greeting gets only the 3 core rules", () => {
    expect(drawerBoundRules({ text: "আসসালামু আলাইকুম" })).toHaveLength(3);
  });
  it("order in progress adds slot rules", () => {
    expect(joined("Rahim Uddin", { orderActive: true })).toContain("never a name/address");
  });
  it("focus product question never asks for catalogue search", () => {
    const r = joined("এটার কালার কি কি?", { hasFocus: true });
    expect(r).toContain("Focus product");
    expect(r).not.toContain("call searchProducts immediately");
  });
});
