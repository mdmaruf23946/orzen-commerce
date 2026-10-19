import { describe, it, expect } from "vitest";
import { detectAbuse } from "./conversation-guard";
const now = Date.parse("2026-10-19T12:00:00Z");
const at = (sec: number, content = "hi" + sec) => ({ content, created_at: new Date(now - sec * 1000).toISOString() });
describe("detectAbuse", () => {
  it("normal chat is allowed", () => expect(detectAbuse([at(5), at(30), at(200)], now).abusive).toBe(false));
  it("9 messages in 60s pauses AI", () => expect(detectAbuse(Array.from({ length: 9 }, (_, i) => at(i * 5)), now).abusive).toBe(true));
  it("same text 4 times in 10 min pauses AI", () => expect(detectAbuse([at(10, "dam koto"), at(100, "Dam koto?"), at(200, "dam koto"), at(400, "dam  koto")], now).abusive).toBe(true));
  it("same text 3 times is allowed", () => expect(detectAbuse([at(10, "x"), at(100, "x"), at(200, "x")], now).abusive).toBe(false));
});
