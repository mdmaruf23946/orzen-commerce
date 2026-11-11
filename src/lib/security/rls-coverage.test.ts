// Stage D: static check of supabase/migrations (read-only) — every public table
// created there must have row level security enabled.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "supabase/migrations");
const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .map((f) => readFileSync(join(dir, f), "utf8")).join("\n").toLowerCase();

const name = (s: string) => s.replace(/"/g, "").replace(/^public\./, "");
const created = new Set(
  [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"?public"?\.)?"?[a-z0-9_]+"?)/g)].map((m) => name(m[1])),
);
const dropped = new Set(
  [...sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?((?:"?public"?\.)?"?[a-z0-9_]+"?)/g)].map((m) => name(m[1])),
);
const rls = new Set(
  [...sql.matchAll(/alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?((?:"?public"?\.)?"?[a-z0-9_]+"?)\s+enable\s+row\s+level\s+security/g)].map((m) => name(m[1])),
);

describe("RLS coverage", () => {
  it("finds tables to check", () => { expect(created.size).toBeGreaterThan(50); });
  it("every created public table enables RLS", () => {
    const missing = [...created].filter((t) => !rls.has(t) && !dropped.has(t));
    expect(missing).toEqual([]);
  });
  it("tenant tables keep store/owner-scoped policies", () => {
    for (const t of ["orders", "products", "store_staff", "ai_conversations"]) {
      const re = new RegExp(`create\\s+policy[^;]*on\\s+(?:public\\.)?"?${t}"?[^;]*(store_id|owner_user_id|user_id|auth\\.uid)`);
      expect(re.test(sql), t).toBe(true);
    }
  });
});
