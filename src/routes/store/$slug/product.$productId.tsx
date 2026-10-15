import { StoreErrorState } from "@/components/storefront/StoreErrorState";
import { createFileRoute, useNavigate, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { fbTrack } from "@/lib/fb-track";
import { isStockless } from "@/lib/product-stock";
import { getRequestOrigin } from "@/lib/seo.functions";
import {
  resolveStoreSeo,
  absUrl,
  jsonLdScript,
  productJsonLd,
  breadcrumbJsonLd,
} from "@/lib/seo";

import { toast } from "sonner";
import { readVariants, variantPrice, variantLabel } from "@/lib/product-variants";
import {
  getProduct,
  getStoreBySlug,
  listRelatedProducts,
  listStoreCategories,
} from "@/lib/storefront.functions";
import { addToCart } from "@/lib/cart";
import { ProductGallery } from "@/components/storefront/pdp/ProductGallery";
import { BuyBox } from "@/components/storefront/pdp/BuyBox";
import { InfoTabs } from "@/components/storefront/pdp/InfoTabs";
import { ServiceInfoSections } from "@/components/storefront/pdp/ServiceInfoSections";
import { SubscriptionInfoSections } from "@/components/storefront/pdp/SubscriptionInfoSections";

import { ReviewsBlock } from "@/components/storefront/pdp/ReviewsBlock";
import { RelatedRail } from "@/components/storefront/pdp/RelatedRail";
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
    let origin = "";
    try {
      origin = await getRequestOrigin();
    } catch {
      /* ignore */
    }
    return { store, product, origin };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const s: any = loaderData.store;
    const p: any = loaderData.product;
    const origin: string = (loaderData as any).origin || "";
    const base = resolveStoreSeo(s, { origin });
    const storeUrl = base.canonical ?? origin ?? "";
    const url = storeUrl ? `${storeUrl.replace(/\/$/, "")}/product/${params.productId}` : null;
    const pseo: any = (p.meta as any)?.seo ?? {};
    const customTitle = String(pseo.title ?? "").trim();
    const customDesc = String(pseo.description ?? "").trim();
    const keywords = String(pseo.keywords ?? "").trim();
    const title = customTitle || `${p.name} — ${s.name}`;
    const desc = customDesc || stripHtml(p.description ?? "").slice(0, 160) || p.name;
    const image = absUrl(origin, p.primary_image_url);
    const meta: any[] = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: customTitle || p.name },
      { property: "og:description", content: desc },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (keywords) meta.push({ name: "keywords", content: keywords });
    if (image) meta.push({ property: "og:image:alt", content: p.name });
    if (url) meta.push({ property: "og:url", content: url });
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
    }
    if (base.noindex) meta.push({ name: "robots", content: "noindex, nofollow" });
    return {
      meta,
      links: url ? [{ rel: "canonical", href: url }] : [],
      scripts: [
        jsonLdScript([
          productJsonLd({ product: p, storeName: s.name, url, image }),
          breadcrumbJsonLd([
            { name: s.name, url: storeUrl || null },
            { name: p.name, url },
          ]),
        ]),
      ],
    };
  },
  errorComponent: ({ error }) => <StoreErrorState error={error} scope="storefront:product" />,
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
    fbTrack("ViewContent", {
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      value: Number(product.price),
      currency: "BDT",
    });
  }, [product?.id, slug]);

  const vdata = useMemo(() => readVariants((product as any)?.variants), [product?.id]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const variant = vdata.options.length
    ? vdata.items.find((it) => vdata.options.every((o) => it.options[o.name] === picked[o.name])) ?? null
    : null;
  const needsChoice = vdata.options.length > 0 && !variant;
  const basePrice = Number(product!.price);
  const price = variant ? variantPrice(variant, basePrice) : basePrice;
  const vRegular = variant && Number(variant.price) > price ? Number(variant.price) : null;
  const oldPrice = variant ? vRegular : product!.old_price != null ? Number(product!.old_price) : null;
  const shownStock = variant && variant.stock != null ? Number(variant.stock) : product!.stock;
  const inStock =
    product!.status !== "draft" &&
    (isStockless((product as any)!.product_type) || shownStock > 0);


  const meta = (product!.meta ?? {}) as Record<string, any>;

  const highlights: string[] = Array.isArray(meta.highlights) ? meta.highlights.filter(Boolean) : [];
  const packageIncludes: string[] = Array.isArray(meta.package_includes)
    ? meta.package_includes.filter(Boolean)
    : Array.isArray(meta.package)
    ? meta.package.filter(Boolean)
    : [];
  const rating: number | null = typeof meta.rating === "number" ? meta.rating : null;
  const reviewCount: number = typeof meta.review_count === "number" ? meta.review_count : 0;

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
          limit: 4,
          strictCategory: true,
        },
      }),
    staleTime: 60_000,
  });

  function add(): boolean {
    if (needsChoice) {
      toast.error("আগে অপশন বেছে নিন (যেমন সাইজ/কালার)");
      return false;
    }
    addToCart(slug, {
      productId: product!.id,
      name: variant ? `${product!.name} (${Object.values(variant.options).join(" / ")})` : product!.name,
      price,
      image: variant?.image || product!.primary_image_url,
      qty,
      ...(variant ? { variantId: variant.id, variantLabel: variantLabel(variant) } : {}),
    });
    toast.success("Added to cart");
    return true;
  }
  function buy() {
    if (!add()) return;
    navigate({ to: "/store/$slug/checkout", params: { slug } });
  }


  if (isDigital) {
    return <DigitalProductPage slug={slug} store={store} product={product} />;
  }


  return (
    <div className="pb-24 lg:pb-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Gallery */}
        <div className="min-w-0">
          <ProductGallery
            name={(product as any)?.meta?.seo?.image_alt || product!.name}
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

            {vdata.options.length > 0 && (
              <div className="mt-4 space-y-3">
                {vdata.options.map((o) => (
                  <div key={o.name}>
                    <p className="mb-1.5 text-sm font-medium">
                      {o.name}
                      {picked[o.name] && <span className="ml-1 text-muted-foreground">: {picked[o.name]}</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {o.values.map((val) => {
                        const exists = vdata.items.some((it) =>
                          it.options[o.name] === val &&
                          vdata.options.every((x) => x.name === o.name || !picked[x.name] || it.options[x.name] === picked[x.name]),
                        );
                        const on = picked[o.name] === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            disabled={!exists}
                            onClick={() => setPicked((p) => ({ ...p, [o.name]: on ? "" : val }))}
                            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-sf-accent bg-sf-accent text-white" : "hover:border-sf-accent"} ${!exists ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {variant?.image && (
                  <img src={variant.image.startsWith("http") ? variant.image : `/api/img/${variant.image}`} alt="" className="h-20 w-20 rounded-lg border object-cover" />
                )}
              </div>
            )}

            <div ref={buyBoxRef} className="mt-4">
              <BuyBox
                price={price}
                oldPrice={oldPrice}
                stock={shownStock}
                status={product!.status}
                productType={(product as any)!.product_type}
                qty={qty}
                setQty={setQty}
                onAdd={add}
                onBuy={buy}
                whatsapp={(store as any)?.whatsapp ?? null}
                productName={product!.name}
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

      {(product as any)?.product_type === "service" && (
        <ServiceInfoSections service={((product as any)?.meta ?? {}).service} />
      )}

      {(product as any)?.product_type === "subscription" && (
        <SubscriptionInfoSections subscription={((product as any)?.meta ?? {}).subscription} />
      )}

      <ReviewsBlock
        rating={rating}
        count={reviewCount}
        storeId={store!.id}
        productId={product!.id}
      />

      <RelatedRail
        title="Related Products"
        slug={slug}
        products={(relatedQ.data ?? []) as any}
        variant="grid"
      />

      <div className="mt-10 flex justify-center">
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="rounded-full bg-sf-ink px-6 py-2.5 text-sm font-semibold text-sf-on-accent shadow-md transition-all hover:bg-sf-accent"
        >
          ← Back to Store
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
