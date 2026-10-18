import { describe, expect, it } from "vitest";
import { billableTokens } from "./ai-credit-billing";

describe("billableTokens", () => {
  it("bills 1 token when the reply used 1 token (no minimum)", () => {
    expect(billableTokens(1)).toBe(1);
  });
  it("bills 5 tokens for a 5-token reply", () => {
    expect(billableTokens(5)).toBe(5);
  });
  it("never bills more than 100 tokens per reply", () => {
    expect(billableTokens(285)).toBe(100);
  });
  it("bills 0 when nothing was generated", () => {
    expect(billableTokens(0)).toBe(0);
  });
});
