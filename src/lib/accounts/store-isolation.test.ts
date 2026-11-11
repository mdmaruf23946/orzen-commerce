// Stage D: multi-store isolation of the Merchant Panel access layer.
import { describe, it, expect, vi, beforeEach } from "vitest";

let wanted: string | null = null;
vi.mock("@/lib/accounts/request-store", () => ({ requestedStoreId: () => wanted }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/storefront/store-bootstrap", () => ({ ensureStoreForAccount: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({ middleware: () => ({ server: (f: any) => f }) }),
}));

import { resolveStoreAccess, assertSection } from "@/lib/accounts/store-access";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
type Row = Record<string, any>;

function fakeDb(tables: Record<string, Row[]>) {
  return {
    from(t: string) {
      let rows = [...(tables[t] ?? [])];
      const q: any = {
        select: () => q,
        eq: (c: string, v: any) => ((rows = rows.filter((r) => r[c] === v)), q),
        order: () => q,
        limit: (n: number) => Promise.resolve({ data: rows.slice(0, n) }),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
      };
      return q;
    },
  };
}

const stores = [
  { id: A, owner_user_id: "ownerA" },
  { id: B, owner_user_id: "ownerB" },
];
let uid = 0;
const user = (p: string) => `${p}-${++uid}`;

beforeEach(() => { wanted = null; });

describe("multi-store isolation", () => {
  it("owner resolves only their own store", async () => {
    const acc = await resolveStoreAccess(fakeDb({ stores }), "ownerA");
    expect(acc.storeId).toBe(A);
    expect(acc.isOwner).toBe(true);
  });

  it("owner cannot switch into another store via the active-store header", async () => {
    wanted = B;
    const acc = await resolveStoreAccess(fakeDb({ stores, store_staff: [] }), "ownerA");
    expect(acc.storeId).toBe(A);
  });

  it("delegated member of B may work in B, scoped to B's owner", async () => {
    const u = user("ownerA");
    wanted = B;
    const db = fakeDb({
      stores: [{ id: A, owner_user_id: u }, stores[1]],
      store_staff: [{ id: "s", user_id: u, store_id: B, status: "active", access_type: "delegated", permissions: { orders: "view" } }],
    });
    const acc = await resolveStoreAccess(db, u);
    expect(acc.storeId).toBe(B);
    expect(acc.isOwner).toBe(false);
    expect(acc.ownerUserId).toBe("ownerB");
    expect(acc.ownStoreId).toBe(A);
  });

  it("revoked, suspended or expired membership gives no access to the other store", async () => {
    for (const row of [
      { status: "revoked" },
      { status: "active", expires_at: new Date(Date.now() - 1000).toISOString() },
    ]) {
      const u = user("x");
      wanted = B;
      const acc = await resolveStoreAccess(
        fakeDb({ stores, store_staff: [{ id: "s", user_id: u, store_id: B, access_type: "employee", ...row }] }),
        u,
      );
      expect(acc.storeId).toBeNull();
    }
  });

  it("staff of A cannot reach B by sending B's id", async () => {
    const u = user("emp");
    wanted = B;
    const acc = await resolveStoreAccess(
      fakeDb({ stores, store_staff: [{ id: "s", user_id: u, store_id: A, status: "active", access_type: "employee", permissions: {} }] }),
      u,
    );
    expect(acc.storeId).toBe(A);
  });

  it("staff access is re-checked every call (revoke applies immediately)", async () => {
    const u = user("emp");
    const staff = [{ id: "s", user_id: u, store_id: A, status: "active", access_type: "employee", permissions: {} }];
    const tables = { stores, store_staff: staff };
    expect((await resolveStoreAccess(fakeDb(tables), u)).storeId).toBe(A);
    staff[0].status = "revoked";
    expect((await resolveStoreAccess(fakeDb(tables), u)).storeId).toBeNull();
  });
});

describe("section permissions", () => {
  const staffAcc = (permissions: any) => ({
    storeId: A, isOwner: false, ownerUserId: "ownerA", permissions,
    staff: { id: "s", name: "n", role: "custom", status: "active", employee_code: null, must_change_password: false, access_type: "employee" as const },
  });
  it("view-only staff cannot manage", () => {
    expect(() => assertSection(staffAcc({ orders: "view" }), "orders", "view")).not.toThrow();
    expect(() => assertSection(staffAcc({ orders: "view" }), "orders", "manage")).toThrow();
  });
  it("staff without a section is blocked", () => {
    expect(() => assertSection(staffAcc({}), "orders")).toThrow();
  });
  it("account with no store membership is blocked", () => {
    expect(() => assertSection({ storeId: null, isOwner: false, ownerUserId: "u", staff: null, permissions: null }, "orders")).toThrow();
  });
});
