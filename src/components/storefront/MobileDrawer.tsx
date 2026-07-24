import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home,
  Package,
  Heart,
  ShoppingCart,
  Phone,
  Shield,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
  LogIn,
  LayoutGrid,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useStoreUI } from "@/lib/store-ui";
import { useCustomerSession } from "@/lib/customer-session";

type Category = { id: string; name: string; parent_id: string | null };

export function MobileDrawer({
  open,
  onOpenChange,
  slug,
  storeName,
  logoUrl,
  categories,
  productCounts,
  totalProducts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  storeName: string;
  logoUrl: string | null;
  categories: Category[];
  productCounts: Map<string, number>;
  totalProducts: number;
}) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const { activeMainId, activeSubId, selectMain, selectSub } = useStoreUI();
  const { customer, signOut } = useCustomerSession(slug);

  const mains = categories.filter((c) => !c.parent_id);
  const subsByParent = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.parent_id) {
      if (!subsByParent.has(c.parent_id)) subsByParent.set(c.parent_id, []);
      subsByParent.get(c.parent_id)!.push(c);
    }
  }

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      document
        .getElementById("all-products")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function pickMain(id: string | null) {
    selectMain(id, id ? "header" : null);
    close();
  }
  function pickSub(mainId: string, subId: string) {
    if (activeMainId !== mainId) selectMain(mainId, "header");
    selectSub(subId);
    close();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[86%] max-w-sm p-0 [&>button]:hidden"
      >
        <div className="flex h-full flex-col">
          {/* Header card */}
          <div
            className="flex items-center gap-3 border-b p-4"
            style={{ backgroundColor: "var(--store-header-bg, #fafafa)" }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div
                className="grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: "var(--primary)" }}
              >
                {storeName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-neutral-900">{storeName}</div>
              {customer ? (
                <div className="truncate text-xs text-neutral-500">
                  Hi, {customer.full_name.split(" ")[0]}
                </div>
              ) : (
                <div className="text-xs text-neutral-500">Welcome</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close menu"
              className="grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            {/* Primary links */}
            <NavItem to="/store/$slug" params={{ slug }} icon={Home} label="Home" onClick={() => onOpenChange(false)} />

            {/* Categories accordion */}
            <div className="mt-1">
              <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Categories
              </div>
              <button
                type="button"
                onClick={() => pickMain(null)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-neutral-100 ${
                  activeMainId === null ? "font-semibold text-neutral-900" : "text-neutral-700"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LayoutGrid className="h-4 w-4 text-neutral-500" />
                  All products
                </span>
                <span className="text-[11px] font-medium text-neutral-400">{totalProducts}</span>
              </button>
              {mains.map((m) => {
                const subs = subsByParent.get(m.id) ?? [];
                const expanded = openCat === m.id;
                const isActive = activeMainId === m.id;
                return (
                  <div key={m.id} className="mt-0.5">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => pickMain(m.id)}
                        className={`flex flex-1 items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-neutral-100 ${
                          isActive ? "font-semibold text-neutral-900" : "text-neutral-700"
                        }`}
                      >
                        <span>{m.name}</span>
                        <span className="text-[11px] font-medium text-neutral-400">
                          {productCounts.get(m.id) ?? 0}
                        </span>
                      </button>
                      {subs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenCat(expanded ? null : m.id)}
                          aria-expanded={expanded}
                          aria-label={expanded ? "Collapse" : "Expand"}
                          className="ml-1 grid h-8 w-8 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100"
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                    {expanded && subs.length > 0 && (
                      <div className="ml-6 mt-1 space-y-0.5 border-l border-neutral-200 pl-2 animate-accordion-down">
                        {subs.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => pickSub(m.id, s.id)}
                            className={`block w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-neutral-100 ${
                              activeSubId === s.id
                                ? "font-semibold text-neutral-900"
                                : "text-neutral-600"
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Shop */}
            <div className="mt-3">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Shop
              </div>
              <NavItem to="/store/$slug/cart" params={{ slug }} icon={ShoppingCart} label="Cart" onClick={() => onOpenChange(false)} />
              <NavItem to="/store/$slug/account" params={{ slug }} search={{ tab: "orders" }} icon={Package} label="Orders" onClick={() => onOpenChange(false)} />
              <NavItem to="/store/$slug/account" params={{ slug }} search={{ tab: "wishlist" }} icon={Heart} label="Wishlist" onClick={() => onOpenChange(false)} />
            </div>

            {/* More */}
            <div className="mt-3">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Help
              </div>
              <NavExtLink href="/contact" icon={Phone} label="Contact" onClick={() => onOpenChange(false)} />
              <NavExtLink href="/privacy-policy" icon={Shield} label="Privacy policy" onClick={() => onOpenChange(false)} />
              <NavExtLink href="/terms" icon={Shield} label="Terms" onClick={() => onOpenChange(false)} />
              <NavExtLink href="/refund-policy" icon={Shield} label="Refund policy" onClick={() => onOpenChange(false)} />
            </div>
          </div>

          {/* Account footer */}
          <div className="border-t p-3">
            {customer ? (
              <div className="space-y-1">
                <NavItem
                  to="/store/$slug/account"
                  params={{ slug }}
                  icon={User}
                  label="My account"
                  onClick={() => onOpenChange(false)}
                />
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : (
              <Link
                to="/store/$slug/auth/login"
                params={{ slug }}
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: "var(--store-btn-bg, #0f172a)" }}
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NavItem({
  to,
  params,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  params?: any;
  icon: any;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to as any}
      params={params}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
    >
      <Icon className="h-4 w-4 text-neutral-500" />
      {label}
    </Link>
  );
}

function NavExtLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: any;
  label: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
    >
      <Icon className="h-4 w-4 text-neutral-500" />
      {label}
    </a>
  );
}
