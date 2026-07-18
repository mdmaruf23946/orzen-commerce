import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  LayoutDashboard, Store as StoreIcon, Package, LogOut, Menu, ArrowLeft, ShieldCheck,
  Sparkles, Wallet, Users, CreditCard, Activity, Truck, Megaphone, ToggleLeft, Settings,
  UserCog, BarChart3, LifeBuoy, Bell, FileText, KeyRound, Webhook, Terminal, HardDrive,
  ChevronDown, ChevronRight, Globe,
} from "lucide-react";
import { amIOwner } from "@/lib/owner.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    { to: "/owner/subscription-pay", label: "Subscription Payments", icon: CreditCard },
    { to: "/owner/subscription-pay/providers", label: "Payment Providers", icon: Settings },
    { to: "/owner/subscription-coupons", label: "Subscription Coupons", icon: Sparkles },
    { to: "/owner/subscriptions", label: "Subscriptions", icon: Users },
    { to: "/owner/billing", label: "Manual Payments", icon: Wallet },
    { to: "/owner/packages", label: "Packages", icon: Package },
    { to: "/owner/payment-settings", label: "Payment Settings", icon: CreditCard },
    { to: "/owner/payment-gateways", label: "Storefront Gateways", icon: Wallet },
  ]},
  { label: "AI", links: [
    { to: "/owner/ai", label: "AI Control", icon: Sparkles },
    { to: "/owner/ai-usage", label: "AI Usage", icon: BarChart3 },
  ]},
  { label: "Integrations", links: [
    { to: "/owner/couriers", label: "Couriers", icon: Truck },
    { to: "/owner/marketing", label: "Marketing", icon: Megaphone },
  ]},
  { label: "Platform", links: [
    { to: "/owner/store-template", label: "Store Template", icon: StoreIcon },
    { to: "/owner/features", label: "Feature Flags", icon: ToggleLeft },
    { to: "/owner/fraud", label: "Fraud Checker", icon: ShieldCheck },
    { to: "/owner/system", label: "System Settings", icon: Settings },
    { to: "/owner/domains", label: "Domains", icon: Globe },
    { to: "/owner/users", label: "Users", icon: UserCog },
    { to: "/owner/audit", label: "Role Audit", icon: ShieldCheck },
  ]},
  { label: "Insights", links: [
    { to: "/owner/reports", label: "Reports", icon: BarChart3 },
    { to: "/owner/support", label: "Support", icon: LifeBuoy },
    { to: "/owner/notifications", label: "Notifications", icon: Bell },
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

export const Route = createFileRoute("/_authenticated/owner")({
  component: OwnerLayout,
});

function OwnerLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ownerCheck = useServerFn(amIOwner);
  const { data, isLoading } = useQuery({ queryKey: ["amIOwner"], queryFn: () => ownerCheck() });

  if (!isLoading && data && !data.isOwner) throw redirect({ to: "/admin" });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <Link to="/owner" className="truncate font-semibold">Platform Owner</Link>
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
          <div className="flex h-14 shrink-0 items-center border-b px-5 font-semibold">Platform Owner</div>
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
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
