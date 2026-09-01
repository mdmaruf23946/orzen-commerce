// Live landing-page preview: renders the real page in an iframe at a fixed
// device width (desktop / tablet / mobile) and scales it down to fit the
// panel, so each device shows the true responsive layout.
import { useLayoutEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";

type Mode = "desktop" | "tablet" | "mobile";

const DEVICES: Record<Mode, { width: number; height: number; label: string; icon: typeof Monitor }> = {
  desktop: { width: 1440, height: 900, label: "Desktop", icon: Monitor },
  tablet: { width: 820, height: 1080, label: "Tablet", icon: Tablet },
  mobile: { width: 390, height: 780, label: "Mobile", icon: Smartphone },
};

export function LandingPreviewFrame({
  previewSrc,
  openUrl,
}: {
  previewSrc: string;
  openUrl: string;
}) {
  const [mode, setMode] = useState<Mode>("desktop");
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const device = DEVICES[mode];
  const src = `${previewSrc}${previewSrc.includes("?") ? "&" : "?"}r=${nonce}`;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
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
    <div className="min-w-0 space-y-2 rounded-xl border bg-card p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
        <div className="min-w-0">
          <span className="text-sm font-semibold">Live preview</span>{" "}
          <span className="text-xs text-muted-foreground">View only · reflects saved content</span>
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-1.5 sm:ml-auto">
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
            <a href={openUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      <div ref={wrapRef} className="flex justify-center rounded-lg border bg-muted/30 p-2 sm:p-3">
        <div
          className="relative overflow-hidden rounded-lg border bg-white shadow-sm"
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
            title="Landing page preview"
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
