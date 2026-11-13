// Stage D1/D2: AI chat and checkout-draft isolation between Merchant A and B.
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let tables: Record<string, any[]> = {};
const writes: { t: string; op: string; filters: Record<string, any>; v?: any }[] = [];

function db() {
  return {
    from(t: string) {
      const filters: Record<string, any> = {};
      let op = "select"; let v: any;
      const rows = () => (tables[t] ?? []).filter((r) => Object.entries(filters).every(([k, x]) => r[k] === x));
      const q: any = {
        select: () => q, order: () => q, lt: () => q, is: () => q, gte: () => q,
        eq: (c: string, x: any) => ((filters[c] = x), q),
        limit: () => Promise.resolve({ data: rows() }),
        maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null }),
        update: (x: any) => { op = "update"; v = x; return q; },
        upsert: (x: any) => { writes.push({ t, op: "upsert", filters: {}, v: x }); return Promise.resolve({}); },
        then: (res: any) => { if (op === "update") { writes.push({ t, op, filters: { ...filters }, v }); for (const r of rows()) Object.assign(r, v); } return Promise.resolve({ data: rows() }).then(res); },
      };
      return q;
    },
  };
}

vi.mock("@tanstack/react-start", () => {
  const chain: any = () => { const c: any = { middleware: () => c, inputValidator: (f: any) => ((c.v = f), c), handler: (h: any) => (d: any) => h({ data: c.v ? c.v(d.data) : d.data, context: d.context }) }; return c; };
  return { createServerFn: chain, createMiddleware: () => ({ middleware: () => ({ server: (f: any) => f }) }) };
});
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ get supabaseAdmin() { return db(); } }));
vi.mock("@/lib/orders/admin-order.server", () => ({
  getOwnedStoreId: async (_s: any, uid: string) => (uid === "ownerA" ? A : uid === "ownerB" ? B : null),
}));

import { canAccessWebConv, sha256Hex } from "@/lib/inbox/web-chat-access.server";
import { saveCheckoutDraft, listCheckoutDrafts, dismissCheckoutDraft, completeCheckoutDraft } from "@/lib/orders/checkout-drafts.functions";

const call = (fn: any, data: any, userId?: string) => fn({ data, context: { supabase: {}, userId } });
const D1 = "11111111-1111-4111-8111-111111111111";
const old = new Date(Date.now() - 3600_000).toISOString();

beforeEach(() => {
  writes.length = 0;
  tables = {
    stores: [{ id: A }, { id: B }],
    checkout_drafts: [{ id: D1, store_id: B, owner_hash: "x", phone: "01711111111", converted_order_id: null, dismissed: false, updated_at: old, created_at: old }],
    orders: [{ id: "22222222-2222-4222-8222-222222222222", store_id: A, phone: "01711111111", created_at: old }],
  };
});

describe("D1: Web Chat conversation isolation", () => {
  it("B's chat never opens from A's store even with the right key", async () => {
    const key = "k".repeat(64);
    const conv = { id: "c", store_id: B, web_access_hash: await sha256Hex(key) };
    expect(await canAccessWebConv(conv, A, key)).toBe(false);
    expect(await canAccessWebConv(conv, B, key)).toBe(true);
  });
  it("a chat id alone, a wrong key, or another customer cannot open it", async () => {
    const conv = { id: "c", store_id: B, web_access_hash: await sha256Hex("right"), web_customer_id: "cust1" };
    expect(await canAccessWebConv(conv, B)).toBe(false);
    expect(await canAccessWebConv(conv, B, "wrong")).toBe(false);
    expect(await canAccessWebConv(conv, B, null, "cust2")).toBe(false);
    expect(await canAccessWebConv(conv, B, null, "cust1")).toBe(true);
  });
});

describe("D2: checkout draft isolation", () => {
  it("Merchant A's list never contains B's drafts", async () => {
    expect(await call(listCheckoutDrafts, undefined, "ownerA")).toEqual([]);
    expect((await call(listCheckoutDrafts, undefined, "ownerB")).map((d: any) => d.id)).toEqual([D1]);
  });
  it("Merchant A cannot dismiss B's draft by sending its id", async () => {
    await call(dismissCheckoutDraft, { id: D1 }, "ownerA");
    expect(tables.checkout_drafts[0].dismissed).toBe(false);
    expect(writes[0].filters.store_id).toBe(A);
  });
  it("an account with no store cannot dismiss anything", async () => {
    await expect(call(dismissCheckoutDraft, { id: D1 }, "stranger")).rejects.toThrow("No store");
  });
  it("another browser or store cannot overwrite a draft", async () => {
    const base = { id: D1, secret: "s".repeat(40), name: "x", items: [], total: 1 };
    await call(saveCheckoutDraft, { ...base, storeId: A });
    await call(saveCheckoutDraft, { ...base, storeId: B });
    expect(writes.filter((w) => w.op === "upsert")).toEqual([]);
  });
  it("A's order cannot close B's draft", async () => {
    const r = await call(completeCheckoutDraft, { id: D1, storeId: B, orderId: "22222222-2222-4222-8222-222222222222" });
    expect(r.ok).toBe(false);
    expect(tables.checkout_drafts[0].converted_order_id).toBeNull();
  });
});
