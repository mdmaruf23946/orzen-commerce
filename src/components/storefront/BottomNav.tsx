import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, LayoutGrid, Heart, Truck, MessageCircle } from "lucide-react";
import { wishlistCount } from "@/lib/wishlist";
import { useStoreT } from "@/lib/store-i18n";

export function BottomNav({ slug, whatsapp }: { slug: string; whatsapp?: string | null }) {
  const { t } = useStoreT();
  const [wish, setWish] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  useEffect(() => {
    const updateWish = () => setWish(wishlistCount(slug));
    updateWish();
    window.addEventListener("wishlist-changed", updateWish);
    window.addEventListener("storage", updateWish);
    return () => {
      window.removeEventListener("wishlist-changed", updateWish);
      window.removeEventListener("storage", updateWish);
    };
  }, [slug]);

  const base = `/store/${slug}`;
  const isHome = pathname === base || pathname === `${base}/`;
  const waHref = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : null;

  function openCategories(e: React.MouseEvent) {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent("store-open-menu"));
  }

  const wishActive =
    pathname === `${base}/account` && /[?&]tab=wishlist(?:&|$)/.test(searchStr ?? "");
  const ordersActive =
    pathname === `${base}/account` && /[?&]tab=orders(?:&|$)/.test(searchStr ?? "");

  const itemCls = (active: boolean) =>
    `relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
      active ? "text-sf-accent" : "text-sf-muted"
    }`;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sf-line bg-white md:hidden"
      style={{
        transform: "translateZ(0)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}

    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
        {/* Categories */}
        <li>
          <a href="#categories" onClick={openCategories} className={itemCls(false)}>
            <LayoutGrid className="h-5 w-5 text-sf-accent" />
            <span>{t("nav.categories")}</span>
          </a>
        </li>

        {/* WhatsApp */}
        <li>
          {waHref ? (
            <a href={waHref} target="_blank" rel="noreferrer" className={itemCls(false)}>
              <MessageCircle className="h-5 w-5 text-sf-accent" />
              <span>{t("home.whatsapp")}</span>
            </a>
          ) : (
            <span className={`${itemCls(false)} opacity-40`}>
              <MessageCircle className="h-5 w-5 text-sf-accent" />
              <span>{t("home.whatsapp")}</span>
            </span>
          )}
        </li>

        {/* Home — center, emphasized */}
        <li className="flex justify-center">
          <Link
            to="/store/$slug"
            params={{ slug }}
            aria-label={t("nav.home")}
            className="-mt-6 flex flex-col items-center gap-1"
          >
            <span
              className={`grid h-14 w-14 place-items-center rounded-full border-4 border-white text-white shadow-[0_8px_20px_-6px_rgba(255,75,31,0.7)] transition-transform active:scale-95 ${
                isHome ? "bg-sf-accent" : "bg-sf-ink"
              }`}
            >
              <Home className="h-6 w-6" />
            </span>
            <span
              className={`pb-2 text-[10px] font-semibold ${isHome ? "text-sf-accent" : "text-sf-muted"}`}
            >
              {t("nav.home")}
            </span>
          </Link>
        </li>

        {/* Wishlist */}
        <li>
          <Link
            to="/store/$slug/account"
            params={{ slug }}
            search={{ tab: "wishlist" } as any}
            className={itemCls(wishActive)}
          >
            <span className="relative">
              <Heart className="h-5 w-5 text-sf-accent" />
              {wish > 0 && (
                <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-sf-accent px-1 text-[9px] font-bold text-white">
                  {wish > 99 ? "99+" : wish}
                </span>
              )}
            </span>
            <span>{t("nav.wishlist")}</span>
          </Link>
        </li>

        {/* Track order */}
        <li>
          <Link
            to="/store/$slug/account"
            params={{ slug }}
            search={{ tab: "orders" } as any}
            className={itemCls(ordersActive)}
          >
            <Truck className="h-5 w-5" />
            <span>{t("home.trackOrder")}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
