import { describe, expect, it } from "vitest";
import { pgSafe } from "./pg-filter";

describe("pgSafe search regression", () => {
  it("preserves a complete customer email", () => {
    expect(pgSafe("rahim@gmail.com")).toBe("rahim@gmail.com");
  });

  it("preserves dotted text", () => {
    expect(pgSafe("shirt.v2")).toBe("shirt.v2");
  });

  it("preserves underscores in emails and exact SKU lookups", () => {
    expect(pgSafe("rahim_uddin@gmail.com")).toBe("rahim_uddin@gmail.com");
    expect(pgSafe("SKU_A.1:blue")).toBe("SKU_A.1:blue");
  });

  it("preserves colons in exact transaction identifiers", () => {
    expect(pgSafe("txn:2026.10_24")).toBe("txn:2026.10_24");
  });

  it("cannot add OR conditions using delimiters or quotes", () => {
    const result = pgSafe('rahim@gmail.com),is_active.eq.true,(email.ilike.%\\"*\'');
    expect(result).toBe("rahim@gmail.com is_active.eq.true email.ilike.");
    expect(result).not.toMatch(/[,()%*\\"']/);
  });

  it("retains the existing normalization and length limit", () => {
    expect(pgSafe("  Rahim\n  Uddin  ")).toBe("Rahim Uddin");
    expect(pgSafe(null)).toBe("");
    expect(pgSafe("x".repeat(120))).toHaveLength(100);
  });
});