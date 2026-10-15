import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, ShieldCheck, Zap, Infinity as InfinityIcon, Download, RefreshCw } from "lucide-react";
import { addToCart } from "@/lib/cart";
import { listRelatedProducts, listStoreCategories } from "@/lib/storefront.functions";
import { formatBytes, type LicenseType } from "@/lib/digital";
import { LICENSE_LABELS } from "@/lib/digital";
import { readVariants, variantPrice, variantLabel } from "@/lib/product-variants";
import { ProductGallery } from "@/components/storefront/pdp/ProductGallery";
import { ReviewsBlock } from "@/components/storefront/pdp/ReviewsBlock";
import { RelatedRail } from "@/components/storefront/pdp/RelatedRail";
import { ShareBar } from "@/components/storefront/pdp/ShareBar";
import { StoreCard } from "@/components/storefront/pdp/StoreCard";
import { StickyMobileBar } from "@/components/storefront/pdp/StickyMobileBar";
import { Button } from "@/components/ui/button";
import { useStoreT } from "@/lib/store-i18n";
import {
  DigitalChangelog,
  DigitalDescription,
  DigitalFaqList,
  DigitalFileInfo,
  DigitalIncluded,
  DigitalLicense,
  DigitalPreview,
  DigitalRequirementsTable,
} from "./DigitalSections";

type Props = { slug: string; store: any; product: any };

export function DigitalProductPage({ slug, store, product }: Props) {
  const { t } = useStoreT();
  const navigate = useNavigate();
  const buyBoxRef = useRef<HTMLDivElement | null>(null);
  const dg = product.digital ?? {};

  const price = Number(product.price);
  const oldPrice = product.old_price != null ? Number(product.old_price) : null;
  const discountPct =
    oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const licenses = useMemo(
    () => (dg.free ? [] : readVariants(product.variants).items.filter((i) => i.options?.License)),
    [product.variants, dg.free],
  );
  const [licenseId, setLicenseId] = useState<string>(() => (licenses.length === 1 ? licenses[0].id : ""));
  const license = licenses.find((l) => l.id === licenseId) ?? null;
  const shownPrice = license ? variantPrice(license, price) : price;
  const isFree = dg.free || (price <= 0 && !licenses.length);

  const categoriesQ = useQuery({
    queryKey: ["store-categories", store.id],
    queryFn: () => listStoreCategories({ data: { storeId: store.id } }),
    staleTime: 5 * 60_000,
  });
  const categoryName = useMemo(() => {
    if (!product.category_id || !categoriesQ.data) return null;
    return categoriesQ.data.find((c: any) => c.id === product.category_id)?.name ?? null;
  }, [categoriesQ.data, product.category_id]);

  const relatedQ = useQuery({
    queryKey: ["related", store.id, product.id, product.category_id],
    queryFn: () =>
      listRelatedProducts({
        data: {
          storeId: store.id,
          categoryId: product.category_id ?? undefined,
          excludeId: product.id,
          limit: 8,
        },
      }),
    staleTime: 60_000,
  });

  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(t);
  }, [added]);

  function add(): boolean {
    if (licenses.length && !license) {
      toast.error("একটি লাইসেন্স বেছে নিন");
      buyBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    addToCart(slug, {
      productId: product.id,
      name: product.name,
      price: shownPrice,
      image: product.primary_image_url,
      qty: 1,
      ...(license ? { variantId: license.id, variantLabel: variantLabel(license) } : {}),
    } as any);
    setAdded(true);
    toast.success(t("pdp.addedToCart"));
    return true;
  }
  function buy() {
    if (!add()) return;
    navigate({ to: "/store/$slug/checkout", params: { slug } });
  }

  const rating = Number(product.rating ?? 0);
  const size = formatBytes(dg.total_size);
  const licenseType = (dg.license_type ?? "personal") as LicenseType;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const metaRow: { label: string; value: string }[] = [];
  if (product.brand) metaRow.push({ label: t("digital.creator"), value: product.brand });
  if (dg.version) metaRow.push({ label: t("digital.version"), value: dg.version });
  if (product.updated_at)
    metaRow.push({ label: t("digital.lastUpdated"), value: new Date(product.updated_at).toLocaleDateString() });
  if (size) metaRow.push({ label: t("digital.fileSize"), value: size });
  metaRow.push({ label: t("digital.license"), value: LICENSE_LABELS[licenseType] ?? t("digital.personalLicense") });

  return (
    <div className="pb-24 lg:pb-6">
      {/* ---------------------------------------------------------- hero */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <ProductGallery
            name={product.name}
            primary={product.primary_image_url}
            gallery={product.gallery}
            videoUrl={product.video_url ?? null}
          />
        </div>

        <div className="min-w-0">
          <div className="lg:sticky lg:top-20">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Zap className="h-3 w-3" /> {t("digital.badge")}
            </span>
            <h1 className="mt-2 text-xl font-bold sm:text-2xl">{product.name}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {categoryName && (
                <span>
                  {t("digital.category")}: <span className="font-medium text-foreground">{categoryName}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium text-foreground">{rating ? rating.toFixed(1) : t("digital.new")}</span>
                {product.total_sold ? <span>· {product.total_sold} {t("digital.sales")}</span> : null}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-3 text-xs">
              {metaRow.map((m) => (
                <div key={m.label}>
                  <dt className="text-muted-foreground">{m.label}</dt>
                  <dd className="font-medium text-foreground">{m.value}</dd>
                </div>
              ))}
            </dl>

            <div ref={buyBoxRef} className="mt-4 rounded-xl border bg-card p-4">
              {licenses.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-sm font-medium">লাইসেন্স বেছে নিন</p>
                  {licenses.map((l) => {
                    const on = l.id === licenseId;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLicenseId(l.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50"}`}
                      >
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                          <span>{l.options.License}</span>
                          <span>৳{variantPrice(l, price).toFixed(0)}</span>
                        </span>
                        {(l as any).description && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{(l as any).description}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {isFree ? t("common.free") : `${licenses.length && !license ? "From " : ""}৳${(license ? shownPrice : licenses.length ? Math.min(...licenses.map((l) => variantPrice(l, price))) : price).toFixed(0)}`}
                </span>
                {!isFree && oldPrice && oldPrice > price && (
                  <>
                    <span className="text-sm text-muted-foreground line-through">
                      ৳{oldPrice.toFixed(0)}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      -{discountPct}%
                    </span>
                  </>
                )}
              </div>

              <div className="mt-4 grid gap-2">
                <Button type="button" variant="outline" className="h-11" onClick={add}>
                  {added ? t("digital.addedCheck") : t("pdp.addToCart")}
                </Button>
                <Button
                  type="button"
                  className="h-11"
                  style={{ backgroundColor: "var(--primary)", color: "white" }}
                  onClick={buy}
                >
                  {t("pdp.buyNow")}
                </Button>
              </div>

              <ul className="mt-4 space-y-2 border-t pt-3 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> {t("digital.securePayment")}
                </li>
                <li className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" /> {t("digital.instantAccess")}
                </li>
                {!dg.download?.expiry_days && (
                  <li className="flex items-center gap-2">
                    <InfinityIcon className="h-4 w-4 text-primary" /> {t("digital.lifetimeAccess")}
                  </li>
                )}
                {dg.version && (
                  <li className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" /> {t("digital.freeUpdates", { version: dg.version })}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ sections */}
      <DigitalPreview
        name={product.name}
        images={dg.preview?.images ?? []}
        videoUrl={dg.preview?.video_url}
        pdfUrl={dg.preview?.pdf_url}
        audioUrl={dg.preview?.audio_url}
        demoUrl={dg.preview?.demo_url}
      />

      <DigitalDescription
        html={product.description ?? null}
        features={Array.isArray(product.features) ? (product.features as string[]).filter(Boolean) : []}
      />

      <DigitalIncluded ids={dg.included ?? []} />

      <DigitalFileInfo
        fileCount={dg.file_count ?? 0}
        totalSize={dg.total_size ?? 0}
        fileTypes={dg.file_types ?? []}
        version={dg.version}
        updatedAt={product.updated_at}
        platforms={dg.platforms ?? []}
      />

      <DigitalRequirementsTable req={dg.requirements ?? {}} />

      <DigitalLicense type={licenseType} note={dg.license_note} />

      <DigitalChangelog text={dg.changelog} version={dg.version} />

      <DigitalFaqList items={dg.faq ?? []} />

      <ReviewsBlock rating={rating || null} storeId={store.id} productId={product.id} />

      <RelatedRail
        title={t("digital.relatedProducts")}
        slug={slug}
        products={(relatedQ.data ?? []) as any}
        variant="grid"
      />

      <StoreCard slug={slug} name={store.name} logoUrl={store.logo_url} />
      <ShareBar url={shareUrl} title={product.name} />

      <div className="mt-8">
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("digital.backToStore")}
        </Link>
      </div>

      <StickyMobileBar price={price} disabled={false} onAdd={add} onBuy={buy} observeRef={buyBoxRef} />
    </div>
  );
}
