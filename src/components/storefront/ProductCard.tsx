import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, ShoppingCart } from "lucide-react";
import { addToCart } from "@/lib/cart";
import { isInWishlist, toggleWishlist } from "@/lib/wishlist";
import { isStockless } from "@/lib/product-stock";
import { useStoreT } from "@/lib/store-i18n";

type Product = {
  id: string;
  name: string;
  price: number | string;
  old_price: number | string | null;
  stock: number;
  primary_image_url: string | null;
  product_type?: string | null;
};

export function ProductCard({ slug, p }: { slug: string; p: Product }) {
  const navigate = useNavigate();
  const { t } = useStoreT();
  const [wished, setWished] = useState(false);
  const price = Number(p.price);
  const oldPrice = p.old_price != null ? Number(p.old_price) : null;
  const hasDiscount = oldPrice != null && oldPrice > price;
  const discountPct = hasDiscount ? Math.round(((oldPrice! - price) / oldPrice!) * 100) : 0;
  const stockless = isStockless(p.product_type);
  const outOfStock = !stockless && p.stock <= 0;

  useEffect(() => {
    setWished(isInWishlist(slug, p.id));
    const sync = () => setWished(isInWishlist(slug, p.id));
    window.addEventListener("wishlist-changed", sync);
    return () => window.removeEventListener("wishlist-changed", sync);
  }, [slug, p.id]);

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

  function handleWish(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const now = toggleWishlist(slug, {
      productId: p.id,
      name: p.name,
      price,
      image: p.primary_image_url,
    });
    setWished(now);
  }

  return (
    <div className="theme-card group flex h-full flex-col overflow-hidden rounded-2xl border border-sf-line bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(17,17,17,0.3)]">
      <Link
        to="/store/$slug/product/$productId"
        params={{ slug, productId: p.id }}
        className="theme-card-media relative block aspect-square overflow-hidden bg-sf-surface"
      >
        {p.primary_image_url ? (
          <img
            src={p.primary_image_url}
            alt={p.name}
            loading="lazy"
            decoding="async"
            className="theme-card-img h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-sf-muted">
            {t("home.noImage")}
          </div>
        )}
        {hasDiscount && (
          <span className="theme-badge absolute left-2 top-2 rounded-md bg-sf-accent px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
            −{discountPct}%
          </span>
        )}
        {outOfStock && (
          <span className="theme-badge absolute right-2 top-2 rounded-md bg-sf-ink/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {t("home.soldOut")}
          </span>
        )}
        <button
          type="button"
          onClick={handleWish}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          className={`absolute ${outOfStock ? "right-2 top-9" : "right-2 top-2"} grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition-colors hover:bg-white`}
        >
          <Heart
            className={`h-4 w-4 transition-colors ${wished ? "fill-sf-accent text-sf-accent" : "text-sf-muted"}`}
          />
        </button>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5 sm:p-3">
        <Link
          to="/store/$slug/product/$productId"
          params={{ slug, productId: p.id }}
          className="line-clamp-2 min-h-[2.4em] text-[13px] font-semibold leading-snug text-sf-text sm:text-sm"
        >
          {p.name}
        </Link>

        <div className="flex flex-wrap items-baseline gap-x-1.5">
          {hasDiscount && (
            <span className="text-[11px] text-sf-muted line-through">৳{oldPrice!.toFixed(0)}</span>
          )}
          <span className="text-[15px] font-extrabold text-sf-accent sm:text-base">
            ৳{price.toFixed(0)}
          </span>
        </div>

        {!outOfStock && !stockless && p.stock <= 5 && (
          <span className="text-[10px] font-medium text-sf-accent">
            {t("pdp.onlyLeft", { count: p.stock })}
          </span>
        )}

        <div className="mt-auto grid grid-cols-[1fr_auto] gap-1.5 pt-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className="theme-btn flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-sf-accent px-2 text-[12px] font-bold text-white transition-colors hover:bg-sf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden truncate sm:inline">{t("pdp.addToCart")}</span>
            <span className="truncate sm:hidden">{t("pdp.add")}</span>
          </button>
          <button
            type="button"
            onClick={handleBuy}
            disabled={outOfStock}
            className="h-9 shrink-0 whitespace-nowrap rounded-lg border border-sf-ink/15 bg-white px-2.5 text-[12px] font-semibold text-sf-ink transition-colors hover:bg-sf-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("pdp.buyNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
