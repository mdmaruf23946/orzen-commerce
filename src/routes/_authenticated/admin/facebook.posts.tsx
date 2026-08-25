import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, ExternalLink, FileText, Heart, Loader2, MessageSquare, PenSquare, RefreshCw,
  Search, Send, Share2, Trash2,
} from "lucide-react";
import {
  getFacebookPage, listFacebookPosts, listFacebookDrafts, publishFacebookPost, deleteFacebookPost,
  deleteFacebookDraft,
} from "@/lib/facebook-page.functions";
import { CAP_SCOPE } from "@/lib/facebook-caps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section, NotConnected, EmptyState, CapBadge, formatWhen, FB_BLUE } from "@/components/admin/facebook/ui";

export const Route = createFileRoute("/_authenticated/admin/facebook/posts")({
  component: PostsPage,
  head: () => ({
    meta: [
      { title: "Facebook Posts | ORZEN Merchant Panel" },
      {
        name: "description",
        content: "Search published Facebook Page posts with reactions, comments and shares, and manage your saved drafts.",
      },
      { property: "og:title", content: "Facebook Posts | ORZEN Merchant Panel" },
      { property: "og:description", content: "Published posts, engagement data and drafts for your Facebook Page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PostsPage() {
  const qc = useQueryClient();
  const pageFn = useServerFn(getFacebookPage);
  const listFn = useServerFn(listFacebookPosts);
  const draftsFn = useServerFn(listFacebookDrafts);
  const publishFn = useServerFn(publishFacebookPost);
  const deletePostFn = useServerFn(deleteFacebookPost);
  const deleteDraftFn = useServerFn(deleteFacebookDraft);

  const [tab, setTab] = useState<"published" | "draft">("published");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [cursors, setCursors] = useState<(string | null)[]>([null]); // one cursor per visited page
  const [pageIdx, setPageIdx] = useState(0);
  const [draftQ, setDraftQ] = useState("");

  const { data: page } = useQuery({ queryKey: ["fbpage", "overview"], queryFn: () => pageFn() });
  const posts = useQuery({
    queryKey: ["fbpage", "posts", q, pageIdx],
    queryFn: () => listFn({ data: { q: q || null, after: cursors[pageIdx] ?? null, limit: 10 } }),
    enabled: tab === "published",
    // Live sync: the Facebook webhook writes changes server-side, this keeps the view fresh.
    refetchInterval: 45_000,
  });
  const drafts = useQuery({
    queryKey: ["fbpage", "drafts"],
    queryFn: () => draftsFn(),
    enabled: tab === "draft",
  });

  if (page && !page.connected) return <NotConnected />;

  const caps = (posts.data?.capabilities ?? page?.capabilities ?? {}) as Record<string, boolean>;

  function applySearch(value: string) {
    setQ(value.trim());
    setCursors([null]);
    setPageIdx(0);
  }

  function nextPage() {
    const next = posts.data?.next ?? null;
    if (!next) return;
    setCursors((c) => {
      const copy = [...c];
      copy[pageIdx + 1] = next;
      return copy;
    });
    setPageIdx((i) => i + 1);
  }

  async function act(id: string, fn: () => Promise<unknown>, msg: string) {
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

  const loading = tab === "published" ? posts.isLoading : drafts.isLoading;
  const allDrafts = (drafts.data?.drafts ?? []) as any[];
  const filteredDrafts = draftQ
    ? allDrafts.filter((d) => String(d.message ?? "").toLowerCase().includes(draftQ.toLowerCase()))
    : allDrafts;
  const items: any[] = tab === "published" ? posts.data?.posts ?? [] : filteredDrafts;

  return (
    <Section
      title="Posts"
      description="Engagement numbers come straight from your page and refresh automatically."
      action={
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (tab === "published" ? posts.refetch() : drafts.refetch())}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
          </Button>
          <Button asChild size="sm" className="flex-1 sm:flex-none" style={{ backgroundColor: FB_BLUE }}>
            <Link to="/admin/facebook/compose">
              <PenSquare className="mr-1.5 h-4 w-4" /> New post
            </Link>
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex gap-1 rounded-xl border bg-muted/40 p-1">
        {(["published", "draft"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-medium transition-colors ${
              tab === t ? "bg-white text-foreground shadow-sm dark:bg-background" : "hover:bg-background/60"
            }`}
          >
            {t === "published" ? "Published" : "Drafts"}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={tab === "published" ? search : draftQ}
            onChange={(e) => (tab === "published" ? setSearch(e.target.value) : setDraftQ(e.target.value))}
            onKeyDown={(e) => {
              if (tab === "published" && e.key === "Enter") applySearch(search);
            }}
            placeholder={tab === "published" ? "Search post text, then press Enter…" : "Search drafts…"}
            className="h-10 pl-9"
          />
        </div>
        {tab === "published" && (
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
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CapBadge ok={!!caps.read_posts} scope={CAP_SCOPE.read_posts} />
        <CapBadge ok={!!caps.create_post} scope={CAP_SCOPE.create_post} />
        <CapBadge ok={!!caps.delete_post} scope={CAP_SCOPE.delete_post} />
      </div>

      {tab === "published" && posts.data?.missing && (
        <p className="mb-2 text-xs text-muted-foreground">
          Your page token is missing the {posts.data.missing} permission, so posts cannot be listed.
        </p>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6 text-muted-foreground" />}
          title={tab === "published" ? (q ? "No posts match your search" : "No posts yet") : "No drafts found"}
          hint={tab === "published" ? "Publish your first post from Create Post." : "Save a draft from Create Post."}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((p: any) => (
            <li key={p.id} className="rounded-xl border bg-background p-3">
              <div className="flex gap-3">
                {(p.image || (p.media_type === "image" && p.media_url)) && (
                  <img
                    src={p.image ?? p.media_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg border object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm">{p.message || "(no text)"}</p>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {tab === "draft" ? `Saved ${formatWhen(p.created_at)}` : formatWhen(p.created_time)}
                  </div>
                  {tab === "published" && (
                    <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {p.reactions ?? 0}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {p.comments ?? 0}</span>
                      <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" /> {p.shares ?? 0}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-start gap-2">
                {tab === "draft" ? (
                  <>
                    <span className="inline-flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        disabled={busyId === p.id || !caps.create_post}
                        style={{ backgroundColor: FB_BLUE }}
                        onClick={() =>
                          act(
                            p.id,
                            () =>
                              publishFn({
                                data: {
                                  draft_id: p.id,
                                  message: p.message ?? "",
                                  media_url: p.media_url,
                                  media_type: p.media_type ?? "text",
                                  link_url: p.link_url,
                                },
                              }),
                            "Draft published",
                          )
                        }
                      >
                        {busyId === p.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                        Publish
                      </Button>
                      <CapBadge ok={!!caps.create_post} scope={CAP_SCOPE.create_post} />
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={busyId === p.id}
                      onClick={() => act(p.id, () => deleteDraftFn({ data: { id: p.id } }), "Draft deleted")}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                    </Button>
                  </>
                ) : (
                  <>
                    {p.permalink_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={p.permalink_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-4 w-4" /> View
                        </a>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link to="/admin/facebook/comments" search={{ post: p.id }}>
                        <MessageSquare className="mr-1.5 h-4 w-4" /> Comments
                      </Link>
                    </Button>
                    <span className="inline-flex flex-col items-start gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={busyId === p.id || !caps.delete_post}
                        onClick={() => act(p.id, () => deletePostFn({ data: { post_id: p.id } }), "Post deleted")}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                      </Button>
                      <CapBadge ok={!!caps.delete_post} scope={CAP_SCOPE.delete_post} />
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "published" && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageIdx === 0 || posts.isFetching}
            onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {pageIdx + 1}</span>
          <Button variant="outline" size="sm" disabled={!posts.data?.next || posts.isFetching} onClick={nextPage}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </Section>
  );
}
