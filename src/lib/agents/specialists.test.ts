import { describe, it, expect } from "vitest";
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
