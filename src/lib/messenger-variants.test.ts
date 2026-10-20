import { describe, expect, test } from "vitest";
import { nextVariantStep, parseVariantPayload, selectedVariant, variantPayload } from "./messenger-variants";

const v = {
  options: [
    { name: "Color", values: ["Black", "White"] },
    { name: "Size", values: ["M", "L"] },
  ],
  items: [
    { options: { Color: "Black", Size: "M" }, price: 890, stock: 5 },
    { options: { Color: "Black", Size: "L" }, price: 950, stock: 0 },
    { options: { Color: "White", Size: "M" }, price: 890, stock: 2 },
  ],
};

describe("messenger variant picker", () => {
  test("color is asked first, then size", () => {
    expect(nextVariantStep(v, {})?.name).toBe("Color");
    expect(nextVariantStep(v, { Color: "Black" })?.name).toBe("Size");
  });
  test("out-of-stock sizes are hidden for the chosen color", () => {
    expect(nextVariantStep(v, { Color: "Black" })?.values).toEqual(["M"]);
  });
  test("complete selection has no next step and gives the variant price", () => {
    expect(nextVariantStep(v, { Color: "White", Size: "M" })).toBeNull();
    expect(selectedVariant(v, { Color: "Black", Size: "L" })?.price).toBe(950);
  });
  test("products without variants skip the picker", () => {
    expect(nextVariantStep([], {})).toBeNull();
  });
  test("payload round-trips", () => {
    const id = "2c880cd8-511b-482b-aff0-42cdeb7c738c";
    expect(parseVariantPayload(variantPayload(id, "Size", "XL"))).toEqual({ productId: id, name: "Size", value: "XL" });
  });
});
