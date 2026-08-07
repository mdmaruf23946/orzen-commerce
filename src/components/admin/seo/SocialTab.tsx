import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { resolveStoreSeo } from "@/lib/seo";
import { SeoCard, SaveBar, type TabProps } from "./shared";
import { SocialPreview } from "./Previews";

export function SocialTab({ form, set, overview, saving, onSave }: TabProps) {
  const store = overview.store;
  const resolved = resolveStoreSeo(
    { ...store, seo: form },
    { origin: overview.storeUrl, categories: overview.categories, productCount: overview.productCount },
  );

  return (
    <div className="space-y-4">
      <SeoCard title="Social preview" description="Shown when your store link is shared.">
        <div className="space-y-1.5">
          <Label>Open Graph Title</Label>
          <Input
            value={form.og_title ?? ""}
            placeholder={resolved.title}
            maxLength={160}
            onChange={(e) => set("og_title", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Open Graph Description</Label>
          <Textarea
            rows={3}
            value={form.og_description ?? ""}
            placeholder={resolved.description}
            maxLength={320}
            onChange={(e) => set("og_description", e.target.value)}
          />
        </div>
        {store?.id && (
          <>
            <div className="space-y-1.5">
              <Label>Open Graph Image (1200×630 recommended)</Label>
              <ImageUploader
                storeId={store.id}
                value={form.og_image_url ?? null}
                onChange={(v) => set("og_image_url", v ?? "")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Twitter / X Image</Label>
              <ImageUploader
                storeId={store.id}
                value={form.twitter_image_url ?? null}
                onChange={(v) => set("twitter_image_url", v ?? "")}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to reuse the Open Graph image.
              </p>
            </div>
          </>
        )}
      </SeoCard>

      <SeoCard title="Live preview">
        <div className="grid gap-3 sm:grid-cols-2">
          <SocialPreview
            variant="facebook"
            title={resolved.ogTitle}
            description={resolved.ogDescription}
            image={resolved.ogImage}
            url={resolved.canonical ?? overview.storeUrl}
          />
          <SocialPreview
            variant="x"
            title={resolved.ogTitle}
            description={resolved.ogDescription}
            image={resolved.twitterImage}
            url={resolved.canonical ?? overview.storeUrl}
          />
        </div>
      </SeoCard>

      <SaveBar
        saving={saving}
        onSave={() => onSave(["og_title", "og_description", "og_image_url", "twitter_image_url"])}
      />
    </div>
  );
}
