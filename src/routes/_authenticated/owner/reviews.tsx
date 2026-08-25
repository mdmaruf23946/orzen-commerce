import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Plus, Pencil, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/compress-image";
import {
  listReviewsAdmin, upsertReview, deleteReview, type PlatformReview,
} from "@/lib/reviews.functions";

export const Route = createFileRoute("/_authenticated/owner/reviews")({
  component: ReviewsPage,
  head: () => ({
    meta: [
      { title: "Reviews & Testimonials | ORZEN Owner" },
      { name: "description", content: "Manage the merchant testimonials shown on the ORZEN landing page." },
      { property: "og:title", content: "Reviews & Testimonials | ORZEN Owner" },
      { property: "og:description", content: "Add, edit and hide landing page merchant reviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Draft = Omit<PlatformReview, "id"> & { id?: string };

const EMPTY: Draft = {
  name: "",
  store_name: "",
  avatar_url: null,
  rating: 5,
  review: "",
  tone: "#0ea5e9",
  is_visible: true,
  sort_order: 0,
};

function ReviewsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listReviewsAdmin);
  const save = useServerFn(upsertReview);
  const remove = useServerFn(deleteReview);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlatformReview | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["owner", "reviews"],
    queryFn: () => list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["owner", "reviews"] });
    qc.invalidateQueries({ queryKey: ["platform", "reviews"] });
  };

  const saveMut = useMutation({
    mutationFn: (d: Draft) => save({ data: d as any }),
    onSuccess: () => { toast.success("Review saved"); setDraft(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Review deleted"); setPendingDelete(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const toUpload = await compressImage(file, { maxEdge: 320, quality: 0.9 });
      const ext = (toUpload.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
      const path = `platform-reviews/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("store-assets")
        .upload(path, toUpload, { upsert: true, contentType: toUpload.type });
      if (error) throw new Error(error.message);
      setDraft((d) => (d ? { ...d, avatar_url: `/api/img/${path}` } : d));
      toast.success("Avatar uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const rows = (data as PlatformReview[]) ?? [];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Reviews &amp; Testimonials</h1>
          <p className="text-sm text-muted-foreground">
            These reviews scroll on the landing page. Hidden ones are never shown publicly.
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY, sort_order: rows.length + 1 })}>
          <Plus className="mr-2 h-4 w-4" /> Add review
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No reviews yet. Add your first merchant testimonial.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className={r.is_visible ? "" : "opacity-60"}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt={r.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                      style={{ background: r.tone }}
                    >
                      {r.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.store_name}</p>
                  </div>
                  <Switch
                    checked={r.is_visible}
                    onCheckedChange={(v) => saveMut.mutate({ ...r, is_visible: v })}
                    aria-label="Visible on landing page"
                  />
                </div>
                <div className="flex gap-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className={k < r.rating ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5 opacity-25"} />
                  ))}
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{r.review}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground">Order #{r.sort_order}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setDraft({ ...r })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPendingDelete(r)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit review" : "Add review"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {draft.avatar_url ? (
                  <img src={draft.avatar_url} alt="avatar" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <span
                    className="grid h-14 w-14 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: draft.tone }}
                  >
                    {(draft.name || "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Avatar</Label>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" asChild disabled={uploading}>
                      <label className="cursor-pointer">
                        {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = ""; }}
                        />
                      </label>
                    </Button>
                    {draft.avatar_url && (
                      <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, avatar_url: null })}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Merchant name</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Store name</Label>
                  <Input value={draft.store_name} onChange={(e) => setDraft({ ...draft, store_name: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setDraft({ ...draft, rating: n })} aria-label={`${n} stars`}>
                      <Star className={n <= draft.rating ? "h-6 w-6 fill-current text-amber-500" : "h-6 w-6 text-muted-foreground/40"} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Review</Label>
                <Textarea rows={4} maxLength={600} value={draft.review} onChange={(e) => setDraft({ ...draft, review: e.target.value })} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Accent colour</Label>
                  <Input type="color" value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value })} className="h-9 p-1" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sort order</Label>
                  <Input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-end gap-2 pb-1.5">
                  <Switch checked={draft.is_visible} onCheckedChange={(v) => setDraft({ ...draft, is_visible: v })} />
                  <Label className="text-xs">Visible</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              disabled={saveMut.isPending || !draft?.name?.trim() || !draft?.review?.trim()}
              onClick={() => draft && saveMut.mutate(draft)}
            >
              {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be removed permanently from the landing page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && delMut.mutate(pendingDelete.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
