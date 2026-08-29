// Live storefront preview embedded inside the Merchant Panel theme page.
// Shows the real store in an iframe so the merchant sees their actual
// storefront with the currently selected theme applied.
import { useState } from "react";
import { ExternalLink, Loader2, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_PREVIEW_PARAM } from "@/lib/theme/context";

export function ThemePreviewFrame({ slug }: { slug: string }) {
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);

  const src = `/store/${slug}?${THEME_PREVIEW_PARAM}=1&r=${nonce}`;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Store Preview</h2>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={mode === "desktop" ? "default" : "outline"}
            className="h-8 px-2.5"
            onClick={() => setMode("desktop")}
          >
            <Monitor className="mr-1 h-3.5 w-3.5" /> Desktop
          </Button>
          <Button
            size="sm"
            variant={mode === "mobile" ? "default" : "outline"}
            className="h-8 px-2.5"
            onClick={() => setMode("mobile")}
          >
            <Smartphone className="mr-1 h-3.5 w-3.5" /> Mobile
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5"
            onClick={() => {
              setLoading(true);
              setNonce((n) => n + 1);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2.5" asChild>
            <a href={`/store/${slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      <div className="flex justify-center rounded-xl border bg-muted/30 p-2 sm:p-3">
        <div
          className={`relative w-full overflow-hidden rounded-lg border bg-background shadow-sm transition-all ${
            mode === "mobile" ? "max-w-[390px]" : "max-w-full"
          }`}
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            key={src}
            src={src}
            title="Store preview"
            onLoad={() => setLoading(false)}
            className={`w-full border-0 ${mode === "mobile" ? "h-[640px]" : "h-[560px] lg:h-[680px]"}`}
          />
        </div>
      </div>
    </div>
  );
}
