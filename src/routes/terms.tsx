import { createFileRoute } from "@tanstack/react-router";
import { getLegalPagePublic } from "@/lib/legal.functions";
import { LegalPage, LegalPageMissing } from "@/components/storefront/LegalPage";

const PAGE_KEY = "terms";
const PAGE_PATH = "/terms";
const DEFAULT_TITLE = "Terms of Service";

export const Route = createFileRoute("/terms")({
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
