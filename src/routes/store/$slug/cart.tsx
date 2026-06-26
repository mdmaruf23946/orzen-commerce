import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { readCart, updateQty, removeItem, cartTotal, type CartItem } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/store/$slug/cart")({
  head: () => ({ meta: [{ title: "Cart" }] }),
  component: CartPage,
});

function CartPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const update = () => setItems(readCart(slug));
    update();
    window.addEventListener("cart-changed", update);
    return () => window.removeEventListener("cart-changed", update);
  }, [slug]);

  const total = cartTotal(slug);

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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Your cart</h1>
      <ul className="divide-y rounded-xl border bg-card">
        {items.map((i) => (
          <li key={i.productId} className="flex gap-3 p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {i.image && <img src={i.image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-medium">{i.name}</p>
                <button
                  onClick={() => removeItem(slug, i.productId)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <div className="inline-flex items-center rounded-full border">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center"
                    onClick={() => updateQty(slug, i.productId, i.qty - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm">{i.qty}</span>
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center"
                    onClick={() => updateQty(slug, i.productId, i.qty + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-sm font-semibold">৳{(i.qty * i.price).toFixed(0)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <span className="text-lg font-bold">৳{total.toFixed(0)}</span>
      </div>
      <Button
        className="h-12 w-full"
        style={{ backgroundColor: "var(--primary)", color: "white" }}
        onClick={() => navigate({ to: "/store/$slug/checkout", params: { slug } })}
      >
        Checkout
      </Button>
    </div>
  );
}
