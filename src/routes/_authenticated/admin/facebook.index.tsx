import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, MessageSquare, PenSquare, RefreshCw, XCircle } from "lucide-react";
import { getFacebookPage } from "@/lib/facebook-page.functions";
import { Button } from "@/components/ui/button";
import { Section, StatusPill, NotConnected, formatWhen, FB_BLUE } from "@/components/admin/facebook/ui";

export const Route = createFileRoute("/_authenticated/admin/facebook/")({
  component: PageOverview,
  head: () => ({
    meta: [
      { title: "Facebook Page Overview | ORZEN Merchant Panel" },
      {
        name: "description",
        content: "See your connected Facebook Page, granted Meta permissions, drafts and unanswered comments at a glance.",
      },
      { property: "og:title", content: "Facebook Page Overview | ORZEN Merchant Panel" },
      { property: "og:description", content: "Connected page status, permissions and comment activity for your store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CAP_LABELS: Record<string, string> = {
  read_posts: "Read posts",
  create_post: "Create posts",
  edit_post: "Edit posts",
  delete_post: "Delete posts",
  read_comments: "Read comments",
  reply_comment: "Reply to comments",
  hide_comment: "Hide comments",
  delete_comment: "Delete comments",
  block_user: "Block users",
  private_reply: "Message on Messenger",
};

function PageOverview() {
  const fn = useServerFn(getFacebookPage);
  const { data, isLoading } = useQuery({ queryKey: ["fbpage", "overview"], queryFn: () => fn() });

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;
  if (!data?.connected) return <NotConnected />;

  const caps = Object.entries(data.capabilities ?? {});

  return (
    <div className="space-y-4">
      <Section title="Connected page" description="This connection is used only by the Facebook Page module.">
        <div className="flex flex-wrap items-center gap-3">
          {data.page_picture_url && (
            <img
              src={data.page_picture_url}
              alt={data.page_name ?? "Facebook page"}
              className="h-14 w-14 rounded-full border object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold" style={{ color: FB_BLUE }}>
                {data.page_name ?? "Facebook Page"}
              </span>
              <StatusPill status={data.status} />
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">Page ID: {data.page_id}</div>
            <div className="text-xs text-muted-foreground">Last verified: {formatWhen(data.last_verified_at)}</div>
            {data.token_expires_at && (
              <div className="text-xs text-muted-foreground">Token expires: {formatWhen(data.token_expires_at)}</div>
            )}
            {data.last_error && <div className="mt-1 text-xs text-destructive">{data.last_error}</div>}
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <a href={`https://facebook.com/${data.page_id}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Open page
              </a>
            </Button>
            <Button asChild size="sm" className="flex-1 sm:flex-none" style={{ backgroundColor: FB_BLUE }}>
              <Link to="/admin/facebook/compose">
                <PenSquare className="mr-1.5 h-4 w-4" /> Create Post
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Saved drafts" value={data.drafts} to="/admin/facebook/posts" />
        <Stat label="Unanswered comments" value={data.unanswered_comments} to="/admin/facebook/comments" />
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">AI comment management</div>
          <div className="mt-1 text-sm font-semibold">
            {data.ai_enabled ? (data.ai_mode === "auto" ? "Automatic" : "Suggest only") : "Off"}
          </div>
          <Link to="/admin/facebook/settings" className="mt-1 inline-block text-xs text-primary underline">
            Configure
          </Link>
        </div>
      </div>

      <Section
        title="Meta permissions"
        description="Only the actions your page token actually grants are enabled across this module."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/facebook/settings">
              <RefreshCw className="mr-1.5 h-4 w-4" /> Reconnect
            </Link>
          </Button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {caps.map(([k, ok]) => (
            <div key={k} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              {ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={ok ? "" : "text-muted-foreground"}>{CAP_LABELS[k] ?? k}</span>
            </div>
          ))}
        </div>
        {!!data.permissions?.length && (
          <div className="mt-3 text-[11px] text-muted-foreground">Granted scopes: {data.permissions.join(", ")}</div>
        )}
      </Section>

      <Section title="Comments" description="Reply, moderate and hand conversations to Messenger.">
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/facebook/comments" search={{ post: undefined }}>
            <MessageSquare className="mr-1.5 h-4 w-4" /> Open comments
          </Link>
        </Button>
      </Section>
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Link>
  );
}
