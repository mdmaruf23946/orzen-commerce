// Stage D (multi-merchant): Merchant A must never reach Merchant B's data.
import { describe, it, expect, vi, beforeEach } from "vitest";

let wanted: string | null = null;
vi.mock("@/lib/accounts/request-store", () => ({ requestedStoreId: () => wanted }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/storefront/store-bootstrap", () => ({ ensureStoreForAccount: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({ middleware: () => ({ server: (f: any) => f }) }),
}));

import { resolveStoreAccess, assertSection, myStoreRow, storeAccess } from "@/lib/accounts/store-access";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let n = 0;
const uid = (p: string) => `${p}-${++n}`;

function fakeDb(tables: Record<string, any[]>) {
  return {
    from(t: string) {
      let rows = [...(tables[t] ?? [])];
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => ((rows = rows.filter((r) => r[c] === v)), q),
        order: () => q,
        limit: (k: number) => Promise.resolve({ data: rows.slice(0, k) }),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
      };
      return q;
    },
  };
}

beforeEach(() => { wanted = null; });

describe("Merchant A vs Merchant B", () => {
  it("myStoreRow returns only A's row even when B's id is requested", async () => {
    const a = uid("ownerA");
    wanted = B;
    const db = fakeDb({
      stores: [{ id: A, owner_user_id: a, name: "A" }, { id: B, owner_user_id: "ownerB", name: "B" }],
      store_staff: [],
    });
    const row = await myStoreRow(db, a, "id,name", "orders");
    expect(row?.id).toBe(A);
    expect(row?.name).toBe("A");
  });

  it("cached owner access is keyed per user, so A's cache never serves B", async () => {
    const a = uid("ownerA"), b = uid("ownerB");
    const db = fakeDb({ stores: [{ id: A, owner_user_id: a }, { id: B, owner_user_id: b }] });
    expect((await resolveStoreAccess(db, a)).storeId).toBe(A);
    expect((await resolveStoreAccess(db, b)).storeId).toBe(B);
    expect((await resolveStoreAccess(db, a)).storeId).toBe(A);
  });

  it("a stranger with no store and no membership gets no store", async () => {
    wanted = B;
    const acc = await resolveStoreAccess(fakeDb({ stores: [{ id: B, owner_user_id: "ownerB" }], store_staff: [] }), uid("s"));
    expect(acc.storeId).toBeNull();
    expect(() => assertSection(acc, "orders")).toThrow();
  });

  it("delegated member of B cannot open B's owner-only sections", async () => {
    const u = uid("d");
    wanted = B;
    const acc = await resolveStoreAccess(fakeDb({
      stores: [{ id: B, owner_user_id: "ownerB" }],
      store_staff: [{ id: "s", user_id: u, store_id: B, status: "active", access_type: "delegated",
        permissions: { employees: "manage", domains: "manage", payment_gateway: "manage" } }],
    }), u);
    expect(acc.storeId).toBe(B);
    for (const s of ["employees", "domains", "payment_gateway"]) {
      expect(() => assertSection(acc, s, "view")).toThrow();
    }
  });

  it("membership expiring in future works; one expired a second ago does not", async () => {
    const u = uid("d");
    wanted = B;
    const row = { id: "s", user_id: u, store_id: B, status: "active", access_type: "delegated", permissions: {} as any,
      expires_at: new Date(Date.now() + 60_000).toISOString() };
    const tables = { stores: [{ id: B, owner_user_id: "ownerB" }], store_staff: [row] };
    expect((await resolveStoreAccess(fakeDb(tables), u)).storeId).toBe(B);
    row.expires_at = new Date(Date.now() - 1000).toISOString();
    expect((await resolveStoreAccess(fakeDb(tables), u)).storeId).toBeNull();
  });

  it("panel middleware rewrites userId to the store owner only for an allowed member", async () => {
    const u = uid("emp");
    wanted = B;
    const supabase = fakeDb({
      stores: [{ id: B, owner_user_id: "ownerB" }],
      store_staff: [{ id: "s", user_id: u, store_id: B, status: "active", access_type: "employee", permissions: { orders: "view" } }],
    });
    const mw: any = storeAccess("orders", "view");
    const out = await mw({ context: { supabase, userId: u }, next: (x: any) => x });
    expect(out.context.userId).toBe("ownerB");
    expect(out.context.authUserId).toBe(u);

    const manage: any = storeAccess("orders", "manage");
    await expect(manage({ context: { supabase, userId: u }, next: (x: any) => x })).rejects.toThrow();
  });

  it("panel middleware refuses an account with no store", async () => {
    const mw: any = storeAccess("orders");
    await expect(mw({ context: { supabase: fakeDb({ stores: [], store_staff: [] }), userId: uid("x") }, next: (x: any) => x }))
      .rejects.toThrow("No store found");
  });
});
