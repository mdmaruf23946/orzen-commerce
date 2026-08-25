import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Ban, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, MessageSquare, RefreshCw, Search, Send, ShieldCheck,
  Sparkles, Trash2,
} from "lucide-react";
import {
  listFacebookComments, syncFacebookComments, replyFacebookComment, setFacebookCommentHidden,
  deleteFacebookComment, blockFacebookCommenter, privateReplyFacebookComment, analyzeFacebookComments,
} from "@/lib/facebook-page.functions";
import { CAP_SCOPE } from "@/lib/facebook-caps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Section, NotConnected, EmptyState, MissingPermission, CapBadge, formatWhen, FB_BLUE,
} from "@/components/admin/facebook/ui";

type Filter = "all" | "unanswered" | "flagged" | "hidden";

export const Route = createFileRoute("/_authenticated/admin/facebook/comments")({
  validateSearch: (s: Record<string, unknown>) => ({ post: typeof s.post === "string" ? s.post : undefined }),
  component: CommentsPage,
  head: () => ({
    meta: [
      { title: "Facebook Comments | ORZEN Merchant Panel" },
      {
        name: "description",
        content: "Search, reply, hide, delete and moderate Facebook Page comments, with AI categories and suggested replies.",
      },
      { property: "og:title", content: "Facebook Comments | ORZEN Merchant Panel" },
      { property: "og:description", content: "Moderate Facebook Page comments and hand conversations to Messenger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unanswered", label: "Unanswered" },
  { key: "flagged", label: "Flagged" },
  { key: "hidden", label: "Hidden" },
];

const CATEGORY_STYLE: Record<string, string> = {
  question: "bg-blue-500/10 text-blue-600",
  order_intent: "bg-emerald-500/10 text-emerald-600",
  praise: "bg-violet-500/10 text-violet-600",
  spam: "bg-amber-500/10 text-amber-600",
  abusive: "bg-destructive/10 text-destructive",
  other: "bg-muted text-muted-foreground",
};

function CommentsPage() {
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

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["fbpage", "comments", filter, post ?? null, q, page],
    queryFn: () => listFn({ data: { filter, post_id: post ?? null, q: q || null, page, page_size: 15 } }),
    // Live sync: the Facebook webhook writes new comments server-side.
    refetchInterval: 30_000,
  });

  if (data && !data.connected) return <NotConnected />;

  const caps = (data?.capabilities ?? {}) as Record<string, boolean>;
  const comments = data?.comments ?? [];
  const totalPages = data?.total_pages ?? 1;

  function applySearch(value: string) {
    setQ(value.trim());
    setPage(1);
  }

  async function run(id: string, fn: () => Promise<unknown>, msg: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["fbpage"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const r: any = await syncFn({ data: { post_id: post ?? null } });
      if (r.ok) toast.success(`Synced ${r.synced} comments`);
      else toast.error(r.error === "not_connected" ? "Connect your page first" : `Missing permission: ${r.error}`);
      qc.invalidateQueries({ queryKey: ["fbpage"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function analyze() {
    const ids = comments.slice(0, 20).map((c: any) => c.comment_id);
    if (!ids.length) return;
    setAnalyzing(true);
    try {
      const r: any = await aiFn({ data: { comment_ids: ids } });
      toast.success(
        r.queued
          ? `AI reviewed ${r.analyzed} comments and queued ${r.queued} actions for your approval`
          : `AI reviewed ${r.analyzed} comments`,
      );
      qc.invalidateQueries({ queryKey: ["fbpage"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Section
      title="Comments"
      description={post ? "Showing comments for one post." : "Comments across your recent page posts, kept in sync automatically."}
      action={
        <div className="flex w-full gap-2 sm:w-auto">
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
            <Link to="/admin/facebook/moderation">
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Moderation
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={sync} disabled={syncing} className="flex-1 sm:flex-none">
            {syncing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
            Sync
          </Button>
          <Button
            size="sm"
            onClick={analyze}
            disabled={analyzing || comments.length === 0}
            className="flex-1 sm:flex-none"
            style={{ backgroundColor: FB_BLUE }}
          >
            {analyzing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            AI review
          </Button>
        </div>
      }
    >
      <div className="mb-3 space-y-2">
        <div className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/40 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${
                filter === f.key ? "bg-white text-foreground shadow-sm dark:bg-background" : "hover:bg-background/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch(search)}
              placeholder="Search comment text or author…"
              className="h-10 pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-10" onClick={() => applySearch(search)}>
              Search
            </Button>
            {q && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={() => {
                  setSearch("");
                  applySearch("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CapBadge ok={!!caps.reply_comment} scope={CAP_SCOPE.reply_comment} />
          <CapBadge ok={!!caps.hide_comment} scope={CAP_SCOPE.hide_comment} />
          <CapBadge ok={!!caps.delete_comment} scope={CAP_SCOPE.delete_comment} />
          <CapBadge ok={!!caps.block_user} scope={CAP_SCOPE.block_user} />
          <CapBadge ok={!!caps.private_reply} scope={CAP_SCOPE.private_reply} />
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6 text-muted-foreground" />}
          title={q ? "No comments match your search" : "No comments here"}
          hint="Press Sync to pull the latest comments from your Facebook Page."
        />
      ) : (
        <ul className="space-y-2">
          {comments.map((c: any) => {
            const draft = drafts[c.comment_id] ?? c.ai_suggestion ?? "";
            const busy = busyId === c.comment_id;
            return (
              <li key={c.id} className="rounded-xl border bg-background p-3">
                <div className="flex gap-2.5">
                  {c.author_picture ? (
                    <img src={c.author_picture} alt="" className="h-9 w-9 shrink-0 rounded-full border object-cover" />
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
                      {(c.author_name ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{c.author_name ?? "Facebook user"}</span>
                      {c.ai_category && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${CATEGORY_STYLE[c.ai_category] ?? CATEGORY_STYLE.other}`}>
                          {String(c.ai_category).replace("_", " ")}
                        </span>
                      )}
                      {c.hidden && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">hidden</span>}
                      {c.replied && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600">replied</span>}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.message}</p>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatWhen(c.comment_created_at)}
                      {c.post_excerpt ? ` · on “${c.post_excerpt}”` : ""}
                    </div>
                  </div>
                </div>

                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.comment_id]: e.target.value }))}
                    placeholder={caps.reply_comment ? "Write a public reply…" : "Replying needs pages_manage_engagement"}
                    disabled={!caps.reply_comment}
                  />
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="inline-flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        disabled={!caps.reply_comment || busy || !draft.trim()}
                        style={{ backgroundColor: FB_BLUE }}
                        onClick={() => run(c.comment_id, () => replyFn({ data: { comment_id: c.comment_id, message: draft } }), "Reply posted")}
                      >
                        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                        Reply
                      </Button>
                      <CapBadge ok={!!caps.reply_comment} scope={CAP_SCOPE.reply_comment} />
                    </span>
                    <span className="inline-flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!caps.private_reply || busy || !draft.trim()}
                        onClick={() => run(c.comment_id, () => dmFn({ data: { comment_id: c.comment_id, message: draft } }), "Sent on Messenger")}
                      >
                        <MessageSquare className="mr-1.5 h-4 w-4" /> Messenger
                      </Button>
                      <CapBadge ok={!!caps.private_reply} scope={CAP_SCOPE.private_reply} />
                    </span>
                    <span className="inline-flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!caps.hide_comment || busy}
                        onClick={() => run(c.comment_id, () => hideFn({ data: { comment_id: c.comment_id, hidden: !c.hidden } }), c.hidden ? "Comment shown" : "Comment hidden")}
                      >
                        {c.hidden ? <Eye className="mr-1.5 h-4 w-4" /> : <EyeOff className="mr-1.5 h-4 w-4" />}
                        {c.hidden ? "Unhide" : "Hide"}
                      </Button>
                      <CapBadge ok={!!caps.hide_comment} scope={CAP_SCOPE.hide_comment} />
                    </span>
                    {c.author_id && (
                      <span className="inline-flex flex-col items-start gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!caps.block_user || busy}
                          onClick={() => run(c.comment_id, () => blockFn({ data: { user_id: c.author_id } }), "User blocked")}
                        >
                          <Ban className="mr-1.5 h-4 w-4" /> Block
                        </Button>
                        <CapBadge ok={!!caps.block_user} scope={CAP_SCOPE.block_user} />
                      </span>
                    )}
                    <span className="inline-flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={!caps.delete_comment || busy}
                        onClick={() => run(c.comment_id, () => delFn({ data: { comment_id: c.comment_id } }), "Comment deleted")}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                      </Button>
                      <CapBadge ok={!!caps.delete_comment} scope={CAP_SCOPE.delete_comment} />
                    </span>
                  </div>
                  {!caps.reply_comment && <MissingPermission scope="pages_manage_engagement" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
          {data?.total != null ? ` · ${data.total} comments` : ""}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)}>
          Next <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </Section>
  );
}
