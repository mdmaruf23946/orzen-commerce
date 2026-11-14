import { describe, expect, it } from "vitest";
import { STUDIO_PARTS, applyVariant, activeVariantId, reorder } from "./studio-variants";
import { isBetaPath, isBetaTester } from "@/lib/beta-features";

describe("theme studio", () => {
  it("every part offers 4 to 10 designs", () => {
    for (const p of STUDIO_PARTS) {
      expect(p.variants.length).toBeGreaterThanOrEqual(4);
      expect(p.variants.length).toBeLessThanOrEqual(10);
    }
  });
  it("applying a design keeps other keys of the same group", () => {
    const out = applyVariant({ header: { search: false } }, { header: { logo_align: "center" } });
    expect(out.header).toEqual({ search: false, logo_align: "center" });
  });
  it("detects the active design", () => {
    const footer = STUDIO_PARTS.find((p) => p.id === "footer")!;
    expect(activeVariantId(footer, { footer: { layout: "centered", social: true, copyright: true, payment_icons: true } })).toBe("centered");
  });
  it("reorders sections", () => {
    expect(reorder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
  it("studio is visible only to the test account", () => {
    expect(isBetaPath("/admin/theme-studio")).toBe(true);
    expect(isBetaTester("mdmaruf0162323@gmail.com")).toBe(true);
    expect(isBetaTester("other@gmail.com")).toBe(false);
  });
});
