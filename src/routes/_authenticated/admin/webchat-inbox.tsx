import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Bot, Globe, Loader2, Search, Send, User } from "lucide-react";
import { FeatureGate } from "@/components/admin/FeatureGate";
import {
  listWebConversations, listWebMessages, setWebHandoff, sendWebManualMessage,
} from "@/lib/webchat-inbox.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/webchat-inbox")({
  component: () => (
    <FeatureGate feature="ai_agent">
      <WebchatInbox />
    </FeatureGate>
  ),
  head: () => ({
    meta: [
      { title: "Web Chat Inbox — ORZEN Merchant Panel" },
      { name: "description", content: "Every website chat conversation, failed replies and manual answers in one inbox." },
      { property: "og:title", content: "Web Chat Inbox — ORZEN Merchant Panel" },
      { property: "og:description", content: "Every website chat conversation in one inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const FILTERS = [
  { v: "all", label: "All" },
  { v: "unread", label: "Unread" },
  { v: "ai", label: "AI" },
  { v: "human", label: "Human" },
  { v: "failed", label: "Failed" },
] as const;
type Filter = (typeof FILTERS)[number]["v"];

function timeShort(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString();
}

function WebchatInbox() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listWebConversations);
  const fetchMsgs = useServerFn(listWebMessages);
  const handoff = useServerFn(setWebHandoff);
  const send = useServerFn(sendWebManualMessage);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: convs = [], isLoading } = useQuery({
    queryKey: ["webchat-inbox", filter, search],
    queryFn: () => fetchList({ data: { filter, search: search || undefined } }),
    refetchInterval: 8000,
  });
  const active = (convs as any[]).find((c) => c.id === activeId);
  const { data: msgs = [] } = useQuery({
    queryKey: ["webchat-msgs", activeId],
    queryFn: () => fetchMsgs({ data: { conversationId: activeId! } }),
    enabled: !!activeId,
    refetchInterval: 5000,
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function onSend() {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      await send({ data: { conversationId: activeId, text: draft.trim() } });
      setDraft("");
      qc.invalidateQueries({ queryKey: ["webchat-msgs", activeId] });
      qc.invalidateQueries({ queryKey: ["webchat-inbox"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function toggleMode() {
    if (!active) return;
    const mode = active.handoff_mode === "human" ? "ai" : "human";
    await handoff({ data: { conversationId: active.id, mode } });
    toast.success(mode === "human" ? "আপনি এখন নিজে উত্তর দেবেন" : "AI আবার উত্তর দেবে");
    qc.invalidateQueries({ queryKey: ["webchat-inbox"] });
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] max-w-6xl overflow-hidden rounded-xl border bg-card">
      <aside className={cn("flex w-full flex-col border-r md:w-80", activeId && "hidden md:flex")}>
        <div className="space-y-2 border-b p-3">
          <div className="flex items-center gap-2 font-semibold"><Globe className="h-4 w-4" />Web Chat Inbox</div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Button key={f.v} size="sm" variant={filter === f.v ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setFilter(f.v)}>
                {f.v === "failed" && <AlertTriangle className="mr-1 h-3 w-3" />}{f.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="p-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>}
          {!isLoading && !(convs as any[]).length && <div className="p-6 text-center text-sm text-muted-foreground">কোনো কথোপকথন নেই।</div>}
          {(convs as any[]).map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={cn("w-full border-b p-3 text-left hover:bg-muted/50", c.id === activeId && "bg-muted")}>
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{c.customer_name || `Visitor ${c.id.slice(0, 4)}`}</span>
                {c.handoff_mode === "human" && <span className="rounded bg-accent px-1.5 text-[10px]">Human</span>}
                {c.unread_count > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{c.unread_count}</span>}
                <span className="ml-auto text-[11px] text-muted-foreground">{timeShort(c.last_message_at ?? c.created_at)}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">{c.last_message_preview || "—"}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className={cn("flex flex-1 flex-col", !activeId && "hidden md:flex")}>
        {!active ? (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">একটি কথোপকথন বাছাই করুন</div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-3">
              <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setActiveId(null)}><ArrowLeft className="h-4 w-4" /></Button>
              <div className="flex-1 truncate font-medium">{active.customer_name || `Visitor ${active.id.slice(0, 4)}`}{active.phone ? ` · ${active.phone}` : ""}</div>
              <Button size="sm" variant="outline" onClick={toggleMode}>
                {active.handoff_mode === "human" ? <><Bot className="mr-1 h-4 w-4" />AI-কে দিন</> : <><User className="mr-1 h-4 w-4" />নিজে উত্তর দিন</>}
              </Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {(msgs as any[]).map((m) => {
                if (m.message_type === "error") {
                  return (
                    <div key={m.id} className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>উত্তর পাঠানো যায়নি — {String(m.content).slice(0, 200)}</span>
                    </div>
                  );
                }
                const mine = m.direction === "out" || m.role === "assistant";
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      {m.content}
                      <div className="mt-1 text-[10px] opacity-70">{m.sent_by_user_id ? "You" : mine ? "AI" : "Customer"} · {timeShort(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 border-t p-3">
              <Textarea rows={1} value={draft} placeholder="উত্তর লিখুন…" onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); } }} />
              <Button onClick={onSend} disabled={sending || !draft.trim()}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
