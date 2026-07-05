import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/owner/ComingSoon";

export const Route = createFileRoute("/_authenticated/owner/users")({
  component: () => <ComingSoon title="User Management" description="Store owners, platform admins, roles, permissions, and login history." />,
});
