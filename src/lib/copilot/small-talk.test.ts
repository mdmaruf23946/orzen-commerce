import { describe, expect, it } from "vitest";
import { smallTalkReply } from "./small-talk";
describe("smallTalkReply", () => {
  it("answers salam with walaikum salam, never salam again", () => {
    for (const t of ["আসসালামু আলাইকুম", "Assalamu alaikum bhai", "slm"]) {
      const r = smallTalkReply(t)!;
      expect(r.startsWith("ওয়ালাইকুম আসসালাম")).toBe(true);
      expect(r).not.toContain("আসসালামু আলাইকুম");
    }
  });
  it("answers how-are-you", () => {
    expect(smallTalkReply("আসসালামু আলাইকুম, কেমন আছেন?")).toContain("আলহামদুলিল্লাহ");
  });
  it("leaves real questions to the model", () => {
    expect(smallTalkReply("আসসালামু আলাইকুম, আজকের বিক্রি কত?")).toBeNull();
    expect(smallTalkReply("dead stock কোনগুলো")).toBeNull();
  });
});
