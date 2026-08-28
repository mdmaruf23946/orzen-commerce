import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { OrderTracker } from "@/components/storefront/account/OrderTracker";
import { getStorePagePublic } from "@/lib/store-pages.functions";
import { storePageHead } from "@/lib/store-page-view";
import { StorePageBody } from "@/components/storefront/StorePageLayout";

const PAGE_KEY = "track-order";

export const Route = createFileRoute("/store/$slug/track-order")({
  loader: ({ params }) => getStorePagePublic({ data: { slug: params.slug, pageKey: PAGE_KEY } }),
  head: ({ loaderData }) => storePageHead(loaderData, PAGE_KEY),
  component: TrackOrderPage,
});

function TrackOrderPage() {
  const { slug } = Route.useParams();
  const d = Route.useLoaderData() as any;
  const intro = d?.page?.content_html as string | undefined;
  return (
    <div className="-mx-4 min-h-[calc(100dvh-3.5rem)] bg-neutral-50 px-4 py-5 sm:-mx-6 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to store
        </Link>
        <h1 className="text-xl font-bold text-neutral-900">
          {d?.page?.title?.trim() || "Track your order"}
        </h1>
        {intro && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <StorePageBody html={intro} title="Track your order" store={d?.store ?? null} />
          </div>
        )}
        <OrderTracker slug={slug} />
      </div>
    </div>
  );
}
