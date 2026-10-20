import { describe, expect, it } from "vitest";
import { claimInflight, firstSighting, forget, releaseInflight } from "./mid-dedupe";

describe("mid dedupe", () => {
  it("drops a repeated mid within 15 minutes", () => {
    expect(firstSighting("p:m1", 0)).toBe(true);
    expect(firstSighting("p:m1", 1000)).toBe(false);
  });
  it("accepts the mid again after 15 minutes", () => {
    expect(firstSighting("p:m2", 0)).toBe(true);
    expect(firstSighting("p:m2", 15 * 60_000 + 1)).toBe(true);
  });
  it("forget lets a failed write be retried", () => {
    firstSighting("p:m3", 0);
    forget("p:m3");
    expect(firstSighting("p:m3", 10)).toBe(true);
  });
  it("one job runs at most once at a time per isolate", () => {
    expect(claimInflight("j1")).toBe(true);
    expect(claimInflight("j1")).toBe(false);
    releaseInflight("j1");
    expect(claimInflight("j1")).toBe(true);
  });
});
