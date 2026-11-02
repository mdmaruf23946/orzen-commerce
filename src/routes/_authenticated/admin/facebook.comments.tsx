import { createFileRoute, redirect } from "@tanstack/react-router";

// Facebook comments now live inside Omni Inbox; keep old links working.
export const Route = createFileRoute("/_authenticated/admin/facebook/comments")({
  validateSearch: (s: Record<string, unknown>): { post?: string } =>
    typeof s.post === "string" ? { post: s.post } : {},
  beforeLoad: () => {
    throw redirect({ to: "/admin/omni-inbox", search: { channel: "facebook" } });
  },
});
