import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL now opens AI Call Center → Calls & History.
export const Route = createFileRoute("/_authenticated/admin/call-center")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/ai-call-center", search: { tab: "calls" } as any });
  },
  head: () => ({
    meta: [
      { title: "Call Center — ORZEN Merchant Panel" },
      { name: "description", content: "Calls to customers now live inside the AI Call Center." },
      { property: "og:title", content: "Call Center — ORZEN Merchant Panel" },
      { property: "og:description", content: "Calls to customers now live inside the AI Call Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
