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
describe("off-topic / abusive auto-off", () => {
  it("one off-topic message is allowed", () => expect(detectAbuse([at(10, "write me a python code")], now).abusive).toBe(false));
  it("3 off-topic messages pause AI", () => expect(detectAbuse([at(10, "write me a python code"), at(60, "solve this math problem"), at(120, "tell me a joke")], now).abusive).toBe(true));
  it("2 abusive messages pause AI", () => expect(detectAbuse([at(10, "fuck you"), at(40, "bitch")], now).abusive).toBe(true));
  it("normal shopping questions are fine", () => expect(detectAbuse([at(10, "দাম কত?"), at(40, "ডেলিভারি চার্জ কত"), at(80, "অর্ডার করতে চাই")], now).abusive).toBe(false));
});
