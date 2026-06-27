import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyStore, updateSeo } from "@/lib/admin.functions";
import { SettingsPage } from "@/components/admin/SettingsPage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/ImageUploader";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  component: SeoPage,
});

const defaults = {
  title: "",
  description: "",
  keywords: "",
  og_image_url: "",
  favicon_url: "",
};

function SeoPage() {
  const storeFn = useServerFn(getMyStore);
  const { data: store } = useQuery({ queryKey: ["admin", "store"], queryFn: () => storeFn() });
  const storeId = (store as any)?.id;

  return (
    <SettingsPage
      title="SEO Settings"
      description="How your storefront appears in search results and link previews."
      column="seo"
      save={updateSeo}
      defaults={defaults}
    >
      {(form, set) => (
        <>
          <div className="space-y-1.5">
            <Label>SEO Title</Label>
            <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label>Meta Description</Label>
            <Textarea
              rows={3}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              maxLength={320}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Meta Keywords (comma separated)</Label>
            <Input value={form.keywords ?? ""} onChange={(e) => set("keywords", e.target.value)} />
          </div>
          {storeId && (
            <>
              <div className="space-y-1.5">
                <Label>Open Graph Image (1200×630 recommended)</Label>
                <ImageUploader
                  storeId={storeId}
                  value={form.og_image_url}
                  onChange={(v) => set("og_image_url", v ?? "")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Favicon</Label>
                <ImageUploader
                  storeId={storeId}
                  value={form.favicon_url}
                  onChange={(v) => set("favicon_url", v ?? "")}
                />
              </div>
            </>
          )}
        </>
      )}
    </SettingsPage>
  );
}
