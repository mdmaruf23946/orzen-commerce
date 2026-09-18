import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Mail, Send, History, FileText, Link2, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/communication")({
  component: CommunicationLayout,
});

const tabs = [
  { to: "/owner/communication", label: "Dashboard", icon: Mail, exact: true },
  { to: "/owner/communication/compose", label: "Compose", icon: Send },
  { to: "/owner/communication/history", label: "History", icon: History },
  { to: "/owner/communication/templates", label: "Templates", icon: FileText },
  { to: "/owner/communication/automations", label: "Email Automations", icon: Zap },
  { to: "/owner/communication/gmail", label: "Gmail Connection", icon: Link2 },
];

function CommunicationLayout() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5" />
        <h1 className="text-2xl font-semibold">Communication &amp; Emails</h1>
      </div>
      <div className="flex flex-wrap gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={t.exact ? { exact: true } : undefined}
            activeProps={{ className: "bg-primary text-primary-foreground" }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            <t.icon className="h-4 w-4" />
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
