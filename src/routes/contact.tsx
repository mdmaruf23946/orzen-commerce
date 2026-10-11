import { createFileRoute } from "@tanstack/react-router";
import { PLATFORM_OG_IMAGE } from "@/lib/platform-seo";
import { getPlatformSeoOverrides } from "@/lib/platform-seo-pages.functions";
import { effectiveSeo } from "@/lib/platform-seo-pages";
import { getLegalPagePublic } from "@/lib/legal.functions";
import { LegalPage, LegalPageMissing } from "@/components/storefront/LegalPage";

const PAGE_KEY = "contact";
const PAGE_PATH = "/contact";
const DEFAULT_TITLE = "Contact Us";

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const [d, seo] = await Promise.all([
      getLegalPagePublic({ data: { page: PAGE_KEY } }),
      getPlatformSeoOverrides().catch(() => ({})),
    ]);
    return { ...(d as any), platformSeo: seo };
  },
  head: ({ loaderData }) => {
    const d: any = loaderData ?? {};
    const p = d.page;
    const store = d.store;
    const ov = !store ? (d.platformSeo as any)?.contact : null;
    const title = ov?.title || p?.title || `${DEFAULT_TITLE}${store?.name ? ` — ${store.name}` : ""}`;
    const description = ov?.description || p?.description || `${DEFAULT_TITLE} for ${store?.name || "our store"}.`;
    const canonical = d.origin ? `${d.origin}${PAGE_PATH}` : undefined;
    const meta: any[] = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: PLATFORM_OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: PLATFORM_OG_IMAGE },
    ];
    if (canonical) meta.push({ property: "og:url", content: canonical });
    const links: any[] = canonical ? [{ rel: "canonical", href: canonical }] : [];
    return { meta, links };
  },
  component: Page,
});

function Page() {
  const d = Route.useLoaderData() as any;
  if (!d?.page) return <LegalPageMissing title={DEFAULT_TITLE} />;
  return (
    <LegalPage
      title={d.page.title}
      html={d.page.html}
      storeName={d.store?.name}
      updatedAt={d.page.updated_at}
    />
  );
}
