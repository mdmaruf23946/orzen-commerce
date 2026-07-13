import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { getOrder } from "@/lib/storefront.functions";

const orderQuery = (orderId: string) =>
  queryOptions({ queryKey: ["order", orderId], queryFn: () => getOrder({ data: { orderId } }) });

export const Route = createFileRoute("/store/$slug/order/$orderId")({
  head: () => ({ meta: [{ title: "Order confirmed" }] }),
  loader: async ({ context, params }) => {
    const order = await context.queryClient.ensureQueryData(orderQuery(params.orderId));
    if (!order) throw notFound();
    return null;
  },
  errorComponent: () => <div className="p-6 text-center">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6 text-center">Order not found</div>,
  component: OrderConfirmation,
});

function OrderConfirmation() {
  const { slug, orderId } = Route.useParams();
  const { data: order } = useSuspenseQuery(orderQuery(orderId));
  if (!order) return null;

  return (
    <div className="mx-auto max-w-lg py-8">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-3 text-2xl font-semibold">Order placed</h1>
        <p className="mt-1 text-sm text-muted-foreground">We'll contact you shortly to confirm.</p>
      </div>
      <div className="mt-6 rounded-xl border bg-card p-4">
        <div className="text-xs text-muted-foreground">Order ID</div>
        <div className="font-mono text-sm">{order.id.slice(0, 8).toUpperCase()}</div>
        <ul className="mt-4 space-y-2 text-sm">
          {(order.items as any[]).map((i: any, idx: number) => (
            <li key={idx} className="flex justify-between gap-3">
              <span>
                {i.name_snapshot} × {i.qty}
              </span>
              <span>৳{(Number(i.price_snapshot) * i.qty).toFixed(0)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-sm">Total</span>
          <span className="text-lg font-bold">৳{Number(order.subtotal).toFixed(0)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>Name</div>
          <div className="text-right text-foreground">{order.customer_name}</div>
          <div>Phone</div>
          <div className="text-right text-foreground">{order.phone}</div>
          <div>Address</div>
          <div className="text-right text-foreground">{order.address}</div>
          <div>Payment</div>
          <div className="text-right text-foreground uppercase">{order.payment_method}</div>
        </div>
      </div>
      <Link
        to="/store/$slug"
        params={{ slug }}
        className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to store
      </Link>
    </div>
  );
}
