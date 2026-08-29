// Live storefront preview embedded inside the Merchant Panel theme page.
// Renders the real store in an iframe at a fixed device width (desktop,
// tablet or mobile) and scales it to fit, so the merchant sees the actual
// responsive layout for each device instead of the panel's own width.
import { useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEME_PREVIEW_PARAM } from "@/lib/theme/context";

type Mode = "desktop" | "tablet" | "mobile";

const DEVICES: Record<Mode, { width: number; height: number; label: string; icon: typeof Monitor }> = {
  desktop: { width: 1280, height: 860, label: "Desktop", icon: Monitor },
  tablet: { width: 820, height: 1080, label: "Tablet", icon: Tablet },
  mobile: { width: 390, height: 780, label: "Mobile", icon: Smartphone },
};

export function ThemePreviewFrame({ slug }: { slug: string }) {
  const [mode, setMode] = useState<Mode>("desktop");
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const src = `/store/${slug}?${THEME_PREVIEW_PARAM}=1&r=${nonce}`;
  const device = DEVICES[mode];

  // Measure the available width and scale the fixed-width iframe down so the
  // full device viewport stays visible without horizontal scrolling.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      // Subtract the wrapper padding (p-2 = 16px, sm:p-3 = 24px) plus a small
      // safety margin, otherwise the scaled frame overflows on the right and
      // the preview looks clipped on that side.
      const padding = window.innerWidth >= 640 ? 24 : 16;
      const available = el.clientWidth - padding - 2;
      setScale(Math.min(1, Math.max(0.1, available / device.width)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device.width]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Store Preview</h2>
        <div className="flex items-center gap-1.5">
          {(Object.keys(DEVICES) as Mode[]).map((m) => {
            const Icon = DEVICES[m].icon;
            return (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                className="h-8 px-2.5"
                onClick={() => {
                  setMode(m);
                  setLoading(true);
                }}
              >
                <Icon className="mr-1 h-3.5 w-3.5" /> {DEVICES[m].label}
              </Button>
            );
          })}
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

      <div ref={wrapRef} className="flex justify-center rounded-xl border bg-muted/30 p-2 sm:p-3">
        <div
          className="relative overflow-hidden rounded-lg border bg-background shadow-sm"
          style={{ width: device.width * scale, height: device.height * scale }}
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            key={src + mode}
            src={src}
            title="Store preview"
            onLoad={() => setLoading(false)}
            className="border-0"
            style={{
              width: device.width,
              height: device.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>
    </div>
  );
}
