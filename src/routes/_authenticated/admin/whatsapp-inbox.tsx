import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Loader2, MessageCircle, Search, Send, User, ArrowLeft, Clock } from "lucide-react";
import {
  listConversations, getConversation, listMessages, markRead, setHandoffMode,
  setConversationStatus, sendManualMessage, sendTemplateMessage, getInboxStats,
  listApprovedTemplates, listCustomerOrders,
} from "@/lib/whatsapp-inbox.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/whatsapp-inbox")({
  component: WhatsappInboxPage,
  head: () => ({
    meta: [
      { title: "WhatsApp Inbox | ORZEN Store Admin" },
      { name: "description", content: "Read and reply to WhatsApp conversations, hand over from AI to a human, and send approved templates." },
      { property: "og:title", content: "WhatsApp Inbox | ORZEN Store Admin" },
      { property: "og:description", content: "Manage every WhatsApp conversation with your customers in one inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FILTERS = ["all", "unread", "open", "waiting", "resolved", "ai", "human"] as const;
type Filter = (typeof FILTERS)[number];

function WhatsappInboxPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listConversations);
  const fetchConv = useServerFn(getConversation);
  const fetchMessages = useServerFn(listMessages);
  const read = useServerFn(markRead);
  const handoff = useServerFn(setHandoffMode);
  const setStatus = useServerFn(setConversationStatus);
  const sendMsg = useServerFn(sendManualMessage);
  const sendTpl = useServerFn(sendTemplateMessage);
  const fetchStats = useServerFn(getInboxStats);
  const fetchTemplates = useServerFn(listApprovedTemplates);
  const fetchOrders = useServerFn(listCustomerOrders);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery({ queryKey: ["wa-inbox", "stats"], queryFn: () => fetchStats(), refetchInterval: 30000 });
  const { data: convs, isLoading } = useQuery({
    queryKey: ["wa-inbox", "list", filter, search],
    queryFn: () => fetchList({ data: { filter, search: search || undefined, limit: 50 } }),
    refetchInterval: 15000,
  });
  const { data: detail } = useQuery({
    queryKey: ["wa-inbox", "conv", activeId],
    queryFn: () => fetchConv({ data: { id: activeId! } }),
    enabled: !!activeId,
    refetchInterval: 15000,
  });
  const { data: messages } = useQuery({
    queryKey: ["wa-inbox", "messages", activeId],
    queryFn: () => fetchMessages({ data: { conversationId: activeId!, limit: 100 } }),
    enabled: !!activeId,
    refetchInterval: 10000,
  });
  const { data: templates } = useQuery({ queryKey: ["wa-inbox", "templates"], queryFn: () => fetchTemplates() });
  const { data: orders } = useQuery({
    queryKey: ["wa-inbox", "orders", activeId],
    queryFn: () => fetchOrders({ data: { conversationId: activeId! } }),
    enabled: !!activeId,
  });

  useEffect(() => {
    if (activeId) void read({ data: { conversationId: activeId } }).then(() => qc.invalidateQueries({ queryKey: ["wa-inbox", "list"] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const conv = (detail as any)?.conv;
  const windowOpen = (detail as any)?.window?.open ?? false;

  async function act(fn: () => Promise<any>, msg?: string) {
    try {
      await fn();
      if (msg) toast.success(msg);
      qc.invalidateQueries({ queryKey: ["wa-inbox"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function send() {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      await sendMsg({ data: { conversationId: activeId, text: draft.trim() } });
      setDraft("");
      qc.invalidateQueries({ queryKey: ["wa-inbox", "messages", activeId] });
      qc.invalidateQueries({ queryKey: ["wa-inbox", "list"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold sm:text-2xl">WhatsApp Inbox</h1>
          <p className="text-sm text-muted-foreground">Every WhatsApp conversation, AI or human handled.</p>
        </div>
        {stats && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>{(stats as any).total} chats</span>
            <span>{(stats as any).unread} unread</span>
            <span>{(stats as any).today} today</span>
          </div>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* List */}
        <aside className={cn("space-y-3", activeId && "hidden lg:block")}>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, number…" />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] capitalize",
                  filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="max-h-[65vh] space-y-1 overflow-y-auto rounded-xl border bg-card p-1">
            {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && !(convs as any[])?.length && (
              <p className="p-3 text-sm text-muted-foreground">No conversations yet.</p>
            )}
            {(convs as any[])?.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full rounded-lg p-2.5 text-left hover:bg-muted",
                  activeId === c.id && "bg-muted",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{c.customer_name || c.phone || c.external_id}</span>
                  {c.handoff_mode === "human" ? (
                    <User className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {c.unread_count > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{c.unread_count}</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.last_message_preview || "—"}</p>
              </button>
            ))}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn("rounded-xl border bg-card", !activeId && "hidden lg:flex lg:items-center lg:justify-center")}>
          {!activeId ? (
            <p className="p-8 text-sm text-muted-foreground">Select a conversation.</p>
          ) : (
            <div className="flex h-[70vh] flex-col">
              <header className="flex flex-wrap items-center gap-2 border-b p-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setActiveId(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{conv?.customer_name || conv?.phone || conv?.external_id}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {windowOpen ? "24h window open" : "24h window closed — use a template"}
                    {orders && (orders as any[]).length ? ` · ${(orders as any[]).length} orders` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={conv?.handoff_mode === "human" ? "default" : "outline"}
                  onClick={() =>
                    act(
                      () => handoff({ data: { conversationId: activeId, mode: conv?.handoff_mode === "human" ? "ai" : "human" } }),
                      conv?.handoff_mode === "human" ? "AI resumed" : "You took over",
                    )
                  }
                >
                  {conv?.handoff_mode === "human" ? "Give back to AI" : "Take over"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    act(
                      () => setStatus({ data: { conversationId: activeId, status: conv?.status === "resolved" ? "open" : "resolved" } }),
                      "Updated",
                    )
                  }
                >
                  {conv?.status === "resolved" ? "Reopen" : "Resolve"}
                </Button>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {(messages as any[])?.map((m) => (
                  <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        m.direction === "out" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content || `[${m.message_type}]`}</p>
                      <p className="mt-1 text-[10px] opacity-70">
                        {new Date(m.created_at).toLocaleTimeString()}
                        {m.delivery_status === "failed" ? ` · failed` : ""}
                      </p>
                      {m.error && <p className="text-[10px] text-destructive">{m.error}</p>}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <footer className="space-y-2 border-t p-3">
                {!windowOpen && !!(templates as any[])?.length && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">Send an approved template:</span>
                    {(templates as any[]).map((t) => (
                      <Button
                        key={t.id}
                        size="sm"
                        variant="outline"
                        onClick={() => act(() => sendTpl({ data: { conversationId: activeId, templateId: t.id } }), "Template sent")}
                      >
                        {t.name}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={windowOpen ? "Write a reply…" : "Window closed — a template is required"}
                    className="min-h-[44px] flex-1 resize-none"
                  />
                  <Button onClick={send} disabled={sending || !draft.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
