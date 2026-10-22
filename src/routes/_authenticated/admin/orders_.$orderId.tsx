import { createFileRoute, useRouter } from "@tanstack/react-router";
import { OrderDetailsDrawer } from "@/components/admin/OrderDetailsDrawer";

export const Route = createFileRoute("/_authenticated/admin/orders_/$orderId")({
  head: () => ({
    meta: [
      { title: "Order Details — ORZEN Merchant Panel" },
      { name: "description", content: "Review customer, products, courier and timeline for a single order." },
      { property: "og:title", content: "Order Details — ORZEN Merchant Panel" },
      { property: "og:description", content: "Review customer, products, courier and timeline for a single order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderDetailsPage,
});

function OrderDetailsPage() {
  const { orderId } = Route.useParams();
  const router = useRouter();
  const back = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/admin/orders" });
  };
  return <OrderDetailsDrawer variant="page" open onOpenChange={(v) => { if (!v) back(); }} orderId={orderId} />;
}
