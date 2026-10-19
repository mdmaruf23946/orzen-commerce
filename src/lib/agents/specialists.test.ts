import { describe, it, expect } from "vitest";
import { specialistFocus, _specialistCount } from "./specialists";

const f = (t: string) => specialistFocus("s1", "messenger", t).agentId;

describe("specialist agents", () => {
  it("registers five agents", () => expect(_specialistCount()).toBe(5));
  it("routes greetings to frontline", () => expect(f("আসসালামু আলাইকুম")).toBe("frontline"));
  it("routes product questions", () => expect(f("এই শার্টের দাম কত")).toBe("product"));
  it("routes order taking", () => expect(f("আমি অর্ডার করতে চাই")).toBe("order"));
  it("routes delivery charge to policy", () => expect(f("ডেলিভারি চার্জ কত")).toBe("policy"));
  it("routes tracking", () => expect(f("আমার পার্সেল কোথায়")).toBe("tracking"));
});
