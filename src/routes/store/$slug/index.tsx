import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  listStoreBanners,
  listStoreProducts,
  listStoreCategories,
  getStoreBySlug,
} from "@/lib/storefront.functions";
import { useStoreUI } from "@/lib/store-ui";
import { ProductCard } from "@/components/storefront/ProductCard";

const storeQuery = (slug: string) =>
  queryOptions({ queryKey: ["store", slug], queryFn: () => getStoreBySlug({ data: { slug } }) });

const bannersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["banners", storeId],
    queryFn: () => listStoreBanners({ data: { storeId } }),
  });

const productsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["products", storeId],
    queryFn: () => listStoreProducts({ data: { storeId } }),
  });

const categoriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["categories", storeId],
    queryFn: () => listStoreCategories({ data: { storeId } }),
  });

export const Route = createFileRoute("/store/$slug/")({
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) return null;
    await Promise.all([
      context.queryClient.ensureQueryData(bannersQuery(store.id)),
      context.queryClient.ensureQueryData(productsQuery(store.id)),
      context.queryClient.ensureQueryData(categoriesQuery(store.id)),
    ]);
    return { storeId: store.id };
  },
  errorComponent: () => <div className="p-6 text-center">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6 text-center">Not found</div>,
  component: StoreHome,
});

function StoreHome() {
  const { slug } = Route.useParams();
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  if (!store) return null;
  const { data: banners } = useSuspenseQuery(bannersQuery(store.id));
  const { data: products } = useSuspenseQuery(productsQuery(store.id));
  const { data: categories } = useSuspenseQuery(categoriesQuery(store.id));
  const { query } = useStoreUI();
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat && p.category_id !== activeCat) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, activeCat]);

  return (
    <div className="space-y-5">
      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {categories.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <CategoryPill
            label="All Products"
            active={activeCat === null}
            onClick={() => setActiveCat(null)}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c.id}
              label={c.name}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          {products.length === 0 ? "No products yet." : "No products match your search."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} slug={slug} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
      style={
        active
          ? { backgroundColor: "var(--store-btn-bg)", color: "#fff", borderColor: "var(--store-btn-bg)" }
          : { backgroundColor: "transparent" }
      }
    >
      {label}
    </button>
  );
}

function BannerCarousel({ banners }: { banners: { id: string; image_url: string; link: string | null }[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);
  const b = banners[idx];
  const img = (
    <img
      src={b.image_url}
      alt=""
      fetchPriority="high"
      className="aspect-[16/7] w-full rounded-xl object-cover sm:aspect-[21/8]"
    />
  );
  return (
    <div className="relative overflow-hidden">
      {b.link ? (
        <a href={b.link} target="_blank" rel="noreferrer">
          {img}
        </a>
      ) : (
        img
      )}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
