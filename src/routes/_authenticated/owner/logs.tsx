import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLoginHistory } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";

export const Route = createFileRoute("/_authenticated/owner/logs")({ component: Page });

function Page() {
  const list = useServerFn(listLoginHistory);
  const { data = [] } = useQuery({ queryKey: ["owner", "logins"], queryFn: () => list() });

  return (
    <div>
      <OwnerPageHeader title="Login Logs" description="Latest sign-ins across the platform." />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Last sign-in</th><th className="px-3 py-2 text-left">Joined</th></tr>
          </thead>
          <tbody>
            {(data as any[]).map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.email ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.last_sign_in_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {(data as any[]).length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">No sign-ins yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
