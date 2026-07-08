import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShieldCheck, ShieldOff, Search } from "lucide-react";
import { listPlatformUsers } from "@/lib/owner-ext.functions";
import { grantRole, revokeRole } from "@/lib/owner.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner/users")({ component: Page });

function Page() {
  const list = useServerFn(listPlatformUsers);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["owner", "platUsers"], queryFn: () => list() });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; role: "owner" | "user" }>({ email: "", role: "owner" });

  const filtered = (data as any[]).filter((u) => !q || u.email?.toLowerCase().includes(q.toLowerCase()));

  async function doGrant() {
    try { await grant({ data: form }); toast.success("Granted"); setOpen(false); setForm({ email: "", role: "owner" }); qc.invalidateQueries({ queryKey: ["owner", "platUsers"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function doRevoke(userId: string, role: "owner" | "user") {
    if (!confirm(`Revoke '${role}' role?`)) return;
    try { await revoke({ data: { targetUserId: userId, role } }); toast.success("Revoked"); qc.invalidateQueries({ queryKey: ["owner", "platUsers"] }); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <OwnerPageHeader title="Users" description="Everyone who signed into the platform."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Grant role</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Grant role</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Role</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
                    <option value="owner">owner</option>
                    <option value="user">user</option>
                  </select>
                </div>
              </div>
              <DialogFooter><Button onClick={doGrant}>Grant</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="mb-3 flex max-w-md items-center gap-2 rounded-md border bg-card px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input className="border-0 focus-visible:ring-0" placeholder="Search email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Roles</th><th className="px-3 py-2 text-left">Joined</th><th className="px-3 py-2 text-left">Last sign-in</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-3 py-2">{u.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : u.roles.map((r: string) => (
                      <span key={r} className={"rounded-full px-2 py-0.5 text-[10px] " + (r === "owner" ? "bg-primary/10 text-primary" : "bg-muted")}>{r}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}</td>
                <td className="px-3 py-2 text-right">
                  {u.roles.includes("owner") ? (
                    <Button size="sm" variant="ghost" onClick={() => doRevoke(u.id, "owner")}><ShieldOff className="mr-1 h-3 w-3" />Revoke owner</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={async () => { setForm({ email: u.email ?? "", role: "owner" }); await doGrant(); }}><ShieldCheck className="mr-1 h-3 w-3" />Make owner</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 md:hidden">
        {filtered.map((u) => (
          <div key={u.id} className="rounded-xl border bg-card p-3">
            <div className="truncate font-medium">{u.email ?? "—"}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {u.roles.map((r: string) => <span key={r} className={"rounded-full px-2 py-0.5 text-[10px] " + (r === "owner" ? "bg-primary/10 text-primary" : "bg-muted")}>{r}</span>)}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Last: {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
