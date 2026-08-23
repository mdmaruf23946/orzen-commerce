import { createFileRoute, Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Users, Image as ImageIcon,
  Settings, CreditCard, LogOut, Menu, Megaphone, Truck, Palette,
  Search as SearchIcon, PackageOpen, Wallet, Bell, ClipboardList, Bot,
  MessageSquare, MessageCircle, Boxes, Ticket, RotateCcw, BarChart3, FileUp, Globe,
  Radar, ShieldCheck, FileText, PhoneCall, Sparkles, AlertTriangle, UserCog,
  ChevronDown, ChevronsLeft, ChevronsRight, Moon, Sun, ExternalLink, LayoutTemplate, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { amIOwner } from "@/lib/owner.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubscriptionStatusBanner } from "@/components/admin/SubscriptionStatusBanner";
import { StickyMobileAdBar } from "@/components/admin/StickyMobileAdBar";
import { UpgradeProvider } from "@/components/admin/UpgradeModal";
import { ProductTypeScopeProvider } from "@/lib/product-type-scope";
import { StoreBrandMark } from "@/components/admin/StoreBrandMark";
import { CountBadge } from "@/components/admin/CountBadge";
import { useBadgeCounts, useMarkSeen } from "@/lib/use-badge-counts";
import { getMyStore } from "@/lib/admin.functions";
import { resolveStoreIcon } from "@/lib/store-icon";
import { recoverFromChunkError } from "@/lib/chunk-recovery";


type BadgeKey =
  | "orders" | "returns" | "customers" | "messenger" | "handoff"
  | "low_stock" | "notifications" | "payments" | "payment_gateway"
  | "delivery" | "landing_pages" | "duplicate_protection" | "ai_recommendations";

type LinkDef = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badgeKey?: BadgeKey;
  children?: { to: string; label: string }[];
};

const links: LinkDef[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/inbox", label: "Notifications Inbox", icon: Bell, badgeKey: "notifications" },

  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, badgeKey: "orders" },
  { to: "/admin/courier-orders", label: "Courier Orders", icon: Truck, badgeKey: "delivery" },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/customers", label: "Customers", icon: Users, badgeKey: "customers" },
  { to: "/admin/customers-accounts", label: "Customer Accounts", icon: Users, badgeKey: "customers" },
  { to: "/admin/duplicate-protection", label: "Duplicate Protection", icon: ShieldCheck, badgeKey: "duplicate_protection" },
  { to: "/admin/call-center", label: "Manual Call Center", icon: PhoneCall },
  { to: "/admin/ai-call-center", label: "AI Call Center", icon: PhoneCall },
  { to: "/admin/returns", label: "Returns", icon: RotateCcw, badgeKey: "returns" },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/finance", label: "Finance", icon: Wallet },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/banners", label: "Banners", icon: ImageIcon },
  { to: "/admin/theme", label: "Theme", icon: Palette },
  { to: "/admin/seo", label: "SEO", icon: SearchIcon },
  { to: "/admin/legal", label: "Legal & Info Pages", icon: FileText },
  { to: "/admin/delivery", label: "Delivery", icon: PackageOpen, badgeKey: "delivery" },
  { to: "/admin/couriers", label: "Couriers", icon: Truck, badgeKey: "delivery" },
  { to: "/admin/payment-gateway", label: "Payment Gateway", icon: CreditCard, badgeKey: "payment_gateway" },
  
  { to: "/admin/ai-agent", label: "AI Sales Agent", icon: Bot },
  { to: "/admin/ai-recommendations", label: "AI Recommendations", icon: Sparkles, badgeKey: "ai_recommendations" },
  { to: "/admin/handoff-queue", label: "Handoff Queue", icon: UserCog, badgeKey: "handoff" },
  { to: "/admin/low-stock", label: "Low Stock Alerts", icon: AlertTriangle, badgeKey: "low_stock" },
  { to: "/admin/messenger", label: "Messenger", icon: MessageSquare, badgeKey: "messenger" },
  { to: "/admin/messenger-inbox", label: "Messenger Inbox", icon: MessageSquare, badgeKey: "messenger" },
  { to: "/admin/whatsapp", label: "WhatsApp Integration", icon: MessageCircle },
  { to: "/admin/whatsapp-inbox", label: "WhatsApp Inbox", icon: MessageCircle },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
  { to: "/admin/product-defaults", label: "Product Defaults", icon: ClipboardList },
  { to: "/admin/domains", label: "Domains", icon: Globe },
  { to: "/admin/dns-check", label: "DNS Checker", icon: Radar },
  { to: "/admin/landing-builder", label: "Landing Pages", icon: LayoutTemplate },
  { to: "/admin/landing-pages", label: "Landing Page Integrations", icon: ExternalLink, badgeKey: "landing_pages" },

  { to: "/admin/import-export", label: "Import / Export", icon: FileUp },
  { to: "/admin/invoice-templates", label: "Invoice Templates", icon: FileText },
  { to: "/admin/subscription", label: "My Subscription", icon: CreditCard },
  { to: "/admin/billing", label: "Billing & Plans", icon: Wallet },
  {
    to: "/admin/settings",
    label: "Store Settings",
    icon: Settings,
    children: [
      { to: "/admin/settings/information", label: "Store Information" },
      { to: "/admin/settings/configuration", label: "Store Configuration" },
      { to: "/admin/settings/workflow", label: "Order & Workflow" },
      
    ],
  },
];


const groupDefs: { label: string; paths: string[] }[] = [
  { label: "Main", paths: ["/admin"] },
  { label: "Orders", paths: ["/admin/orders", "/admin/courier-orders", "/admin/returns"] },
  { label: "Products", paths: ["/admin/products", "/admin/categories", "/admin/inventory", "/admin/product-defaults"] },
  { label: "Customers", paths: ["/admin/customers", "/admin/customers-accounts", "/admin/duplicate-protection"] },
  { label: "Call Center", paths: ["/admin/call-center", "/admin/ai-call-center"] },
  { label: "AI & Automation", paths: ["/admin/ai-agent", "/admin/ai-recommendations", "/admin/handoff-queue", "/admin/low-stock", "/admin/messenger", "/admin/messenger-inbox", "/admin/whatsapp", "/admin/whatsapp-inbox"] },
  { label: "Marketing", paths: ["/admin/marketing", "/admin/coupons", "/admin/seo", "/admin/banners", "/admin/notifications"] },
  { label: "Finance", paths: ["/admin/payment-gateway", "/admin/finance", "/admin/analytics"] },
  { label: "Operations", paths: ["/admin/delivery", "/admin/couriers", "/admin/landing-builder", "/admin/landing-pages"] },
  { label: "System", paths: ["/admin/theme", "/admin/legal", "/admin/invoice-templates", "/admin/domains", "/admin/dns-check", "/admin/import-export"] },
  { label: "Account", paths: ["/admin/subscription", "/admin/billing", "/admin/settings"] },
];

function buildGroups(query: string) {
  const q = query.trim().toLowerCase();
  const used = new Set<string>();
  const visible = links;
  const byPath = new Map(visible.map((l) => [l.to, l]));
  const groups = groupDefs.map((g) => {
    const items: LinkDef[] = [];
    for (const p of g.paths) {
      const l = byPath.get(p);
      if (l) { items.push(l); used.add(p); }
    }
    return { label: g.label, items };
  });
  const leftover = visible.filter((l) => !used.has(l.to));
  if (leftover.length) groups.push({ label: "More", items: leftover });
  if (!q) return groups.filter((g) => g.items.length > 0);
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
    .filter((g) => g.items.length > 0);
}

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
  errorComponent: AdminErrorComponent,
});

/** Keeps a transient failure (stale chunk, network blip, server hiccup)
 *  contained inside the admin panel with a retry, instead of blanking the app. */
function AdminErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const [recovering] = useState(() => recoverFromChunkError(error));

  if (recovering) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-sm text-muted-foreground">
        Updating to the latest version…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">এই পেজটি লোড হয়নি</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              // Re-run the failed loaders too, not just the boundary UI.
              router.invalidate();
              reset();
            }}
          >
            আবার চেষ্টা করুন
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            রিফ্রেশ
          </Button>
        </div>
      </div>
    </div>
  );
}


function AdminLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [subMenus, setSubMenus] = useState<Record<string, boolean>>({});
  const ownerCheck = useServerFn(amIOwner);
  const { data: ownerData } = useQuery({
    queryKey: ["amIOwner"],
    queryFn: () => ownerCheck(),
    retry: 2,
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const fetchStore = useServerFn(getMyStore);
  const { data: myStore } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore() });
  const storeIcon = resolveStoreIcon(myStore as any);
  const storeName = (myStore as any)?.name ?? "";
  const { counts, storeId } = useBadgeCounts();
  const markSeen = useMarkSeen();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!storeId) return;
    const link = links.find((l) => l.to === currentPath && l.badgeKey);
    if (link?.badgeKey) {
      markSeen.mutate({ store_id: storeId, feature: link.badgeKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, currentPath]);


  useEffect(() => {
    setCollapsed(localStorage.getItem("admin.sidebar.collapsed") === "1");
    const d = localStorage.getItem("admin.theme.dark") === "1";
    setDark(d);
    if (d) document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => setOpen(false), [currentPath]);

  function toggleCollapsed() {
    const v = !collapsed;
    setCollapsed(v);
    localStorage.setItem("admin.sidebar.collapsed", v ? "1" : "0");
  }
  function toggleDark() {
    const v = !dark;
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("admin.theme.dark", v ? "1" : "0");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const groups = useMemo(() => buildGroups(search), [search]);

  const asideWidth = collapsed ? "md:w-[72px]" : "md:w-64";

  return (
    <UpgradeProvider>
    <ProductTypeScopeProvider>
    <div className="min-h-screen bg-muted/40">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <button className="flex min-w-0 items-center gap-2 font-semibold" onClick={() => setOpen((v) => !v)}>
          <Menu className="h-5 w-5 shrink-0" />
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <StoreBrandMark compact />
            <span className="text-[11px] font-normal text-muted-foreground">Store Admin</span>
          </span>
        </button>
        <button
          onClick={toggleDark}
          className="grid h-9 w-9 place-items-center rounded-full border"
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-screen w-72 transform flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 md:sticky md:top-0 md:translate-x-0",
            asideWidth,
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          {/* Brand */}
          <div className={cn("flex h-20 shrink-0 items-center gap-3 border-b px-4", collapsed && "md:justify-center md:px-2")}>
            {(!collapsed || open) ? (
              <div className="flex min-w-0 flex-col leading-tight">
                <StoreBrandMark />
                <span className="mt-1 truncate text-[12px] text-muted-foreground">Store Admin</span>
              </div>
            ) : (
              <StoreBrandMark iconOnly />
            )}
            <button
              className="ml-auto hidden md:inline-flex items-center rounded-md p-1 text-muted-foreground hover:bg-muted"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
            <button className="ml-auto md:hidden" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Store identity (per-store icon + name) */}
          {(!collapsed || open) && storeName && (
            <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
              {storeIcon ? (
                <img
                  src={storeIcon}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-md border object-cover"
                />
              ) : (
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-xs font-bold text-white"
                  style={{ backgroundColor: (myStore as any)?.primary_color || "hsl(var(--primary))" }}
                >
                  {storeName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold">{storeName}</div>
                <div className="text-[11px] text-muted-foreground">Store</div>
              </div>
            </div>
          )}


          {/* Search */}
          {(!collapsed || open) && (
            <div className="border-b p-3">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu…"
                  className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2 pb-[100px] md:pb-4">
            {groups.map((g) => {
              const collapsedGroup = openGroups[g.label] === false;
              return (
                <div key={g.label}>
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => setOpenGroups((s) => ({ ...s, [g.label]: !(s[g.label] !== false) }))}
                      className="flex w-full items-center justify-between px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      <span>{g.label}</span>
                      <ChevronDown className={cn("h-3 w-3 transition-transform", collapsedGroup && "-rotate-90")} />
                    </button>
                  )}
                  {(!collapsedGroup || collapsed) && (
                    <div className="space-y-0.5">
                      {g.items.map((l) => {
                        const badgeVal = l.badgeKey ? (counts as any)[l.badgeKey] ?? 0 : 0;
                        const hasChildren = !!l.children?.length && (!collapsed || open);
                        const subOpen = subMenus[l.to] ?? currentPath.startsWith(l.to);
                        return (
                        <div key={l.to}>
                        <div className="flex items-center">
                        <Link
                          to={hasChildren ? l.children![0].to : l.to}
                          onClick={() => { if (!hasChildren) setOpen(false); }}
                          activeOptions={l.exact ? { exact: true } : undefined}
                          activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
                          title={collapsed ? `${l.label}${badgeVal ? ` (${badgeVal})` : ""}` : undefined}
                          className={cn(
                            "group relative flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                            collapsed && "md:justify-center md:px-2",
                          )}
                        >
                          <span className="relative shrink-0">
                            <l.icon className="h-4 w-4" />
                            {collapsed && badgeVal > 0 && (
                              <CountBadge count={badgeVal} variant="dot" label={l.label} />
                            )}
                          </span>
                          {(!collapsed || open) && <span className="truncate">{l.label}</span>}
                          {(!collapsed || open) && badgeVal > 0 && (
                            <CountBadge count={badgeVal} label={l.label} />
                          )}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            aria-label={`Toggle ${l.label} menu`}
                            onClick={() => setSubMenus((s) => ({ ...s, [l.to]: !subOpen }))}
                            className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !subOpen && "-rotate-90")} />
                          </button>
                        )}
                        </div>
                        {hasChildren && subOpen && (
                          <div className="mt-0.5 space-y-0.5 border-l pl-3 ml-5">
                            {l.children!.map((c) => (
                              <Link
                                key={c.to}
                                to={c.to}
                                onClick={() => setOpen(false)}
                                activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
                                className="block rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              >
                                {c.label}
                              </Link>
                            ))}
                          </div>
                        )}
                        </div>
                        );
                      })}

                    </div>
                  )}
                </div>
              );
            })}

            {ownerData?.isOwner && (
              <Link
                to="/owner"
                onClick={() => setOpen(false)}
                title={collapsed ? "Owner Panel" : undefined}
                className={cn(
                  "mt-1 flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10",
                  collapsed && !open && "md:justify-center md:px-2",
                )}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                {(!collapsed || open) && <span>Owner Panel</span>}
              </Link>
            )}

            <button
              onClick={signOut}
              title={collapsed ? "Logout" : undefined}
              className={cn(
                "mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10",
                collapsed && "md:justify-center md:px-2",
              )}
            >
              <LogOut className="h-4 w-4" />
              {(!collapsed || open) && <span>Logout</span>}
            </button>
          </nav>
        </aside>

        {open && (
          <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop sticky header */}
          <header className="sticky top-0 z-20 hidden h-16 items-center gap-3 border-b bg-background/95 px-6 backdrop-blur md:flex">
            <div className="relative w-full max-w-md">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search anything…"
                className="w-full rounded-full border bg-muted/40 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/admin/messenger-inbox"
                className="relative grid h-9 w-9 place-items-center rounded-full border hover:bg-muted"
                aria-label="Messenger inbox"
              >
                <MessageSquare className="h-4 w-4" />
                {counts.messenger > 0 && (
                  <span className="absolute -right-1 -top-1">
                    <CountBadge count={counts.messenger} label="messenger" />
                  </span>
                )}
              </Link>
              <Link
                to="/admin/inbox"
                className="relative grid h-9 w-9 place-items-center rounded-full border hover:bg-muted"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {counts.notifications > 0 && (
                  <span className="absolute -right-1 -top-1">
                    <CountBadge count={counts.notifications} label="notifications" />
                  </span>
                )}
              </Link>

              <button
                onClick={toggleDark}
                className="grid h-9 w-9 place-items-center rounded-full border hover:bg-muted"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Button
                variant="default"
                size="sm"
                className="rounded-full"
                onClick={() => navigate({ to: "/admin/settings" })}
              >
                <Settings className="mr-1.5 h-4 w-4" />
                Store
              </Button>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-[70px] md:p-6 md:pb-8 lg:p-8">
            <SubscriptionStatusBanner />
            <Outlet />
          </main>
        </div>
      </div>
      <StickyMobileAdBar />
    </div>
    </ProductTypeScopeProvider>
    </UpgradeProvider>
  );
}
