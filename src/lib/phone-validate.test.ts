import { describe, it, expect } from "vitest";
import { normalizeSignupPhone } from "./phone-validate";

describe("normalizeSignupPhone", () => {
  it("accepts a Bangladeshi mobile", () => expect(normalizeSignupPhone("01712-345678")).toBe("01712345678"));
  it("normalizes +880 format", () => expect(normalizeSignupPhone("+8801712345678")).toBe("01712345678"));
  it("rejects empty", () => expect(normalizeSignupPhone("")).toBeNull());
  it("rejects too short", () => expect(normalizeSignupPhone("01712")).toBeNull());
});
