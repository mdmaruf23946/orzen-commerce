import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listTickets, updateTicket, deleteTicket, listContactRequests, updateContactRequest, listFeedback } from "@/lib/owner-ext.functions";
import { OwnerPageHeader } from "@/components/owner/OwnerPageHeader";
import { Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/owner/support")({ component: Page });

function Page() {
  const [tab, setTab] = useState<"tickets" | "contact" | "feedback">("tickets");
  const tickets = useServerFn(listTickets);
  const contacts = useServerFn(listContactRequests);
  const fbs = useServerFn(listFeedback);
  const upTicket = useServerFn(updateTicket);
  const delTicket = useServerFn(deleteTicket);
  const upContact = useServerFn(updateContactRequest);
  const qc = useQueryClient();

  const tk = useQuery({ queryKey: ["owner", "tickets"], queryFn: () => tickets({ data: { status: "all" } }), enabled: tab === "tickets" });
  const cq = useQuery({ queryKey: ["owner", "contacts"], queryFn: () => contacts(), enabled: tab === "contact" });
  const fb = useQuery({ queryKey: ["owner", "feedback"], queryFn: () => fbs(), enabled: tab === "feedback" });

  return (
    <div>
      <OwnerPageHeader title="Support Center" description="Tickets, contact requests and user feedback." />
      <div className="mb-4 flex gap-2 border-b">
        {(["tickets", "contact", "feedback"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={"px-3 py-2 text-sm capitalize " + (tab === t ? "border-b-2 border-primary font-medium" : "text-muted-foreground")}>{t}</button>
        ))}
      </div>

      {tab === "tickets" && (
        <div className="space-y-2">
          {(tk.data as any[] ?? []).length === 0 && <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No support tickets.</div>}
          {(tk.data as any[] ?? []).map((t) => (
            <div key={t.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.subject}</div>
                  <div className="text-xs text-muted-foreground">{t.stores?.name ?? "—"} · {new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={t.status} onChange={async (e) => { await upTicket({ data: { id: t.id, status: e.target.value as any } }); qc.invalidateQueries({ queryKey: ["owner", "tickets"] }); }} className="rounded-md border bg-background px-2 py-1 text-xs">
                    <option>open</option><option>in_progress</option><option>resolved</option><option>closed</option>
                  </select>
                  <span className={"rounded-full px-2 py-0.5 text-[10px] " + (t.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-muted")}>{t.priority}</span>
                  <Button variant="ghost" size="icon" onClick={async () => { if (confirm("Delete?")) { await delTicket({ data: { id: t.id } }); qc.invalidateQueries({ queryKey: ["owner", "tickets"] }); } }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "contact" && (
        <div className="space-y-2">
          {(cq.data as any[] ?? []).length === 0 && <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No contact requests.</div>}
          {(cq.data as any[] ?? []).map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name} · <span className="text-muted-foreground">{c.email}</span></div>
                  {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.message}</p>
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <select value={c.status} onChange={async (e) => { try { await upContact({ data: { id: c.id, status: e.target.value as any } }); qc.invalidateQueries({ queryKey: ["owner", "contacts"] }); } catch (err) { toast.error((err as Error).message); } }} className="rounded-md border bg-background px-2 py-1 text-xs">
                  <option>new</option><option>in_progress</option><option>resolved</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "feedback" && (
        <div className="space-y-2">
          {(fb.data as any[] ?? []).length === 0 && <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No feedback yet.</div>}
          {(fb.data as any[] ?? []).map((f) => (
            <div key={f.id} className="rounded-xl border bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={"h-3.5 w-3.5 " + (i < (f.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />)}
                <span className="text-xs text-muted-foreground">{f.stores?.name ?? "—"} · {new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              {f.message && <p className="text-sm">{f.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
