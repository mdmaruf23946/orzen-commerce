import { createFileRoute, redirect } from "@tanstack/react-router";

// Old "Courier Setup" URL — keep bookmarks working.
export const Route = createFileRoute("/_authenticated/admin/couriers/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/couriers/apps", replace: true });
  },
});
