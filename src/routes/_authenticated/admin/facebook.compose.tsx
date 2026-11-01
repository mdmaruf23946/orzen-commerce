import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe, Image as ImageIcon, Link2, Loader2, Monitor, Package, Save, Search, Send, Smartphone, ThumbsUp, MessageCircle, Share2, Type, Video, X } from "lucide-react";
import { getFacebookPage, publishFacebookPost, saveFacebookDraft } from "@/lib/facebook-page.functions";
import { searchOmniProducts } from "@/lib/omni-products.functions";
import { getMyStore } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { NotConnected, MissingPermission, FB_BLUE } from "@/components/admin/facebook/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/facebook/compose")({
  component: ComposePage,
  head: () => ({
    meta: [
      { title: "Create Facebook Post | ORZEN Merchant Panel" },
      { name: "description", content: "Create Facebook Page posts with live mobile and desktop preview and one-click store product posts." },
      { property: "og:title", content: "Create Facebook Post | ORZEN Merchant Panel" },
      { property: "og:description", content: "Compose and publish Facebook Page posts from ORZEN Merchant Panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type MediaType = "text" | "image" | "video" | "link";
const TYPES = [
  { key: "text", label: "লেখা", Icon: Type },
  { key: "image", label: "ছবি", Icon: ImageIcon },
  { key: "video", label: "ভিডিও", Icon: Video },
  { key: "link", label: "লিংক", Icon: Link2 },
] as const;

function absoluteUrl(pathOrUrl: string | null): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/img/${pathOrUrl.replace(/^\/+/, "")}`;
}

const tk = (n: number) => `৳${Number(n || 0).toLocaleString("en-US")}`;

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
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;
  if (!page?.connected) return <NotConnected />;

  const canPost = !!page.capabilities?.create_post;
  const mediaUrl = absoluteUrl(mediaPath);
  const payload = {
    message,
    media_type: type,
    media_url: type === "image" || type === "video" ? mediaUrl : null,
    link_url: type === "link" ? linkUrl : null,
  };

  function pickProduct(p: any) {
    const url = store?.slug ? `https://orzen.top/store/${store.slug}/product/${p.id}` : "";
    const price = p.old_price && Number(p.old_price) > Number(p.price)
      ? `💰 দাম: ${tk(p.price)} (আগে ${tk(p.old_price)})`
      : `💰 দাম: ${tk(p.price)}`;
    setMessage([`🛍️ ${p.name}`, "", price, p.stock > 0 ? "✅ স্টকে আছে" : "", "", url ? `🛒 অর্ডার করুন: ${url}` : "", "📩 বিস্তারিত জানতে inbox করুন"].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n"));
    if (p.primary_image_url) {
      setType("image");
      setMediaPath(p.primary_image_url);
    } else if (url) {
      setType("link");
      setLinkUrl(url);
    }
    setPickerOpen(false);
  }

  async function act(kind: "publish" | "draft") {
    setBusy(kind);
    try {
      if (kind === "publish") await publish({ data: payload });
      else await saveDraft({ data: payload });
      toast.success(kind === "publish" ? "Facebook Page-এ post হয়ে গেছে" : "Draft সেভ হয়েছে");
      qc.invalidateQueries({ queryKey: ["fbpage"] });
      navigate({ to: "/admin/facebook/posts" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      {/* Editor */}
      <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">নতুন post তৈরি করুন</h2>
            <p className="text-xs text-muted-foreground">সরাসরি {page.page_name} Page-এ publish হবে</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Package className="mr-1.5 h-4 w-4" /> Store-এর product post করুন
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-xl border bg-muted/40 p-1">
          {TYPES.map(({ key, label, Icon }) => (
            <button key={key} type="button" onClick={() => setType(key)}
              className={cn("flex min-h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors",
                type === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/60")}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Post-এর লেখা</Label>
            <span className="text-[11px] text-muted-foreground">{message.length}/5000</span>
          </div>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 5000))} rows={8}
            placeholder="Customer-দের কী জানাতে চান? যেমন: নতুন collection এসেছে! 🎉" />
        </div>

        {(type === "image" || type === "video") && store?.id && (
          <div className="space-y-1.5">
            <Label className="text-xs">{type === "image" ? "ছবি" : "ভিডিও"}</Label>
            <ImageUploader storeId={store.id} folder={`${store.id}/facebook`} value={mediaPath} onChange={setMediaPath}
              accept={type === "image" ? "image/*" : "video/*"} maxBytes={type === "image" ? 5 * 1024 * 1024 : 50 * 1024 * 1024} />
          </div>
        )}
        {type === "link" && (
          <div className="space-y-1.5">
            <Label className="text-xs">লিংক</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
        )}

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
          <Button onClick={() => act("publish")} disabled={busy !== null || (!message && !mediaUrl && !linkUrl)} style={{ backgroundColor: FB_BLUE }} className="sm:flex-1">
            {busy === "publish" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} এখনই Publish করুন
          </Button>
          <Button variant="outline" onClick={() => act("draft")} disabled={busy !== null}>
            {busy === "draft" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Draft রাখুন
          </Button>
        </div>
        {!canPost && <MissingPermission scope="pages_manage_posts" />}
      </section>

      {/* Preview */}
      <section className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Live preview</h3>
          <div className="flex gap-1 rounded-lg border bg-card p-0.5">
            {([["mobile", Smartphone], ["desktop", Monitor]] as const).map(([d, Icon]) => (
              <button key={d} onClick={() => setDevice(d)} title={d}
                className={cn("rounded-md p-1.5", device === d ? "bg-muted text-foreground" : "text-muted-foreground")}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div className={cn("mx-auto overflow-hidden border bg-card shadow-md transition-all", device === "mobile" ? "max-w-[340px] rounded-[1.75rem] border-[6px] border-foreground/80" : "w-full rounded-xl")}>
          <div className="flex items-center gap-2 p-3">
            {page.page_picture_url ? <img src={page.page_picture_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              : <span className="h-10 w-10 rounded-full" style={{ backgroundColor: FB_BLUE }} />}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{page.page_name}</div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">এখনই · <Globe className="h-3 w-3" /></div>
            </div>
          </div>
          <p className={cn("whitespace-pre-wrap px-3 pb-2 text-sm", !message && "text-muted-foreground")}>{message || "আপনার post-এর লেখা এখানে দেখা যাবে…"}</p>
          {type === "image" && mediaUrl && <img src={mediaUrl} alt="" className="max-h-96 w-full object-cover" />}
          {type === "video" && mediaUrl && <video src={mediaUrl} controls className="max-h-96 w-full bg-foreground" />}
          {type === "link" && linkUrl && (
            <div className="border-y bg-muted/50 px-3 py-2">
              <div className="truncate text-[11px] uppercase text-muted-foreground">{(() => { try { return new URL(linkUrl).hostname; } catch { return linkUrl; } })()}</div>
              <div className="truncate text-sm font-semibold">{linkUrl}</div>
            </div>
          )}
          <div className="mx-3 flex justify-around border-t py-1.5 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" /> Like</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" /> Comment</span>
            <span className="flex items-center gap-1"><Share2 className="h-4 w-4" /> Share</span>
          </div>
        </div>
      </section>

      <ProductPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={pickProduct} />
    </div>
  );
}

function ProductPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; onPick: (p: any) => void }) {
  const search = useServerFn(searchOmniProducts);
  const [q, setQ] = useState("");
  const [d, setD] = useState("");
  useEffect(() => { const t = setTimeout(() => setD(q), 250); return () => clearTimeout(t); }, [q]);
  const { data, isFetching } = useQuery({
    queryKey: ["fb-compose-products", d],
    queryFn: () => search({ data: { q: d || undefined } }),
    enabled: open,
    staleTime: 30_000,
  });
  const rows = (data?.rows ?? []) as any[];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader><DialogTitle>কোন product post করবেন?</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus className="pl-8" placeholder="Product-এর নাম বা code…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setQ("")}><X className="h-4 w-4" /></button>}
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {isFetching && !rows.length ? <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin" /> :
            rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">কোনো product পাওয়া যায়নি</p> :
            rows.map((p) => (
              <button key={p.id} onClick={() => onPick(p)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted">
                {p.primary_image_url ? <img src={absoluteUrl(p.primary_image_url)!} alt="" className="h-12 w-12 rounded-md border object-cover" />
                  : <span className="grid h-12 w-12 place-items-center rounded-md bg-muted"><Package className="h-5 w-5 text-muted-foreground" /></span>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{tk(p.price)} · {p.stock > 0 ? `স্টক ${p.stock}` : "স্টক শেষ"}</div>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
