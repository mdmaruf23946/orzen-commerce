import { createFileRoute } from "@tanstack/react-router";
import { FeatureGate } from "@/components/admin/FeatureGate";
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
import {
  Send, RefreshCw, User as UserIcon, Bot, Search, ArrowLeft,
  Paperclip, Smile, Zap, Package, X, Plus, BookMarked,
} from "lucide-react";
import {
  listConversations,
  listMessages,
  getConversation,
  markRead,
  setHandoffMode,
  setTags,
  setLeadStatus,
  sendManualMessage,
  retryFailedMessage,
  listNotes,
  saveNote,
  listCustomerOrders,
  getInboxStats,
  listSavedReplies,
  upsertSavedReply,
  deleteSavedReply,
  searchStoreProducts,
  refreshMessengerProfiles,
} from "@/lib/messenger-inbox.functions";
import { compressImage } from "@/lib/compress-image";
import { MessengerMark } from "@/components/admin/brand/MessengerMark";

export const Route = createFileRoute("/_authenticated/admin/messenger-inbox")({
  component: () => (
    <FeatureGate feature="ai_messenger">
      <MessengerInbox />
    </FeatureGate>
  ),
  head: () => ({
    meta: [{ title: "Messenger Inbox — Store Admin" }],
  }),
});

type Filter = "all" | "unread" | "ai" | "human" | "orders";
type LeadStatus = "interested" | "pending" | "ready" | "ordered" | "cancelled" | null;
const EMOJIS = ["😀","😁","😂","🤣","😊","😍","🥰","😘","😎","🤩","🙌","👍","👎","🙏","👏","🔥","✨","💯","❤️","💔","😢","😭","😡","🤔","😴","🎉","🎁","🛒","💰","📦","✅","❌","⏰","📞","💬"];
const LEAD_OPTIONS: { v: Exclude<LeadStatus, null>; label: string; tone: string }[] = [
  { v: "interested", label: "Interested", tone: "bg-blue-100 text-blue-700" },
  { v: "pending", label: "Pending", tone: "bg-amber-100 text-amber-700" },
  { v: "ready", label: "Ready to order", tone: "bg-violet-100 text-violet-700" },
  { v: "ordered", label: "Ordered", tone: "bg-emerald-100 text-emerald-700" },
  { v: "cancelled", label: "Cancelled", tone: "bg-rose-100 text-rose-700" },
];

function timeShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString();
}

// Public HTTPS URL for Meta — served by /api/img/$ (bucket-agnostic proxy).
function toPublicUrl(path: string) {
  if (path.startsWith("http")) return path;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/img/${path}`;
}

// Tiny notification beep — no asset needed.
let audioCtx: AudioContext | null = null;
function beep() {
  try {
    if (typeof window === "undefined") return;
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.16);
  } catch { /* noop */ }
}

function displayName(c: any) {
  const p = c?.psid_profile ?? {};
  return (
    c?.customer_name ||
    p.name ||
    [p.first_name, p.last_name].filter(Boolean).join(" ") ||
    (c?.external_id ? `PSID ${String(c.external_id).slice(-6)}` : "Unknown")
  );
}

/** Facebook profile picture with graceful fallback (CDN links can expire). */
function FbAvatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (!src || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-messenger/10 text-sm font-semibold text-messenger"
        style={{ width: size, height: size }}
      >
        {initial && initial !== "P" ? initial : <UserIcon className="h-4 w-4" />}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function MessengerInbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(listConversations);
  const statsFn = useServerFn(getInboxStats);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastMsgAtRef = useRef<number>(0);

  const conversations = useQuery({
    queryKey: ["mi", "conversations", filter, search],
    queryFn: () => listFn({ data: { filter, search: search || undefined } }),
    refetchInterval: 15_000,
  });
  const stats = useQuery({ queryKey: ["mi", "stats"], queryFn: () => statsFn(), refetchInterval: 30_000 });

  // Facebook profile pictures are signed CDN links that expire, and display
  // names can change — re-sync them from the Graph API periodically.
  const refreshProfilesFn = useServerFn(refreshMessengerProfiles);
  useQuery({
    queryKey: ["mi", "profiles-sync"],
    queryFn: async () => {
      const res = await refreshProfilesFn({ data: {} });
      if (res.length) {
        qc.invalidateQueries({ queryKey: ["mi", "conversations"] });
        qc.invalidateQueries({ queryKey: ["mi", "conv"] });
      }
      return res;
    },
    refetchInterval: 10 * 60_000,
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    const ch = supabase
      .channel("mi-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["mi", "conversations"] });
        qc.invalidateQueries({ queryKey: ["mi", "stats"] });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_messages" },
        (payload: any) => {
          const row = payload?.new;
          if (row?.direction === "in") {
            const t = Date.now();
            if (t - lastMsgAtRef.current > 1500) {
              lastMsgAtRef.current = t;
              beep();
            }
          }
        },
      )
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
    <div className={cn("space-y-4", selectedId && "max-md:flex max-md:h-[calc(100dvh-3.5rem-1rem-70px)] max-md:flex-col max-md:overflow-hidden max-md:space-y-0")}>
      <div className={cn("flex items-center gap-3 rounded-xl border border-messenger/20 bg-messenger/5 p-3", selectedId && "max-md:hidden")}>
        <MessengerMark size={40} />
        <div className="min-w-0">
        <h1 className="text-2xl font-semibold">Messenger Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Total {stats.data?.total ?? 0} · Unread {stats.data?.unread ?? 0} · Today {stats.data?.today ?? 0} ·
          AI {stats.data?.ai_replied ?? 0} · Human {stats.data?.human_replied ?? 0} · Failed{" "}
          {stats.data?.failed ?? 0}
        </p>
        </div>
      </div>

      <div className={cn("grid min-h-0 grid-cols-1 gap-4 md:h-[calc(100vh-180px)] md:grid-cols-[320px_1fr]", selectedId && "max-md:flex-1 max-md:overflow-hidden")}>
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
                    filter === f.id ? "bg-messenger text-messenger-foreground" : "hover:bg-messenger/10",
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
              const name = displayName(c);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b p-3 text-left hover:bg-muted/50",
                    selectedId === c.id && "bg-messenger/10 ring-1 ring-inset ring-messenger/30",
                  )}
                >
                  <FbAvatar src={profile.profile_pic} name={name} size={40} />
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
                      {c.lead_status && (
                        <Badge variant="outline" className="text-[10px] capitalize">{c.lead_status}</Badge>
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
            "flex min-h-0 flex-col rounded-lg border bg-background overflow-hidden",
            selectedId ? "flex max-md:h-full" : "hidden md:flex",
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
  const setTagsFn = useServerFn(setTags);
  const setLeadFn = useServerFn(setLeadStatus);
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
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [quickReplies, setQuickRepliesState] = useState<{ title: string; payload: string }[]>([]);
  const [uploading, setUploading] = useState<string | null>(null); // label of upload in progress
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<"image" | "video" | "audio" | "file">("image");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs.data?.length]);

  const send = useMutation({
    mutationFn: (v: any) => sendFn({ data: v }),
    onSuccess: () => {
      setText("");
      setQuickRepliesState([]);
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
  const storeId: string | undefined = c?.store_id;
  const profile = c?.psid_profile ?? {};
  const name = c?.customer_name || profile.first_name || `PSID ${c?.external_id?.slice(-6)}`;
  const mode = c?.handoff_mode ?? "ai";

  async function handleUpload(file: File) {
    if (!storeId) {
      toast.error("Store not ready");
      return;
    }
    setUploading(file.name);
    try {
      let toUpload = file;
      let kind: "image" | "video" | "audio" | "file" = uploadKind;
      if (file.type.startsWith("image/")) {
        kind = "image";
        toUpload = await compressImage(file);
      } else if (file.type.startsWith("video/")) kind = "video";
      else if (file.type.startsWith("audio/")) kind = "audio";
      else kind = "file";

      const rawExt = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = rawExt.slice(0, 5) || "bin";
      const path = `${storeId}/messenger/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("store-assets").upload(path, toUpload, {
        upsert: false,
        contentType: toUpload.type || "application/octet-stream",
      });
      if (error) throw new Error(error.message);
      const url = toPublicUrl(path);
      await send.mutateAsync({
        conversationId,
        attachmentUrl: url,
        attachmentType: kind,
      });
      toast.success("Attachment sent");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function openPicker(kind: "image" | "video" | "audio" | "file") {
    setUploadKind(kind);
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        kind === "image" ? "image/*"
        : kind === "video" ? "video/*"
        : kind === "audio" ? "audio/*"
        : "*/*";
      fileInputRef.current.click();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* header */}
      <div className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="relative shrink-0">
          <FbAvatar src={profile.profile_pic} name={name} size={36} />
          {typeof (profile as any).is_online === "boolean" && (
            <span
              className={cn(
                "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                (profile as any).is_online ? "bg-green-500" : "bg-muted-foreground/50",
              )}
              aria-label={(profile as any).is_online ? "Online" : "Offline"}
            />
          )}
        </div>
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
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <div ref={scrollRef} className="min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-contain scroll-smooth p-3 pb-24 [-webkit-overflow-scrolling:touch] md:pb-4">

            {(msgs.data ?? []).map((m: any) => {
              const out = m.direction === "out";
              const failed = m.delivery_status === "failed";
              const att = Array.isArray(m.attachments) ? m.attachments[0] : null;
              return (
                <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      out
                        ? failed
                          ? "bg-destructive/10 text-destructive"
                          : "bg-messenger text-messenger-foreground"
                        : "bg-muted",
                    )}
                  >
                    {m.message_type === "image" && att?.url ? (
                      <img src={att.url} alt="" className="mb-1 max-h-60 rounded-md object-cover" />
                    ) : m.message_type === "video" && att?.url ? (
                      <video src={att.url} controls className="mb-1 max-h-60 rounded-md" />
                    ) : m.message_type === "audio" && att?.url ? (
                      <audio src={att.url} controls className="mb-1 w-full" />
                    ) : m.message_type === "file" && att?.url ? (
                      <a href={att.url} target="_blank" rel="noreferrer" className="underline">Attachment</a>
                    ) : m.message_type === "template" && att?.element ? (
                      <div className="mb-1 overflow-hidden rounded-md border bg-background text-foreground">
                        {att.element.image_url && (
                          <img src={att.element.image_url} alt="" className="h-32 w-full object-cover" />
                        )}
                        <div className="p-2">
                          <div className="text-sm font-medium">{att.element.title}</div>
                          {att.element.subtitle && (
                            <div className="text-xs text-muted-foreground">{att.element.subtitle}</div>
                          )}
                        </div>
                      </div>
                    ) : null}
                    {m.content && <div className="whitespace-pre-wrap">{m.content}</div>}
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
          <div className="sticky bottom-0 z-10 shrink-0 space-y-2 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {quickReplies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {quickReplies.map((q, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs">
                    {q.title}
                    <button onClick={() => setQuickRepliesState(quickReplies.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {uploading && (
              <div className="text-xs text-muted-foreground">Uploading {uploading}…</div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-1">
                <IconBtn title="Image" onClick={() => openPicker("image")}><Paperclip className="h-4 w-4" /></IconBtn>
                <IconBtn title="Emoji" onClick={() => setShowEmoji((v) => !v)}><Smile className="h-4 w-4" /></IconBtn>
                <IconBtn title="Quick replies" onClick={() => setShowQuick((v) => !v)}><Zap className="h-4 w-4" /></IconBtn>
                <IconBtn title="Saved replies" onClick={() => setShowSaved((v) => !v)}><BookMarked className="h-4 w-4" /></IconBtn>
                <IconBtn title="Product card" onClick={() => setShowProducts((v) => !v)}><Package className="h-4 w-4" /></IconBtn>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a reply..."
                rows={1}
                className="min-h-[38px] max-h-32 resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && (text.trim() || quickReplies.length)) {
                    e.preventDefault();
                    send.mutate({
                      conversationId,
                      text: text.trim() || undefined,
                      quickReplies: quickReplies.length ? quickReplies : undefined,
                    });
                  }
                }}
              />
              <Button
                className="bg-messenger text-messenger-foreground hover:bg-messenger/90"
                disabled={(!text.trim() && !quickReplies.length) || send.isPending}
                onClick={() =>
                  send.mutate({
                    conversationId,
                    text: text.trim() || undefined,
                    quickReplies: quickReplies.length ? quickReplies : undefined,
                  })
                }
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {showEmoji && (
              <div className="rounded-md border bg-background p-2">
                <div className="flex flex-wrap gap-1">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setText((t) => t + e)}
                      className="rounded p-1 text-lg hover:bg-muted"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showQuick && (
              <QuickReplyBuilder
                value={quickReplies}
                onChange={setQuickRepliesState}
                onClose={() => setShowQuick(false)}
              />
            )}

            {showSaved && (
              <SavedRepliesPanel
                onPick={(body) => {
                  setText((t) => (t ? t + "\n" : "") + body);
                  setShowSaved(false);
                }}
              />
            )}

            {showProducts && (
              <ProductPickerPanel
                onPick={(p) => {
                  send.mutate({
                    conversationId,
                    productCard: {
                      title: p.name,
                      subtitle: `৳${Number(p.price ?? 0).toLocaleString()}`,
                      imageUrl: p.primary_image_url ? toPublicUrl(p.primary_image_url) : undefined,
                    },
                  });
                  setShowProducts(false);
                }}
              />
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
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
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Lead status</div>
            <div className="flex flex-wrap gap-1">
              {LEAD_OPTIONS.map((o) => {
                const active = c?.lead_status === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => {
                      setLeadFn({ data: { conversationId, status: active ? null : o.v } }).then(() => {
                        qc.invalidateQueries({ queryKey: ["mi", "conv", conversationId] });
                        qc.invalidateQueries({ queryKey: ["mi", "conversations"] });
                      });
                    }}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      active ? o.tone + " border-transparent" : "hover:bg-muted",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Tags</div>
            <TagsEditor
              value={(c?.tags as string[]) ?? []}
              onChange={(tags) => {
                setTagsFn({ data: { conversationId, tags } }).then(() => {
                  qc.invalidateQueries({ queryKey: ["mi", "conv", conversationId] });
                  qc.invalidateQueries({ queryKey: ["mi", "conversations"] });
                });
              }}
            />
          </div>

          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Orders</div>
            {(orders.data ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">No matched orders.</div>
            )}
            {(orders.data ?? []).map((o: any) => (
              <div key={o.id} className="mb-1 rounded border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{o.invoice_no || o.id.slice(0, 8)}</div>
                  <button
                    className="text-[10px] underline"
                    onClick={() =>
                      send.mutate({
                        conversationId,
                        orderCard: {
                          orderId: o.invoice_no || o.id,
                          status: o.status,
                          total: Number(o.subtotal ?? 0),
                          url: typeof window !== "undefined"
                            ? `${window.location.origin}/admin/orders`
                            : undefined,
                        },
                      })
                    }
                  >
                    Send
                  </button>
                </div>
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

function IconBtn({
  title, children, onClick,
}: { title: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function TagsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px]">
            {t}
            <button onClick={() => onChange(value.filter((x) => x !== t))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              const v = input.trim().slice(0, 40);
              if (!value.includes(v)) onChange([...value, v].slice(0, 20));
              setInput("");
            }
          }}
          placeholder="Add tag"
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}

function QuickReplyBuilder({
  value, onChange, onClose,
}: {
  value: { title: string; payload: string }[];
  onChange: (v: { title: string; payload: string }[]) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <div className="rounded-md border bg-background p-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium">Quick replies (max 13)</span>
        <button onClick={onClose}><X className="h-3 w-3" /></button>
      </div>
      <div className="flex gap-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Button label"
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              e.preventDefault();
              const t = title.trim().slice(0, 20);
              if (value.length < 13) onChange([...value, { title: t, payload: t.toUpperCase() }]);
              setTitle("");
            }
          }}
        />
        <Button
          size="sm"
          type="button"
          disabled={!title.trim() || value.length >= 13}
          onClick={() => {
            const t = title.trim().slice(0, 20);
            onChange([...value, { title: t, payload: t.toUpperCase() }]);
            setTitle("");
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Send with your message to show tappable buttons under the reply.
      </p>
    </div>
  );
}

function SavedRepliesPanel({ onPick }: { onPick: (body: string) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSavedReplies);
  const upsertFn = useServerFn(upsertSavedReply);
  const delFn = useServerFn(deleteSavedReply);
  const q = useQuery({ queryKey: ["mi", "saved"], queryFn: () => listFn() });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: () => upsertFn({ data: { title: title.trim(), body: body.trim(), sort: 0 } }),
    onSuccess: () => {
      setTitle(""); setBody("");
      qc.invalidateQueries({ queryKey: ["mi", "saved"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mi", "saved"] }),
  });
  return (
    <div className="max-h-64 overflow-y-auto rounded-md border bg-background p-2 text-xs">
      <div className="mb-2 space-y-1">
        {(q.data ?? []).map((r: any) => (
          <div key={r.id} className="flex items-start justify-between gap-2 rounded border p-2">
            <button className="flex-1 text-left" onClick={() => onPick(r.body)}>
              <div className="font-medium">{r.title}</div>
              <div className="line-clamp-2 text-muted-foreground">{r.body}</div>
            </button>
            <button className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(r.id)}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {q.data?.length === 0 && (
          <div className="p-2 text-center text-muted-foreground">No saved replies yet.</div>
        )}
      </div>
      <div className="space-y-1 border-t pt-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-8 text-xs" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" className="min-h-[50px] text-xs" />
        <Button size="sm" disabled={!title.trim() || !body.trim() || add.isPending} onClick={() => add.mutate()}>
          <Plus className="mr-1 h-3 w-3" /> Save reply
        </Button>
      </div>
    </div>
  );
}

function ProductPickerPanel({ onPick }: { onPick: (p: any) => void }) {
  const searchFn = useServerFn(searchStoreProducts);
  const [q, setQ] = useState("");
  const products = useQuery({
    queryKey: ["mi", "products", q],
    queryFn: () => searchFn({ data: { query: q } }),
  });
  return (
    <div className="max-h-64 overflow-y-auto rounded-md border bg-background p-2 text-xs">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products"
        className="mb-2 h-8 text-xs"
      />
      <div className="space-y-1">
        {(products.data ?? []).map((p: any) => (
          <button
            key={p.id}
            onClick={() => onPick(p)}
            className="flex w-full items-center gap-2 rounded border p-2 text-left hover:bg-muted/50"
          >
            {p.primary_image_url ? (
              <img src={toPublicUrl(p.primary_image_url)} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <div className="h-10 w-10 rounded bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.name}</div>
              <div className="text-muted-foreground">৳{Number(p.price ?? 0).toLocaleString()}</div>
            </div>
          </button>
        ))}
        {products.data?.length === 0 && (
          <div className="p-2 text-center text-muted-foreground">No products.</div>
        )}
      </div>
    </div>
  );
}
