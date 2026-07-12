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
  const price = Number(p.price);
  const oldPrice = p.old_price != null ? Number(p.old_price) : null;
  const hasDiscount = oldPrice != null && oldPrice > price;
  const discountPct = hasDiscount ? Math.round(((oldPrice! - price) / oldPrice!) * 100) : 0;
  const outOfStock = p.stock <= 0;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock) return;
    addToCart(slug, {
      productId: p.id,
      name: p.name,
      price,
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
      price,
      image: p.primary_image_url,
      qty: 1,
    });
    navigate({ to: "/store/$slug/cart", params: { slug } });
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_-6px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_10px_24px_-8px_rgba(0,0,0,0.12)]">
      <Link
        to="/store/$slug/product/$productId"
        params={{ slug, productId: p.id }}
        className="relative block aspect-square overflow-hidden bg-neutral-100"
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
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
            No image
          </div>
        )}
        {hasDiscount && (
          <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            −{discountPct}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute right-2 top-2 rounded-full bg-neutral-900/85 px-2 py-0.5 text-[10px] font-bold text-white">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3">
        <Link
          to="/store/$slug/product/$productId"
          params={{ slug, productId: p.id }}
          className="line-clamp-2 text-[13px] font-semibold leading-snug text-neutral-900 sm:text-sm"
        >
          {p.name}
        </Link>

        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold text-neutral-900 sm:text-base">
            ৳{price.toFixed(0)}
          </span>
          {hasDiscount && (
            <span className="text-[11px] text-neutral-400 line-through">
              ৳{oldPrice!.toFixed(0)}
            </span>
          )}
        </div>

        {!outOfStock && p.stock <= 5 && (
          <span className="text-[10px] font-medium text-amber-600">Only {p.stock} left</span>
        )}

        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className="h-8 rounded-lg border border-neutral-200 bg-white text-[11px] font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to Cart
          </button>
          <button
            type="button"
            onClick={handleBuy}
            disabled={outOfStock}
            className="h-9 rounded-lg text-[13px] font-semibold text-white shadow-sm transition-opacity active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--store-btn-bg, #0f172a)" }}
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
