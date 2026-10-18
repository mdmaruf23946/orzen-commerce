import { describe, it, expect } from "vitest";
import { detectSmallTalk, smallTalkReply } from "./fast-path-replies";
describe("small talk", () => {
  it("detects safe phrases", () => {
    expect(detectSmallTalk("Assalamu alaikum")).toBe("greeting");
    expect(detectSmallTalk("ধন্যবাদ ভাই")).toBe("thanks");
    expect(detectSmallTalk("কেমন আছেন?")).toBe("how_are_you");
    expect(detectSmallTalk("আল্লাহ হাফেজ")).toBe("bye");
  });
  it("never fast-paths order answers or questions", () => {
    for (const t of ["ok", "ঠিক আছে", "আচ্ছা", "hi price koto", "dam koto", "এটা আছে?"]) expect(detectSmallTalk(t)).toBeNull();
  });
  it("replies contain no prices and fill store name", () => {
    for (let i = 0; i < 50; i++) {
      const r = smallTalkReply("greeting", { bn: i % 2 === 0, storeName: "ORZEN", seed: "c" + i });
      expect(r).not.toMatch(/৳|\{store\}|tk|taka/i);
    }
  });
});
