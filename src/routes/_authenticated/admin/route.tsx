import { COURIERS } from "@/components/admin/couriers/providers";
import { useCourierConnections, type CourierConnectionMap } from "@/lib/courier-apps";
import { MARKETING_PLATFORMS, useMarketingConnections, type MarketingConnectionMap } from "@/lib/marketing-platforms";
import { CALL_SMS_PROVIDERS, CALL_SMS_HUB_PATH, type ProviderConnectionMap } from "@/lib/call-sms-providers";
import { useProviderConnections } from "@/lib/use-call-sms-connections";
import { isBetaPath, isBetaTester } from "@/lib/beta-features";
import { PAYMENT_SECTIONS, usePaymentGatewayConnections } from "@/lib/payment-gateway-apps";
import { AI_MESSAGING_APPS, useAiMessagingConnections, type AiMessagingConnectionMap } from "@/lib/ai-messaging-apps";
import { createFileRoute, Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Package, Tags, ShoppingBag, Users, Image as ImageIcon,
  Settings, CreditCard, Menu, Megaphone, Truck,
  Search as SearchIcon, PackageOpen, Wallet, Bell, ClipboardList, Bot,
  MessageSquare, MessageCircle, Boxes, Ticket, RotateCcw, BarChart3, FileUp, Globe,
  Radar, ShieldCheck, FileText, PhoneCall, Sparkles, AlertTriangle, UserCog, Palette,
  ChevronDown, ChevronsLeft, ChevronsRight, Moon, Sun, ExternalLink, LayoutTemplate, X,
  Gauge, PackageCheck, Headphones, LayoutGrid, Inbox as InboxIcon, Plug as PlugIcon, Store, SlidersHorizontal, LifeBuoy, UserRound,
} from "lucide-react";
import { amIOwner } from "@/lib/owner.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubscriptionStatusBanner } from "@/components/admin/SubscriptionStatusBanner";
import { UpgradeProvider } from "@/components/admin/UpgradeModal";
import { ProductTypeScopeProvider } from "@/lib/product-type-scope";
import { StoreBrandMark } from "@/components/admin/StoreBrandMark";
import { StoreSwitcher, DelegatedStoreBanner } from "@/components/admin/access/StoreSwitcher";
import { AdminGlobalSearch } from "@/components/admin/AdminGlobalSearch";
import { CountBadge } from "@/components/admin/CountBadge";
import { useBadgeCounts, useMarkSeen } from "@/lib/use-badge-counts";
import { getMyStore } from "@/lib/admin.functions";
import { resolveStoreIcon, resolveStoreBrandLogo } from "@/lib/store-icon";
import { recoverFromChunkError } from "@/lib/chunk-recovery";
import { StoreAccessProvider, useStoreAccess } from "@/lib/use-store-access";
import { ReadOnlyGuard } from "@/components/admin/ReadOnlyGuard";
import { PlanLockGate } from "@/components/admin/PlanLockGate";
import { EmailVerifyBanner, EmailVerifyGate } from "@/components/admin/EmailVerifyGate";
import { sectionForPath, DELEGATE_ROLES } from "@/lib/panel-sections";
import { getAccountProfile } from "@/lib/account-profile.functions";
import { AccountAvatar } from "@/components/admin/AccountAvatar";
import { getMyWallet } from "@/lib/wallet.functions";
import { getMyAiCredits } from "@/lib/ai-credit-purchase.functions";

function AiCreditsChip() {
  const fn = useServerFn(getMyAiCredits);
  const { data } = useQuery({ queryKey: ["my-ai-credits"], queryFn: () => fn(), staleTime: 60_000 });
  const bal = Number(data?.balance ?? 0);
  return (
    <Link
      to="/admin/billing"
      search={{ highlight: undefined, plan: undefined, from: undefined }}
      className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
      title="AI Credits balance"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">AI Credits:</span>
      <span className="font-semibold tabular-nums">{bal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </Link>
  );
}

function AdFundChip() {
  const walletFn = useServerFn(getMyWallet);
  const { data } = useQuery({ queryKey: ["my-wallet"], queryFn: () => walletFn(), staleTime: 60_000 });
  const bal = Number(data?.balance ?? 0);
  return (
    <Link
      to="/admin/billing"
      search={{ highlight: undefined, plan: undefined, from: undefined }}
      className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
      title="Ad Fund balance"
    >
      <Wallet className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Ad Fund:</span>
      <span className="font-semibold">৳{bal.toLocaleString()}</span>
    </Link>
  );
}


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
  search?: Record<string, string>;
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

const CALL_SMS_GROUP = "AI Call & SMS Integration";

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
          { to: "/admin/delivery", label: "Delivery Zones", icon: Radar, badgeKey: "delivery" },
        ],
      },
      {
        to: "/admin/couriers/apps",
        label: "Courier Apps",
        icon: Truck,
        children: [
          { to: "/admin/couriers/apps", label: "All Courier Apps", icon: Truck },
          { to: "/admin/couriers/overview", label: "Courier Overview", icon: LayoutDashboard },
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
      { to: "/admin/duplicate-protection", label: "Duplicate Protection", icon: ShieldCheck, badgeKey: "duplicate_protection" },
    ],
  },
  {
    label: CALL_SMS_GROUP,
    icon: PhoneCall,
    items: [
      { to: CALL_SMS_HUB_PATH, label: "Call & SMS Apps", icon: Store },
    ],
  },
  {
    label: "Calls",
    icon: PhoneCall,
    items: [
      { to: "/admin/manual-call/apps", label: "Call Apps", icon: Store },
      { to: "/admin/manual-call", label: "Calls Hub", icon: PhoneCall },
    ],
  },
  {
    label: "Channels & AI",
    icon: Bot,
    items: [
      { to: "/admin/ai-messaging/apps", label: "AI Messaging Apps", icon: LayoutGrid },
      { to: "/admin/omni-inbox", label: "Omni Inbox", icon: InboxIcon },
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
          { to: "/admin/handoff-queue", label: "Handoff Queue", icon: Headphones, badgeKey: "handoff" },
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
      { to: "/admin/marketing/apps", label: "Marketing & Targeting Apps", icon: Megaphone },
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
      { to: "/admin/payment-gateways/apps", label: "Payment Gateway Apps", icon: CreditCard, badgeKey: "payment_gateway" },
      { to: "/admin/payment-gateways/overview", label: "Payment Overview", icon: Gauge },
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

/** Connected providers only — each gets its own menu with its own sections. */
function providerItems(connected: ProviderConnectionMap): LinkDef[] {
  return CALL_SMS_PROVIDERS.filter((p) => connected[p.id]).map((p) => ({
    to: p.path,
    label: p.name,
    icon: p.kind === "sms" ? MessageSquare : PhoneCall,
    children: p.sections.map((sec) => ({ to: p.path, search: { tab: sec.key }, label: sec.label, icon: sec.icon })),
  }));
}

/** Connected couriers only — each gets its own isolated menu. */
function courierItems(connected: CourierConnectionMap): LinkDef[] {
  return COURIERS.filter((c) => connected[c.key]).map((c) => ({
    to: `/admin/couriers/${c.key}`,
    label: c.label,
    icon: Truck,
    children: [
      { to: `/admin/couriers/${c.key}`, search: { section: "overview" }, label: "Overview", icon: LayoutDashboard },
      { to: `/admin/couriers/${c.key}`, search: { section: "integration" }, label: "Integration", icon: PlugIcon },
    ],
  }));
}

/** Connected marketing platforms only — each gets its own isolated menu. */
function marketingItems(connected: MarketingConnectionMap): LinkDef[] {
  return MARKETING_PLATFORMS.filter((p) => connected[p.id]).map((p) => ({
    to: p.path,
    label: p.name,
    icon: Megaphone,
    children: p.sections.map((sec) => ({ to: p.path, search: { tab: sec.key }, label: sec.label, icon: sec.icon })),
  }));
}

/** Connected AI messaging apps only — chats live in the single Omni Inbox; each app keeps its Integration page. */
function aiMessagingItems(connected: AiMessagingConnectionMap): LinkDef[] {
  return AI_MESSAGING_APPS.filter((a) => connected[a.id]).map((a) => ({
    to: a.integrationPath,
    label: a.name,
    icon: a.id === "messenger" ? MessageSquare : a.id === "webchat" ? Globe : MessageCircle,
  })) as LinkDef[];
}

/** Connected payment gateways only — each gets its own isolated menu. */
function paymentItems(gws: { id: string; label: string }[]): LinkDef[] {
  return gws.map((g) => ({
    to: `/admin/payment-gateways/${g.id}`,
    label: g.label,
    icon: Wallet,
    children: PAYMENT_SECTIONS.map((sec) => ({ to: `/admin/payment-gateways/${g.id}`, search: { section: sec.key }, label: sec.label, icon: sec.icon })),
  }));
}

function buildGroups(query: string, canSee: (path: string) => boolean, connected: ProviderConnectionMap = {}, mkt: MarketingConnectionMap = {}, aim: AiMessagingConnectionMap = {}, cour: CourierConnectionMap = {}, pay: { id: string; label: string }[] = []) {
  const q = query.trim().toLowerCase();
  return menuGroups
    .map((group) => {
      const groupItems = group.label === CALL_SMS_GROUP
        ? [group.items[0], ...providerItems(connected), ...group.items.slice(1)]
        : group.label === "Marketing & Sales"
          ? [group.items[0], ...marketingItems(mkt), ...group.items.slice(1)]
          : group.label === "Channels & AI"
            ? [group.items[0], group.items[1], ...aiMessagingItems(aim), ...group.items.slice(2)]
            : group.label === "Orders & Delivery"
              ? (() => {
                  const i = group.items.findIndex((it) => it.to === "/admin/couriers/apps");
                  return [...group.items.slice(0, i + 1), ...courierItems(cour), ...group.items.slice(i + 1)];
                })()
              : group.label === "Finance & Analytics"
                ? (() => {
                    const i = group.items.findIndex((it) => it.to === "/admin/payment-gateways/overview");
                    return [...group.items.slice(0, i + 1), ...paymentItems(pay), ...group.items.slice(i + 1)];
                  })()
                : group.items;
      const items = groupItems.reduce<VisibleLinkDef[]>((visible, item) => {
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
  const fetchAccountProfile = useServerFn(getAccountProfile);
  const { data: accountProfile } = useQuery({
    queryKey: ["admin", "account-profile"],
    queryFn: () => fetchAccountProfile(),
    staleTime: 60_000,
  });
  const storeIcon = resolveStoreBrandLogo(myStore as any);
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

  const access = useStoreAccess();
  const betaTester = isBetaTester((accountProfile as any)?.email);
  const canSee = useMemo(
    () => (path: string) => {
      if (isBetaPath(path) && !betaTester) return false;
      if (!access.isEmployee) return true;
      const section = sectionForPath(path);
      if (!section) return false;
      return access.can(section.key, "view");
    },
    [access, betaTester],
  );
  const { connected: providerConnected } = useProviderConnections();
  const providerKey = JSON.stringify(providerConnected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { connected: mktConnected } = useMarketingConnections();
  const mktKey = JSON.stringify(mktConnected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { connected: aimConnected } = useAiMessagingConnections();
  const aimKey = JSON.stringify(aimConnected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { connected: courConnected } = useCourierConnections();
  const courKey = JSON.stringify(courConnected);
  const payConnected = usePaymentGatewayConnections();
  const payKey = JSON.stringify(payConnected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => buildGroups(search, canSee, providerConnected, mktConnected, aimConnected, courConnected, payConnected), [search, canSee, providerKey, mktKey, aimKey, courKey, payKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allGroups = useMemo(() => buildGroups("", canSee, providerConnected, mktConnected, aimConnected, courConnected, payConnected), [canSee, providerKey, mktKey, aimKey, courKey, payKey]);

  const currentSection = sectionForPath(currentPath);
  const isPersonalProfile = currentPath === "/admin/profile";
  const pageAllowed = (!isBetaPath(currentPath) || betaTester) && (isPersonalProfile
    || !access.isEmployee
    || (!!currentSection && access.can(currentSection.key, "view")));

  const asideWidth = collapsed ? "md:w-[72px]" : "md:w-[288px]";

  return (
    <UpgradeProvider>
    <ProductTypeScopeProvider physicalOnly={!betaTester}>
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
        <div className="ml-3 flex shrink-0 items-center gap-1.5">
        {!access.isEmployee && <><AiCreditsChip /><AdFundChip /></>}
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-screen w-72 transform flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 md:sticky md:top-0 md:translate-x-0",
            asideWidth,
            open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          {/* Collapse toggle — sits on the sidebar edge, outside the panel */}
          <button
            className="absolute -right-3.5 top-[26px] z-50 hidden h-7 w-7 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground md:grid"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
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
            {(!collapsed || open) && storeName && (
              <div className="ml-auto hidden shrink-0 md:block">
                <StoreSwitcher
                  compact
                  currentStoreId={access.storeId ?? (myStore as any)?.id ?? null}
                  storeName={storeName}
                  storeIcon={storeIcon}
                  color={(myStore as any)?.primary_color}
                  roleLabel={access.isOwner ? "Owner" : (DELEGATE_ROLES.find((r) => r.value === access.staff?.role)?.label ?? access.staff?.role ?? "Team member")}
                />
              </div>
            )}
            <button
              onClick={toggleDark}
              className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full border hover:bg-muted md:ml-0 md:hidden"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          {/* Search (+ store switcher beside it on mobile) */}
          {(!collapsed || open) && (
            <div className="flex items-center gap-2 border-b p-3">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu…"
                  className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {storeName && (
                <div className="shrink-0 md:hidden">
                  <StoreSwitcher
                    compact
                    currentStoreId={access.storeId ?? (myStore as any)?.id ?? null}
                    storeName={storeName}
                    storeIcon={storeIcon}
                    color={(myStore as any)?.primary_color}
                    roleLabel={access.isOwner ? "Owner" : (DELEGATE_ROLES.find((r) => r.value === access.staff?.role)?.label ?? access.staff?.role ?? "Team member")}
                  />
                </div>
              )}
            </div>
          )}

          <nav className="flex flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-2 pb-4">
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
                                key={c.to + (c.search?.tab ?? "")}
                                to={c.to}
                                search={c.search as any}
                                onClick={() => setOpen(false)}
                                activeOptions={c.search ? { includeSearch: true } : c.exact ? { exact: true } : undefined}
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

            <div className={cn("grid grid-cols-2 gap-1", collapsed && !open && "md:grid-cols-1")}>
              {!access.isEmployee && (
                <Link
                  to="/admin/billing"
                  search={{ highlight: undefined, plan: undefined, from: undefined }}
                  onClick={() => setOpen(false)}
                  title={collapsed ? "Billing" : undefined}
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && !open && "md:px-1",
                  )}
                >
                  <Wallet className="h-4 w-4 shrink-0" />
                  {(!collapsed || open) && <span>Billing</span>}
                </Link>
              )}
              <Link
                to="/admin/support"
                onClick={() => setOpen(false)}
                title={collapsed ? "Help Center" : undefined}
                className={cn(
                  "flex min-w-0 items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  access.isEmployee && "col-span-2",
                  collapsed && !open && "md:col-span-1 md:px-1",
                )}
              >
                <LifeBuoy className="h-4 w-4 shrink-0" />
                {(!collapsed || open) && <span>Help Center</span>}
              </Link>
            </div>

            <Link
              to="/admin/profile"
              onClick={() => setOpen(false)}
              title={collapsed ? "Profile" : undefined}
              className="flex min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 hover:bg-muted md:hidden"
            >
              {accountProfile ? (
                <AccountAvatar name={accountProfile.name} avatarUrl={accountProfile.avatarUrl} />
              ) : (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-muted">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              {(!collapsed || open) && (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold">{accountProfile?.name ?? "My Profile"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{accountProfile?.email ?? "Account settings"}</div>
                </div>
              )}
            </Link>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)}>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              aria-label="Close menu"
              className="absolute left-[calc(18rem+0.75rem)] top-6 grid h-10 w-10 place-items-center rounded-full bg-background text-foreground shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop sticky header */}
          <header className="sticky top-0 z-20 hidden h-16 items-center gap-3 border-b bg-background/95 px-6 backdrop-blur md:flex">
            <AdminGlobalSearch groups={allGroups} />
            <div className="ml-auto flex items-center gap-2">
              {!access.isEmployee && <><AiCreditsChip /><AdFundChip /></>}
              <Link
                to="/admin/omni-inbox"
                className="relative grid h-9 w-9 place-items-center rounded-full border hover:bg-muted"
                aria-label="Inbox"
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
              <Link
                to="/admin/profile"
                aria-label="My account"
                title={accountProfile?.email ?? "My account"}
                className="grid h-9 w-9 place-items-center rounded-full ring-offset-background transition hover:ring-2 hover:ring-primary/40"
              >
                {accountProfile ? (
                  <AccountAvatar name={accountProfile.name} avatarUrl={accountProfile.avatarUrl} />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full border bg-muted">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}
              </Link>
            </div>
          </header>

          <main className={cn("min-w-0 flex-1 overflow-x-hidden p-4 pb-[70px] md:p-6 md:pb-8 lg:p-8", isPersonalProfile && "pt-0 md:pt-0 lg:pt-0")}>
            {!access.isEmployee && <SubscriptionStatusBanner />}
            {!access.isEmployee && <EmailVerifyBanner />}
            {access.isDelegated && storeName && (
              <DelegatedStoreBanner
                storeName={storeName}
                roleLabel={DELEGATE_ROLES.find((r) => r.value === access.staff?.role)?.label ?? access.staff?.role ?? "Team member"}
              />
            )}
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
                    !isPersonalProfile && access.isEmployee && (!currentSection || !access.can(currentSection.key, "manage"))
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
