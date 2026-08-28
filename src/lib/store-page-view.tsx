// Shared rendering + SEO helpers for the merchant-editable storefront pages.
import { StorePageShell, StorePageBody } from "@/components/storefront/StorePageLayout";
import { storePageDef } from "@/lib/store-pages";

type LoaderShape = {
  origin?: string;
  slug?: string;
  store?: { name?: string | null } | null;
  page?: {
    title?: string | null;
    content_html?: string | null;
    seo_description?: string | null;
    updated_at?: string | null;
  } | null;
};

export function storePageTitle(d: LoaderShape, pageKey: string): string {
  const def = storePageDef(pageKey);
  const storeName = d?.store?.name;
  const base = d?.page?.title?.trim() || def?.label || "Page";
  return storeName && !base.includes(storeName) ? `${base} — ${storeName}` : base;
}

/** Builds the route `head()` payload for one storefront page. */
export function storePageHead(loaderData: unknown, pageKey: string) {
  const d = (loaderData ?? {}) as LoaderShape;
  const def = storePageDef(pageKey);
  const title = storePageTitle(d, pageKey);
  const description =
    d?.page?.seo_description?.trim() ||
    def?.defaultDescription ||
    `${def?.label ?? "Page"} for ${d?.store?.name || "our store"}.`;
  const canonical = d?.origin ? `${d.origin}/${pageKey}` : undefined;
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ];
  if (canonical) meta.push({ property: "og:url", content: canonical });
  return { meta, links: canonical ? [{ rel: "canonical", href: canonical }] : [] };
}

export function StorePageView({
  slug,
  pageKey,
  data,
  children,
}: {
  slug: string;
  pageKey: string;
  data: unknown;
  children?: React.ReactNode;
}) {
  const d = (data ?? {}) as LoaderShape;
  const def = storePageDef(pageKey);
  const title = d?.page?.title?.trim() || def?.label || "Page";
  return (
    <StorePageShell
      slug={slug}
      title={title}
      storeName={d?.store?.name}
      updatedAt={d?.page?.updated_at ?? null}
    >
      <StorePageBody
        html={d?.page?.content_html ?? null}
        title={title}
        store={(d?.store as any) ?? null}
      />
      {children}
    </StorePageShell>
  );
}
