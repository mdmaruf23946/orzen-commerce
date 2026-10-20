import { describe, it, expect } from "vitest";
import { asksForHuman } from "./conversation-guard.server";

describe("human handoff only on explicit request", () => {
  it("colour question never offers handoff", () => {
    expect(asksForHuman("এটার কি কি কালার আছে?")).toBe(false);
  });
  it("asking for a person does", () => {
    expect(asksForHuman("এডমিনের সাথে কথা বলতে চাই")).toBe(true);
  });
});
