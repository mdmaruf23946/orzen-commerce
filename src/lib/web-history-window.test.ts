import { describe, it, expect } from "vitest";
import { windowWebHistory } from "./web-history-window";

const u = (t: string) => ({ role: "user", parts: [{ type: "text", text: t }] });
const a = (t: string) => ({ role: "assistant", parts: [{ type: "text", text: t }] });

describe("windowWebHistory", () => {
  it("keeps short chats unchanged", () => {
    const m = [u("hi"), a("hello")];
    expect(windowWebHistory(m).recent).toHaveLength(2);
    expect(windowWebHistory(m).summary).toBe("");
  });
  it("sends at most 4 recent messages for a 20-message chat", () => {
    const m = Array.from({ length: 20 }, (_, i) => (i % 2 ? a(`r${i}`) : u(`q${i}`)));
    const r = windowWebHistory(m);
    expect(r.recent.length).toBeLessThanOrEqual(4);
    expect(r.recent[0].role).toBe("user");
    expect(r.summary).toContain("q14");
  });
});
