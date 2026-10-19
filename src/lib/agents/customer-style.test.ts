import { describe, it, expect } from "vitest";
import { deriveCustomerStyle, personaInstruction, customerTexts } from "./customer-style";
import { registerAgent, routeMessage, _resetAgents } from "./registry";

describe("customer style memory", () => {
  it("remembers address term across messages", () => {
    const s = deriveCustomerStyle(["ভাইয়া দাম কত?", "আচ্ছা"], "ডেলিভারি কবে?");
    expect(s.address).toBe("bhaiya");
    expect(s.language).toBe("bn");
  });
  it("latest message decides language", () => {
    expect(deriveCustomerStyle(["দাম কত"], "dam koto vai").language).toBe("banglish");
  });
  it("no emoji when merchant disabled it", () => {
    const s = deriveCustomerStyle(["hi 😊"], "price?");
    expect(personaInstruction(s, { allowEmoji: false })).toContain("No emojis");
  });
  it("only user texts are kept", () => {
    expect(customerTexts([{ role: "user", content: "a" }, { role: "assistant", content: "b" }])).toEqual(["a"]);
  });
});

describe("agent registry", () => {
  it("routes to highest-priority agent and only matching drawers", () => {
    _resetAgents();
    registerAgent({ id: "low", priority: 1, matches: () => true, drawers: [] });
    registerAgent({ id: "product", priority: 5, matches: (i) => /দাম/.test(i.text),
      drawers: [{ id: "price", matches: (t) => /দাম/.test(t) }, { id: "stock", matches: (t) => /স্টক/.test(t) }] });
    const r = routeMessage({ storeId: "s", channel: "messenger", text: "দাম কত" });
    expect(r?.agent.id).toBe("product");
    expect(r?.drawers.map((d) => d.id)).toEqual(["price"]);
  });
});
