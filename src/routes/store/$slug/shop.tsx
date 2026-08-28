import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SearchX, Search } from "lucide-react";
import {
  getStoreBySlug,
  listStoreProducts,
  listStoreCategories,
} from "@/lib/storefront.functions";
import { getStorePagePublic } from "@/lib/store-pages.functions";
import { storePageHead } from "@/lib/store-page-view";
import { StorePageBody } from "@/components/storefront/StorePageLayout";
import { ProductCard } from "@/components/storefront/ProductCard";
import { StoreErrorState } from "@/components/storefront/StoreErrorState";
import { Input } from "@/components/ui/input";

const PAGE_KEY = "shop";
const STALE = 5 * 60_000;

const storeQuery = (slug: string) =>
  queryOptions({ queryKey: ["store", slug], queryFn: () => getStoreBySlug({ data: { slug } }), staleTime: STALE });

export const Route = createFileRoute("/store/$slug/shop")({
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) throw notFound();
    const [products, categories, page] = await Promise.all([
      context.queryClient.ensureQueryData(
        queryOptions({
          queryKey: ["products", store.id],
          queryFn: () => listStoreProducts({ data: { storeId: store.id } }),
          staleTime: STALE,
        }),
      ),
      context.queryClient.ensureQueryData(
        queryOptions({
          queryKey: ["categories", store.id],
          queryFn: () => listStoreCategories({ data: { storeId: store.id } }),
          staleTime: STALE,
        }),
      ),
      getStorePagePublic({ data: { slug: params.slug, pageKey: PAGE_KEY } }),
    ]);
    return { store, products, categories, page };
  },
  head: ({ loaderData }) => storePageHead((loaderData as any)?.page, PAGE_KEY),
  errorComponent: ({ error }) => <StoreErrorState error={error} scope="storefront:shop" />,
  notFoundComponent: () => <div className="p-6 text-center">Not found</div>,
  component: ShopPage,
});

type Sort = "newest" | "price-asc" | "price-desc" | "name";

function ShopPage() {
  const { slug } = Route.useParams();
  const { store, products, categories, page } = Route.useLoaderData() as any;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");

  const mains = useMemo(() => (categories ?? []).filter((c: any) => !c.parent_id), [categories]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of categories ?? []) {
      if (c.parent_id) m.set(c.parent_id, [...(m.get(c.parent_id) ?? []), c.id]);
    }
    return m;
  }, [categories]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = (products ?? []) as any[];
    if (cat !== "all") {
      const ids = new Set<string>([cat, ...(childrenOf.get(cat) ?? [])]);
      out = out.filter((p) => p.category_id && ids.has(p.category_id));
    }
    if (term) out = out.filter((p) => String(p.name).toLowerCase().includes(term));
    const sorted = [...out];
    if (sort === "price-asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price-desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === "name") sorted.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return sorted;
  }, [products, q, cat, sort, childrenOf]);

  const intro = page?.page?.content_html as string | undefined;

  return (
    <div className="space-y-5 py-4">
      <header className="space-y-2">
        <h1 className="text-xl font-bold text-sf-ink sm:text-2xl">
          {page?.page?.title?.trim() || `Shop all products`}
        </h1>
        {intro && (
          <StorePageBody html={intro} title="Shop" store={store ?? null} />
        )}
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className="bg-white pl-9"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {mains.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-10 rounded-md border border-input bg-white px-3 text-sm"
          aria-label="Sort products"
        >
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center">
          <SearchX className="h-8 w-8 text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-800">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {list.map((p: any) => (
            <ProductCard key={p.id} slug={slug} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
