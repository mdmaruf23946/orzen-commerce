import { describe, it, expect, beforeAll } from "vitest";
import { _resetAgents } from "./registry";
import { allowedToolsFor } from "./specialists";
beforeAll(() => _resetAgents());
import { specialistFocus, _specialistCount } from "./specialists";

const f = (t: string) => specialistFocus("s1", "messenger", t).agentId;

const cases: Record<string, [string, string][]> = {
  normal: [
    ["আসসালামু আলাইকুম", "frontline"],
    ["এই শার্টের দাম কত", "product"],
    ["আমি অর্ডার করতে চাই", "order"],
    ["ডেলিভারি চার্জ কত", "policy"],
    ["আমার পার্সেল কোথায় আছে", "tracking"],
    ["রিটার্ন করা যাবে?", "policy"],
    ["বিকাশে পেমেন্ট করা যাবে?", "policy"],
  ],
  typos: [
    ["টিসার্ট এর দাম কতো", "product"],
    ["দেলিব্যারি ছার্য কত", "policy"],
    ["অরডার নিবেন?", "order"],
    ["ডেলিভারী চার্জ কতো", "policy"],
    ["কুরীয়ার এ দিয়েছেন?", "tracking"],
    ["প্রডাক্টটা আছে কিনা", "product"],
  ],
  banglish: [
    ["dam koto bhai?", "product"],
    ["delivery charge koto ashbe?", "policy"],
    ["order ta track korbo kivabe?", "tracking"],
    ["stock ase?", "product"],
    ["kinte chai", "order"],
    ["kobe pabo?", "policy"],
    ["kmn asen", "frontline"],
  ],
  weird: [
    ["হুম", "frontline"],
    ["আচ্ছা", "frontline"],
    ["valo achen?", "frontline"],
    ["dokan kothay?", "frontline"],
    ["😂😂", "frontline"],
    ["", "frontline"],
  ],
  mixed: [
    ["দাম কত আর ডেলিভারি কবে পাব?", "policy"],
    ["অর্ডার করব, ডেলিভারি চার্জ কত?", "order"],
  ],
};

describe("specialist agents", () => {
  it("registers five agents (zero-config, same for every store)", () => expect(_specialistCount()).toBe(5));
  for (const [group, list] of Object.entries(cases))
    for (const [text, agent] of list)
      it(`${group}: "${text}" → ${agent}`, () => expect(f(text)).toBe(agent));

  it("compound question opens drawers of both agents", () => {
    const r = specialistFocus("s1", "messenger", "দাম কত আর ডেলিভারি চার্জ কত?");
    expect(r.drawerIds).toContain("delivery_charge");
    expect(r.drawerIds).toContain("catalog_cards");
  });
  it("routing is identical for any new store id", () => {
    expect(specialistFocus("brand-new-store", "whatsapp", "dam koto").agentId).toBe("product");
  });
});

describe("tool scoping (token diet)", () => {
  it("pure greeting gets no store tools", () => {
    expect([...allowedToolsFor("আসসালামু আলাইকুম")!]).toEqual(["escalateToHuman"]);
  });
  it("delivery question gets only policy tools, no product schemas", () => {
    const s = allowedToolsFor("ডেলিভারি চার্জ কত")!;
    expect(s.has("getDeliveryCharge")).toBe(true);
    expect(s.has("searchProducts")).toBe(false);
    expect(s.has("trackOrder")).toBe(false);
  });
  it("tracking gets trackOrder but not finalizeOrder", () => {
    const s = allowedToolsFor("আমার পার্সেল কোথায় আছে")!;
    expect(s.has("trackOrder")).toBe(true);
    expect(s.has("finalizeOrder")).toBe(false);
  });
  it("bare product name still can search", () => {
    expect(allowedToolsFor("টিশার্ট")!.has("searchProducts")).toBe(true);
  });
  it("greeting during an order keeps order tools", () => {
    expect(allowedToolsFor("ok", { orderInProgress: true })!.has("finalizeOrder")).toBe(true);
  });
  it("compound question unions both agents' tools", () => {
    const s = allowedToolsFor("দাম কত আর ডেলিভারি চার্জ কত?")!;
    expect(s.has("searchProducts") && s.has("getDeliveryCharge")).toBe(true);
  });
});
