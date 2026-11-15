import { createFileRoute, redirect } from "@tanstack/react-router";

// The old Theme & Styling page is replaced by Store Design for every merchant.
export const Route = createFileRoute("/_authenticated/admin/theme")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/theme-studio" });
  },
});
