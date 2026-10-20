import { describe, expect, test } from "vitest";
import { isAffirmative, isNegative } from "./slot-validate";

describe("order confirmation replies", () => {
  test("misspelt yes (হে) counts as yes", () => {
    for (const t of ["হ্যাঁ", "হে", "হ্যা ভাই", "জি", "ok", "he"]) expect(isAffirmative(t)).toBe(true);
  });
  test("no / won't take counts as no", () => {
    for (const t of ["না", "নিব না", "লাগবে না", "no"]) expect(isNegative(t)).toBe(true);
  });
  test("a product question is neither", () => {
    expect(isAffirmative("হে টিশার্ট আছে?")).toBe(false);
    expect(isNegative("দাম কত")).toBe(false);
  });
});
