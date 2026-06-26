import { Link, useNavigate } from "@tanstack/react-router";
import { addToCart } from "@/lib/cart";

type Product = {
  id: string;
  name: string;
  price: number | string;
  old_price: number | string | null;
  stock: number;
  primary_image_url: string | null;
};

export function ProductCard({ slug, p }: { slug: string; p: Product }) {
  const navigate = useNavigate();
  const outOfStock = p.stock <= 0;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    addToCart(slug, {
      productId: p.id,
      name: p.name,
      price: Number(p.price),
      image: p.primary_image_url,
      qty: 1,
    });
  }

  function handleBuy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    addToCart(slug, {
      productId: p.id,
      name: p.name,
      price: Number(p.price),
      image: p.primary_image_url,
      qty: 1,
    });
    navigate({ to: "/store/$slug/cart", params: { slug } });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <Link
        to="/store/$slug/product/$productId"
        params={{ slug, productId: p.id }}
        className="block aspect-square overflow-hidden bg-muted"
      >
        {p.primary_image_url ? (
          <img
            src={p.primary_image_url}
            alt={p.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </Link>

      <div
        className="px-2 py-1.5 text-center text-xs font-semibold text-white sm:text-sm"
        style={{ backgroundColor: "var(--store-title-bar-bg)" }}
      >
        <Link
          to="/store/$slug/product/$productId"
          params={{ slug, productId: p.id }}
          className="line-clamp-2"
        >
          {p.name}
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-base font-bold" style={{ color: "var(--primary)" }}>
            ৳{Number(p.price).toFixed(0)}
          </span>
          {p.old_price && (
            <span className="text-xs text-muted-foreground line-through">
              ৳{Number(p.old_price).toFixed(0)}
            </span>
          )}
        </div>
        {outOfStock ? (
          <span className="text-center text-[11px] font-semibold text-destructive">
            Out of stock
          </span>
        ) : (
          <div className="mt-auto flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleAdd}
              className="h-8 rounded-md border text-xs font-semibold active:opacity-80"
              style={{
                borderColor: "var(--store-btn-bg)",
                color: "var(--store-btn-bg)",
              }}
            >
              Add to Cart
            </button>
            <button
              type="button"
              onClick={handleBuy}
              className="h-9 w-full rounded-md text-sm font-semibold text-white active:opacity-80"
              style={{ backgroundColor: "var(--store-btn-bg)" }}
            >
              Buy Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
