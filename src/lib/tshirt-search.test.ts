import { test, expect } from "vitest";
import { tokenize } from "./catalog-memory.server";
import { isNameOnlyProductQuery } from "./messenger-webhook.server";
const hay = "urban wear প্রিমিয়াম ওভারসাইজড কটন টি-শার্ট premium oversized cotton t-shirt";
const prodTokens = new Set(tokenize(hay));
for (const q of ["টিসার্ট","টিশার্ট","টি শার্ট","টি-শার্ট","t shirt","tshirt","T-Shirt","গেঞ্জি"]) {
  test(q, () => {
    const terms = tokenize(q);
    expect(terms.some((t) => prodTokens.has(t) || hay.includes(t))).toBe(true);
    expect(isNameOnlyProductQuery(q)).toBe(true);
  });
}
