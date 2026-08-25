import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { LifeBuoy, Plus, Send, CheckCircle2 } from "lucide-react";
import {
  listMyTickets, getMyTicket, createMyTicket, replyMyTicket, closeMyTicket,
} from "@/lib/store-support.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Support — ORZEN Merchant Panel" },
      { name: "description", content: "Open a support ticket and chat with the ORZEN platform team about your store." },
      { property: "og:title", content: "Support — ORZEN Merchant Panel" },
      { property: "og:description", content: "Open a support ticket and chat with the ORZEN platform team about your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PRIORITIES = ["low", "normal", "high", "urgent"];

function SupportPage() {
  const load = useServerFn(listMyTickets);
  const create = useServerFn(createMyTicket);
  const qc = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin", "support", "tickets"],
    queryFn: () => load(),
  });

  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ subject: "", priority: "normal", message: "" });
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  async function submit() {
    if (form.subject.trim().length < 3 || form.message.trim().length < 3) {
      return toast.error("Please add a subject and a message");
    }
    setBusy(true);
    try {
      const t = (await create({ data: { subject: form.subject, priority: form.priority as any, message: form.message } })) as any;
      toast.success("Ticket created");
      setOpenNew(false);
      setForm({ subject: "", priority: "normal", message: "" });
      qc.invalidateQueries({ queryKey: ["admin", "support", "tickets"] });
      setActiveId(t?.id ?? null);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  const rows = (tickets as any[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <LifeBuoy className="h-5 w-5" /> Support
          </h1>
          <p className="text-sm text-muted-foreground">Ask the ORZEN team for help with your store.</p>
        </div>
        <Button size="sm" onClick={() => setOpenNew(true)}>
          <Plus className="mr-1 h-4 w-4" /> New ticket
        </Button>
      </div>

      <div className="rounded-2xl border bg-card">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No tickets yet. Create one and we will get back to you.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActiveId(t.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.subject}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.updated_at ?? t.created_at).toLocaleString()} · {t.priority}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${t.status === "closed" ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-600"}`}>
                    {t.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New support ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Message</Label><Textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Create ticket"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <TicketThread id={activeId} onClose={() => setActiveId(null)} />
    </div>
  );
}

function TicketThread({ id, onClose }: { id: string | null; onClose: () => void }) {
  const get = useServerFn(getMyTicket);
  const reply = useServerFn(replyMyTicket);
  const close = useServerFn(closeMyTicket);
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["admin", "support", "ticket", id],
    queryFn: () => get({ data: { id: id! } }),
    enabled: !!id,
  });

  const ticket = (data as any)?.ticket;
  const messages = ((data as any)?.messages ?? []) as any[];
  const me = (data as any)?.meUserId;

  async function send() {
    if (!body.trim() || !id) return;
    setBusy(true);
    try {
      await reply({ data: { ticketId: id, body } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin", "support", "ticket", id] });
      qc.invalidateQueries({ queryKey: ["admin", "support", "tickets"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function markClosed() {
    if (!id) return;
    try {
      await close({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin", "support", "tickets"] });
      qc.invalidateQueries({ queryKey: ["admin", "support", "ticket", id] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="pr-8 text-base">{ticket?.subject ?? "Ticket"}</DialogTitle></DialogHeader>
        <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
          {messages.map((m) => {
            const mine = m.author_user_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {mine ? "You" : "ORZEN Support"} · {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {ticket?.status !== "closed" && (
          <div className="space-y-2">
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" />
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={markClosed}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Mark resolved
              </Button>
              <Button size="sm" onClick={send} disabled={busy || !body.trim()}>
                <Send className="mr-1 h-4 w-4" /> Send
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
