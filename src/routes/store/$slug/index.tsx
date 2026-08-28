import { StoreErrorState } from "@/components/storefront/StoreErrorState";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Flame, Grid3x3, ChevronRight, SearchX } from "lucide-react";
import {
  listStoreBanners,
  listStoreProducts,
  listStoreCategories,
  listBestSellingProducts,
  getStoreBySlug,
} from "@/lib/storefront.functions";
import { useStoreUI } from "@/lib/store-ui";
import { useStoreT } from "@/lib/store-i18n";
import { useStoreTheme } from "@/lib/theme/context";
import { ProductCard } from "@/components/storefront/ProductCard";
import { HeroBanners } from "@/components/storefront/HeroBanners";
import { getCategoryIcon } from "@/lib/category-icons";
import { CategoryIconCluster } from "@/components/CategoryIconCluster";


const STALE = 5 * 60_000;
const GC = 30 * 60_000;

/**
 * Shared stability options: once data has rendered, background refetches must
 * never flip the query back to a pending state (which would re-suspend the
 * component and flash the skeleton again).
 */
const stable = {
  staleTime: STALE,
  gcTime: GC,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
  placeholderData: keepPreviousData,
} as const;

const storeQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store", slug],
    queryFn: () => getStoreBySlug({ data: { slug } }),
    ...stable,
  });

const bannersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["banners", storeId],
    queryFn: () => listStoreBanners({ data: { storeId } }),
    ...stable,
  });

const productsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["products", storeId],
    queryFn: () => listStoreProducts({ data: { storeId } }),
    ...stable,
  });

const categoriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["categories", storeId],
    queryFn: () => listStoreCategories({ data: { storeId } }),
    ...stable,
  });

const bestSellingQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["best-selling", storeId],
    queryFn: () => listBestSellingProducts({ data: { storeId, limit: 12 } }),
    ...stable,
  });

export const Route = createFileRoute("/store/$slug/")({
  head: () => ({
    meta: [
      { title: "Shop Products — ORZEN Store" },
      { name: "description", content: "Browse featured, best-selling, and new products from this ORZEN store." },
      { property: "og:title", content: "Shop Products — ORZEN Store" },
      { property: "og:description", content: "Browse featured, best-selling, and new products from this ORZEN store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) throw notFound();
    const [banners, products, categories, bestSelling] = await Promise.all([
      context.queryClient.ensureQueryData(bannersQuery(store.id)),
      context.queryClient.ensureQueryData(productsQuery(store.id)),
      context.queryClient.ensureQueryData(categoriesQuery(store.id)),
      context.queryClient.ensureQueryData(bestSellingQuery(store.id)),
    ]);
    return { store, banners, products, categories, bestSelling };
  },
  errorComponent: ({ error }) => <StoreErrorState error={error} scope="storefront:home" />,
  notFoundComponent: () => <div className="p-6 text-center">Not found</div>,
  component: StoreHome,
});

const PAGE_SIZE = 12;

function StoreHome() {
  return <HomeContent />;
}

function HomeContent() {
  const { t } = useStoreT();

  const { slug } = Route.useParams();
  const { store, banners, products, categories, bestSelling } = Route.useLoaderData();
  const { query, activeMainId, activeSubId, source, selectMain, selectSub } = useStoreUI();
  const theme = useStoreTheme();
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
    return products.filter((p: any) => {
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

  const isFiltering = !!activeMainId || !!activeSubId || query.trim().length > 0;

  const on = theme.sections;
  const blocks: Partial<Record<string, React.ReactNode>> = {
    banner: on.banner && banners.length > 0 ? <HeroBanners key="banner" banners={banners as any} /> : null,
    categories:
      on.categories && categories.length > 0 ? (
        <FeaturedCategories key="categories">
          <CategoryStrip
            allImage={(store as any).all_category_image_url ?? null}
            categories={mainCategories as any}
            active={activeMainId}
            onSelect={(id) => selectMain(id, "icon")}
          />
        </FeaturedCategories>
      ) : null,
    featured:
      on.featured && !isFiltering && featured.length > 0 ? (
        <FeaturedPanel key="featured" title={t("home.featuredProducts")}>
          <ProductCarousel slug={slug} products={featured} auto />
        </FeaturedPanel>
      ) : null,
    best_sellers:
      on.best_sellers && !isFiltering && bestSelling.length > 0 ? (
        <Section
          key="best_sellers"
          title={t("home.bestSelling")}
          icon={<Flame className="h-4 w-4 text-sf-accent" />}
          onViewAll={() => selectMain(null, null)}
        >
          <ProductGrid slug={slug} products={bestSelling} />
        </Section>
      ) : null,
    new_arrival:
      on.new_arrival && !isFiltering && newArrivals.length > 0 ? (
        <Section
          key="new_arrival"
          title={t("home.newArrivals")}
          icon={<Sparkles className="h-4 w-4 text-sf-accent" />}
          onViewAll={() => selectMain(null, null)}
        >
          <ProductGrid slug={slug} products={newArrivals} />
        </Section>
      ) : null,
  };

  return (
    <div className="theme-sections flex animate-fade-in flex-col gap-2 opacity-100 transition-opacity duration-300 sm:gap-8">


      {!isFiltering && source === "header" && activeMainId && activeSubs.length > 0 && (
        <SubcategoryBar
          subs={activeSubs}
          activeSubId={activeSubId}
          onSelect={(id) => selectSub(id)}
        />
      )}

      {theme.section_order.map((k) => blocks[k] ?? null)}

      <section id="all-products" className="scroll-mt-32 space-y-4">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-sf-accent" />
          <h2 className="text-lg font-bold tracking-tight text-sf-ink sm:text-xl">
            {isFiltering ? t("home.results") : t("home.allProducts")}
          </h2>
          <span className="ml-2 rounded-full bg-sf-surface px-2 py-0.5 text-[11px] font-medium text-sf-muted">
            {filtered.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          isFiltering ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center">
              <SearchX className="h-8 w-8 text-neutral-400" />
              <p className="text-sm font-semibold text-neutral-800">{t("home.noProductsFound")}</p>
              <p className="text-xs text-neutral-500">{t("home.tryAnotherKeyword")}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500">
              {t("home.noProductsYet")}
            </div>
          )
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
                  {t("home.loadMore")}
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
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
  seeMoreLabel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onViewAll?: () => void;
  seeMoreLabel?: string;
  children: React.ReactNode;
}) {
  const { t } = useStoreT();
  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">{icon}</span>
          <h2 className="truncate text-lg font-bold tracking-tight text-sf-ink sm:text-xl">
            {title}
          </h2>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-sf-ink px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-sf-accent sm:text-xs"
          >
            {seeMoreLabel ?? t("home.viewAll")} <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Section shell for the featured category cards. */
function FeaturedCategories({ children }: { children: React.ReactNode }) {
  return (
    <section id="categories" className="scroll-mt-32 rounded-2xl border border-sf-line bg-white p-2 sm:rounded-3xl sm:p-4">
      {children}
    </section>
  );
}

/** Multi-tone gradient panel that frames the featured product carousel. */
function FeaturedPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sf-featured-panel overflow-hidden rounded-2xl p-2 shadow-lg sm:rounded-3xl sm:p-6">
      <h2 className="mb-2 text-center text-lg font-extrabold tracking-tight text-white sm:mb-5 sm:text-2xl">
        {title}
        <span className="mx-auto mt-2 block h-1 w-16 rounded-full bg-sf-accent" />
      </h2>
      {children}
    </section>
  );
}

/** Horizontal snap carousel of product cards with desktop arrows. */
function ProductCarousel({
  slug,
  products,
  auto = false,
}: {
  slug: string;
  products: Array<Parameters<typeof ProductCard>[0]["p"]>;
  auto?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useStoreT();

  function scrollBy(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  }

  // Auto slide right, loop back to start at the end. Pauses on hover/touch,
  // while the page itself is scrolling, and when the rail is off-screen.
  useEffect(() => {
    if (!auto || products.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    let paused = false;
    let visible = true;
    let pageScrolling = 0;
    const pause = () => (paused = true);
    const resume = () => (paused = false);
    el.addEventListener("pointerdown", pause);
    el.addEventListener("pointerup", resume);
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);

    // Programmatic smooth scrolling of a nested rail steals touch momentum
    // from the page, so never animate it while the user is scrolling.
    const onPageScroll = () => {
      pageScrolling = Date.now();
    };
    window.addEventListener("scroll", onPageScroll, { passive: true });

    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
        threshold: 0.25,
      });
      io.observe(el);
    }

    const id = setInterval(() => {
      if (paused || !visible) return;
      if (Date.now() - pageScrolling < 800) return;
      const step = Math.max(200, el.clientWidth * 0.5);
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: "smooth" });
    }, 3000);
    return () => {
      clearInterval(id);
      io?.disconnect();
      window.removeEventListener("scroll", onPageScroll);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("pointerup", resume);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
    };
  }, [auto, products.length]);


  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div
            key={p.id}
            className="w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-[calc(33.333%-0.5rem)] md:w-[calc(25%-0.5625rem)] lg:w-[calc(20%-0.6rem)]"
          >
            <ProductCard slug={slug} p={p} />
          </div>
        ))}
      </div>


      <button
        type="button"
        aria-label={t("home.prev")}
        onClick={() => scrollBy(-1)}
        className="absolute -left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-sf-ink shadow-md transition-colors hover:bg-sf-accent hover:text-white lg:grid"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </button>
      <button
        type="button"
        aria-label={t("home.next")}
        onClick={() => scrollBy(1)}
        className="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-sf-ink shadow-md transition-colors hover:bg-sf-accent hover:text-white lg:grid"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
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
  const { t } = useStoreT();
  return (
    <div className="-mx-4 hidden overflow-x-auto px-4 md:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-2">
        <SubPill active={activeSubId === null} onClick={() => onSelect(null)}>
          {t("home.categoryAll")}
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
          ? "bg-sf-accent text-white"
          : "bg-sf-surface text-sf-ink hover:bg-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function CategoryStrip({
  categories,
  allImage,
  active,
  onSelect,
}: {
  categories: {
    id: string;
    name: string;
    image_url?: string | null;
    icon_name?: string | null;
    icon_style?: string | null;
  }[];
  allImage?: string | null;
  active: string | null;
  onSelect: (id: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useStoreT();


  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex flex-nowrap gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory sm:grid sm:grid-cols-6 sm:gap-4 md:grid-cols-8"
      >
        <div className="w-[calc(25%-0.75rem)] shrink-0 snap-start sm:w-auto">
          <CategoryTile
            label={t("home.categoryAll")}
            image={allImage ?? null}
            active={active === null}
            onClick={() => onSelect(null)}
          />
        </div>
        {categories.map((c) => (
          <div key={c.id} className="w-[calc(25%-0.75rem)] shrink-0 snap-start sm:w-auto">
            <CategoryTile
              label={c.name}
              image={c.image_url ?? null}
              iconName={c.icon_name ?? null}
              iconStyle={c.icon_style ?? "outline"}
              active={active === c.id}
              onClick={() => onSelect(c.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}



function CategoryTile({
  label,
  image,
  iconName,
  iconStyle,
  active,
  onClick,
}: {
  label: string;
  image?: string | null;
  iconName?: string | null;
  iconStyle?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const PresetIcon = getCategoryIcon(iconName);
  const ring = active ? "var(--sf-accent, #FF4B1F)" : "transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full min-w-0 flex-col items-center gap-1.5"
    >
      <div
        className="aspect-square w-full overflow-hidden rounded-2xl border border-sf-line bg-sf-surface transition-all"
        style={{ boxShadow: `inset 0 0 0 2px ${ring}` }}
      >
        {PresetIcon ? (
          <span className={`grid h-full w-full place-items-center text-neutral-700 ${iconStyle === "colored" ? "" : "p-1"}`}>
            <CategoryIconCluster iconName={iconName} iconStyle={iconStyle ?? "outline"} />
          </span>
        ) : image ? (
          <img
            src={image}
            alt={label}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
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
        className={`line-clamp-1 w-full text-center text-[11px] font-medium ${active ? "text-sf-accent" : "text-sf-muted"}`}
      >
        {label}
      </span>
    </button>

  );
}


