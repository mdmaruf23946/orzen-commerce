import { describe, it, expect } from "vitest";
import { attachNewSubdomainOrThrow } from "./subdomain-rename";

describe("subdomain rename guard", () => {
  it("passes when the new host attaches", async () => {
    await expect(attachNewSubdomainOrThrow("a.orzen.top", async () => ({ ok: true }))).resolves.toBeUndefined();
  });
  it("throws a clear error when attach fails", async () => {
    await expect(
      attachNewSubdomainOrThrow("a.orzen.top", async () => ({ ok: false, reason: "error", error: "boom" })),
    ).rejects.toThrow(/a\.orzen\.top.*boom/s);
  });
  it("throws when automation is not configured", async () => {
    await expect(
      attachNewSubdomainOrThrow("a.orzen.top", async () => ({ ok: false, reason: "not_configured" })),
    ).rejects.toThrow(/a\.orzen\.top/);
  });
  it("throws when attach itself throws", async () => {
    await expect(
      attachNewSubdomainOrThrow("a.orzen.top", async () => { throw new Error("net"); }),
    ).rejects.toThrow(/net/);
  });
});
