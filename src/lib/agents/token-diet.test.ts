import { describe, it, expect } from "vitest";
import { noDataChatReply } from "../fast-path-replies";
import { allowedToolsFor } from "./specialists";

describe("no-data chat agent (0 tokens)", () => {
  it("answers casual chat", () => {
    expect(noDataChatReply("এই কেমন আছো?")).toBeTruthy();
    expect(noDataChatReply("কি খবর")).toBeTruthy();
  });
  it("never swallows store questions", () => {
    expect(noDataChatReply("কেমন আছেন, দাম কত?")).toBeNull();
    expect(noDataChatReply("ডেলিভারি চার্জ কত")).toBeNull();
  });
});

describe("focus product colour question needs no tools", () => {
  it("drops search and card", () => {
    const t = allowedToolsFor("এটার আর কি কি কালার আছে?", { hasFocus: true });
    expect(t.has("searchProducts")).toBe(false);
    expect(t.has("sendProductCard")).toBe(false);
  });
  it("delivery question only gets policy tools", () => {
    const t = allowedToolsFor("ঢাকায় ডেলিভারি চার্জ কত?");
    expect(t.has("searchProducts")).toBe(false);
    expect(t.has("getDeliveryCharge")).toBe(true);
  });
});
