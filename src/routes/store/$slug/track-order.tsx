import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { OrderTracker } from "@/components/storefront/account/OrderTracker";

export const Route = createFileRoute("/store/$slug/track-order")({
  head: () => ({
    meta: [
      { title: "Track your order — order status & delivery updates" },
      {
        name: "description",
        content:
          "Track any order instantly with your Order ID or the phone number used at checkout. See live status, shipping progress and courier details.",
      },
      { property: "og:title", content: "Track your order" },
      {
        property: "og:description",
        content: "Check live order status and delivery progress with your Order ID or phone number.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackOrderPage,
});

function TrackOrderPage() {
  const { slug } = Route.useParams();
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
        <h1 className="text-xl font-bold text-neutral-900">Track your order</h1>
        <OrderTracker slug={slug} />
      </div>
    </div>
  );
}
