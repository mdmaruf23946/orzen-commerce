import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Send } from "lucide-react";
import { getFacebookPage, publishFacebookPost, saveFacebookDraft } from "@/lib/facebook-page.functions";
import { getMyStore } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Section, NotConnected, MissingPermission, FB_BLUE } from "@/components/admin/facebook/ui";

export const Route = createFileRoute("/_authenticated/admin/facebook/compose")({
  component: ComposePage,
  head: () => ({
    meta: [
      { title: "Create Facebook Post | ORZEN Store Admin" },
      {
        name: "description",
        content: "Write, preview and publish a Facebook Page post with text, image, video or link — without leaving your store admin.",
      },
      { property: "og:title", content: "Create Facebook Post | ORZEN Store Admin" },
      { property: "og:description", content: "Compose and publish Facebook Page posts from ORZEN Store Admin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type MediaType = "text" | "image" | "video" | "link";

const TYPES: { key: MediaType; label: string }[] = [
  { key: "text", label: "Text" },
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
  { key: "link", label: "Link" },
];

function absoluteUrl(pathOrUrl: string | null): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/img/${pathOrUrl}`;
}

function ComposePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pageFn = useServerFn(getFacebookPage);
  const storeFn = useServerFn(getMyStore);
  const publish = useServerFn(publishFacebookPost);
  const saveDraft = useServerFn(saveFacebookDraft);

  const { data: page, isLoading } = useQuery({ queryKey: ["fbpage", "overview"], queryFn: () => pageFn() });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });

  const [type, setType] = useState<MediaType>("text");
  const [message, setMessage] = useState("");
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState<"publish" | "draft" | null>(null);

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;
  if (!page?.connected) return <NotConnected />;

  const canPost = !!page.capabilities?.create_post;
  const mediaUrl = absoluteUrl(mediaPath);

  async function onPublish() {
    setBusy("publish");
    try {
      await publish({
        data: {
          message,
          media_type: type,
          media_url: type === "image" || type === "video" ? mediaUrl : null,
          link_url: type === "link" ? linkUrl : null,
        },
      });
      toast.success("Published to your Facebook Page");
      qc.invalidateQueries({ queryKey: ["fbpage"] });
      setMessage("");
      setMediaPath(null);
      setLinkUrl("");
      navigate({ to: "/admin/facebook/posts" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onSaveDraft() {
    setBusy("draft");
    try {
      await saveDraft({
        data: {
          message,
          media_type: type,
          media_url: type === "image" || type === "video" ? mediaUrl : null,
          link_url: type === "link" ? linkUrl : null,
        },
      });
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["fbpage"] });
      navigate({ to: "/admin/facebook/posts" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Create Post" description="Publish directly to your Facebook Page.">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={`min-h-9 flex-1 rounded-lg px-3 text-xs font-medium transition-colors ${
                  type === t.key ? "bg-white text-foreground shadow-sm dark:bg-background" : "hover:bg-background/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Post text</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="What do you want to share with your customers?"
            />
          </div>

          {(type === "image" || type === "video") && store?.id && (
            <div className="space-y-1.5">
              <Label className="text-xs">{type === "image" ? "Image" : "Video"}</Label>
              <ImageUploader
                storeId={store.id}
                folder={`${store.id}/facebook`}
                value={mediaPath}
                onChange={setMediaPath}
                accept={type === "image" ? "image/*" : "video/*"}
                maxBytes={type === "image" ? 5 * 1024 * 1024 : 50 * 1024 * 1024}
              />
              <p className="text-[11px] text-muted-foreground">
                Facebook downloads the file from your store, so the post keeps working after publishing.
              </p>
            </div>
          )}

          {type === "link" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Link URL</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}
        </div>
      </Section>

      <Section title="Preview" description="How the post will look on your page.">
        <div className="rounded-xl border bg-background p-3">
          <div className="flex items-center gap-2">
            {page.page_picture_url && (
              <img src={page.page_picture_url} alt="" className="h-9 w-9 rounded-full border object-cover" />
            )}
            <div>
              <div className="text-sm font-semibold">{page.page_name}</div>
              <div className="text-[11px] text-muted-foreground">Just now · Facebook Page</div>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{message || "Your post text will appear here."}</p>
          {type === "image" && mediaUrl && (
            <img src={mediaUrl} alt="" className="mt-2 max-h-72 w-full rounded-lg border object-cover" />
          )}
          {type === "video" && mediaUrl && (
            <video src={mediaUrl} controls className="mt-2 max-h-72 w-full rounded-lg border" />
          )}
          {type === "link" && linkUrl && (
            <div className="mt-2 truncate rounded-lg border bg-muted/40 p-2 text-xs text-muted-foreground">{linkUrl}</div>
          )}
        </div>
      </Section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={onPublish}
          disabled={!canPost || busy !== null}
          className="w-full sm:w-auto"
          style={{ backgroundColor: FB_BLUE }}
        >
          {busy === "publish" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Publish now
        </Button>
        <Button variant="outline" onClick={onSaveDraft} disabled={busy !== null} className="w-full sm:w-auto">
          {busy === "draft" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save as draft
        </Button>
        {!canPost && <div className="self-center"><MissingPermission scope="pages_manage_posts" /></div>}
      </div>
    </div>
  );
}
