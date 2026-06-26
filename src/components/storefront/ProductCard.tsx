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

function readPanelColor(): string {
  if (typeof window === "undefined") return "#0f172a";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--store-title-bar-bg")
    .trim();
  return v || "#0f172a";
}

function isLight(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length !== 3 && m.length !== 6) return false;
  const h = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Relative luminance (sRGB approx)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

export function ProductCard({ slug, p }: { slug: string; p: Product }) {
  const navigate = useNavigate();
  const outOfStock = p.stock <= 0;
  const light = typeof window !== "undefined" ? isLight(readPanelColor()) : false;
  const fg = light ? "#0f172a" : "#ffffff";
  const muted = light ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.7)";
  const outlineBorder = light ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.55)";

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
        className="flex flex-1 flex-col gap-2 p-2.5 sm:p-3"
        style={{ backgroundColor: "var(--store-title-bar-bg, #0f172a)", color: fg }}
      >
        <Link
          to="/store/$slug/product/$productId"
          params={{ slug, productId: p.id }}
          className="line-clamp-2 text-center text-xs font-semibold sm:text-sm"
          style={{ color: fg }}
        >
          {p.name}
        </Link>

        <div className="flex items-baseline justify-center gap-2">
          <span className="text-base font-bold" style={{ color: fg }}>
            ৳{Number(p.price).toFixed(0)}
          </span>
          {p.old_price && (
            <span className="text-xs line-through" style={{ color: muted }}>
              ৳{Number(p.old_price).toFixed(0)}
            </span>
          )}
        </div>

        {outOfStock ? (
          <span
            className="mt-auto text-center text-[11px] font-semibold"
            style={{ color: "#ef4444" }}
          >
            Out of stock
          </span>
        ) : (
          <div className="mt-auto flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleAdd}
              className="h-8 rounded-md border bg-transparent text-xs font-semibold active:opacity-80"
              style={{ borderColor: outlineBorder, color: fg }}
            >
              Add to Cart
            </button>
            <button
              type="button"
              onClick={handleBuy}
              className="h-9 w-full rounded-md text-sm font-semibold text-white active:opacity-80"
              style={{ backgroundColor: "var(--store-btn-bg, #0f172a)" }}
            >
              Buy Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
