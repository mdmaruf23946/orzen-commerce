import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL: now Call & SMS Apps → ePBX (or AI Voice Agent for tab=ai).
export const Route = createFileRoute("/_authenticated/admin/ai-call-center")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  beforeLoad: ({ search }) => {
    if (search.tab === "ai") throw redirect({ to: "/admin/call-sms/ai-voice-agent" });
    throw redirect({ to: "/admin/call-sms/epbx", search: { tab: search.tab } });
  },
});
