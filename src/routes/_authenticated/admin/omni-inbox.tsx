import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Bot, Crown, Globe, Inbox, Info, Loader2, Package, Plus, Search, Send, User } from "lucide-react";
import { OmniCustomerPanel } from "@/components/admin/OmniCustomerPanel";
import { OmniProductPicker } from "@/components/admin/OmniProductPicker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FeatureGate } from "@/components/admin/FeatureGate";
import { listOmniConversations, listOmniMessages, setOmniHandoff } from "@/lib/omni-inbox.functions";
import { OMNI_CHANNELS, OMNI_FOLDERS, type OmniFolder } from "@/lib/omni-channels";
import { sendManualMessage as sendMessenger, refreshMessengerProfiles } from "@/lib/messenger-inbox.functions";
import { sendManualMessage as sendWhatsapp } from "@/lib/whatsapp-inbox.functions";
import { sendWebManualMessage } from "@/lib/webchat-inbox.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/omni-inbox")({
  component: () => (
    <FeatureGate feature="ai_agent">
      <OmniInbox />
    </FeatureGate>
  ),
  head: () => ({
    meta: [
      { title: "Omni Inbox — ORZEN Merchant Panel" },
      { name: "description", content: "Messenger, WhatsApp and website chats in one professional inbox." },
      { property: "og:title", content: "Omni Inbox — ORZEN Merchant Panel" },
      { property: "og:description", content: "Every customer conversation from every channel in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

// Official brand marks (fixed brand colours are part of the logos).
function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  if (channel === "messenger")
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="Messenger">
        <circle cx="12" cy="12" r="12" fill="#0866FF" />
        <path fill="#fff" d="M12 5.2c-3.9 0-6.9 2.8-6.9 6.6 0 2 .8 3.7 2.2 4.9v2.3l2.1-1.2c.8.2 1.7.3 2.6.3 3.9 0 6.9-2.8 6.9-6.3S15.9 5.2 12 5.2Zm.7 8.6-1.8-1.9-3.4 1.9 3.8-4 1.8 1.9 3.4-1.9-3.8 4Z" />
      </svg>
    );
  if (channel === "whatsapp")
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="WhatsApp">
        <circle cx="12" cy="12" r="12" fill="#25D366" />
        <path fill="#fff" d="M12 5.5a6.4 6.4 0 0 0-5.5 9.7l-.9 3.3 3.4-.9A6.4 6.4 0 1 0 12 5.5Zm3.7 9c-.2.4-.9.8-1.3.9-.3 0-.7.1-2.3-.5a8 8 0 0 1-3.1-2.8c-.3-.4-.7-1.1-.7-1.9s.4-1.2.6-1.4c.1-.2.3-.2.4-.2h.3c.1 0 .3 0 .4.3l.6 1.4c0 .1.1.2 0 .4l-.2.3-.3.3c-.1.1-.2.2-.1.4.2.3.6 1 1.2 1.5.8.7 1.4.9 1.6 1 .2.1.3.1.4 0l.6-.7c.1-.2.3-.2.4-.1l1.3.6c.2.1.3.1.3.2.1.1.1.5-.1.9Z" />
      </svg>
    );
  return (
    <span className={cn("grid place-items-center rounded-full bg-primary text-primary-foreground", className)} aria-label="Website">
      <Globe className="h-[65%] w-[65%]" />
    </span>
  );
}

function timeShort(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "এখন";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}মি`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}ঘ`;
  return new Date(iso).toLocaleDateString();
}

function nameOf(c: any) {
  return c.customer_name || c.phone || (c.channel === "web" ? `Visitor ${c.id.slice(0, 4)}` : `Customer ${c.id.slice(0, 4)}`);
}

const SEGMENT: Record<string, { label: string; cls: string }> = {
  customer: { label: "ক্রেতা", cls: "bg-primary/10 text-primary" },
  interested: { label: "আগ্রহী", cls: "bg-accent text-accent-foreground" },
  incomplete: { label: "অসম্পূর্ণ", cls: "bg-secondary text-secondary-foreground" },
  hold: { label: "হোল্ড", cls: "bg-destructive/10 text-destructive" },
};

/** Real profile photo when the channel gives one; initial letter otherwise. */
function Avatar({ c, className }: { c: any; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (c.profile_pic && !broken)
    return <img src={c.profile_pic} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cn("rounded-full object-cover", className)} />;
  return (
    <div className={cn("grid place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground", className)}>
      {nameOf(c).slice(0, 1).toUpperCase()}
    </div>
  );
}

function OmniInbox() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listOmniConversations);
  const fetchMsgs = useServerFn(listOmniMessages);
  const handoff = useServerFn(setOmniHandoff);
  const sendFb = useServerFn(sendMessenger);
  const sendWa = useServerFn(sendWhatsapp);
  const sendWeb = useServerFn(sendWebManualMessage);

  const [channel, setChannel] = useState<string>("all");
  const [folder, setFolder] = useState<OmniFolder>("all");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["omni-inbox", channel, folder, search],
    queryFn: () => fetchList({ data: { channel, folder, search: search || undefined } }),
    refetchInterval: 6000,
  });
  const convs = (data?.rows ?? []) as any[];

  // Pull real Facebook name + photo for Messenger customers missing them (server caches 6h).
  const refreshFb = useServerFn(refreshMessengerProfiles);
  const askedRef = useRef(new Set<string>());
  useEffect(() => {
    const ids = convs
      .filter((c) => c.channel === "messenger" && (!c.profile_pic || !c.customer_name) && !askedRef.current.has(c.id))
      .map((c) => c.id)
      .slice(0, 30);
    if (!ids.length) return;
    ids.forEach((id) => askedRef.current.add(id));
    refreshFb({ data: { ids } })
      .then((r: any[]) => { if (r?.some((x) => x.profile_pic || x.name)) qc.invalidateQueries({ queryKey: ["omni-inbox"] }); })
      .catch(() => {});
  }, [convs, refreshFb, qc]);
  const counts = (data?.counts ?? {}) as Record<string, number>;
  const active = convs.find((c) => c.id === activeId) ?? (activeConv?.id === activeId ? activeConv : null);

  const { data: msgs = [] } = useQuery({
    queryKey: ["omni-msgs", activeId],
    queryFn: () => fetchMsgs({ data: { conversationId: activeId! } }),
    enabled: !!activeId,
    refetchInterval: 4000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, activeId]);

  function open(c: any) {
    setActiveId(c.id);
    setActiveConv(c);
  }

  async function onSend() {
    if (!active || !draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    try {
      const payload = { data: { conversationId: active.id, text } };
      if (active.channel === "messenger") await sendFb(payload as any);
      else if (active.channel === "whatsapp") await sendWa(payload as any);
      else await sendWeb(payload);
      setDraft("");
      qc.invalidateQueries({ queryKey: ["omni-msgs", active.id] });
      qc.invalidateQueries({ queryKey: ["omni-inbox"] });
    } catch (e) {
      toast.error((e as Error).message || "মেসেজ পাঠানো যায়নি");
    } finally {
      setSending(false);
    }
  }

  async function toggleMode() {
    if (!active) return;
    const mode = active.handoff_mode === "human" ? "ai" : "human";
    try {
      await handoff({ data: { conversationId: active.id, mode } });
      setActiveConv({ ...active, handoff_mode: mode });
      toast.success(mode === "human" ? "এখন আপনি নিজে উত্তর দেবেন" : "AI আবার উত্তর দেবে");
      qc.invalidateQueries({ queryKey: ["omni-inbox"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const tabs = [{ key: "all", label: "All" }, ...OMNI_CHANNELS];

  return (
    <div className="flex flex-col h-[calc(100dvh-9rem)] overflow-hidden rounded-xl border bg-card shadow-sm md:-mx-6 md:-mt-6 md:-mb-8 md:h-[calc(100dvh-4rem)] md:rounded-none md:border-0 md:shadow-none lg:-mx-8 lg:-mt-8">
          {/* Smart folders */}
          <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b bg-card px-3 py-2 [scrollbar-width:none]">
            {OMNI_FOLDERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFolder(f.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border whitespace-nowrap px-3 py-1 text-xs transition-colors",
                  folder === f.key ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {f.key === "human" && <User className="h-3 w-3" />}
                {f.key === "vip" && <Crown className="h-3 w-3" />}
                {f.key === "attention" && <AlertTriangle className="h-3 w-3" />}
                {f.key === "ai" && <Bot className="h-3 w-3" />}
                {f.label}
              </button>
            ))}
          </div>
      <div className="flex min-h-0 flex-1">
      {/* Conversation list */}
      <aside className={cn("flex w-full min-w-0 flex-col border-r md:w-[360px]", activeId && "hidden md:flex")}>
        <div className="space-y-3 border-b p-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <div className="font-semibold leading-tight">Omni Inbox</div>
              <div className="truncate text-xs text-muted-foreground">সব customer conversation এক জায়গায়</div>
            </div>
          </div>

          {/* Channel line */}
          <div className="-mx-3 flex items-center gap-2 overflow-x-auto border-b px-3 pb-2 pt-1 [scrollbar-width:none]">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setChannel(t.key)}
                title={t.label}
                aria-label={t.label}
                aria-pressed={channel === t.key}
                className={cn(
                  "relative grid h-12 w-12 shrink-0 place-items-center rounded-full transition-all",
                  channel === t.key ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "opacity-90 hover:opacity-100",
                )}
              >
                {t.key === "all" ? (
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">All</span>
                ) : (
                  <ChannelIcon channel={t.key} className="h-12 w-12" />
                )}
                {!!counts[t.key] && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-card">
                    {counts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-9 pl-8" placeholder="নাম, ফোন বা মেসেজ খুঁজুন…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          )}
          {!isLoading && !convs.length && (
            <div className="p-8 text-center text-sm text-muted-foreground">এখানে কোনো কথোপকথন নেই।</div>
          )}
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => open(c)}
              className={cn("flex w-full gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/50", c.id === activeId && "bg-muted")}
            >
              <div className="relative shrink-0">
                <Avatar c={c} className="h-11 w-11" />
                <ChannelIcon channel={c.channel} className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full ring-2 ring-card" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cn("truncate text-sm", c.unread_count > 0 ? "font-semibold" : "font-medium")}>{nameOf(c)}</span>
                  {c.vip && <Crown className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="VIP" />}
                  {c.segment && SEGMENT[c.segment] && (
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", SEGMENT[c.segment].cls)}>{SEGMENT[c.segment].label}</span>
                  )}
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeShort(c.last_message_at ?? c.created_at)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={cn("truncate text-xs", c.unread_count > 0 ? "text-foreground" : "text-muted-foreground")}>
                    {c.last_message_preview || "—"}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    {c.failed && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="পাঠানো যায়নি" />}
                    {c.handoff_mode === "human" && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">Human</span>}
                    {c.unread_count > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{c.unread_count}</span>
                    )}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat thread */}
      <section className={cn("flex min-w-0 flex-1 flex-col", !activeId && "hidden md:flex")}>
        {!active ? (
          <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
            <div>
              <Inbox className="mx-auto mb-2 h-10 w-10 opacity-40" />
              বাম পাশ থেকে একটি কথোপকথন বাছাই করুন
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-3">
              <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setActiveId(null)} aria-label="ফিরে যান">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="relative shrink-0">
                <Avatar c={active} className="h-9 w-9" />
                <ChannelIcon channel={active.channel} className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ring-2 ring-card" />
              </div>
              <button type="button" onClick={() => setInfoOpen(true)} className="min-w-0 flex-1 text-left xl:pointer-events-none" aria-label="কাস্টমার তথ্য দেখুন">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  <span className="truncate">{nameOf(active)}</span>
                  {active.vip && <Crown className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {OMNI_CHANNELS.find((x) => x.key === active.channel)?.label}
                  {active.phone ? ` · ${active.phone}` : ""}
                  {active.total_orders ? ` · ${active.total_orders} অর্ডার` : ""}
                </div>
              </button>
              <Button size="icon" variant="ghost" className="shrink-0 xl:hidden" onClick={() => setInfoOpen(true)} aria-label="কাস্টমার তথ্য">
                <Info className="h-4 w-4" />
              </Button>
              <Button size="sm" variant={active.handoff_mode === "human" ? "default" : "outline"} onClick={toggleMode} className="shrink-0">
                {active.handoff_mode === "human" ? (
                  <><Bot className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">AI-কে দিন</span></>
                ) : (
                  <><User className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">নিজে উত্তর দিন</span></>
                )}
              </Button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3 sm:p-4">
              {(msgs as any[]).map((m) => {
                const failed = m.message_type === "error" || m.delivery_status === "failed";
                if (m.message_type === "error") {
                  return (
                    <div key={m.id} className="mx-auto flex max-w-md items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>উত্তর পাঠানো যায়নি — {String(m.content ?? "").slice(0, 200)}</span>
                    </div>
                  );
                }
                const mine = m.direction === "out" || m.role === "assistant";
                const img = Array.isArray(m.attachments) ? m.attachments.find((a: any) => a?.type === "image" && a?.url) : null;
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                        mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card",
                        failed && "ring-1 ring-destructive",
                      )}
                    >
                      {img && <img src={img.url} alt="" className="mb-1 max-h-56 rounded-lg" loading="lazy" />}
                      {m.content}
                      <div className="mt-1 text-[10px] opacity-70">
                        {m.sent_by_user_id ? "আপনি" : mine ? "AI" : "Customer"} · {timeShort(m.created_at)}
                        {failed && " · পাঠানো যায়নি"}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex items-end gap-2 border-t bg-card p-2 sm:p-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="আরও অ্যাকশন">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuItem onClick={() => setPickerOpen(true)}>
                    <Package className="mr-2 h-4 w-4" /> প্রোডাক্ট / সাইজ-রং পাঠান
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Textarea
                rows={1}
                value={draft}
                placeholder="উত্তর লিখুন…"
                className="max-h-32 min-h-10 resize-none"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
              />
              <Button onClick={onSend} disabled={sending || !draft.trim()} size="icon" className="h-10 w-10 shrink-0" aria-label="পাঠান">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </section>

      {active && (
        <aside className="hidden w-[320px] shrink-0 border-l xl:block">
          <OmniCustomerPanel conversationId={active.id} />
        </aside>
      )}
      {active && (
        <OmniProductPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          conversationId={active.id}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ["omni-msgs", active.id] });
            qc.invalidateQueries({ queryKey: ["omni-inbox"] });
          }}
        />
      )}
      <Sheet open={infoOpen && !!active} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="h-[100dvh] w-full max-w-full p-0 pb-[env(safe-area-inset-bottom)] sm:max-w-sm [&>button]:hidden">
          <SheetTitle className="sr-only">কাস্টমার তথ্য</SheetTitle>
          {active && <OmniCustomerPanel conversationId={active.id} onClose={() => setInfoOpen(false)} />}
        </SheetContent>
      </Sheet>
      </div>
    </div>
  );
}
