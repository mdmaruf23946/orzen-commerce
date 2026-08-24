import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { FacebookMark } from "@/components/admin/facebook/ui";

export const Route = createFileRoute("/_authenticated/admin/facebook")({
  component: () => (
    <FeatureGate feature="facebook_page">
      <FacebookLayout />
    </FeatureGate>
  ),
});

const TABS = [
  { to: "/admin/facebook", label: "Page Overview", exact: true },
  { to: "/admin/facebook/posts", label: "Posts" },
  { to: "/admin/facebook/comments", label: "Comments" },
  { to: "/admin/facebook/compose", label: "Create Post" },
  { to: "/admin/facebook/settings", label: "Page Settings" },
];

function FacebookLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <header className="flex items-center gap-3">
        <FacebookMark />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Facebook Page</h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Manage your page posts, comments and moderation — separate from the Messenger AI Agent.
          </p>
        </div>
      </header>

      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <nav className="flex w-max gap-1 rounded-xl border bg-card p-1">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-[#1877F2] text-white" : "hover:bg-muted"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
