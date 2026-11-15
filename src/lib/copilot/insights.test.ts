import { describe, it, expect } from "vitest";
import { summarizeSales, productPerformance, normalizeProductDraft } from "./insights";

describe("copilot insights", () => {
  it("excludes cancelled orders from revenue and computes cancel rate", () => {
    const s = summarizeSales([
      { id: "1", status: "delivered", subtotal: 1000, created_at: "", phone: "a" },
      { id: "2", status: "pending", subtotal: 500, created_at: "", phone: "a" },
      { id: "3", status: "cancelled", subtotal: 900, created_at: "", phone: "b" },
      { id: "4", status: "confirmed", subtotal: 0, created_at: "", phone: "c" },
    ]);
    expect(s.revenue).toBe(1500);
    expect(s.cancelRate).toBe(25);
    expect(s.repeatCustomers).toBe(1);
  });
  it("ranks top sellers and flags low stock", () => {
    const p = productPerformance(
      [{ id: "a", name: "A", price: 1, stock: 2, status: "active" }, { id: "b", name: "B", price: 1, stock: 50, status: "active" }],
      [{ order_id: "o", product_id: "a", name_snapshot: "A", qty: 3, price_snapshot: 100 }],
    );
    expect(p.top[0]).toMatchObject({ id: "a", qty: 3, revenue: 300 });
    expect(p.notSelling.map((x) => x.id)).toEqual(["b"]);
    expect(p.lowStock.map((x) => x.id)).toEqual(["a"]);
  });
  it("product drafts are always unsaved drafts with positive price", () => {
    expect(normalizeProductDraft({ name: "T-shirt", price: 450 }).status).toBe("draft");
    expect(() => normalizeProductDraft({ name: "T-shirt", price: 0 })).toThrow();
  });
});

import { copilotProductSlug as slugFn } from "./insights";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("copilotProductSlug", () => {
  i2("keeps latin words", () => e2(slugFn("Cotton T-Shirt!", "ab12")).toBe("cotton-t-shirt-ab12"));
  i2("falls back for Bengali", () => e2(slugFn("লাল শাড়ি", "x1")).toBe("product-x1"));
});
