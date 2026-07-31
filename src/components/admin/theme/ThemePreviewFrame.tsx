import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet, RefreshCw, ExternalLink } from "lucide-react";
import {
  THEME_PREVIEW_MESSAGE,
  THEME_PREVIEW_PARAM,
  THEME_PREVIEW_READY,
} from "@/lib/theme/context";
import { Button } from "@/components/ui/button";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

const SIZES: Record<PreviewDevice, { w: number; h: number; label: string; icon: any }> = {
  desktop: { w: 1280, h: 900, label: "Desktop", icon: Monitor },
  tablet: { w: 834, h: 1050, label: "Tablet", icon: Tablet },
  mobile: { w: 390, h: 780, label: "Mobile", icon: Smartphone },
};

/**
 * Embeds the real storefront and streams theme changes to it over postMessage.
 * The iframe mounts once — setting changes never remount or reload it.
 */
export function ThemePreviewFrame({
  slug,
  definition,
  overrides,
  path = "",
}: {
  slug: string;
  definition: unknown;
  overrides: unknown;
  path?: string;
}) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const src = `/store/${slug}${path}?${THEME_PREVIEW_PARAM}=1`;
  const size = SIZES[device];

  // Handshake: the storefront announces itself once mounted.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === THEME_PREVIEW_READY) setReady(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Stream theme changes, throttled to one frame.
  useEffect(() => {
    if (!ready) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      frameRef.current?.contentWindow?.postMessage(
        { type: THEME_PREVIEW_MESSAGE, definition, overrides },
        window.location.origin,
      );
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, definition, overrides]);

  // Fit the virtual viewport into whatever space the panel has.
  useEffect(() => {
    const fit = () => {
      const w = boxRef.current?.clientWidth ?? 0;
      if (!w) return;
      setScale(Math.min(1, w / size.w));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [size.w]);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-muted/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
          {(Object.keys(SIZES) as PreviewDevice[]).map((d) => {
            const Icon = SIZES[d].icon;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-label={SIZES[d].label}
                className={`grid h-7 w-8 place-items-center rounded-md transition ${
                  device === d ? "bg-background shadow-sm" : "opacity-60 hover:opacity-100"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {size.w}×{size.h} · {Math.round(scale * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Reload preview"
            onClick={() => {
              setReady(false);
              if (frameRef.current) frameRef.current.src = src;
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" asChild aria-label="Open storefront">
            <a href={`/store/${slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      <div ref={boxRef} className="min-w-0 overflow-hidden p-3">
        <div style={{ height: size.h * scale }} className="mx-auto w-full">
          <iframe
            ref={frameRef}
            src={src}
            title="Storefront preview"
            className="origin-top-left rounded-lg border bg-background shadow-sm"
            style={{
              width: size.w,
              height: size.h,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>
    </div>
  );
}
