import { createFileRoute } from "@tanstack/react-router";
import { PLATFORM_OG_IMAGE } from "@/lib/platform-seo";
import { getLegalPagePublic } from "@/lib/legal.functions";
import { LegalPage, LegalPageMissing } from "@/components/storefront/LegalPage";

const PAGE_KEY = "about";
const PAGE_PATH = "/about";
const DEFAULT_TITLE = "About Us";

export const Route = createFileRoute("/about")({
  loader: () => getLegalPagePublic({ data: { page: PAGE_KEY } }),
  head: ({ loaderData }) => {
    const d: any = loaderData ?? {};
    const p = d.page;
    const store = d.store;
    const title = p?.title || `${DEFAULT_TITLE}${store?.name ? ` — ${store.name}` : ""}`;
    const description = p?.description || `${DEFAULT_TITLE} for ${store?.name || "our store"}.`;
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
