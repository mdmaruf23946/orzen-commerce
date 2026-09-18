import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsLayout,
});

const TABS = [
  { to: "/admin/settings/information", label: "Store Information" },
  { to: "/admin/settings/configuration", label: "Store Configuration" },
  { to: "/admin/settings/workflow", label: "Order & Workflow" },
  { to: "/admin/settings/security", label: "Account Security" },
];

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto max-w-3xl">
      <div className="-mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <nav className="flex w-max gap-1 rounded-xl border bg-card p-1">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                pathname === t.to ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
