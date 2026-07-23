import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Flame, Grid3x3, ChevronRight } from "lucide-react";
import {
  listStoreBanners,
  listStoreProducts,
  listStoreCategories,
  listBestSellingProducts,
  getStoreBySlug,
} from "@/lib/storefront.functions";
import { useStoreUI } from "@/lib/store-ui";
import { ProductCard } from "@/components/storefront/ProductCard";

const STALE = 5 * 60_000;

const storeQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store", slug],
    queryFn: () => getStoreBySlug({ data: { slug } }),
    staleTime: STALE,
  });

const bannersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["banners", storeId],
    queryFn: () => listStoreBanners({ data: { storeId } }),
    staleTime: STALE,
  });

const productsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["products", storeId],
    queryFn: () => listStoreProducts({ data: { storeId } }),
    staleTime: STALE,
  });

const categoriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["categories", storeId],
    queryFn: () => listStoreCategories({ data: { storeId } }),
    staleTime: STALE,
  });

const bestSellingQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["best-selling", storeId],
    queryFn: () => listBestSellingProducts({ data: { storeId, limit: 12 } }),
    staleTime: STALE,
  });

export const Route = createFileRoute("/store/$slug/")({
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) return null;
    await Promise.all([
      context.queryClient.ensureQueryData(bannersQuery(store.id)),
      context.queryClient.ensureQueryData(productsQuery(store.id)),
      context.queryClient.ensureQueryData(categoriesQuery(store.id)),
      context.queryClient.ensureQueryData(bestSellingQuery(store.id)),
    ]);
    return { storeId: store.id };
  },
  errorComponent: () => <div className="p-6 text-center">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6 text-center">Not found</div>,
  component: StoreHome,
});

const PAGE_SIZE = 12;

function StoreHome() {
  const { slug } = Route.useParams();
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  if (!store) return null;
  const { data: banners } = useSuspenseQuery(bannersQuery(store.id));
  const { data: products } = useSuspenseQuery(productsQuery(store.id));
  const { data: categories } = useSuspenseQuery(categoriesQuery(store.id));
  const { data: bestSelling } = useSuspenseQuery(bestSellingQuery(store.id));
  const { query, activeMainId, activeSubId, source, selectMain, selectSub } = useStoreUI();
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const mainCategories = useMemo(
    () => categories.filter((c: any) => !c.parent_id),
    [categories],
  );
  const subsByParent = useMemo(() => {
    const m = new Map<string, typeof categories>();
    for (const c of categories) {
      const pid = (c as any).parent_id as string | null;
      if (pid) {
        if (!m.has(pid)) m.set(pid, [] as any);
        (m.get(pid) as any).push(c);
      }
    }
    return m;
  }, [categories]);

  const catParentMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of categories) m.set(c.id, (c as any).parent_id ?? null);
    return m;
  }, [categories]);

  const countsByMain = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const cid = (p as any).category_id as string | null;
      if (!cid) continue;
      const parent = catParentMap.get(cid);
      const mainId = parent ?? cid;
      m.set(mainId, (m.get(mainId) ?? 0) + 1);
    }
    return m;
  }, [products, catParentMap]);

  const activeSubs = activeMainId ? (subsByParent.get(activeMainId) as any) ?? [] : [];

  const featured = useMemo(
    () => products.filter((p: any) => p.is_featured).slice(0, 12),
    [products],
  );

  const newArrivals = useMemo(
    () => [...products].slice(0, 12),
    [products],
  );



  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const cid = (p as any).category_id as string | null;
      if (activeSubId) {
        if (cid !== activeSubId) return false;
      } else if (activeMainId) {
        if (!cid) return false;
        const parent = catParentMap.get(cid);
        if (cid !== activeMainId && parent !== activeMainId) return false;
      }
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, activeMainId, activeSubId, catParentMap]);

  useEffect(() => {
    setPageSize(PAGE_SIZE);
  }, [activeMainId, activeSubId, query]);

  // Search integration: exact match on a subcategory auto-activates it
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const hit = categories.find((c: any) => c.parent_id && c.name.toLowerCase() === q);
    if (hit) {
      const parent = (hit as any).parent_id as string;
      if (activeMainId !== parent) selectMain(parent, "header");
      if (activeSubId !== hit.id) selectSub(hit.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categories]);

  function scrollToAll() {
    document.getElementById("all-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-8">
      {mainCategories.length > 0 && (
        <MainCategoryBar
          mains={mainCategories as any}
          counts={countsByMain}
          totalCount={products.length}
          activeMainId={activeMainId}
          onSelect={(id) => {
            selectMain(id, "header");
            scrollToAll();
          }}
        />
      )}

      {banners.length > 0 && <BannerCarousel banners={banners} />}

      {source === "header" && activeMainId && activeSubs.length > 0 && (
        <SubcategoryBar
          subs={activeSubs}
          activeSubId={activeSubId}
          onSelect={(id) => {
            selectSub(id);
            scrollToAll();
          }}
        />
      )}

      {categories.length > 0 && (
        <CategoryStrip
          categories={mainCategories as any}
          active={activeMainId}
          onSelect={(id) => {
            selectMain(id, "icon");
            scrollToAll();
          }}
        />
      )}

      {featured.length > 0 && (
        <Section
          title="Featured Products"
          icon={<Sparkles className="h-4 w-4 text-amber-500" />}
          onViewAll={() => {
            selectMain(null, null);
            scrollToAll();
          }}
        >
          <ProductGrid slug={slug} products={featured} />
        </Section>
      )}

      {bestSelling.length > 0 && (
        <Section
          title="Best Selling"
          icon={<Flame className="h-4 w-4 text-rose-500" />}
          onViewAll={() => {
            selectMain(null, null);
            scrollToAll();
          }}
        >
          <ProductGrid slug={slug} products={bestSelling} />
        </Section>
      )}

      <section id="all-products" className="scroll-mt-32 space-y-4">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-neutral-500" />
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">
            All Products
          </h2>
          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
            {filtered.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
            {products.length === 0 ? "No products yet." : "No products match your search."}
          </div>
        ) : (
          <>
            <ProductGrid slug={slug} products={filtered.slice(0, pageSize)} />
            {filtered.length > pageSize && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setPageSize((n) => n + PAGE_SIZE)}
                  className="rounded-full border border-neutral-200 bg-white px-6 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ProductGrid({
  slug,
  products,
}: {
  slug: string;
  products: Array<Parameters<typeof ProductCard>[0]["p"]>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} slug={slug} p={p} />
      ))}
    </div>
  );
}

function Section({
  title,
  icon,
  onViewAll,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onViewAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">{title}</h2>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function MainCategoryBar({
  mains,
  counts,
  totalCount,
  activeMainId,
  onSelect,
}: {
  mains: { id: string; name: string }[];
  counts: Map<string, number>;
  totalCount: number;
  activeMainId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="-mx-4 hidden overflow-x-auto px-4 pb-1 md:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-2">
        <Pill active={activeMainId === null} onClick={() => onSelect(null)}>
          All ({totalCount})
        </Pill>
        {mains.map((c) => (
          <Pill
            key={c.id}
            active={activeMainId === c.id}
            onClick={() => onSelect(c.id)}
          >
            {c.name} ({counts.get(c.id) ?? 0})
          </Pill>
        ))}
      </div>
    </div>
  );
}

function SubcategoryBar({
  subs,
  activeSubId,
  onSelect,
}: {
  subs: { id: string; name: string }[];
  activeSubId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="-mx-4 hidden overflow-x-auto px-4 md:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-2">
        <SubPill active={activeSubId === null} onClick={() => onSelect(null)}>
          All
        </SubPill>
        {subs.map((s) => (
          <SubPill
            key={s.id}
            active={activeSubId === s.id}
            onClick={() => onSelect(s.id)}
          >
            {s.name}
          </SubPill>
        ))}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${
        active
          ? "text-white"
          : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
      style={active ? { backgroundColor: "var(--store-btn-bg, #7c3aed)" } : undefined}
    >
      {children}
    </button>
  );
}

function SubPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function CategoryStrip({
  categories,
  active,
  onSelect,
}: {
  categories: { id: string; name: string; image_url?: string | null }[];
  active: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-6 sm:gap-4 sm:overflow-visible sm:px-0 md:grid-cols-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <CategoryTile label="All" active={active === null} onClick={() => onSelect(null)} />
      {categories.map((c) => (
        <CategoryTile
          key={c.id}
          label={c.name}
          image={c.image_url ?? null}
          active={active === c.id}
          onClick={() => onSelect(c.id)}
        />
      ))}
    </div>
  );
}

function CategoryTile({
  label,
  image,
  active,
  onClick,
}: {
  label: string;
  image?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const ring = active ? "var(--store-btn-bg, #0f172a)" : "transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-20 shrink-0 snap-start flex-col items-center gap-1.5 sm:w-auto"
    >
      <div
        className="grid aspect-square w-16 place-items-center overflow-hidden rounded-2xl bg-neutral-100 ring-2 transition-all sm:w-full"
        style={{ boxShadow: `inset 0 0 0 2px ${ring}` }}
      >
        {image ? (
          <img src={image} alt={label} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span
            className="grid h-full w-full place-items-center text-lg font-bold text-neutral-400"
            aria-hidden
          >
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span
        className={`line-clamp-1 w-full text-center text-[11px] font-medium ${active ? "text-neutral-900" : "text-neutral-600"}`}
      >
        {label}
      </span>
    </button>
  );
}


function BannerCarousel({
  banners,
}: {
  banners: { id: string; image_url: string; link: string | null }[];
}) {
  const [idx, setIdx] = useState(0);
  const startX = useRef<number | null>(null);
  const deltaX = useRef(0);
  const paused = useRef(false);

  useEffect(() => {
    if (banners.length <= 1) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const t = setInterval(() => {
      if (!paused.current) setIdx((i) => (i + 1) % banners.length);
    }, 4500);
    return () => clearInterval(t);
  }, [banners.length]);

  function onDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    deltaX.current = 0;
    paused.current = true;
  }
  function onMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    deltaX.current = e.clientX - startX.current;
  }
  function onUp() {
    if (startX.current == null) return;
    const d = deltaX.current;
    startX.current = null;
    paused.current = false;
    if (Math.abs(d) < 40) return;
    setIdx((i) => (d < 0 ? (i + 1) % banners.length : (i - 1 + banners.length) % banners.length));
  }

  return (
    <div
      className="relative -mx-4 overflow-hidden rounded-none sm:mx-0 sm:rounded-2xl"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {banners.map((b, i) => {
          const img = (
            <img
              src={b.image_url}
              alt=""
              draggable={false}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              className="aspect-[16/8] w-full flex-shrink-0 select-none object-cover sm:aspect-[21/8]"
            />
          );
          return (
            <div key={b.id} className="w-full flex-shrink-0">
              {b.link ? (
                <a href={b.link} target="_blank" rel="noreferrer">
                  {img}
                </a>
              ) : (
                img
              )}
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? "w-6 bg-white" : "w-1.5 bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
