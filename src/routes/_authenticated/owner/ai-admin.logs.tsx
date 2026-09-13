import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAiAdminLogs } from "@/lib/ai-admin.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/owner/ai-admin/logs")({ component: Page });

function Page() {
  const fn = useServerFn(listAiAdminLogs);
  const { data = [] } = useQuery({ queryKey: ["ai-admin", "logs"], queryFn: () => fn() });
  const [q, setQ] = useState("");

  const rows = (data as any[]).filter((r) =>
    !q ||
    [r.action_key, r.command, r.target_label, r.result, r.actor].join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <OwnerPageHeader title="Activity Logs" description="Every action the AI assistant performed, with its result." />
      <Card>
        <CardContent className="p-4">
          <Input
            className="mb-3 max-w-sm"
            placeholder="Search action, command or target…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Command</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      No activity yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{r.actor || r.channel}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">{r.command}</TableCell>
                      <TableCell className="text-xs">{r.action_key}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">{r.target_label}</TableCell>
                      <TableCell>
                        <Badge variant={r.risk === "high" ? "destructive" : r.risk === "medium" ? "secondary" : "outline"}>
                          {r.risk}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.result === "success" ? "default" : r.result === "failed" ? "destructive" : "secondary"}>
                          {r.result}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
