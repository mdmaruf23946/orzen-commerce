import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { grantRole, listRoleAuditLog, revokeRole } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/owner/audit")({
  component: AuditPage,
});

function AuditPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRoleAuditLog);
  const grantFn = useServerFn(grantRole);
  const revokeFn = useServerFn(revokeRole);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["roleAuditLog"],
    queryFn: () => listFn(),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "user">("owner");

  const grant = useMutation({
    mutationFn: (vars: { email: string; role: "owner" | "user" }) =>
      grantFn({ data: vars }),
    onSuccess: () => {
      toast.success("Role granted");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["roleAuditLog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (vars: { targetUserId: string; role: "owner" | "user" }) =>
      revokeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Role revoked");
      qc.invalidateQueries({ queryKey: ["roleAuditLog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Role Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Track who granted Owner access, to whom, and when.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-semibold">Grant role</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <div>
            <Label htmlFor="email">User email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "owner" | "user")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">owner</SelectItem>
                <SelectItem value="user">user</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              disabled={!email || grant.isPending}
              onClick={() => grant.mutate({ email, role })}
            >
              {grant.isPending ? "Granting..." : "Grant"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b p-4 font-semibold">History</div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No entries yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">—</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.action === "granted" ? "default" : "secondary"}>
                      {r.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell className="text-sm">
                    {r.target_email ?? r.target_user_id}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.actor_email ?? r.actor_user_id}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.action === "granted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          revoke.mutate({
                            targetUserId: r.target_user_id,
                            role: r.role,
                          })
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
