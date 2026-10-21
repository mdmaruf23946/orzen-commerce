import { describe, it, expect } from "vitest";
import { isCatalogBrowseIntent } from "./catalog-browse-intent";

describe("catalog browse intent", () => {
  it.each(["আপনাদের কাছে কি আছে", "আপনাদের কাছে কি আছে?", "কি কি আছে", "কী পাওয়া যায়", "ki ki ase", "what do you sell", "সব প্রোডাক্ট দেখান"])(
    "browse: %s",
    (t) => expect(isCatalogBrowseIntent(t)).toBe(true),
  );
  it.each(["টিশার্ট কি আছে", "এটা কি আছে", "দাম কত", "মধু আছে?", "অর্ডার করতে চাই"])("not browse: %s", (t) =>
    expect(isCatalogBrowseIntent(t)).toBe(false),
  );
});
