import { describe, expect, it } from "vitest";
import { acquireStoreSlot, storeSlotsInUse } from "./store-slots";

describe("store slots", () => {
  it("default is unlimited: 5,000 parallel jobs for one store never wait", async () => {
    const many = await Promise.all(Array.from({ length: 5000 }, () => acquireStoreSlot("u1")));
    expect(storeSlotsInUse("u1")).toBe(5000);
    many.forEach((r) => r());
    expect(storeSlotsInUse("u1")).toBe(0);
  });

  it("an explicit limit still queues extra jobs", async () => {
    const rels = await Promise.all([1, 2, 3, 4].map(() => acquireStoreSlot("s1", 4)));
    expect(storeSlotsInUse("s1")).toBe(4);
    let fifth = false;
    const p = acquireStoreSlot("s1", 4).then((r) => { fifth = true; return r; });
    await new Promise((r) => setTimeout(r, 10));
    expect(fifth).toBe(false);
    rels[0]();
    const r5 = await p;
    expect(fifth).toBe(true);
    [...rels.slice(1), r5].forEach((r) => r());
    expect(storeSlotsInUse("s1")).toBe(0);
  });

  it("never drops a job: runs after the max wait even when full", async () => {
    const rel = await acquireStoreSlot("s2", 1);
    const late = await acquireStoreSlot("s2", 1, 20);
    expect(storeSlotsInUse("s2")).toBe(2);
    rel(); late();
  });

  it("other stores are not blocked", async () => {
    const rel = await acquireStoreSlot("s3", 1);
    const other = await acquireStoreSlot("s4", 1, 10_000);
    expect(storeSlotsInUse("s4")).toBe(1);
    rel(); other();
  });
});
