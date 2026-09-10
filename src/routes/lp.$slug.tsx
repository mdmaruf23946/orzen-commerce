// Public renderer for builder landing pages.
// One fixed, professional template. Section order is always:
// Header first, Footer last; everything in between follows content.sectionOrder.
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Star, Loader2, ChevronDown } from "lucide-react";
import { LP_ICONS } from "@/lib/landing-icons";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicLanding, getLandingStoreProducts, type PublicLandingPage } from "@/lib/landing-public.functions";
import type { LandingProductCard } from "@/components/landing/sections/ProductGrid";
import { readRecent } from "@/lib/recently-viewed";
import { LandingBranding } from "@/components/landing/LandingBranding";
import { GenericSection } from "@/components/landing/GenericSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { sectionSpec } from "@/lib/landing-sections";
import { normalizePalette, themeTokens } from "@/lib/landing-theme";
import { safeDesignCss } from "@/lib/landing-code";
import { LP_BASE_CSS, wrapUserLayer } from "@/lib/landing-base-css";
import { computeOfferPrices, normalizeOffer, offerIsUsable } from "@/lib/landing-offer";
import { getLandingPreviewBySlug } from "@/lib/landing-builder.functions";
import {
  lpImage, normalizeContent, normalizeDeliveryZones,
  type LandingContent, type LandingFormConfig, type LandingDeliveryZone,
} from "@/lib/landing-builder";

export const Route = createFileRoute("/lp/$slug")({
  validateSearch: (search: Record<string, unknown>) => {
    const draft: Record<string, string> = {};
    for (const role of ["primary", "secondary", "accent", "background", "text"]) {
      const v = search[`c_${role}`];
      if (typeof v === "string" && v) draft[role] = v.startsWith("#") ? v : `#${v}`;
    }
    return {
      preview:
        search["preview"] === true || search["preview"] === "true" || search["preview"] === "1"
          ? true
          : undefined,
      draftTheme: Object.keys(draft).length ? draft : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ preview: Boolean(search.preview) }),
  loader: async ({ params, deps }) => {
    // In preview mode the page may still be a draft — it is fetched client-side
    // through the owner-authenticated server function instead.
    if (deps.preview) return null;
    const page = await getPublicLanding({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const content = normalizeContent(loaderData.content);
    const title = loaderData.seo?.title || loaderData.title;
    const description = loaderData.seo?.description || content.hero.subheadline || loaderData.title;
    const image = lpImage((loaderData.seo as any)?.image || content.hero.image);
    const pageIcon = lpImage(String((loaderData.seo as any)?.icon ?? ""));
    return {
      links: pageIcon
        ? [
            { rel: "icon", href: pageIcon },
            { rel: "apple-touch-icon", href: pageIcon },
          ]
        : [],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image.startsWith("https://")
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <div className="text-2xl font-semibold">Page not published</div>
        <p className="mt-2 text-sm text-neutral-500">
          This landing page is not published yet. Publish it from the Merchant Panel to make it live.
        </p>
      </div>
    </div>
  ),
  component: LandingPageView,
});

const ICONS = LP_ICONS;

function money(n: number) {
  return `৳${Number(n || 0).toLocaleString("en-US")}`;
}

function LandingPageView() {
  const loaded = Route.useLoaderData() as PublicLandingPage | null;
  const { preview, draftTheme } = Route.useSearch();
  const previewFn = useServerFn(getLandingPreviewBySlug);
  const { slug } = Route.useParams();

  const { data: previewPage, isLoading } = useQuery({
    queryKey: ["lp-preview", slug],
    queryFn: () => previewFn({ data: { slug } }) as Promise<PublicLandingPage | null>,
    enabled: Boolean(preview) && !loaded,
    staleTime: 0,
  });

  const page = loaded ?? (previewPage as PublicLandingPage | null);

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        ) : (
          <div>
            <div className="text-2xl font-semibold">Page not found</div>
            <p className="mt-2 text-sm text-neutral-500">
              This landing page is not available. Sign in as the store owner to preview drafts.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {!preview && <LandingPixels pageId={page.id} />}
      <LandingPageBody page={page} preview={Boolean(preview)} draftTheme={draftTheme} />
    </>
  );
}

function LandingPageBody({
  page,
  preview,
  draftTheme,
}: {
  page: PublicLandingPage;
  preview: boolean;
  draftTheme?: Record<string, string> | undefined;
}) {
  const content = useMemo(() => normalizeContent(page.content), [page.content]);
  const form = (page.form_config ?? {}) as LandingFormConfig;

  // Keep the page "in use" so the idle sweep never releases a live page's hosts.
  useEffect(() => {
    if (preview) return;
    import("@/integrations/supabase/client")
      .then(({ supabase }) => supabase.rpc("touch_landing_activity", { _page_id: page.id, _visit: true }))
      .catch(() => null);
  }, [preview, page.id]);

  // Saved merchant design (draft colors win while previewing from the builder).
  const palette = useMemo(
    () => normalizePalette({ ...((page.theme ?? {}) as object), ...(draftTheme ?? {}) }),
    [page.theme, draftTheme],
  );
  const STYLE = useMemo(() => themeTokens(palette) as React.CSSProperties, [palette]);

  // Saved "Coding" tab design. In builder preview the unsaved draft (kept in
  // sessionStorage by the Coding tab) wins so changes can be checked first.
  const [draftCode, setDraftCode] = useState<string | null>(null);
  useEffect(() => {
    if (!preview) return;
    try {
      setDraftCode(sessionStorage.getItem(`lp-draft-code:${page.slug}`));
    } catch {
      setDraftCode(null);
    }
  }, [preview, page.slug]);
  const designSource = draftCode ?? ((page as any).design_code as string | null) ?? "";
  const designCss = useMemo(() => wrapUserLayer(safeDesignCss(designSource)), [designSource]);
  // Keying the <style> on the saved code guarantees the old stylesheet is
  // removed, never merged, when new CSS is saved.
  const designKey = useMemo(() => `${designSource.length}-${hashCode(designSource)}`, [designSource]);

  // ----- Catalogue-driven sections (Recommended / Related / Recently viewed) -----
  // Catalogue-backed grids are opt-in: they only render when the merchant
  // explicitly added them (flag === true), never on an `undefined` flag.
  const productSections = useMemo(
    () =>
      content.sectionOrder.filter(
        (k) => content.sectionEnabled[k] === true && sectionSpec(k)?.render === "products",
      ),
    [content.sectionOrder, content.sectionEnabled],
  );
  const catalogueFn = useServerFn(getLandingStoreProducts);
  const { data: catalogue } = useQuery({
    queryKey: ["lp-catalogue", page.store.id],
    queryFn: () => catalogueFn({ data: { storeId: page.store.id, storeSlug: page.store.slug } }),
    enabled: productSections.length > 0,
    staleTime: 5 * 60_000,
  });
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    if (productSections.includes("recently_viewed")) setRecentIds(readRecent(page.store.slug, page.product?.id));
  }, [productSections, page.store.slug, page.product?.id]);

  function productsForSection(key: string): LandingProductCard[] {
    const all = catalogue?.products ?? [];
    if (!all.length) return [];
    const others = all.filter((p) => p.id !== page.product?.id);
    if (key === "recommended_products") {
      const picked: string[] = Array.isArray((content.blocks[key] as any)?.productIds)
        ? ((content.blocks[key] as any).productIds as string[])
        : [];
      const chosen = picked.map((id) => all.find((p) => p.id === id)).filter(Boolean) as LandingProductCard[];
      return (chosen.length ? chosen : others).slice(0, 8);
    }
    if (key === "recently_viewed") {
      return recentIds.map((id) => all.find((p) => p.id === id)).filter(Boolean).slice(0, 8) as LandingProductCard[];
    }
    return others.slice(0, 8);
  }

  const price = content.pricing.price || page.product?.price || 0;
  const oldPrice = content.pricing.oldPrice ?? page.product?.old_price ?? null;
  const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
  const storeName = content.header.storeName.trim() || page.store?.name || page.title;

  const productImages = useMemo(() => {
    const gallery = Array.isArray(page.product?.gallery)
      ? (page.product?.gallery as unknown[])
          .map((g) => (typeof g === "string" ? g : String((g as any)?.url ?? "")))
          .filter(Boolean)
      : [];
    return Array.from(
      new Set([...(content.product.images ?? []), page.product?.primary_image_url ?? "", ...gallery].filter(Boolean)),
    ) as string[];
  }, [content.product.images, page.product]);

  const heroImage = content.hero.image || productImages[0] || "";
  const shownImages =
    content.product.selectedImages.length > 0
      ? productImages.filter((i) => content.product.selectedImages.includes(i))
      : productImages;

  // Footer values: merchant text wins, Store Settings is the automatic fallback.
  const headerIcon = content.header.iconLogo;
  const headerName = content.header.nameLogo;



      const builtinNodes: Record<string, React.ReactNode> = {
        hero: (
          <>
          <section className="px-4 pb-12 pt-8 sm:pt-14">
            <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
              <div className="order-2 md:order-1">
                {content.hero.offerText && (
                  <span
                    className="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white lp-accent-bg"
                  >
                    {content.hero.offerText}
                  </span>
                )}
                <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
                  {content.hero.headline || page.product?.name || page.title}
                </h1>
                {content.hero.subheadline && (
                  <p className="mt-3 text-base text-neutral-600">{content.hero.subheadline}</p>
                )}
                <div className="mt-4 flex items-center gap-1 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                  <span className="ml-1 text-xs text-neutral-500">5.0</span>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-3">
                  <span className="text-3xl font-bold lp-primary-text">{money(price)}</span>
                  {oldPrice && oldPrice > price && (
                    <span className="text-lg text-neutral-400 line-through">{money(oldPrice)}</span>
                  )}
                  {discount > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                      -{discount}%
                    </span>
                  )}
                  {content.pricing.note && <span className="text-xs text-neutral-500">{content.pricing.note}</span>}
                </div>
                <a
                  href="#order"
                  className="mt-6 inline-block px-7 py-3 text-base font-semibold text-white shadow-lg lp-btn"
                >
                  {content.hero.ctaText || "Order Now"}
                </a>
              </div>
              <div className="order-1 md:order-2">
                {heroImage && (
                  <img
                    src={lpImage(heroImage)}
                    alt={content.hero.headline || page.title}
                    className="w-full object-cover shadow-xl lp-round"
                    loading="eager"
                  />
                )}
              </div>
            </div>
          </section>
          </>
        ),
        product: (
          <>
          {content.product.enabled && (
            <Section title={content.product.title} subtitle={content.product.subtitle}>
              {shownImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {shownImages.map((img, i) => (
                    <img
                      key={i}
                      src={lpImage(img)}
                      alt={`${page.title} ${i + 1}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover lp-round"
                    />
                  ))}
                </div>
              )}

              {content.product.showFeatures && content.product.features.length > 0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {content.product.features.map((f, i) => {
                    const Icon = ICONS[f.icon] ?? Check;
                    return (
                      <div key={i} className="flex gap-3 bg-neutral-50 p-4 lp-round">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white lp-primary-bg"
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="font-semibold">{f.title}</div>
                          {f.text && <div className="mt-1 text-sm text-neutral-600">{f.text}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {content.product.showSpecs && content.product.specs.length > 0 && (
                <div className="mt-6 overflow-hidden lp-round">
                  <table className="w-full text-sm">
                    <tbody>
                      {content.product.specs.map((s, i) => (
                        <tr key={i} className={i % 2 ? "bg-neutral-50" : ""}>
                          <td className="w-1/3 p-3 font-medium">{s.label}</td>
                          <td className="p-3 text-neutral-600">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}
          </>
        ),
        description: (
          <>
          {content.description.enabled && (content.description.text || content.description.points.length > 0) && (
            <Section title={content.description.title}>
              {content.description.text && (
                <p className="mx-auto max-w-3xl whitespace-pre-line text-center text-sm leading-relaxed text-neutral-600">
                  {content.description.text}
                </p>
              )}
              {content.description.points.length > 0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {content.description.points.map((p, i) => {
                    const PIcon = ICONS[p.icon] ?? Check;
                    return (
                      <div key={i} className="bg-neutral-50 p-4 lp-round">
                        <PIcon className="h-5 w-5 lp-primary-text" />
                        <div className="mt-2 font-semibold">{p.title}</div>
                        <div className="mt-1 text-sm text-neutral-600">{p.text}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          )}
          </>
        ),
        faq: (
          <>
          {content.faq.enabled && content.faq.items.length > 0 && (
            <Section title={content.faq.title}>
              <div className="mx-auto max-w-3xl space-y-2">
                {content.faq.items.map((f, i) => (
                  <details key={i} className="group bg-neutral-50 p-4 lp-round">
                    <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                      {f.q}
                      <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 text-sm text-neutral-600">{f.a}</p>
                  </details>
                ))}
              </div>
            </Section>
          )}
          </>
        ),
        reviews: (
          <>
          {content.reviews.enabled && content.reviews.items.length > 0 && (
            <Section title={content.reviews.title}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {content.reviews.items.map((r, i) => (
                  <div key={i} className="bg-neutral-50 p-4 lp-round">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className="h-4 w-4"
                          style={{ color: s < (r.rating || 5) ? "var(--lp-accent)" : "#d4d4d4" }}
                          fill={s < (r.rating || 5) ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-neutral-700">{r.text}</p>
                    <div className="mt-3 flex items-center gap-2">
                      {r.photo && (
                        <img
                          src={lpImage(r.photo)}
                          alt={r.name}
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      )}
                      <div className="text-xs font-semibold text-neutral-500">
                        — {r.name}{r.location ? `, ${r.location}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
          </>
        ),
        order: (
          <>
          <OrderForm page={page} content={content} form={form} price={price} />
          </>
        ),
      };

  return (
    <div
      style={STYLE}
      className="lp-root min-h-screen"
    >
      {/* Base presentation layer — defaults the merchant CSS can override. */}
      <style dangerouslySetInnerHTML={{ __html: LP_BASE_CSS }} />
      {/* Merchant design code (Coding tab) — presentation only, page-scoped,
          and last in the cascade so it wins over every default. */}
      {designCss && (
        <style key={designKey} data-lp-design={designKey} dangerouslySetInnerHTML={{ __html: designCss }} />
      )}
      <LandingBranding
        slug={page.slug}
        name={page.seo?.title || page.title}
        icon={lpImage(String((page.seo as any)?.icon ?? "") || headerIcon) || null}
        themeColor={(page.theme as any)?.primary ?? "#16a34a"}
      />
      {preview && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-black">
          Preview mode — only you can see this page until it is published.
        </div>
      )}

      {/* 1. Header */}
      <header
        data-lp-section="header"
        className="sticky top-0 z-30 border-b backdrop-blur lp-header"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {headerIcon && (
            <img src={lpImage(headerIcon)} alt="" className="h-9 w-9 shrink-0 object-contain" />
          )}
          {headerName ? (
            <img src={lpImage(headerName)} alt={storeName} className="h-8 w-auto max-w-[180px] shrink-0 object-contain" />
          ) : (
            <span className="truncate text-base font-extrabold tracking-tight">{storeName}</span>
          )}
          {content.header.showButton && (
            <a
              href="#order"
              className="ml-auto shrink-0 px-4 py-2 text-sm font-semibold text-white lp-btn-sm"
            >
              {content.header.buttonText || "Order Now"}
            </a>
          )}
        </div>
      </header>

      {/* 2–7. Ordered sections */}
      {content.sectionOrder
        .filter((key) => {
          if (key === "header" || key === "footer") return false;
          if (content.sectionEnabled[key] === false) return false;
          // Product grids pull from the catalogue, so an unset flag must not
          // opt the page in — require an explicit enable.
          if (sectionSpec(key)?.render === "products") return content.sectionEnabled[key] === true;
          return true;
        })
        .map((key) => {
          const spec = sectionSpec(key);
          if (!spec) return null;
          if (spec.builtin) {
            return (
              <div key={key} data-lp-section={key}>
                {builtinNodes[key] ?? null}
              </div>
            );
          }
          return (
            <div key={key} data-lp-section={key}>
              <GenericSection
                spec={spec}
                data={content.blocks[key] ?? {}}
                products={spec.render === "products" ? productsForSection(key) : []}
                storeUrl={catalogue?.storeUrl ?? ""}
              />
            </div>
          );
        })}

      {/* 8. Footer */}
      <LandingFooter
        footer={content.footer}
        store={page.store as any}
        storePages={(page as any).store_pages ?? []}
        storeUrl={catalogue?.storeUrl ?? ""}
        fallbackName={storeName}
      />

    </div>
  );
}

function Section({
  title, subtitle, children,
}: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-5xl">
        {title && <h2 className="text-center text-2xl font-bold">{title}</h2>}
        {subtitle && <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-neutral-600">{subtitle}</p>}
        <div className={title || subtitle ? "mt-6" : ""}>{children}</div>
      </div>
    </section>
  );
}

function OrderForm({
  page,
  content,
  form,
  price,
}: {
  page: PublicLandingPage;
  content: LandingContent;
  form: LandingFormConfig;
  price: number;
}) {
  // Offer: purchase options priced from the same catalog data the server uses.
  const offer = useMemo(() => normalizeOffer(page.offer), [page.offer]);
  const offerPrices = useMemo(() => {
    if (!offerIsUsable(offer) || !page.product) return [];
    const others: Record<string, { name: string; price: number; stock: number }> = {};
    for (const row of page.offer_products ?? []) {
      // Only sellable products count — the server refuses packages with a
      // missing item, so an unavailable extra must not be shown or priced.
      if (row.status === "draft" || (row.stock ?? 0) <= 0) continue;
      others[row.id] = { name: row.name, price: Number(row.price) || 0, stock: row.stock ?? 0 };
    }
    const usable = {
      ...offer,
      tiers: offer.tiers.filter((t) =>
        t.items.every(
          (it) => it.productId === page.product!.id || (others[it.productId]?.stock ?? 0) >= it.qty,
        ),
      ),
    };
    return computeOfferPrices(usable, {
      main: { productId: page.product.id, name: page.product.name, price },
      others,
    });
  }, [offer, page.offer_products, page.product, price]);


  const [tierId, setTierId] = useState<string>("");
  const activeTier =
    offerPrices.find((t) => t.tierId === tierId) ??
    offerPrices.find((t) => t.featured) ??
    offerPrices[0] ??
    null;

  const fields = (form.fields ?? []).filter((f) => f.enabled).filter((f) => !(activeTier && f.key === "quantity"));
  const methods = form.paymentMethods?.length ? form.paymentMethods : ["cod"];
  const zones = normalizeDeliveryZones(form.deliveryZones);

  const [values, setValues] = useState<Record<string, string>>({ quantity: "1" });
  const [zoneId, setZoneId] = useState(
    zones.find((z) => z.isDefault)?.id ?? zones[0]?.id ?? "",
  );
  const delivery = zones.length
    ? (zones.find((z) => z.id === zoneId)?.charge ?? zones[0]!.charge)
    : Number(form.deliveryCharge ?? 0);
  const [method, setMethod] = useState(methods[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<OrderConfirmation | null>(null);

  const qty = activeTier ? activeTier.quantity : Math.max(1, Number(values["quantity"] || 1));
  const goods = activeTier ? activeTier.price : price * qty;
  const total = goods + delivery;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/public/lp/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          landing_page_id: page.id,
          customer_name: values["customer_name"] ?? "",
          phone: values["phone"] ?? "",
          address: values["address"] ?? "",
          area: values["area"] ?? null,
          email: values["email"] || null,
          note: values["note"] || null,
          quantity: qty,
          offer_tier: activeTier?.tierId ?? null,
          payment_method: method,
          delivery_zone: zones.length ? zoneId : null,
          txn_id: values["txn_id"] || null,
          page_url: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        invoice_no?: string | null;
        order_id?: string | null;
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Order failed");
      setDone({
        invoice: json.invoice_no ?? null,
        orderId: json.order_id ?? null,
        name: values["customer_name"] ?? "",
        phone: values["phone"] ?? "",
        address: values["address"] ?? "",
        area: (zones.length ? zones.find((z) => z.id === zoneId)?.name : values["area"]) || null,
        method,
        txnId: values["txn_id"] || null,
        lines: activeTier
          ? activeTier.lines.map((l) => ({
              name: l.name,
              qty: l.qty,
              free: l.free,
            }))
          : [{ name: page.product?.name ?? "Product", qty, free: false }],
        packageLabel: activeTier ? activeTier.label || `প্যাকেজ (${activeTier.quantity})` : null,
        goods,
        delivery,
        total,
      });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: document.getElementById("order")?.offsetTop ?? 0, behavior: "smooth" });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "lp-input w-full border border-neutral-300 bg-white px-3 py-2 text-sm outline-none";

  return (
    <section id="order" className="px-4 py-12">
      <div
        className="mx-auto max-w-xl bg-white p-5 shadow-lg ring-1 ring-neutral-200 sm:p-7 lp-round"
      >
        <h2 className="text-xl font-bold">{content.order.title || "Order Now"}</h2>
        {content.order.subtitle && <p className="mt-1 text-sm text-neutral-600">{content.order.subtitle}</p>}

        {!done && offerPrices.length > 0 && (
          <div className="lp-offer mt-5">
            {offer.title && <div className="lp-offer-title text-base font-semibold">{offer.title}</div>}
            {offer.subtitle && <div className="lp-offer-subtitle text-xs text-neutral-600">{offer.subtitle}</div>}
            <div className="lp-offer-tiers mt-3 grid gap-2">
              {offerPrices.map((t) => {
                const selected = activeTier?.tierId === t.tierId;
                return (
                  <button
                    type="button"
                    key={t.tierId}
                    aria-pressed={selected}
                    onClick={() => setTierId(t.tierId)}
                    className={`lp-offer-tier lp-round-xs flex w-full items-center gap-3 border p-3 text-left ${
                      selected ? "is-selected border-neutral-900" : "border-neutral-300"
                    } ${t.featured ? "is-featured" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="lp-offer-tier-label text-sm font-semibold">
                        {t.label || `${t.quantity} × ${page.product?.name ?? ""}`}
                        {t.badge && <span className="lp-offer-badge ml-2 text-[10px] uppercase">{t.badge}</span>}
                      </div>
                      <div className="lp-offer-tier-items text-[11px] text-neutral-500">
                        {t.lines.map((l) => `${l.qty}× ${l.name}${l.free ? " (free)" : ""}`).join(" + ")}
                      </div>
                    </div>
                    <div className="text-right">
                      {t.savings > 0 && (
                        <div className="lp-price-old text-[11px] text-neutral-400 line-through">{money(t.original)}</div>
                      )}
                      <div className="lp-price text-sm font-bold">{money(t.price)}</div>
                      {t.savings > 0 && (
                        <div className="lp-save-badge text-[10px] text-emerald-600">save {money(t.savings)}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {done ? (
          <div className="lp-confirm mt-6">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white lp-primary-bg">
                <Check className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-medium">
                {content.order.successMessage || "ধন্যবাদ! অর্ডার গ্রহণ করা হয়েছে।"}
              </p>
              {done.invoice && (
                <p className="mt-1 text-xs text-neutral-500">ইনভয়েস নম্বর: {done.invoice}</p>
              )}
            </div>

            <div className="lp-confirm-card mt-5 space-y-2 bg-neutral-50 p-3 text-sm lp-round-xs">
              <div className="text-xs font-semibold uppercase text-neutral-500">অর্ডার বিবরণ</div>
              {done.packageLabel && (
                <div className="text-sm font-medium">{done.packageLabel}</div>
              )}
              {done.lines.map((l, i) => (
                <Row
                  key={`${l.name}-${i}`}
                  label={`${l.qty} × ${l.name}${l.free ? " (ফ্রি)" : ""}`}
                  value={l.free ? "ফ্রি" : ""}
                />
              ))}
              <div className="border-t pt-2">
                <Row label="পণ্যমূল্য" value={money(done.goods)} />
                <Row label="ডেলিভারি চার্জ" value={money(done.delivery)} />
              </div>
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>সর্বমোট</span>
                <span className="lp-primary-text">{money(done.total)}</span>
              </div>
            </div>

            <div className="lp-confirm-card mt-3 space-y-1 bg-neutral-50 p-3 text-sm lp-round-xs">
              <div className="text-xs font-semibold uppercase text-neutral-500">ডেলিভারি তথ্য</div>
              <Row label="নাম" value={done.name} />
              <Row label="মোবাইল" value={done.phone} />
              {done.area && <Row label="এলাকা" value={done.area} />}
              {done.address && (
                <div className="text-neutral-700">
                  <span className="text-neutral-500">ঠিকানা: </span>
                  {done.address}
                </div>
              )}
            </div>

            <div className="lp-confirm-pay mt-3 space-y-1 bg-neutral-50 p-3 text-sm lp-round-xs">
              <div className="text-xs font-semibold uppercase text-neutral-500">পেমেন্ট নির্দেশনা</div>
              <Row label="পেমেন্ট মেথড" value={done.method.toUpperCase()} />
              {done.txnId && <Row label="ট্রানজেকশন আইডি" value={done.txnId} />}
              <p className="pt-1 text-neutral-700">{paymentInstruction(done.method, done.total)}</p>
            </div>

            <p className="mt-3 text-center text-xs text-neutral-500">
              আমাদের প্রতিনিধি শীঘ্রই কল করে অর্ডারটি কনফার্ম করবেন।
            </p>
          </div>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={submit}>
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                {f.key === "address" || f.key === "note" ? (
                  <textarea
                    className={inputClass}
                    rows={2}
                    required={f.required}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    className={inputClass}
                    type={f.key === "quantity" ? "number" : f.key === "email" ? "email" : "text"}
                    min={f.key === "quantity" ? 1 : undefined}
                    required={f.required}
                    value={values[f.key] ?? (f.key === "quantity" ? "1" : "")}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            {zones.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  {form.deliveryZoneLabel || "ডেলিভারি এলাকা"}
                  <span className="text-red-500"> *</span>
                </label>
                <select
                  className={inputClass}
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  required
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} — {money(z.charge)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {methods.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">পেমেন্ট মেথড</label>
                <div className="flex flex-wrap gap-2">
                  {methods.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`lp-round-xs border px-3 py-1.5 text-xs uppercase ${
                        method === m ? "lp-primary-bg text-white" : "border-neutral-300 bg-transparent"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method !== "cod" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">ট্রানজেকশন আইডি</label>
                <input
                  className={inputClass}
                  value={values["txn_id"] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, txn_id: e.target.value }))}
                />
              </div>
            )}

            <div
              className="space-y-1 bg-neutral-50 p-3 text-sm lp-round-xs"
            >
              <Row
                label={activeTier ? activeTier.label || `প্যাকেজ (${activeTier.quantity})` : `প্রোডাক্ট (${qty})`}
                value={money(goods)}
              />
              <Row label="ডেলিভারি চার্জ" value={money(delivery)} />
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>সর্বমোট</span>
                <span className="lp-primary-text">{money(total)}</span>
              </div>
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 py-3 font-semibold text-white disabled:opacity-60 lp-btn"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.buttonText || "অর্ডার কনফার্ম করুন"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

/** Snapshot of a placed order, shown on the confirmation panel. */
type OrderConfirmation = {
  invoice: string | null;
  orderId: string | null;
  name: string;
  phone: string;
  address: string;
  area: string | null;
  method: string;
  txnId: string | null;
  lines: { name: string; qty: number; free: boolean }[];
  packageLabel: string | null;
  goods: number;
  delivery: number;
  total: number;
};

/** Presentation-only guidance for how the buyer should settle the order. */
function paymentInstruction(method: string, total: number) {
  const amount = money(total);
  switch (method) {
    case "bkash":
      return `bKash-এ ${amount} পাঠিয়ে ট্রানজেকশন আইডি সংরক্ষণ করুন। আমাদের প্রতিনিধি পেমেন্ট যাচাই করে অর্ডার কনফার্ম করবেন।`;
    case "nagad":
      return `Nagad-এ ${amount} পাঠিয়ে ট্রানজেকশন আইডি সংরক্ষণ করুন। পেমেন্ট যাচাইয়ের পর অর্ডার প্রসেস করা হবে।`;
    case "rocket":
      return `Rocket-এ ${amount} পাঠিয়ে ট্রানজেকশন আইডি সংরক্ষণ করুন। পেমেন্ট যাচাইয়ের পর অর্ডার প্রসেস করা হবে।`;
    case "bank":
      return `ব্যাংক ট্রান্সফারে ${amount} পাঠান। ট্রান্সফার সম্পন্ন হলে আমাদের প্রতিনিধি যাচাই করে অর্ডার কনফার্ম করবেন।`;
    default:
      return `ক্যাশ অন ডেলিভারি: পণ্য হাতে পেয়ে ডেলিভারি ম্যানকে ${amount} পরিশোধ করুন। এখন কোনো অগ্রিম পেমেন্ট লাগবে না।`;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Tiny stable hash used to key the merchant stylesheet element. */
function hashCode(v: string): number {
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (Math.imul(31, h) + v.charCodeAt(i)) | 0;
  return h >>> 0;
}
