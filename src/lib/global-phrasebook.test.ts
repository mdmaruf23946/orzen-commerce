import { describe, expect, it } from "vitest";
import { intentFromToolCalls, phraseKey, promote } from "./global-phrasebook";

describe("global phrasebook safety", () => {
  it("never stores phones, order numbers, links or long text", () => {
    expect(phraseKey("01712345678")).toBeNull();
    expect(phraseKey("অর্ডার ১২৩৪৫ কই")).toBeNull();
    expect(phraseKey("see www.x.com")).toBeNull();
    expect(phraseKey("আমার নাম করিম বাসা মিরপুর দশ রোড সাত কাছে")).toBeNull();
    expect(phraseKey("কি কি পাওয়া যায়?")).toBe("কি কি পাওয়া যায়");
  });

  it("learns only from single-purpose turns", () => {
    expect(intentFromToolCalls([{ name: "listCategories" }])).toBe("catalog_browse");
    expect(intentFromToolCalls([{ name: "getDeliveryCharge", args: {} }])).toBe("delivery_charge");
    expect(intentFromToolCalls([{ name: "getDeliveryCharge", args: { area: "Khulna" } }])).toBeNull();
    expect(intentFromToolCalls([{ name: "listCategories" }, { name: "searchProducts" }])).toBeNull();
    expect(intentFromToolCalls([{ name: "checkStock" }])).toBeNull();
  });

  it("needs 3 stores and 90% agreement", () => {
    expect(promote([{ phrase_key: "a", intent: "catalog_browse", stores: 2, hits: 50 }]).size).toBe(0);
    expect(promote([{ phrase_key: "a", intent: "catalog_browse", stores: 3, hits: 9 }]).get("a")).toBe("catalog_browse");
    expect(
      promote([
        { phrase_key: "a", intent: "catalog_browse", stores: 5, hits: 8 },
        { phrase_key: "a", intent: "delivery_charge", stores: 2, hits: 2 },
      ]).size,
    ).toBe(0);
  });
});
