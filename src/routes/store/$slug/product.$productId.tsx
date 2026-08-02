import { createFileRoute, useNavigate, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { fbTrack } from "@/lib/fb-track";
import { toast } from "sonner";
import {
  getProduct,
  getStoreBySlug,
  listBestSellingProducts,
  listProductsByIds,
  listRelatedProducts,
  listStoreCategories,
} from "@/lib/storefront.functions";
import { addToCart } from "@/lib/cart";
import { pushRecent, readRecent } from "@/lib/recently-viewed";
import { ProductGallery } from "@/components/storefront/pdp/ProductGallery";
import { BuyBox } from "@/components/storefront/pdp/BuyBox";
import { InfoTabs } from "@/components/storefront/pdp/InfoTabs";
import { ReviewsBlock } from "@/components/storefront/pdp/ReviewsBlock";
import { RelatedRail } from "@/components/storefront/pdp/RelatedRail";
import { ShareBar } from "@/components/storefront/pdp/ShareBar";
import { TrustBadges } from "@/components/storefront/pdp/TrustBadges";
import { StoreCard } from "@/components/storefront/pdp/StoreCard";
import { StickyMobileBar } from "@/components/storefront/pdp/StickyMobileBar";
import { DigitalProductPage } from "@/components/storefront/pdp/digital/DigitalProductPage";



const storeQuery = (slug: string) =>
  queryOptions({ queryKey: ["store", slug], queryFn: () => getStoreBySlug({ data: { slug } }) });

const productQuery = (storeId: string, productId: string) =>
  queryOptions({
    queryKey: ["product", storeId, productId],
    queryFn: () => getProduct({ data: { storeId, productId } }),
  });

export const Route = createFileRoute("/store/$slug/product/$productId")({
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) throw notFound();
    const product = await context.queryClient.ensureQueryData(
      productQuery(store.id, params.productId),
    );
    if (!product) throw notFound();
    return { store, product };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.product.name} — ${loaderData.store.name}` },
            {
              name: "description",
              content:
                stripHtml(loaderData.product.description ?? "")?.slice(0, 155) ||
                loaderData.product.name,
            },
            { property: "og:title", content: loaderData.product.name },
            {
              property: "og:description",
              content:
                stripHtml(loaderData.product.description ?? "")?.slice(0, 155) ||
                loaderData.product.name,
            },
            { property: "og:type", content: "product" },
            { name: "twitter:card", content: "summary_large_image" },
            ...(loaderData.product.primary_image_url?.startsWith("http")
              ? [
                  { property: "og:image", content: loaderData.product.primary_image_url },
                  { name: "twitter:image", content: loaderData.product.primary_image_url },
                ]
              : []),
          ],
        }
      : {},
  errorComponent: () => <div className="p-6 text-center">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6 text-center">Product not found</div>,
  component: ProductPage,
});

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, "").trim();
}

function ProductPage() {
  const { slug, productId } = Route.useParams();
  const navigate = useNavigate();
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  const { data: product } = useSuspenseQuery(productQuery(store!.id, productId));
  const [qty, setQty] = useState(1);
  const buyBoxRef = useRef<HTMLDivElement | null>(null);
  const isDigital = (product as any)?.product_type === "digital";


  useEffect(() => {
    if (!product) return;
    pushRecent(slug, product.id);
    fbTrack("ViewContent", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      value: Number(product.price),
      currency: "BDT",
    });
  }, [product?.id, slug]);

  const price = Number(product!.price);
  const oldPrice = product!.old_price != null ? Number(product!.old_price) : null;
  const inStock = product!.stock > 0 && product!.status !== "draft";

  const meta = (product!.meta ?? {}) as Record<string, any>;

  const highlights: string[] = Array.isArray(meta.highlights) ? meta.highlights.filter(Boolean) : [];
  const packageIncludes: string[] = Array.isArray(meta.package_includes)
    ? meta.package_includes.filter(Boolean)
    : Array.isArray(meta.package)
    ? meta.package.filter(Boolean)
    : [];
  const rating: number | null = typeof meta.rating === "number" ? meta.rating : null;
  const features: string[] = Array.isArray(product!.features)
    ? (product!.features as string[]).filter(Boolean)
    : [];
  const specifications: Record<string, string> =
    product!.specifications && typeof product!.specifications === "object" && !Array.isArray(product!.specifications)
      ? (product!.specifications as Record<string, string>)
      : {};

  const deliveryInfo = useMemo(() => {
    const d: any = (store as any)?.delivery ?? {};
    const parts: string[] = [];
    if (d.inside_city != null) parts.push(`Inside city: ৳${Number(d.inside_city).toFixed(0)}`);
    if (d.outside_city != null) parts.push(`Outside city: ৳${Number(d.outside_city).toFixed(0)}`);
    if (d.free_min) parts.push(`Free shipping over ৳${Number(d.free_min).toFixed(0)}`);
    if (d.eta) parts.push(String(d.eta));
    return parts.length ? parts.join(" • ") : null;
  }, [store]);

  const categoriesQ = useQuery({
    queryKey: ["store-categories", store!.id],
    queryFn: () => listStoreCategories({ data: { storeId: store!.id } }),
    staleTime: 5 * 60_000,
  });
  const categoryName = useMemo(() => {
    if (!product!.category_id || !categoriesQ.data) return null;
    return categoriesQ.data.find((c) => c.id === product!.category_id)?.name ?? null;
  }, [categoriesQ.data, product!.category_id]);

  const relatedQ = useQuery({
    queryKey: ["related", store!.id, product!.id, product!.category_id],
    queryFn: () =>
      listRelatedProducts({
        data: {
          storeId: store!.id,
          categoryId: product!.category_id ?? undefined,
          excludeId: product!.id,
          limit: 8,
        },
      }),
    staleTime: 60_000,
  });

  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    setRecentIds(readRecent(slug, product!.id).slice(0, 12));
  }, [slug, product!.id]);
  const recentQ = useQuery({
    queryKey: ["recent-products", store!.id, recentIds.join(",")],
    queryFn: () => listProductsByIds({ data: { storeId: store!.id, ids: recentIds } }),
    enabled: recentIds.length > 0,
    staleTime: 60_000,
  });
  const recentSorted = useMemo(() => {
    if (!recentQ.data) return [];
    const map = new Map(recentQ.data.map((p) => [p.id, p]));
    return recentIds.map((id) => map.get(id)).filter(Boolean) as any[];
  }, [recentQ.data, recentIds]);

  const bestQ = useQuery({
    queryKey: ["bestsellers", store!.id],
    queryFn: () => listBestSellingProducts({ data: { storeId: store!.id, limit: 8 } }),
    staleTime: 5 * 60_000,
  });
  const alsoLike = useMemo(
    () => (bestQ.data ?? []).filter((p: any) => p.id !== product!.id).slice(0, 8),
    [bestQ.data, product!.id],
  );

  function add() {
    addToCart(slug, {
      productId: product!.id,
      name: product!.name,
      price,
      image: product!.primary_image_url,
      qty,
    });
    toast.success("Added to cart");
  }
  function buy() {
    add();
    navigate({ to: "/store/$slug/checkout", params: { slug } });
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const codEnabled = ((store as any)?.payment_methods ?? []).includes?.("cod") ?? true;

  if (isDigital) {
    return <DigitalProductPage slug={slug} store={store} product={product} />;
  }


  return (
    <div className="pb-24 lg:pb-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Gallery */}
        <div className="min-w-0">
          <ProductGallery
            name={product!.name}
            primary={product!.primary_image_url}
            gallery={product!.gallery}
            videoUrl={(product as any).video_url ?? null}
          />
        </div>

        {/* Info + Sticky Buy Box */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-20">
            <h1 className="text-xl font-bold sm:text-2xl">{product!.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {(product as any).brand && (
                <span>
                  Brand: <span className="font-medium text-foreground">{(product as any).brand}</span>
                </span>
              )}
              {categoryName && (
                <span>
                  Category: <span className="font-medium text-foreground">{categoryName}</span>
                </span>
              )}
              {(product as any).sku && (
                <span>
                  SKU: <span className="font-medium text-foreground">{(product as any).sku}</span>
                </span>
              )}
            </div>

            {highlights.length > 0 && (
              <ul className="mt-4 space-y-1 rounded-xl border bg-muted/30 p-3 text-sm">
                {highlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 text-primary">✓</span>
                    <span className="text-foreground/80">{h}</span>
                  </li>
                ))}
              </ul>
            )}

            <div ref={buyBoxRef} className="mt-4">
              <BuyBox
                price={price}
                oldPrice={oldPrice}
                stock={product!.stock}
                status={product!.status}
                qty={qty}
                setQty={setQty}
                onAdd={add}
                onBuy={buy}
              />
            </div>
          </div>
        </div>
      </div>

      <InfoTabs
        description={product!.description ?? null}
        features={features}
        specifications={specifications}
        packageIncludes={packageIncludes}
        deliveryInfo={deliveryInfo}
        returnPolicy={(product as any).return_policy ?? null}
        warranty={(product as any).warranty ?? null}
      />


      <ReviewsBlock rating={rating} />

      <RelatedRail
        title="Related Products"
        slug={slug}
        products={(relatedQ.data ?? []) as any}
        variant="grid"
      />

      {recentSorted.length > 0 && (
        <RelatedRail
          title="Recently Viewed"
          slug={slug}
          products={recentSorted}
          variant="scroll"
        />
      )}

      {alsoLike.length > 0 && (
        <RelatedRail title="You May Also Like" slug={slug} products={alsoLike as any} variant="grid" />
      )}

      <StoreCard slug={slug} name={store!.name} logoUrl={store!.logo_url} />
      <TrustBadges codEnabled={codEnabled} />
      <ShareBar url={shareUrl} title={product!.name} />

      <div className="mt-8">
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to store
        </Link>
      </div>

      <StickyMobileBar
        price={price}
        disabled={!inStock}
        onAdd={add}
        onBuy={buy}
        observeRef={buyBoxRef}
      />
    </div>
  );
}
