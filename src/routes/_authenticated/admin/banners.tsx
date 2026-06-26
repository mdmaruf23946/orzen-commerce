import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { listMyBanners, addBanner, deleteBanner, getMyStore } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUploader } from "@/components/admin/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  component: BannersPage,
});

function BannersPage() {
  const list = useServerFn(listMyBanners);
  const add = useServerFn(addBanner);
  const del = useServerFn(deleteBanner);
  const storeFn = useServerFn(getMyStore);
  const qc = useQueryClient();
  const { data: banners } = useQuery({ queryKey: ["admin", "banners"], queryFn: () => list() });
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  async function remove(id: string) {
    if (!confirm("Delete banner?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "banners"] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!image) return toast.error("Upload an image");
    setSaving(true);
    try {
      await add({ data: { image_url: image, link: link || null } });
      qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      toast.success("Banner added");
      setOpen(false);
      setImage(null);
      setLink("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Banners</h1>
        <Button onClick={() => setOpen(true)} disabled={(banners?.length ?? 0) >= 3}>
          <Plus className="mr-1 h-4 w-4" /> Add banner
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Maximum 3 banners.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(banners ?? []).map((b) => (
          <div key={b.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="aspect-[16/7] bg-muted">
              <img
                src={b.image_url.startsWith("http") ? b.image_url : `/api/img/${b.image_url}`}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="truncate text-xs text-muted-foreground">{b.link || "No link"}</span>
              <button onClick={() => remove(b.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && store && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add banner</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <ImageUploader storeId={store.id} value={image} onChange={setImage} />
              <div className="space-y-1.5">
                <Label htmlFor="lnk">Link (optional)</Label>
                <Input id="lnk" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/product/..." />
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Saving…" : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
