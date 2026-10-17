import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Store as StoreIcon, LogOut, Menu, ArrowLeft, ShieldCheck,
  Sparkles, Users, CreditCard, Activity, Truck, Megaphone, ToggleLeft, Settings,
  UserCog, BarChart3, LifeBuoy, FileText, KeyRound, Webhook, Terminal, HardDrive,
  ChevronDown, ChevronRight, Globe, Palette, PhoneCall, Star, Bot, Mail,
} from "lucide-react";
import { amIOwner } from "@/lib/owner.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/lib/platform-branding";

type NavLink = { to: string; label: string; icon: any; exact?: boolean };
type NavGroup = { label: string; links: NavLink[] };

const groups: NavGroup[] = [
  { label: "Overview", links: [
    { to: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  ]},
  { label: "Stores", links: [
    { to: "/owner/stores", label: "All Stores", icon: StoreIcon },
    { to: "/owner/health", label: "Store Health", icon: Activity },
  ]},
  { label: "Billing", links: [
    { to: "/owner/subscriptions", label: "Billing & Payments", icon: CreditCard },
  ]},
  { label: "AI", links: [
    { to: "/owner/ai", label: "AI Control", icon: Sparkles },
    { to: "/owner/ai-usage", label: "AI Usage", icon: BarChart3 },
    { to: "/owner/ai-credits", label: "AI Credits", icon: Star },
    { to: "/owner/message-performance", label: "Message Performance", icon: Activity },
    { to: "/owner/ai-call-center", label: "AI Call Center", icon: PhoneCall },
    { to: "/owner/ai-admin", label: "AI Admin Control", icon: Bot },
  ]},
  { label: "Communication", links: [
    { to: "/owner/communication", label: "Communication & Emails", icon: Mail },
  ]},
  { label: "Integrations", links: [
    { to: "/owner/meta-app", label: "Meta App / Auto Connect", icon: Sparkles },
    { to: "/owner/couriers", label: "Couriers", icon: Truck },
    { to: "/owner/marketing", label: "Marketing", icon: Megaphone },
    { to: "/owner/meta-tracking", label: "Main Website Tracking", icon: Activity },
    { to: "/owner/ads", label: "Advertisement Management", icon: Megaphone },
  ]},
  { label: "Platform", links: [
    { to: "/owner/platform-branding", label: "Branding & Assets", icon: Palette },
    { to: "/owner/themes", label: "Themes & Templates", icon: Palette },
    { to: "/owner/features", label: "Feature Flags", icon: ToggleLeft },
    { to: "/owner/domains", label: "Domains", icon: Globe },
    { to: "/owner/seo", label: "Platform SEO", icon: BarChart3 },
    { to: "/owner/system", label: "System Settings", icon: Settings },
    { to: "/owner/footer", label: "Footer Settings", icon: Settings },
    { to: "/owner/reviews", label: "Reviews & Testimonials", icon: Star },
    { to: "/owner/fraud", label: "Fraud Checker", icon: ShieldCheck },
  ]},
  { label: "People", links: [
    { to: "/owner/users", label: "Users", icon: UserCog },
    { to: "/owner/customers", label: "Customer Accounts", icon: Users },
    { to: "/owner/audit", label: "Role Audit", icon: ShieldCheck },
    { to: "/owner/support", label: "Support", icon: LifeBuoy },
  ]},
  { label: "Insights", links: [
    { to: "/owner/reports", label: "Reports", icon: BarChart3 },
  ]},
  { label: "Security", links: [
    { to: "/owner/logs", label: "Login Logs", icon: FileText },
    { to: "/owner/backups", label: "Backups", icon: HardDrive },
  ]},
  { label: "Developer", links: [
    { to: "/owner/api", label: "API Keys", icon: KeyRound },
    { to: "/owner/webhooks", label: "Webhooks", icon: Webhook },
    { to: "/owner/dev-logs", label: "System Logs", icon: Terminal },
  ]},
];

/** Sub-pages that used to be separate sidebar links, now shown as tabs on the page. */
type SectionTabs = { title: string; tabs: { to: string; label: string; exact?: boolean }[] };

const SECTION_TABS: SectionTabs[] = [
  {
    title: "Billing & Payments",
    tabs: [
      { to: "/owner/subscriptions", label: "Subscriptions" },
      { to: "/owner/subscription-pay", label: "Subscription Payments", exact: true },
      { to: "/owner/subscription-pay/providers", label: "Payment Providers" },
      { to: "/owner/subscription-coupons", label: "Coupons" },
      { to: "/owner/billing", label: "Manual Payments" },
      { to: "/owner/packages", label: "Packages" },
      { to: "/owner/payment-settings", label: "Payment Settings" },
      { to: "/owner/payment-gateways", label: "Storefront Gateways" },
    ],
  },
  {
    title: "Branding & Assets",
    tabs: [
      { to: "/owner/platform-branding", label: "Platform Branding" },
      { to: "/owner/brand-assets", label: "Payment Brand Assets" },
      { to: "/owner/courier-brand-assets", label: "Courier Brand Assets" },
      { to: "/owner/showcase", label: "Showcase Mockups" },
    ],
  },
  {
    title: "Themes & Templates",
    tabs: [
      { to: "/owner/themes", label: "Store Themes" },
      { to: "/owner/store-template", label: "Store Template" },
      { to: "/owner/invoice-templates", label: "Invoice Templates" },
    ],
  },
];

function SectionTabBar({ pathname }: { pathname: string }) {
  const section = SECTION_TABS.find((s) =>
    s.tabs.some((t) => pathname === t.to || pathname.startsWith(t.to + "/")),
  );
  if (!section) return null;
  return (
    <div className="mb-4 flex w-full min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b pb-px">
      {section.tabs.map((t) => {
        const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/owner")({
  component: OwnerLayout,
});

function OwnerLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ownerCheck = useServerFn(amIOwner);
  const { data, isLoading } = useQuery({ queryKey: ["amIOwner"], queryFn: () => ownerCheck() });

  const notOwner = !isLoading && data && !data.isOwner;
  useEffect(() => {
    if (notOwner) navigate({ to: "/admin", replace: true });
  }, [notOwner, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <Link to="/owner" className="truncate font-semibold">
          <BrandMark placement="winner_header" fallbackText="Platform Owner" />
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
          <div className="flex h-14 shrink-0 items-center border-b px-5 font-semibold">
            <BrandMark placement="winner_header" fallbackText="Platform Owner" />
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {groups.map((group) => {
              const isCollapsed = collapsed[group.label];
              return (
                <div key={group.label} className="mb-1">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [group.label]: !c[group.label] }))}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted"
                  >
                    <span className="truncate">{group.label}</span>
                    {isCollapsed ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                  </button>
                  {!isCollapsed && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {group.links.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          onClick={() => setOpen(false)}
                          activeOptions={l.exact ? { exact: true } : undefined}
                          activeProps={{ className: "bg-primary text-primary-foreground" }}
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                        >
                          <l.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{l.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <Link to="/admin" className="mt-2 flex items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <ArrowLeft className="h-4 w-4 shrink-0" /> <span className="truncate">Back to Admin</span>
            </Link>
            <button onClick={signOut} className="mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4 shrink-0" /> Logout
            </button>
          </nav>
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
        <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden p-3 sm:p-4 md:p-8">
          <div className="w-full min-w-0 max-w-full">
            <SectionTabBar pathname={pathname} />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
