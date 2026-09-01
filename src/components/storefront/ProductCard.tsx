import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, ShoppingCart } from "lucide-react";
import { addToCart } from "@/lib/cart";
import { isInWishlist, toggleWishlist } from "@/lib/wishlist";
import { isStockless } from "@/lib/product-stock";
import { useStoreT } from "@/lib/store-i18n";
import { useReveal } from "@/hooks/use-reveal";

type Product = {
  id: string;
  name: string;
  price: number | string;
  old_price: number | string | null;
  stock: number;
  primary_image_url: string | null;
  product_type?: string | null;
};

export function ProductCard({ slug, p, index = 0 }: { slug: string; p: Product; index?: number }) {
  const navigate = useNavigate();
  const { t } = useStoreT();
  const { ref: revealRef, visible } = useReveal<HTMLDivElement>(0.08);
  const [wished, setWished] = useState(false);
  const [pulse, setPulse] = useState(0);
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
    setPulse((v) => v + 1);
  }

  return (
    <div
      ref={revealRef}
      style={{ "--sf-i": index % 10 } as React.CSSProperties}
      className={`theme-card sf-lift group flex h-full flex-col overflow-hidden rounded-xl border border-sf-line bg-sf-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] hover:border-sf-accent/40 sm:rounded-2xl ${
        visible ? "sf-reveal-in" : "sf-reveal"
      }`}
    >
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
            className="theme-card-img h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-sf-muted">
            {t("home.noImage")}
          </div>
        )}
        {hasDiscount && (
          <span className="theme-badge absolute left-2 top-2 sf-animate-pop rounded-md bg-sf-highlight px-1.5 py-0.5 text-[10px] font-bold text-sf-on-highlight shadow-sm">
            −{discountPct}%
          </span>
        )}
        {outOfStock && (
          <span className="theme-badge absolute right-2 top-2 sf-animate-fade-in rounded-md bg-sf-error px-1.5 py-0.5 text-[10px] font-bold text-white">
            {t("home.soldOut")}
          </span>
        )}
        <button
          type="button"
          onClick={handleWish}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wished}
          className={`absolute ${outOfStock ? "right-2 top-9" : "right-2 top-2"} sf-press grid h-7 w-7 place-items-center rounded-full bg-sf-card/90 shadow-sm backdrop-blur hover:scale-110 hover:bg-sf-card sm:h-8 sm:w-8`}
        >
          <Heart
            key={pulse}
            className={`h-3.5 w-3.5 transition-colors sm:h-4 sm:w-4 ${pulse ? "sf-animate-pop" : ""} ${wished ? "fill-sf-accent text-sf-accent" : "text-sf-muted"}`}
          />
        </button>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-2 sm:gap-1.5 sm:p-3">
        <Link
          to="/store/$slug/product/$productId"
          params={{ slug, productId: p.id }}
          className="line-clamp-2 min-h-[2.2em] text-xs font-semibold leading-snug text-sf-text transition-colors duration-200 group-hover:text-sf-accent sm:min-h-[2.4em] sm:text-sm"
        >
          {p.name}
        </Link>

        <div className="flex flex-wrap items-baseline gap-x-1">
          {hasDiscount && (
            <span className="text-[10px] text-sf-muted line-through sm:text-[11px]">৳{oldPrice!.toFixed(0)}</span>
          )}
          <span className="text-sm font-extrabold text-sf-accent sm:text-base">
            ৳{price.toFixed(0)}
          </span>
        </div>

        {!outOfStock && !stockless && p.stock <= 5 && (
          <span className="text-[10px] font-medium text-sf-accent">
            {t("pdp.onlyLeft", { count: p.stock })}
          </span>
        )}

        <div className="mt-auto grid grid-cols-[1fr_auto] gap-1 pt-1.5 sm:gap-1.5 sm:pt-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            className="theme-btn sf-press group/add flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg bg-sf-accent px-1.5 text-[11px] font-bold text-sf-on-accent hover:bg-sf-accent-hover hover:shadow-[0_8px_18px_-10px_var(--sf-accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:gap-1.5 sm:px-2 sm:text-[12px]"
          >
            <ShoppingCart className="h-3 w-3 shrink-0 transition-transform duration-200 group-hover/add:-translate-y-0.5 group-hover/add:scale-110 sm:h-3.5 sm:w-3.5" />
            <span className="hidden truncate sm:inline">{t("pdp.addToCart")}</span>
            <span className="truncate sm:hidden">{t("pdp.add")}</span>
          </button>
          <button
            type="button"
            onClick={handleBuy}
            disabled={outOfStock}
            className="sf-press h-8 shrink-0 whitespace-nowrap rounded-lg border border-sf-ink/15 bg-sf-card px-2 text-[11px] font-semibold text-sf-ink hover:border-sf-accent hover:bg-sf-accent-soft hover:text-sf-accent disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:px-2.5 sm:text-[12px]"
          >
            {t("pdp.buyNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
