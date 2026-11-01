import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Ban, Eye, EyeOff, Globe, Loader2, MessageCircle, MessageSquare, RefreshCw, Search, Send,
  ShieldCheck, Sparkles, Trash2,
} from "lucide-react";
import {
  listFacebookComments, syncFacebookComments, replyFacebookComment, setFacebookCommentHidden,
  deleteFacebookComment, blockFacebookCommenter, privateReplyFacebookComment, analyzeFacebookComments,
} from "@/lib/facebook-page.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NotConnected, MissingPermission, formatWhen, FB_BLUE, FacebookMark } from "@/components/admin/facebook/ui";
import { cn } from "@/lib/utils";

type Filter = "all" | "unanswered" | "flagged" | "hidden";
type Mode = "public" | "messenger";

export const Route = createFileRoute("/_authenticated/admin/facebook/comments")({
  validateSearch: (s: Record<string, unknown>) => ({ post: typeof s.post === "string" ? s.post : undefined }),
  component: CommentsInbox,
  head: () => ({
    meta: [
      { title: "Facebook Comment Inbox | ORZEN Merchant Panel" },
      { name: "description", content: "Every Facebook Page comment in one inbox — see who commented, on which post, and reply publicly or on Messenger." },
      { property: "og:title", content: "Facebook Comment Inbox | ORZEN Merchant Panel" },
      { property: "og:description", content: "Reply to Facebook comments publicly or privately from one inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FILTERS: { key: Filter; label: string }[] = [
  { key: "unanswered", label: "উত্তর বাকি" },
  { key: "all", label: "সব" },
  { key: "flagged", label: "Spam / গালি" },
  { key: "hidden", label: "Hidden" },
];

const CATEGORY: Record<string, { label: string; cls: string }> = {
  question: { label: "প্রশ্ন", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  order_intent: { label: "অর্ডার করতে চায়", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  praise: { label: "প্রশংসা", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  spam: { label: "Spam", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  abusive: { label: "গালি", cls: "bg-destructive/10 text-destructive" },
  other: { label: "অন্যান্য", cls: "bg-muted text-muted-foreground" },
};

function Avatar({ name, src, size = 40 }: { name?: string | null; src?: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full border object-cover" />
  ) : (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">
      {(name ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function CommentsInbox() {
  const { post } = Route.useSearch();
  const qc = useQueryClient();
  const listFn = useServerFn(listFacebookComments);
  const syncFn = useServerFn(syncFacebookComments);
  const replyFn = useServerFn(replyFacebookComment);
  const hideFn = useServerFn(setFacebookCommentHidden);
  const delFn = useServerFn(deleteFacebookComment);
  const blockFn = useServerFn(blockFacebookCommenter);
  const dmFn = useServerFn(privateReplyFacebookComment);
  const aiFn = useServerFn(analyzeFacebookComments);

  const [filter, setFilter] = useState<Filter>("unanswered");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("public");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["fbpage", "comments", filter, post ?? null, q],
    queryFn: () => listFn({ data: { filter, post_id: post ?? null, q: q || null, page: 1, page_size: 50 } }),
  });
  const { data: unanswered } = useQuery({
    queryKey: ["fbpage", "comments", "count-unanswered"],
    queryFn: () => listFn({ data: { filter: "unanswered", page: 1, page_size: 5 } }),
    staleTime: 60_000,
  });

  const comments = (data?.comments ?? []) as any[];
  const caps = (data?.capabilities ?? {}) as Record<string, boolean>;
  const active = useMemo(() => comments.find((c) => c.comment_id === activeId) ?? null, [comments, activeId]);
  const history = useMemo(
    () => (active?.author_id ? comments.filter((c) => c.author_id === active.author_id && c.comment_id !== active.comment_id) : []),
    [comments, active],
  );

  if (data && !data.connected) return <NotConnected />;

  const draft = active ? drafts[active.comment_id] ?? active.ai_suggestion ?? "" : "";

  async function run(key: string, fn: () => Promise<unknown>, msg: string, after?: () => void) {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      after?.();
      qc.invalidateQueries({ queryKey: ["fbpage"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    await run("sync", async () => {
      const r: any = await syncFn({ data: { post_id: post ?? null } });
      if (!r.ok) throw new Error(r.error === "not_connected" ? "আগে Facebook Page connect করুন" : `Permission দরকার: ${r.error}`);
    }, "নতুন comment আনা হয়েছে");
  }

  async function analyze() {
    const ids = comments.slice(0, 20).map((c) => c.comment_id);
    if (!ids.length) return;
    await run("ai", () => aiFn({ data: { comment_ids: ids } }), "AI comment গুলো যাচাই করেছে");
  }

  function send() {
    if (!active || !draft.trim()) return;
    const id = active.comment_id;
    const clear = () => setDrafts((d) => ({ ...d, [id]: "" }));
    if (mode === "public") run("send", () => replyFn({ data: { comment_id: id, message: draft } }), "Public reply দেওয়া হয়েছে", clear);
    else run("send", () => dmFn({ data: { comment_id: id, message: draft } }), "Messenger-এ পাঠানো হয়েছে", clear);
  }

  const canSend = mode === "public" ? caps.reply_comment : caps.private_reply;

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[520px] overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* List */}
      <aside className={cn("flex w-full min-w-0 flex-col border-r md:w-[360px]", active && "hidden md:flex")}>
        <div className="space-y-2.5 border-b p-3">
          <div className="flex items-center gap-2">
            <FacebookMark className="h-8 w-8" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-tight">Comment Inbox</div>
              <div className="truncate text-xs text-muted-foreground">
                {unanswered?.total ? `${unanswered.total}টি comment-এর উত্তর বাকি` : "সব comment-এর উত্তর দেওয়া হয়েছে"}
              </div>
            </div>
            <Button size="icon" variant="ghost" title="নতুন comment আনুন" onClick={sync} disabled={busy === "sync"}>
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" title="AI review" onClick={analyze} disabled={busy === "ai" || !comments.length}>
              {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
            <Button asChild size="icon" variant="ghost" title="Moderation">
              <Link to="/admin/facebook/moderation"><ShieldCheck className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setActiveId(null); }}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors",
                  filter === f.key ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {f.label}
                {f.key === "unanswered" && !!unanswered?.total && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {unanswered.total > 99 ? "99+" : unanswered.total}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="Comment খুঁজুন… (Enter)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQ(search.trim())}
            />
          </div>
          {post && (
            <Link to="/admin/facebook/comments" search={{ post: undefined }} className="block text-xs text-primary hover:underline">
              একটি post-এর comment দেখানো হচ্ছে · সব দেখুন
            </Link>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />)}</div>
          ) : comments.length === 0 ? (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
              <div>
                <MessageSquare className="mx-auto mb-2 h-8 w-8" />
                {q ? "কোনো comment মেলেনি" : "এখানে কোনো comment নেই"}
                <div className="mt-1 text-xs">উপরের ↻ বাটনে চাপ দিয়ে নতুন comment আনুন।</div>
              </div>
            </div>
          ) : (
            comments.map((c) => {
              const cat = c.ai_category ? CATEGORY[c.ai_category] ?? CATEGORY.other : null;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.comment_id)}
                  className={cn(
                    "flex w-full gap-2.5 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                    activeId === c.comment_id && "bg-muted",
                  )}
                >
                  <div className="relative">
                    <Avatar name={c.author_name} src={c.author_picture} />
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ring-2 ring-card" style={{ backgroundColor: FB_BLUE }}>
                      <MessageCircle className="h-2.5 w-2.5 text-primary-foreground" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", !c.replied ? "font-semibold" : "font-medium")}>{c.author_name ?? "Facebook user"}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{formatWhen(c.comment_created_at)}</span>
                    </div>
                    <p className={cn("truncate text-xs", !c.replied ? "text-foreground" : "text-muted-foreground")}>{c.message || "(ছবি/স্টিকার)"}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {!c.replied && !c.hidden && <span className="h-2 w-2 rounded-full bg-destructive" />}
                      {c.replied && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ উত্তর দেওয়া</span>}
                      {c.hidden && <span className="text-[10px] text-muted-foreground">hidden</span>}
                      {cat && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", cat.cls)}>{cat.label}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("flex min-w-0 flex-1 flex-col", !active && "hidden md:flex")}>
        {!active ? (
          <div className="grid flex-1 place-items-center p-6 text-center text-sm text-muted-foreground">
            <div>
              <MessageSquare className="mx-auto mb-2 h-10 w-10" />
              বাম পাশ থেকে একটি comment বেছে নিন
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2.5 border-b px-3 py-2.5">
              <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setActiveId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar name={active.author_name} src={active.author_picture} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold leading-tight">{active.author_name ?? "Facebook user"}</div>
                <div className="text-xs text-muted-foreground">Facebook comment · {formatWhen(active.comment_created_at)}</div>
              </div>
              <Button size="sm" variant="outline" disabled={!caps.hide_comment || !!busy}
                onClick={() => run("hide", () => hideFn({ data: { comment_id: active.comment_id, hidden: !active.hidden } }), active.hidden ? "Comment দেখানো হচ্ছে" : "Comment hide করা হয়েছে")}>
                {active.hidden ? <Eye className="h-4 w-4 sm:mr-1.5" /> : <EyeOff className="h-4 w-4 sm:mr-1.5" />}
                <span className="hidden sm:inline">{active.hidden ? "Unhide" : "Hide"}</span>
              </Button>
              {active.author_id && (
                <Button size="sm" variant="outline" title="Block" disabled={!caps.block_user || !!busy}
                  onClick={() => confirm("এই ব্যক্তিকে Page থেকে block করবেন?") && run("block", () => blockFn({ data: { user_id: active.author_id } }), "Block করা হয়েছে")}>
                  <Ban className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" title="Delete" className="text-destructive hover:bg-destructive/10" disabled={!caps.delete_comment || !!busy}
                onClick={() => confirm("Comment টি মুছে ফেলবেন?") && run("del", () => delFn({ data: { comment_id: active.comment_id } }), "Comment মুছে ফেলা হয়েছে", () => setActiveId(null))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
              {/* Post preview */}
              <div className="rounded-xl border bg-card p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Globe className="h-3 w-3" /> এই post-এর নিচে comment করেছে
                </div>
                <p className="line-clamp-3 text-sm">{active.post_excerpt || "Page post"}</p>
                {active.post_id && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <a href={`https://facebook.com/${active.post_id}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">Facebook-এ দেখুন</a>
                    <Link to="/admin/facebook/comments" search={{ post: active.post_id }} className="text-primary hover:underline">এই post-এর সব comment</Link>
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <div className="space-y-2">
                  <div className="text-center text-[11px] text-muted-foreground">এই customer-এর আগের comment</div>
                  {history.slice().reverse().map((h) => (
                    <button key={h.id} onClick={() => setActiveId(h.comment_id)} className="flex w-full gap-2 text-left opacity-70 hover:opacity-100">
                      <Avatar name={h.author_name} src={h.author_picture} size={28} />
                      <div className="rounded-2xl rounded-tl-sm bg-card px-3 py-2 text-sm shadow-sm">
                        {h.message}
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{formatWhen(h.comment_created_at)} {h.replied ? "· ✓" : ""}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* The comment */}
              <div className="flex gap-2">
                <Avatar name={active.author_name} src={active.author_picture} size={32} />
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card px-3.5 py-2.5 shadow-sm">
                  <div className="text-xs font-semibold">{active.author_name ?? "Facebook user"}</div>
                  <p className="whitespace-pre-wrap text-sm">{active.message || "(ছবি/স্টিকার)"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    {formatWhen(active.comment_created_at)}
                    {active.ai_category && (
                      <span className={cn("rounded-full px-1.5 py-0.5", (CATEGORY[active.ai_category] ?? CATEGORY.other).cls)}>
                        {(CATEGORY[active.ai_category] ?? CATEGORY.other).label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {active.replied && (
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm px-3.5 py-2 text-xs text-primary-foreground" style={{ backgroundColor: FB_BLUE }}>
                    ✓ Page থেকে উত্তর দেওয়া হয়েছে
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <footer className="space-y-2 border-t p-3">
              <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
                {([["public", "পাবলিক comment-এ reply", MessageCircle], ["messenger", "Messenger-এ inbox করুন", Send]] as const).map(([k, label, Icon]) => (
                  <button key={k} onClick={() => setMode(k)}
                    className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      mode === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60")}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              {active.ai_suggestion && !drafts[active.comment_id] && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3" /> AI-এর প্রস্তাবিত উত্তর বসানো আছে — চাইলে বদলে নিন</div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [active.comment_id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={mode === "public" ? "সবাই দেখতে পাবে এমন উত্তর লিখুন…" : "শুধু এই customer Messenger-এ দেখবে…"}
                  className="min-h-[44px] resize-none"
                />
                <Button onClick={send} disabled={!canSend || busy === "send" || !draft.trim()} style={{ backgroundColor: FB_BLUE }} className="h-11">
                  {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {mode === "messenger" && <p className="text-[11px] text-muted-foreground">Facebook-এর নিয়মে প্রতিটি comment-এ ৭ দিনের মধ্যে একবারই Messenger-এ পাঠানো যায়; customer উত্তর দিলে চ্যাটটি Omni Inbox-এ চলে আসবে।</p>}
              {!canSend && <MissingPermission scope={mode === "public" ? "pages_manage_engagement" : "pages_messaging"} />}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
