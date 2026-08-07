import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { resolveStoreSeo } from "@/lib/seo";
import { SeoCard, SaveBar, Counter, type TabProps } from "./shared";
import { GooglePreview } from "./Previews";

export function BasicTab({ form, set, overview, saving, onSave }: TabProps) {
  const store = overview.store;
  const auto = resolveStoreSeo(
    { ...store, seo: {} },
    { origin: overview.storeUrl, categories: overview.categories, productCount: overview.productCount },
  );
  const resolved = resolveStoreSeo(
    { ...store, seo: form },
    { origin: overview.storeUrl, categories: overview.categories, productCount: overview.productCount },
  );

  return (
    <div className="space-y-4">
      <SeoCard title="Basic SEO" description="How your store appears in search results.">
        <div className="space-y-1.5">
          <Label>SEO Title</Label>
          <Input
            value={form.title ?? ""}
            placeholder={auto.title}
            maxLength={160}
            onChange={(e) => set("title", e.target.value)}
          />
          <Counter value={form.title ?? ""} min={25} max={60} />
        </div>
        <div className="space-y-1.5">
          <Label>Meta Description</Label>
          <Textarea
            rows={3}
            value={form.description ?? ""}
            placeholder={auto.description}
            maxLength={320}
            onChange={(e) => set("description", e.target.value)}
          />
          <Counter value={form.description ?? ""} min={70} max={160} />
        </div>
        <div className="space-y-1.5">
          <Label>Canonical URL</Label>
          <Input
            value={form.canonical_url ?? ""}
            placeholder={overview.storeUrl}
            onChange={(e) => set("canonical_url", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use your store address automatically.
          </p>
        </div>
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0">
            <Label className="text-sm">Search engine visibility</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {form.noindex ? "No Index — search engines are asked to skip this store." : "Index — your store can appear in search results."}
            </p>
          </div>
          <Switch
            checked={form.noindex !== true}
            onCheckedChange={(v) => set("noindex", !v)}
          />
        </div>
      </SeoCard>

      <SeoCard title="Favicon" description="Small icon shown in browser tabs and search results.">
        {store?.id ? (
          <ImageUploader
            storeId={store.id}
            value={form.favicon_url ?? null}
            onChange={(v) => set("favicon_url", v ?? "")}
          />
        ) : null}
        <p className="text-xs text-muted-foreground">
          If empty, your store icon or logo is used automatically.
        </p>
      </SeoCard>

      <GooglePreview
        title={resolved.title}
        description={resolved.description}
        url={resolved.canonical ?? overview.storeUrl}
      />

      <SaveBar saving={saving} onSave={() => onSave(["title", "description", "canonical_url", "noindex", "favicon_url"])} />
    </div>
  );
}
