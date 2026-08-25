import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/owner/notification-center")({ component: Layout });

const tabs = [
  { to: "/owner/notification-center", label: "Campaigns", exact: true },
  { to: "/owner/notification-center/compose", label: "Compose" },
  { to: "/owner/notification-center/templates", label: "Templates" },
];

function Layout() {
  const { pathname } = useLocation();
  return (
    <div>
      <OwnerPageHeader title="Notification Center" description="Send announcements and updates to merchants via Email and In-App." />
      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link key={t.to} to={t.to} className={cn(
              "border-b-2 px-3 py-2 text-sm",
              active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}>{t.label}</Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
