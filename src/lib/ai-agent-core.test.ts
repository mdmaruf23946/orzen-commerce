import { describe, expect, test } from "vitest";
import {
  canonicalCaption,
  formatFocusVariants,
  isMessengerOrderable,
  productKind,
  scoreProductAgainstQuery,
} from "./ai-agent.server";

// Regression net for ai-agent.server.ts before it is split into modules.

describe("product kind", () => {
  test("unknown or missing type is physical", () => {
    expect(productKind({})).toBe("physical");
    expect(productKind({ product_type: "gadget" })).toBe("physical");
    expect(productKind({ product_type: "DIGITAL" })).toBe("digital");
  });
  test("only physical products can be ordered in chat", () => {
    expect(isMessengerOrderable({ product_type: "physical" })).toBe(true);
    for (const t of ["digital", "service", "subscription"]) {
      expect(isMessengerOrderable({ product_type: t })).toBe(false);
    }
  });
});

describe("product search scoring", () => {
  test("exact name beats partial name", () => {
    const exact = scoreProductAgainstQuery({ name: "Black Panjabi" }, ["black", "panjabi"], "black panjabi");
    const partial = scoreProductAgainstQuery({ name: "Black Panjabi Premium" }, ["black", "panjabi"], "black panjabi");
    expect(exact).toBeGreaterThan(partial);
  });
  test("exact SKU gives a strong match", () => {
    expect(scoreProductAgainstQuery({ name: "Shirt", sku: "sk-101" }, ["sk-101"], "")).toBeGreaterThanOrEqual(150);
  });
  test("no signal scores zero", () => {
    expect(scoreProductAgainstQuery({ name: "Shirt" }, ["watch"], "watch")).toBe(0);
  });
});

describe("product caption", () => {
  test("shows price, old price and stock", () => {
    expect(canonicalCaption({ name: "Bag", price: 900, old_price: 1200, stock: 3 })).toBe(
      "Bag — ৳900 (was ৳1200), in stock.",
    );
    expect(canonicalCaption({ name: "Bag", price: 900, stock: 0, short_description: "Leather" })).toBe(
      "Bag — ৳900, out of stock. Leather",
    );
  });
});

describe("variant formatting", () => {
  test("lists option values", () => {
    expect(formatFocusVariants({ options: [{ name: "Size", values: ["M", "L"] }] })).toBe("Size: M/L");
  });
  test("flat arrays are deduplicated and capped at 10", () => {
    expect(formatFocusVariants(["Red", "Red", { label: "Blue" }])).toBe("Red, Blue");
    expect(formatFocusVariants(Array.from({ length: 15 }, (_, i) => `v${i}`)).split(", ")).toHaveLength(10);
  });
  test("empty input gives empty text", () => {
    expect(formatFocusVariants(null)).toBe("");
  });
});
