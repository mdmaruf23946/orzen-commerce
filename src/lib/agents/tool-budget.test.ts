import { describe, it, expect } from "vitest";
import { allowedToolsFor } from "./specialists";
import { checkPersonName } from "../slot-validate";

describe("token budget", () => {
  it("product question gets at most 6 tools", () => {
    expect(allowedToolsFor("টি-শার্ট এর দাম কত").size).toBeLessThanOrEqual(6);
  });
  it("delivery question gets at most 3 tools", () => {
    expect(allowedToolsFor("ডেলিভারি চার্জ কত").size).toBeLessThanOrEqual(3);
  });
  it("product name is never a customer name", () => {
    expect(checkPersonName("টিসার্ট").ok).toBe(false);
  });
});
