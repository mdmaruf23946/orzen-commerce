import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { SeoCard, SaveBar, type TabProps } from "./shared";

export function SearchTab({ form, set, overview, saving, onSave }: TabProps) {
  const base = overview.storeUrl.replace(/\/$/, "");
  const sitemapUrl = `${base}/sitemap.xml`;
  const robotsUrl = `${base}/robots.txt`;

  return (
    <div className="space-y-4">
      <SeoCard title="Sitemap" description="Helps search engines discover your products and pages.">
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0">
            <Label className="text-sm">Enable sitemap.xml</Label>
            <p className="mt-0.5 break-all text-xs text-muted-foreground">{sitemapUrl}</p>
          </div>
          <Switch
            checked={form.sitemap_enabled !== false}
            onCheckedChange={(v) => set("sitemap_enabled", v)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={sitemapUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View sitemap
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={robotsUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View robots.txt
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {overview.productCount} products and {overview.categoryCount} categories are included
          automatically.
        </p>
      </SeoCard>

      <SeoCard title="robots.txt rules" description="Extra crawl rules appended to the generated file.">
        <Textarea
          rows={5}
          className="font-mono text-xs"
          placeholder={"Disallow: /cart\nDisallow: /checkout"}
          value={form.robots_extra ?? ""}
          onChange={(e) => set("robots_extra", e.target.value)}
        />
      </SeoCard>

      <SaveBar saving={saving} onSave={() => onSave(["sitemap_enabled", "robots_extra"])} />
    </div>
  );
}
