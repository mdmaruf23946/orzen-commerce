import { describe, expect, test } from "vitest";
import { isShortFollowUp } from "./ai-agent.server";

describe("short product follow-ups", () => {
  test("elliptical questions about the last product count as follow-ups", () => {
    for (const t of ["কি ফুলের?", "খাঁটি তো?", "মেয়াদ কতদিন?", "কত গ্রাম?", "এটা কি ফুলের"]) {
      expect(isShortFollowUp(t)).toBe(true);
    }
  });
  test("greetings and acknowledgements are not follow-ups", () => {
    for (const t of ["সালাম", "ধন্যবাদ", "ok", "হুম"]) expect(isShortFollowUp(t)).toBe(false);
  });
});
