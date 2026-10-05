import { CALL_SMS_PROVIDERS } from "@/lib/call-sms-providers";
import { createFileRoute, Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Users, Image as ImageIcon,
  Settings, CreditCard, LogOut, Menu, Megaphone, Truck,
  Search as SearchIcon, PackageOpen, Wallet, Bell, ClipboardList, Bot,
  MessageSquare, MessageCircle, Boxes, Ticket, RotateCcw, BarChart3, FileUp, Globe,
  Radar, ShieldCheck, FileText, PhoneCall, Sparkles, AlertTriangle, UserCog, Palette,
  ChevronDown, ChevronsLeft, ChevronsRight, Moon, Sun, ExternalLink, LayoutTemplate, X,
  Gauge, PackageCheck, Headphones, Store, SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { amIOwner } from "@/lib/owner.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubscriptionStatusBanner } from "@/components/admin/SubscriptionStatusBanner";
import { UpgradeProvider } from "@/components/admin/UpgradeModal";
import { ProductTypeScopeProvider } from "@/lib/product-type-scope";
import { StoreBrandMark } from "@/components/admin/StoreBrandMark";
import { CountBadge } from "@/components/admin/CountBadge";
import { useBadgeCounts, useMarkSeen } from "@/lib/use-badge-counts";
import { getMyStore } from "@/lib/admin.functions";
import { resolveStoreIcon } from "@/lib/store-icon";
import { recoverFromChunkError } from "@/lib/chunk-recovery";
import { StoreAccessProvider, useStoreAccess } from "@/lib/use-store-access";
import { ReadOnlyGuard } from "@/components/admin/ReadOnlyGuard";
import { PlanLockGate } from "@/components/admin/PlanLockGate";
import { EmailVerifyBanner, EmailVerifyGate } from "@/components/admin/EmailVerifyGate";
import { sectionForPath } from "@/lib/panel-sections";


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
  children?: ChildLinkDef[];
};

type ChildLinkDef = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  badgeKey?: BadgeKey;
};

type NavGroupDef = {
  label: string;
  icon: typeof LayoutDashboard;
  items: LinkDef[];
};

type VisibleLinkDef = Omit<LinkDef, "children"> & { children?: ChildLinkDef[] };

const menuGroups: NavGroupDef[] = [
  {
    label: "Core",
    icon: Gauge,
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/admin/inbox", label: "Notifications Inbox", icon: Bell, badgeKey: "notifications" },
    ],
  },
  {
    label: "Orders & Delivery",
    icon: PackageCheck,
    items: [
      { to: "/admin/orders", label: "All Orders", icon: ShoppingBag, badgeKey: "orders" },
      {
        to: "/admin/courier-orders",
        label: "Courier & Shipping",
        icon: Truck,
        badgeKey: "delivery",
        children: [
          { to: "/admin/courier-orders", label: "Courier Orders", icon: ClipboardList, badgeKey: "delivery" },
          { to: "/admin/parcels", label: "Courier Parcels", icon: PackageOpen, badgeKey: "delivery" },
          { to: "/admin/couriers", label: "Courier Setup", icon: Truck, badgeKey: "delivery" },
          { to: "/admin/delivery", label: "Delivery Zones", icon: Radar, badgeKey: "delivery" },
        ],
      },
      { to: "/admin/returns", label: "Returns & Exchanges", icon: RotateCcw, badgeKey: "returns" },
    ],
  },
  {
    label: "Products & Inventory",
    icon: Boxes,
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/categories", label: "Categories", icon: Tags },
      {
        to: "/admin/inventory",
        label: "Inventory & Stock",
        icon: Boxes,
        badgeKey: "low_stock",
        children: [
          { to: "/admin/inventory", label: "Inventory", icon: Boxes },
          { to: "/admin/low-stock", label: "Low Stock Alerts", icon: AlertTriangle, badgeKey: "low_stock" },
        ],
      },
      {
        to: "/admin/product-defaults",
        label: "Catalogue Tools",
        icon: ClipboardList,
        children: [
          { to: "/admin/product-defaults", label: "Product Defaults", icon: ClipboardList },
          { to: "/admin/import-export", label: "Import / Export", icon: FileUp },
        ],
      },
    ],
  },
  {
    label: "Customers & Support",
    icon: Headphones,
    items: [
      {
        to: "/admin/customers",
        label: "Customer Directory",
        icon: Users,
        badgeKey: "customers",
        children: [
          { to: "/admin/customers", label: "Customers", icon: Users, badgeKey: "customers" },
          { to: "/admin/customers-accounts", label: "Customer Accounts", icon: UserCog, badgeKey: "customers" },
        ],
      },
      {
        to: CALL_SMS_PROVIDERS[0]?.path ?? "/admin/call-sms/ai-voice-agent",
        label: "Call & SMS Apps",
        icon: PhoneCall,
        children: [
          ...CALL_SMS_PROVIDERS.map((p) => ({ to: p.path, label: p.name, icon: p.kind === "sms" ? MessageSquare : PhoneCall })),
          { to: "/admin/call-sms/ai-voice-agent", label: "AI Voice Agent", icon: Bot },
        ],
      },
      { to: "/admin/duplicate-protection", label: "Duplicate Protection", icon: ShieldCheck, badgeKey: "duplicate_protection" },
    ],
  },
  {
    label: "Channels & AI",
    icon: Bot,
    items: [
      {
        to: "/admin/messenger-inbox",
        label: "Omnichannel Inbox",
        icon: MessageSquare,
        badgeKey: "messenger",
        children: [
          { to: "/admin/messenger-inbox", label: "Messenger Inbox", icon: MessageSquare, badgeKey: "messenger" },
          { to: "/admin/whatsapp-inbox", label: "WhatsApp Inbox", icon: MessageCircle },
          { to: "/admin/handoff-queue", label: "Handoff Queue", icon: Headphones, badgeKey: "handoff" },
        ],
      },
      {
        to: "/admin/messenger",
        label: "Channel Setup",
        icon: MessageCircle,
        children: [
          { to: "/admin/messenger", label: "Messenger AI Integration", icon: MessageSquare },
          { to: "/admin/whatsapp", label: "WhatsApp AI Integration", icon: MessageCircle },
        ],
      },
      {
        to: "/admin/ai",
        label: "AI Command Center",
        icon: Bot,
        children: [
          { to: "/admin/ai/agents", label: "Agents", icon: Bot },
          { to: "/admin/ai/approvals", label: "Approvals", icon: ShieldCheck },
          { to: "/admin/ai/identity", label: "Merchant Identity", icon: UserCog },
          { to: "/admin/ai/settings", label: "AI Settings", icon: Settings },
          { to: "/admin/ai/logs", label: "Activity Log", icon: ClipboardList },
        ],
      },
      { to: "/admin/ai-agent", label: "AI Sales Agent", icon: Bot },
      { to: "/admin/ai-recommendations", label: "AI Recommendations", icon: Sparkles, badgeKey: "ai_recommendations" },
    ],
  },
  {
    label: "Marketing & Sales",
    icon: Megaphone,
    items: [
      { to: "/admin/marketing", label: "Marketing & Tracking", icon: Megaphone },
      { to: "/admin/coupons", label: "Coupons & Discounts", icon: Ticket },
      {
        to: "/admin/landing-builder",
        label: "Landing Pages",
        icon: LayoutTemplate,
        badgeKey: "landing_pages",
        children: [
          { to: "/admin/landing-builder", label: "Landing Page Builder", icon: LayoutTemplate },
          { to: "/admin/landing-pages", label: "Landing Page Integrations", icon: Globe, badgeKey: "landing_pages" },
        ],
      },
      {
        to: "/admin/facebook",
        label: "Facebook Page",
        icon: Globe,
        children: [
          { to: "/admin/facebook", label: "Page Overview", icon: Globe },
          { to: "/admin/facebook/posts", label: "Posts", icon: FileText },
          { to: "/admin/facebook/comments", label: "Comments", icon: MessageSquare },
          { to: "/admin/facebook/compose", label: "Create Post", icon: Megaphone },
          { to: "/admin/facebook/moderation", label: "Moderation", icon: ShieldCheck },
          { to: "/admin/facebook/settings", label: "Page Settings", icon: Settings },
        ],
      },
      { to: "/admin/seo", label: "SEO Tools", icon: SearchIcon },
    ],
  },
  {
    label: "Finance & Analytics",
    icon: BarChart3,
    items: [
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/finance", label: "Business Finance", icon: Wallet },
      { to: "/admin/payment-gateway", label: "Payment Gateways", icon: CreditCard, badgeKey: "payment_gateway" },
    ],
  },
  {
    label: "Online Storefront",
    icon: Store,
    items: [
      { to: "/admin/theme", label: "Theme & Styling", icon: Palette },
      { to: "/admin/banners", label: "Banners & Sliders", icon: ImageIcon },
      { to: "/admin/pages", label: "Pages & Legal Content", icon: FileText },
      { to: "/admin/invoice-templates", label: "Invoice Templates", icon: FileText },
    ],
  },
  {
    label: "Settings & Management",
    icon: SlidersHorizontal,
    items: [
      {
        to: "/admin/settings",
        label: "Store Settings",
        icon: Settings,
        children: [
          { to: "/admin/settings/information", label: "Store Information", icon: Store },
          { to: "/admin/settings/configuration", label: "Store Configuration", icon: SlidersHorizontal },
          { to: "/admin/settings/workflow", label: "Order & Workflow", icon: ClipboardList },
          { to: "/admin/settings/security", label: "Account Security", icon: ShieldCheck },
        ],
      },
      {
        to: "/admin/domains",
        label: "Domains & DNS",
        icon: Globe,
        children: [
          { to: "/admin/domains", label: "Domains", icon: Globe },
          { to: "/admin/dns-check", label: "DNS Checker", icon: Radar },
        ],
      },
      { to: "/admin/employees", label: "Employees & Team", icon: UserCog },
      { to: "/admin/activity", label: "Activity Log", icon: ClipboardList },
      { to: "/admin/notifications", label: "Customer Notification Setup", icon: Bell, badgeKey: "notifications" },
      { to: "/admin/subscription", label: "My Subscription", icon: CreditCard },
      { to: "/admin/billing", label: "Billing & Plans", icon: Wallet },
      { to: "/admin/support", label: "Help Center", icon: MessageSquare },
    ],
  },
];

const allMenuItems = menuGroups.flatMap((g) =>
  g.items.flatMap((i) => [i, ...(i.children ?? []).map((c) => ({ ...c, icon: i.icon }))]),
);

function matchesPath(pathname: string, item: { to: string; exact?: boolean }) {
  return item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
}

function itemBadgeCount(item: Pick<LinkDef, "badgeKey" | "children">, counts: Partial<Record<BadgeKey, number>>) {
  const keys = new Set<BadgeKey>();
  if (item.badgeKey) keys.add(item.badgeKey);
  for (const child of item.children ?? []) if (child.badgeKey) keys.add(child.badgeKey);
  let total = 0;
  for (const key of keys) total += counts[key] ?? 0;
  return total;
}

function findBadgeKey(pathname: string): BadgeKey | undefined {
  let best: { len: number; key: BadgeKey } | null = null;
  for (const item of allMenuItems) {
    if (!item.badgeKey || !matchesPath(pathname, item)) continue;
    if (!best || item.to.length > best.len) best = { len: item.to.length, key: item.badgeKey };
  }
  return best?.key;
}

function itemMatchesQuery(item: LinkDef, q: string) {
  if (!q) return true;
  if (item.label.toLowerCase().includes(q)) return true;
  return (item.children ?? []).some((child) => child.label.toLowerCase().includes(q));
}

function activeInItem(pathname: string, item: LinkDef) {
  if (matchesPath(pathname, item)) return true;
  return (item.children ?? []).some((child) => matchesPath(pathname, child));
}

function buildGroups(query: string, canSee: (path: string) => boolean) {
  const q = query.trim().toLowerCase();
  return menuGroups
    .map((group) => {
      const items = group.items.reduce<VisibleLinkDef[]>((visible, item) => {
          const visibleChildren = (item.children ?? []).filter((child) => canSee(child.to));
          const isVisible = canSee(item.to) || visibleChildren.length > 0;
          if (!isVisible || !itemMatchesQuery({ ...item, children: visibleChildren }, q)) return visible;
          visible.push({ ...item, children: visibleChildren.length ? visibleChildren : undefined });
          return visible;
        }, []);
      return { label: group.label, icon: group.icon, items };
    })
    .filter((group) => group.items.length > 0);
}

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <StoreAccessProvider>
      <AdminLayout />
    </StoreAccessProvider>
  ),
  errorComponent: AdminErrorComponent,
});

/** Keeps a transient failure (stale chunk, network blip, server hiccup)
 *  contained inside the admin panel with a retry, instead of blanking the app. */
function AdminErrorComponent({ error, reset }: { error: any; reset: () => void; info?: unknown }) {
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
    const badgeKey = findBadgeKey(currentPath);
    if (badgeKey) {
      markSeen.mutate({ store_id: storeId, feature: badgeKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, currentPath]);


  useEffect(() => {
    setCollapsed(localStorage.getItem("admin.sidebar.collapsed") === "1");
    try {
      const savedGroups = JSON.parse(localStorage.getItem("admin.sidebar.groups") ?? "{}");
      const savedSubMenus = JSON.parse(localStorage.getItem("admin.sidebar.submenus") ?? "{}");
      if (savedGroups && typeof savedGroups === "object") setOpenGroups(savedGroups);
      if (savedSubMenus && typeof savedSubMenus === "object") setSubMenus(savedSubMenus);
    } catch {
      localStorage.removeItem("admin.sidebar.groups");
      localStorage.removeItem("admin.sidebar.submenus");
    }
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
  function toggleGroup(label: string, currentlyOpen: boolean) {
    setOpenGroups((state) => {
      const next = { ...state, [label]: !currentlyOpen };
      localStorage.setItem("admin.sidebar.groups", JSON.stringify(next));
      return next;
    });
  }
  function toggleSubMenu(path: string, currentlyOpen: boolean) {
    setSubMenus((state) => {
      const next = { ...state, [path]: !currentlyOpen };
      localStorage.setItem("admin.sidebar.submenus", JSON.stringify(next));
      return next;
    });
  }
  function toggleDark() {
    const v = !dark;
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("admin.theme.dark", v ? "1" : "0");
  }

  async function signOut() {
    const wasEmployee = access.isEmployee;
    await supabase.auth.signOut();
    navigate({ to: wasEmployee ? "/employee-login" : "/auth", replace: true });
  }

  const access = useStoreAccess();
  const canSee = useMemo(
    () => (path: string) => {
      if (!access.isEmployee) return true;
      const section = sectionForPath(path);
      if (!section) return false;
      return access.can(section.key, "view");
    },
    [access],
  );
  const groups = useMemo(() => buildGroups(search, canSee), [search, canSee]);

  const currentSection = sectionForPath(currentPath);
  const pageAllowed =
    !access.isEmployee || (!!currentSection && access.can(currentSection.key, "view"));

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
            <span className="text-[11px] font-normal text-muted-foreground">Merchant Panel</span>
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
                <span className="mt-1 truncate text-[12px] text-muted-foreground">Merchant Panel</span>
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

          <nav className="flex flex-1 flex-col gap-3 overflow-y-auto p-2 pb-4">
            {groups.map((g) => {
              const groupActive = g.items.some((item) => activeInItem(currentPath, item));
              const groupOpen = search.trim() ? true : (openGroups[g.label] ?? groupActive);
              return (
                <div key={g.label}>
                  {(!collapsed || open) && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.label, groupOpen)}
                      aria-expanded={groupOpen}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] font-bold uppercase tracking-wide text-foreground/70 hover:bg-muted hover:text-foreground",
                        groupActive && "text-foreground",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <g.icon className={cn("h-[18px] w-[18px] shrink-0 text-muted-foreground", groupActive && "text-primary")} />
                        <span className="truncate">{g.label}</span>
                      </span>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !groupOpen && "-rotate-90")} />
                    </button>
                  )}
                  {(groupOpen || (collapsed && !open)) && (
                    <div className="space-y-0.5">
                      {g.items.map((l) => {
                        const badgeVal = itemBadgeCount(l, counts);
                        const hasChildren = !!l.children?.length && (!collapsed || open);
                        const itemActive = activeInItem(currentPath, l);
                        const childSearchMatch = search.trim() && l.children?.some((child) => child.label.toLowerCase().includes(search.trim().toLowerCase()));
                        const subOpen = childSearchMatch ? true : (subMenus[l.to] ?? itemActive);
                        const destination = hasChildren && l.children?.[0] ? l.children[0].to : l.to;
                        return (
                        <div key={l.to}>
                        <div className="flex items-center">
                        <Link
                          to={destination}
                          onClick={() => { if (!hasChildren) setOpen(false); }}
                          activeOptions={l.exact ? { exact: true } : undefined}
                          title={collapsed ? `${l.label}${badgeVal ? ` (${badgeVal})` : ""}` : undefined}
                          className={cn(
                            "group relative flex flex-1 items-center gap-2.5 rounded-lg py-2 pl-9 pr-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                            collapsed && "md:justify-center md:px-2 md:pl-2",
                            itemActive && "bg-primary/10 font-medium text-primary",
                          )}
                        >
                          <span className="relative shrink-0">
                            <l.icon className="h-4 w-4" />
                            {collapsed && badgeVal > 0 && (
                              <CountBadge count={badgeVal} variant="dot" label={l.label} />
                            )}
                          </span>
                          {(!collapsed || open) && <span className="truncate">{l.label}</span>}
                          {(!collapsed || open) && badgeVal > 0 && (!hasChildren || !subOpen) && (
                            <CountBadge count={badgeVal} label={l.label} />
                          )}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            aria-label={`Toggle ${l.label} menu`}
                            onClick={() => toggleSubMenu(l.to, subOpen)}
                            aria-expanded={subOpen}
                            className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !subOpen && "-rotate-90")} />
                          </button>
                        )}
                        </div>
                        {hasChildren && subOpen && (
                          <div className="ml-[38px] mt-0.5 space-y-0.5 border-l pl-2">
                            {l.children?.map((c) => {
                              const childBadge = c.badgeKey ? counts[c.badgeKey] ?? 0 : 0;
                              return (
                              <Link
                                key={c.to}
                                to={c.to}
                                onClick={() => setOpen(false)}
                                activeOptions={c.exact ? { exact: true } : undefined}
                                activeProps={{ className: "bg-primary/10 text-primary font-medium" }}
                                className="flex min-h-8 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              >
                                <c.icon className="h-4 w-4 shrink-0 opacity-80" />
                                <span className="truncate">{c.label}</span>
                                {childBadge > 0 && <CountBadge count={childBadge} label={c.label} />}
                              </Link>
                              );
                            })}
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
          </nav>
          <div className="shrink-0 space-y-1 border-t bg-sidebar p-2">
            {ownerData?.isOwner && (
              <Link
                to="/owner"
                onClick={() => setOpen(false)}
                title={collapsed ? "Owner Panel" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10",
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
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10",
                collapsed && "md:justify-center md:px-2",
              )}
            >
              <LogOut className="h-4 w-4" />
              {(!collapsed || open) && <span>Logout</span>}
            </button>
          </div>
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
            {!access.isEmployee && <SubscriptionStatusBanner />}
            {!access.isEmployee && <EmailVerifyBanner />}
            {access.loading ? (
              <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />
            ) : pageAllowed ? (
              <>
                {access.isEmployee && !!currentSection && !access.can(currentSection.key, "manage") && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    View only — you can see this section but changes are not allowed.
                  </div>
                )}
                <ReadOnlyGuard
                  active={
                    access.isEmployee && (!currentSection || !access.can(currentSection.key, "manage"))
                  }
                >
                  <PlanLockGate path={currentPath}>
                    <EmailVerifyGate path={currentPath}>
                      <Outlet />
                    </EmailVerifyGate>
                  </PlanLockGate>
                </ReadOnlyGuard>
              </>


            ) : (
              <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
                <h2 className="mt-3 text-base font-semibold">No access to this section</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account doesn't have permission for this page. Ask the store owner to grant access.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
    </ProductTypeScopeProvider>
    </UpgradeProvider>
  );
}
