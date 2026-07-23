import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, LayoutGrid, ShoppingCart, Heart, User } from "lucide-react";
import { cartCount } from "@/lib/cart";
import { wishlistCount } from "@/lib/wishlist";

export function BottomNav({ slug }: { slug: string }) {
  const [visible, setVisible] = useState(true);
  const [cart, setCart] = useState(0);
  const [wish, setWish] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const updateCart = () => setCart(cartCount(slug));
    const updateWish = () => setWish(wishlistCount(slug));
    updateCart();
    updateWish();
    window.addEventListener("cart-changed", updateCart);
    window.addEventListener("wishlist-changed", updateWish);
    window.addEventListener("storage", updateCart);
    return () => {
      window.removeEventListener("cart-changed", updateCart);
      window.removeEventListener("wishlist-changed", updateWish);
      window.removeEventListener("storage", updateCart);
    };
  }, [slug]);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (Math.abs(delta) > 6) {
          setVisible(delta < 0 || y < 80);
          lastY = y;
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const base = `/store/${slug}`;
  const isActive = (p: string) =>
    p === base ? pathname === base || pathname === `${base}/` : pathname.startsWith(p);

  function scrollToAll(e: React.MouseEvent) {
    if (pathname === base || pathname === `${base}/`) {
      e.preventDefault();
      document.getElementById("all-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const items: Array<{
    to: "/store/$slug" | "/store/$slug/cart" | "/store/$slug/account";
    label: string;
    icon: typeof Home;
    active: boolean;
    onClick?: (e: React.MouseEvent) => void;
    badge?: number;
  }> = [
    { to: "/store/$slug", label: "Home", icon: Home, active: isActive(base) },
    { to: "/store/$slug", label: "Browse", icon: LayoutGrid, active: false, onClick: scrollToAll },
    { to: "/store/$slug/cart", label: "Cart", icon: ShoppingCart, active: isActive(`${base}/cart`), badge: cart },
    { to: "/store/$slug/account", label: "Wishlist", icon: Heart, active: false, badge: wish },
    { to: "/store/$slug/account", label: "Account", icon: User, active: isActive(`${base}/account`) },
  ];

  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 backdrop-blur transition-transform duration-300 md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((it, i) => (
          <li key={i} className="flex-1">
            <Link
              to={it.to}
              params={{ slug }}
              onClick={it.onClick}
              className="relative flex h-14 flex-col items-center justify-center gap-0.5"
            >
              <div className="relative">
                <it.icon
                  className={`h-5 w-5 transition-colors ${it.active ? "text-neutral-900" : "text-neutral-500"}`}
                  strokeWidth={it.active ? 2.5 : 2}
                />
                {it.badge !== undefined && it.badge > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
                  >
                    {it.badge > 99 ? "99+" : it.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${it.active ? "text-neutral-900" : "text-neutral-500"}`}
              >
                {it.label}
              </span>
              {it.active && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full"
                  style={{ backgroundColor: "var(--store-btn-bg, #0f172a)" }}
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
