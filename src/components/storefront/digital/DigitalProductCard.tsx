import { Link, useNavigate } from "@tanstack/react-router";
import { Download, Zap, Star } from "lucide-react";
import { addToCart } from "@/lib/cart";

export type DigitalProduct = {
  id: string;
  name: string;
  price: number | string;
  old_price: number | string | null;
  primary_image_url: string | null;
  digital_category?: string | null;
  total_sold?: number | null;
  rating?: number | null;
  updated_at?: string | null;
  digital?: any;
};

/** Marketplace-style card: download-focused, no stock / shipping language. */
export function DigitalProductCard({
  slug,
  p,
  categoryLabel,
}: {
  slug: string;
  p: DigitalProduct;
  categoryLabel?: string | null;
}) {
  const navigate = useNavigate();
  const price = Number(p.price);
  const oldPrice = p.old_price != null ? Number(p.old_price) : null;
  const hasDiscount = oldPrice != null && oldPrice > price;
  const free = price <= 0;

  function add(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addToCart(slug, {
      productId: p.id,
      name: p.name,
      price,
      image: p.primary_image_url,
      qty: 1,
    });
  }
  function get(e: React.MouseEvent) {
    add(e);
    navigate({ to: "/store/$slug/checkout", params: { slug } });
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--dg-card,#12131a)] shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--dg-accent,#6366f1)]/40 hover:shadow-[0_12px_40px_-16px_rgba(99,102,241,0.6)]">
      <Link
        to="/store/$slug/product/$productId"
        params={{ slug, productId: p.id }}
        className="relative block aspect-[16/10] overflow-hidden bg-black/40"
      >
        {p.primary_image_url ? (
          <img
            src={p.primary_image_url}
            alt={p.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-white/30">Preview</div>
        )}
        <div className="absolute left-2 top-2 flex gap-1.5">
          {free ? (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
              FREE
            </span>
          ) : hasDiscount ? (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
              −{Math.round(((oldPrice! - price) / oldPrice!) * 100)}%
            </span>
          ) : null}
          {categoryLabel && (
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur">
              {categoryLabel}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          to="/store/$slug/product/$productId"
          params={{ slug, productId: p.id }}
          className="line-clamp-2 min-h-[2.4em] text-[13px] font-semibold leading-snug text-white/90 sm:text-sm"
        >
          {p.name}
        </Link>

        <div className="flex items-center gap-3 text-[10px] text-white/45">
          {p.rating ? (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {Number(p.rating).toFixed(1)}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" /> {p.total_sold ?? 0}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold text-white">
            {free ? "Free" : `৳${price.toFixed(0)}`}
          </span>
          {hasDiscount && (
            <span className="text-[11px] text-white/35 line-through">৳{oldPrice!.toFixed(0)}</span>
          )}
        </div>

        <div className="mt-auto flex gap-1.5 pt-1">
          <button
            type="button"
            onClick={add}
            className="h-9 flex-1 rounded-lg border border-white/15 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/5"
          >
            Add
          </button>
          <button
            type="button"
            onClick={get}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[color:var(--dg-accent,#6366f1)] text-[12px] font-semibold text-white transition-opacity active:opacity-90"
          >
            <Zap className="h-3.5 w-3.5" />
            {free ? "Get" : "Buy"}
          </button>
        </div>
      </div>
    </div>
  );
}
