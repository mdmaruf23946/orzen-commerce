import { createFileRoute, redirect } from "@tanstack/react-router";

// Replaced by the unified Pages & Content manager.
export const Route = createFileRoute("/_authenticated/admin/legal")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/pages" });
  },
});
