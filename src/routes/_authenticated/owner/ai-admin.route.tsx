import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/owner/ai-admin")({
  component: AiAdminLayout,
});

const tabs = [
  { to: "/owner/ai-admin", label: "Overview", exact: true },
  { to: "/owner/ai-admin/whatsapp", label: "WhatsApp" },
  { to: "/owner/ai-admin/messenger", label: "Messenger" },
  { to: "/owner/ai-admin/agent", label: "AI Agent" },
  { to: "/owner/ai-admin/agents", label: "AI Agents" },
  { to: "/owner/ai-admin/knowledge", label: "Knowledge Base" },
  { to: "/owner/ai-admin/support", label: "Customer Support" },
  { to: "/owner/ai-admin/notifications", label: "Notifications" },
  { to: "/owner/ai-admin/permissions", label: "Commands & Permissions" },
  { to: "/owner/ai-admin/automation", label: "Automation" },
  { to: "/owner/ai-admin/logs", label: "Activity Logs" },
  { to: "/owner/ai-admin/settings", label: "Settings" },
];

function AiAdminLayout() {
  return (
    <div>
      <OwnerPageHeader
        title="AI Admin Control"
        description="Channels, agents, knowledge and automation for the platform AI assistant."
      />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b pb-px">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={t.exact ? { exact: true } : undefined}
            activeProps={{ className: "border-primary font-medium text-foreground" }}
            className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
