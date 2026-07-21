import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Send, RefreshCw, User as UserIcon, Bot, Search, ArrowLeft } from "lucide-react";
import {
  listConversations,
  listMessages,
  getConversation,
  markRead,
  setHandoffMode,
  sendManualMessage,
  retryFailedMessage,
  listNotes,
  saveNote,
  listCustomerOrders,
  getInboxStats,
} from "@/lib/messenger-inbox.functions";

export const Route = createFileRoute("/_authenticated/admin/messenger-inbox")({
  component: MessengerInbox,
  head: () => ({
    meta: [{ title: "Messenger Inbox — Store Admin" }],
  }),
});

type Filter = "all" | "unread" | "ai" | "human" | "orders";

function timeShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString();
}

function MessengerInbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(listConversations);
  const statsFn = useServerFn(getInboxStats);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const conversations = useQuery({
    queryKey: ["mi", "conversations", filter, search],
    queryFn: () => listFn({ data: { filter, search: search || undefined } }),
    refetchInterval: 15_000,
  });
  const stats = useQuery({ queryKey: ["mi", "stats"], queryFn: () => statsFn(), refetchInterval: 30_000 });

  // Realtime — refresh list on any change
  useEffect(() => {
    const ch = supabase
      .channel("mi-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["mi", "conversations"] });
        qc.invalidateQueries({ queryKey: ["mi", "stats"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "ai", label: "AI" },
    { id: "human", label: "Human" },
    { id: "orders", label: "Orders" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Messenger Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Total {stats.data?.total ?? 0} · Unread {stats.data?.unread ?? 0} · Today {stats.data?.today ?? 0} ·
          AI {stats.data?.ai_replied ?? 0} · Human {stats.data?.human_replied ?? 0} · Failed{" "}
          {stats.data?.failed ?? 0}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr] md:h-[calc(100vh-180px)]">
        {/* List */}
        <aside
          className={cn(
            "flex flex-col rounded-lg border bg-background overflow-hidden",
            selectedId ? "hidden md:flex" : "flex",
          )}
        >
          <div className="border-b p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, PSID"
                className="pl-8 h-9"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs border",
                    filter === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(conversations.data ?? []).map((c: any) => {
              const profile = c.psid_profile ?? {};
              const name = c.customer_name || profile.first_name || `PSID ${c.external_id?.slice(-6)}`;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b p-3 text-left hover:bg-muted/50",
                    selectedId === c.id && "bg-muted",
                  )}
                >
                  {profile.profile_pic ? (
                    <img
                      src={profile.profile_pic}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <UserIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeShort(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {c.last_message_preview || "—"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <Badge variant={c.handoff_mode === "human" ? "default" : "secondary"} className="text-[10px]">
                        {c.handoff_mode === "human" ? "HUMAN" : "AI"}
                      </Badge>
                      {c.unread_count > 0 && (
                        <Badge className="text-[10px]">{c.unread_count}</Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {conversations.data?.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</div>
            )}
          </div>
        </aside>

        {/* Chat */}
        <section
          className={cn(
            "flex flex-col rounded-lg border bg-background overflow-hidden",
            selectedId ? "flex" : "hidden md:flex",
          )}
        >
          {selectedId ? (
            <ChatPane
              key={selectedId}
              conversationId={selectedId}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ChatPane({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const getConvFn = useServerFn(getConversation);
  const listMsgFn = useServerFn(listMessages);
  const markReadFn = useServerFn(markRead);
  const setModeFn = useServerFn(setHandoffMode);
  const sendFn = useServerFn(sendManualMessage);
  const retryFn = useServerFn(retryFailedMessage);
  const listNotesFn = useServerFn(listNotes);
  const saveNoteFn = useServerFn(saveNote);
  const listOrdersFn = useServerFn(listCustomerOrders);

  const conv = useQuery({
    queryKey: ["mi", "conv", conversationId],
    queryFn: () => getConvFn({ data: { id: conversationId } }),
  });
  const msgs = useQuery({
    queryKey: ["mi", "msgs", conversationId],
    queryFn: () => listMsgFn({ data: { conversationId } }),
    refetchInterval: 8_000,
  });
  const notes = useQuery({
    queryKey: ["mi", "notes", conversationId],
    queryFn: () => listNotesFn({ data: { conversationId } }),
  });
  const orders = useQuery({
    queryKey: ["mi", "orders", conversationId],
    queryFn: () => listOrdersFn({ data: { conversationId } }),
  });

  useEffect(() => {
    markReadFn({ data: { conversationId } }).catch(() => {});
  }, [conversationId, markReadFn]);

  useEffect(() => {
    const ch = supabase
      .channel(`mi-msgs-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["mi", "msgs", conversationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, qc]);

  const [text, setText] = useState("");
  const [newNote, setNewNote] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs.data?.length]);

  const send = useMutation({
    mutationFn: (v: { text: string }) => sendFn({ data: { conversationId, text: v.text } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["mi", "msgs", conversationId] });
      qc.invalidateQueries({ queryKey: ["mi", "conversations"] });
    },
    onError: (e: any) => toast.error(e.message || "Send failed"),
  });

  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { messageId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mi", "msgs", conversationId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMode = useMutation({
    mutationFn: (mode: "ai" | "human") => setModeFn({ data: { conversationId, mode } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mi", "conv", conversationId] });
      qc.invalidateQueries({ queryKey: ["mi", "conversations"] });
    },
  });

  const saveN = useMutation({
    mutationFn: (body: string) => saveNoteFn({ data: { conversationId, body } }),
    onSuccess: () => {
      setNewNote("");
      qc.invalidateQueries({ queryKey: ["mi", "notes", conversationId] });
    },
  });

  const c = conv.data?.conv as any;
  const profile = c?.psid_profile ?? {};
  const name = c?.customer_name || profile.first_name || `PSID ${c?.external_id?.slice(-6)}`;
  const mode = c?.handoff_mode ?? "ai";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 border-b p-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {profile.profile_pic ? (
          <img src={profile.profile_pic} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <UserIcon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">PSID {c?.external_id}</div>
        </div>
        <Button
          size="sm"
          variant={mode === "human" ? "default" : "outline"}
          onClick={() => toggleMode.mutate(mode === "ai" ? "human" : "ai")}
        >
          {mode === "human" ? "HUMAN" : "AI"}
        </Button>
      </div>

      {/* messages + profile */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {(msgs.data ?? []).map((m: any) => {
              const out = m.direction === "out";
              const failed = m.delivery_status === "failed";
              return (
                <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      out
                        ? failed
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    {m.message_type === "image" && m.attachments?.[0]?.url ? (
                      <img
                        src={m.attachments[0].url}
                        alt=""
                        className="mb-1 max-h-60 rounded-md object-cover"
                      />
                    ) : m.message_type === "video" && m.attachments?.[0]?.url ? (
                      <video src={m.attachments[0].url} controls className="mb-1 max-h-60 rounded-md" />
                    ) : m.message_type === "audio" && m.attachments?.[0]?.url ? (
                      <audio src={m.attachments[0].url} controls className="mb-1 w-full" />
                    ) : m.message_type === "file" && m.attachments?.[0]?.url ? (
                      <a
                        href={m.attachments[0].url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Attachment
                      </a>
                    ) : null}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
                      <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                      {out && <span>{m.delivery_status}</span>}
                      {out && !m.sent_by_user_id && <Bot className="h-3 w-3" />}
                      {failed && (
                        <button
                          onClick={() => retry.mutate(m.id)}
                          className="inline-flex items-center gap-1 underline"
                        >
                          <RefreshCw className="h-3 w-3" /> Retry
                        </button>
                      )}
                    </div>
                    {failed && m.error && (
                      <div className="mt-1 text-[10px] text-destructive">{m.error}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* composer */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a reply..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                    e.preventDefault();
                    send.mutate({ text: text.trim() });
                  }
                }}
              />
              <Button
                disabled={!text.trim() || send.isPending}
                onClick={() => send.mutate({ text: text.trim() })}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* right rail */}
        <aside className="hidden overflow-y-auto border-l p-3 text-sm lg:block">
          <div className="mb-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Customer</div>
            <div className="mt-1">{name}</div>
            {c?.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
            <div className="mt-1 text-xs text-muted-foreground">
              First contact: {c?.first_contact_at ? new Date(c.first_contact_at).toLocaleString() : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              Orders: {c?.total_orders ?? 0} · Spent ৳{Number(c?.total_spent ?? 0).toLocaleString()}
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Orders</div>
            {(orders.data ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">No matched orders.</div>
            )}
            {(orders.data ?? []).map((o: any) => (
              <div key={o.id} className="mb-1 rounded border p-2 text-xs">
                <div className="font-medium">{o.invoice_no || o.id.slice(0, 8)}</div>
                <div className="text-muted-foreground">
                  {o.status} · ৳{Number(o.subtotal ?? 0)}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Notes</div>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="min-h-[60px] text-sm"
            />
            <Button
              size="sm"
              className="mt-1"
              disabled={!newNote.trim() || saveN.isPending}
              onClick={() => saveN.mutate(newNote.trim())}
            >
              Add note
            </Button>
            <div className="mt-2 space-y-1">
              {(notes.data ?? []).map((n: any) => (
                <div key={n.id} className="rounded border p-2 text-xs">
                  <div className="whitespace-pre-wrap">{n.body}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
