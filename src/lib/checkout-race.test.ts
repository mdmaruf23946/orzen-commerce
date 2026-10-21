// Synthetic model of create_chat_order's row lock: per-product serial section,
// stock checked under the lock. Verifies "last piece" goes to exactly one buyer.
import { describe, it, expect } from "vitest";
import { buildIdempotencyKey } from "./chat-order.server";

function makeStore(stock: number) {
  let s = stock;
  let chain = Promise.resolve();
  const orders = new Set<string>();
  return {
    order(key: string, qty = 1) {
      const run = chain.then(async () => {
        await new Promise((r) => setTimeout(r, 0));
        if (orders.has(key)) return { ok: true, existing: true };
        if (s < qty) return { ok: false, error: "out_of_stock", available: s };
        s -= qty; orders.add(key);
        return { ok: true, existing: false };
      });
      chain = run.then(() => undefined);
      return run;
    },
    get stock() { return s; },
  };
}

describe("checkout under peak load", () => {
  it("last piece: exactly one of 500 simultaneous buyers wins", async () => {
    const st = makeStore(1);
    const res = await Promise.all(Array.from({ length: 500 }, (_, i) => st.order(`k${i}`)));
    expect(res.filter((r) => r.ok).length).toBe(1);
    expect(res.filter((r: any) => r.error === "out_of_stock" && r.available === 0).length).toBe(499);
    expect(st.stock).toBe(0);
  });

  it("50,000 synthetic orders on 100 stock never oversell; duplicates reuse", async () => {
    const st = makeStore(100);
    const keys = Array.from({ length: 50_000 }, (_, i) => `k${i % 40_000}`);
    const res = await Promise.all(keys.map((k) => st.order(k)));
    expect(res.filter((r: any) => r.ok && !r.existing).length).toBe(100);
    expect(st.stock).toBe(0);
  }, 30_000);

  it("same customer message twice gives the same order key", () => {
    const a = { channel: "messenger", conversationId: "c1", productId: "p1", qty: 1, phone: "+8801711-000000" };
    expect(buildIdempotencyKey(a)).toBe(buildIdempotencyKey({ ...a, phone: "01711000000" }));
  });
});
