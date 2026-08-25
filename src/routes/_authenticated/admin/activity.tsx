import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { History, User } from "lucide-react";
import { listActivity, listEmployees } from "@/lib/employees.functions";
import { PANEL_SECTIONS } from "@/lib/panel-sections";
import { useStoreAccess } from "@/lib/use-store-access";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  component: ActivityPage,
  head: () => ({
    meta: [
      { title: "Activity Log — ORZEN Merchant Panel" },
      { name: "description", content: "See which employee or merchant performed each important action in your store, and when." },
      { property: "og:title", content: "Activity Log — ORZEN Merchant Panel" },
      { property: "og:description", content: "See which employee or merchant performed each important action in your store, and when." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string; actor_name: string; actor_kind: string; actor_staff_id: string | null;
  section: string; action: string; summary: string; created_at: string;
};

function ActivityPage() {
  const load = useServerFn(listActivity);
  const loadStaff = useServerFn(listEmployees);
  const { isOwner } = useStoreAccess();
  const [actor, setActor] = useState("all");
  const [section, setSection] = useState("all");
  const [days, setDays] = useState("30");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "activity", actor, section, days],
    queryFn: () =>
      load({
        data: {
          ...(actor !== "all" ? { actor } : {}),
          ...(section !== "all" ? { section } : {}),
          days: Number(days),
          limit: 200,
        },
      }),
  });

  const { data: staffData } = useQuery({
    queryKey: ["admin", "employees"],
    queryFn: () => loadStaff(),
    enabled: isOwner,
  });

  const rows = ((data as any)?.rows ?? []) as Row[];
  const staff = ((staffData as any)?.rows ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <History className="h-5 w-5" /> Activity Log
        </h1>
        <p className="text-sm text-muted-foreground">Important actions performed in your store, by you and your team.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {isOwner && (
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Everyone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All sections" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {PANEL_SECTIONS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border bg-card">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No activity recorded for this period.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3 p-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{r.summary}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.actor_name} · {PANEL_SECTIONS.find((s) => s.key === r.section)?.label ?? r.section} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                  {r.actor_kind}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
