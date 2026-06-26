import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStoreBySlug, placeOrder } from "@/lib/storefront.functions";
import { readCart, clearCart, cartTotal, type CartItem } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const storeQuery = (slug: string) =>
  queryOptions({ queryKey: ["store", slug], queryFn: () => getStoreBySlug({ data: { slug } }) });

export const Route = createFileRoute("/store/$slug/checkout")({
  head: () => ({ meta: [{ title: "Checkout" }] }),
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(storeQuery(params.slug));
    return null;
  },
  errorComponent: () => <div className="p-6 text-center">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6 text-center">Not found</div>,
  component: CheckoutPage,
});

function CheckoutPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  const place = useServerFn(placeOrder);

  const [items, setItems] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [method, setMethod] = useState<"cod" | "bkash" | "nagad">("cod");
  const [txnId, setTxnId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setItems(readCart(slug)), [slug]);

  if (!store) return null;
  const total = items.reduce((a, i) => a + i.qty * i.price, 0);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold">Your cart is empty</h1>
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Continue shopping
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await place({
        data: {
          storeId: store!.id,
          customerName: name,
          phone,
          address,
          area: area || undefined,
          paymentMethod: method,
          txnId: method === "cod" ? undefined : txnId,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        },
      });
      clearCart(slug);
      navigate({ to: "/store/$slug/order/$orderId", params: { slug, orderId: res.orderId } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 sm:grid-cols-5">
      <div className="sm:col-span-3">
        <h1 className="text-xl font-semibold">Checkout</h1>
        <div className="mt-4 space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" required value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">Delivery area (optional)</Label>
            <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
        </div>

        <h2 className="mt-6 text-sm font-semibold">Payment method</h2>
        <div className="mt-2 grid gap-2">
          {(
            [
              { id: "cod", label: "Cash on Delivery", desc: "Pay when you receive" },
              ...(store.bkash_number
                ? [{ id: "bkash" as const, label: "bKash", desc: `Send to ${store.bkash_number}` }]
                : []),
              ...(store.nagad_number
                ? [{ id: "nagad" as const, label: "Nagad", desc: `Send to ${store.nagad_number}` }]
                : []),
            ] as { id: "cod" | "bkash" | "nagad"; label: string; desc: string }[]
          ).map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${method === m.id ? "border-primary bg-primary/5" : ""}`}
            >
              <input
                type="radio"
                name="method"
                value={m.id}
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium">{m.label}</div>
                <div className="text-xs text-muted-foreground">{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
        {method !== "cod" && (
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="txn">Transaction ID</Label>
            <Input id="txn" required value={txnId} onChange={(e) => setTxnId(e.target.value)} />
          </div>
        )}
      </div>

      <aside className="sm:col-span-2">
        <div className="sticky top-20 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Order summary</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="line-clamp-1">
                  {i.name} × {i.qty}
                </span>
                <span>৳{(i.qty * i.price).toFixed(0)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="text-sm">Total</span>
            <span className="text-lg font-bold">৳{total.toFixed(0)}</span>
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="mt-4 h-12 w-full"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            {submitting ? "Placing order…" : "Confirm Order"}
          </Button>
        </div>
      </aside>
    </form>
  );
}
