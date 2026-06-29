import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingBag,
  Users,
  Image as ImageIcon,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  Megaphone,
  Truck,
  Palette,
  Search as SearchIcon,
  PackageOpen,
  Wallet,
  Bell,
  ClipboardList,
  Bot,
  MessageSquare,
  Boxes,
  Ticket,
  RotateCcw,
  BarChart3,
  FileUp,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { amIOwner } from "@/lib/owner.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubscriptionStatusBanner } from "@/components/admin/SubscriptionStatusBanner";

const links: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/import-export", label: "Import / Export", icon: FileUp },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/returns", label: "Returns", icon: RotateCcw },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/finance", label: "Finance", icon: Wallet },
  { to: "/admin/banners", label: "Banners", icon: ImageIcon },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/couriers", label: "Couriers", icon: Truck },
  { to: "/admin/theme", label: "Theme", icon: Palette },
  { to: "/admin/seo", label: "SEO", icon: SearchIcon },
  { to: "/admin/delivery", label: "Delivery", icon: PackageOpen },
  { to: "/admin/payments", label: "Payments", icon: Wallet },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/product-defaults", label: "Product Defaults", icon: ClipboardList },
  { to: "/admin/ai-agent", label: "AI Sales Agent", icon: Bot },
  { to: "/admin/messenger", label: "Messenger", icon: MessageSquare },
  { to: "/admin/settings", label: "Store Settings", icon: Settings },
  { to: "/admin/subscription", label: "Subscription", icon: CreditCard },
];


export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ownerCheck = useServerFn(amIOwner);
  const { data: ownerData } = useQuery({ queryKey: ["amIOwner"], queryFn: () => ownerCheck() });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  useEffect(() => setOpen(false), []);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <Link to="/admin" className="font-semibold">
          Store Admin
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-screen w-64 transform flex-col border-r bg-background transition-transform md:sticky md:top-0 md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-14 shrink-0 items-center border-b px-5 font-semibold">Store Admin</div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">

            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                activeOptions={l.exact ? { exact: true } : undefined}
                activeProps={{ className: "bg-primary text-primary-foreground" }}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            ))}
            {ownerData?.isOwner && (
              <Link
                to="/owner"
                className="mt-2 flex items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                Owner Panel
              </Link>
            )}
            <button
              onClick={signOut}
              className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </nav>
        </aside>
        {open && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />
        )}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
