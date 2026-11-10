import { describe, expect, it } from "vitest";
import { isAdminCommand, splitReplyBubbles } from "./admin-intent";

describe("admin vs sales routing", () => {
  it("sales-style test messages go to the sales agent", () => {
    expect(isAdminCommand("Ai diye business control Korte chai")).toBe(false);
    expect(isAdminCommand("কুরিয়ার বুকিং কেমনে হয়?")).toBe(false);
    expect(isAdminCommand("Can you tell me more about your ad?")).toBe(false);
  });
  it("real admin commands stay with the admin assistant", () => {
    expect(isAdminCommand("ড্যাশবোর্ড")).toBe(true);
    expect(isAdminCommand("pending payment dao")).toBe(true);
    expect(isAdminCommand("হ্যাঁ")).toBe(true);
    expect(isAdminCommand("তাকে বলে দাও কাল কল করব")).toBe(true);
  });
  it("splits replies into at most 3 bubbles", () => {
    expect(splitReplyBubbles("a\n\nb\n\nc\n\nd")).toEqual(["a", "b", "c\nd"]);
  });
});
