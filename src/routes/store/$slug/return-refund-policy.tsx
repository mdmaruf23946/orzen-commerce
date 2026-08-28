import { createFileRoute } from "@tanstack/react-router";
import { getStorePagePublic } from "@/lib/store-pages.functions";
import { storePageHead, StorePageView } from "@/lib/store-page-view";
import { StoreErrorState } from "@/components/storefront/StoreErrorState";

const PAGE_KEY = "return-refund-policy";

export const Route = createFileRoute("/store/$slug/return-refund-policy")({
  loader: ({ params }) => getStorePagePublic({ data: { slug: params.slug, pageKey: PAGE_KEY } }),
  head: ({ loaderData }) => storePageHead(loaderData, PAGE_KEY),
  errorComponent: ({ error }) => <StoreErrorState error={error} scope="storefront:page" />,
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  return <StorePageView slug={slug} pageKey={PAGE_KEY} data={Route.useLoaderData()} />;
}
