import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LayoutDashboard, Store as StoreIcon, Package, LogOut, Menu, ArrowLeft } from "lucide-react";
import { amIOwner } from "@/lib/owner.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/owner", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/owner/stores", label: "Stores", icon: StoreIcon },
  { to: "/owner/packages", label: "Packages", icon: Package },
];

export const Route = createFileRoute("/_authenticated/owner")({
  beforeLoad: async () => {
    // Soft check in component too; redirect non-owners to admin.
  },
  component: OwnerLayout,
});

function OwnerLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ownerCheck = useServerFn(amIOwner);
  const { data, isLoading } = useQuery({ queryKey: ["amIOwner"], queryFn: () => ownerCheck() });

  if (!isLoading && data && !data.isOwner) {
    throw redirect({ to: "/admin" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:hidden">
        <Link to="/owner" className="font-semibold">
          Platform Owner
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 transform border-r bg-background transition-transform md:static md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-14 items-center border-b px-5 font-semibold">Platform Owner</div>
          <nav className="flex flex-col gap-1 p-3">
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
            <Link
              to="/admin"
              className="mt-2 flex items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Admin
            </Link>
            <button
              onClick={signOut}
              className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </nav>
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
