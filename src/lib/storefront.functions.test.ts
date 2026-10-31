import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, pages } = vi.hoisted(() => ({
  createClient: vi.fn(),
  pages: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (data: unknown) => data;
    const builder = {
      inputValidator: (validator: typeof validate) => {
        validate = validator;
        return builder;
      },
      handler: (handler: (input: { data: unknown }) => unknown) =>
        (input: { data: unknown }) => handler({ data: validate(input.data) }),
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: vi.fn() }));
vi.mock("./swr-cache", () => ({ swr: (_key: string, load: () => unknown) => load() }));

import { listStoreProducts } from "./storefront.functions";

const storeId = "11111111-1111-4111-8111-111111111111";
const rows = Array.from({ length: 1205 }, (_, index) => ({
  id: `product-${index}`,
  name: `Product ${index}`,
  category_id: index >= 1000 ? "older-category" : "newer-category",
  primary_image_url: null,
  gallery: [`products/${index}.jpg`],
}));

describe("storefront catalogue pagination", () => {
  let query: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    query = {};
    for (const method of ["from", "select", "eq", "neq", "order"]) {
      query[method] = vi.fn(() => query);
    }
    query.range = pages;
    pages.mockImplementation(async (start: number, end: number) => ({
      data: rows.slice(start, end + 1), error: null,
    }));
    createClient.mockReturnValue(query);
  });

  it("returns older products past both the 500 cutoff and the 1000 API cap", async () => {
    const products = await listStoreProducts({ data: { storeId } });
    expect(products).toHaveLength(1205);
    expect(products[1204].id).toBe("product-1204");
    expect(products.filter((p: { category_id: string }) => p.category_id === "older-category")).toHaveLength(205);
    expect(products[1204].primary_image_url).toBe("/api/img/products/1204.jpg");
    expect(pages.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("keeps each page store scoped, excludes drafts and orders timestamp ties by id", async () => {
    await listStoreProducts({ data: { storeId } });
    expect(query.eq.mock.calls).toEqual(Array(3).fill(["store_id", storeId]));
    expect(query.neq.mock.calls).toEqual(Array(3).fill(["status", "draft"]));
    expect(query.order.mock.calls).toEqual(Array.from({ length: 3 }, () => [
      ["created_at", { ascending: false }], ["id", { ascending: false }],
    ]).flat());
  });

  it("preserves an explicit first-page preview limit without loading more", async () => {
    const products = await listStoreProducts({ data: { storeId, limit: 24 } });
    expect(products).toHaveLength(24);
    expect(pages.mock.calls).toEqual([[0, 23]]);
  });

  it("handles an empty catalogue with only one request", async () => {
    pages.mockResolvedValue({ data: [], error: null });
    expect(await listStoreProducts({ data: { storeId } })).toEqual([]);
    expect(pages).toHaveBeenCalledTimes(1);
  });

  it("stops when an exact page boundary is followed by an empty page", async () => {
    pages.mockImplementation(async (start: number, end: number) => ({
      data: rows.slice(0, 1000).slice(start, end + 1), error: null,
    }));
    expect(await listStoreProducts({ data: { storeId } })).toHaveLength(1000);
    expect(pages).toHaveBeenCalledTimes(3);
  });

  it("rejects a later-page failure rather than returning or caching a partial catalogue", async () => {
    pages.mockResolvedValueOnce({ data: rows.slice(0, 500), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Page failed" } });
    await expect(listStoreProducts({ data: { storeId } })).rejects.toThrow("Page failed");
  });
});