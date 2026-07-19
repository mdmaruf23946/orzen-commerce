import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getMyActiveAds, type ActiveAd } from "@/lib/ads-public.functions";

const FORMAT_SIZE: Record<string, { w: number | string; h: number }> = {
  banner_728x90: { w: 728, h: 90 },
  banner_320x50: { w: 320, h: 50 },
  banner_300x250: { w: 300, h: 250 },
  native: { w: "100%", h: 250 },
  responsive: { w: "100%", h: 120 },
};

export function AdSlot({ slotKey, className }: { slotKey: string; className?: string }) {
  const fn = useServerFn(getMyActiveAds);
  const { data } = useQuery({
    queryKey: ["my-ads"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const ad = (data ?? []).find((a: ActiveAd) => a.slot_key === slotKey);
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ad || visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad, visible]);

  if (!ad || !ad.code) return null;
  const size = FORMAT_SIZE[ad.format] ?? FORMAT_SIZE.responsive;
  const width = typeof size.w === "number" ? `${size.w}px` : size.w;

  return (
    <div
      ref={ref}
      className={className ?? "my-6 flex justify-center"}
      style={{ minHeight: size.h }}
      aria-label="advertisement"
    >
      {visible && (
        <iframe
          title="ad"
          srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>html,body{margin:0;padding:0;overflow:hidden;font-family:system-ui}</style></head><body>${ad.code}</body></html>`}
          sandbox="allow-scripts allow-popups allow-same-origin allow-popups-to-escape-sandbox"
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            width,
            maxWidth: "100%",
            height: size.h,
            border: 0,
            display: "block",
          }}
        />
      )}
    </div>
  );
}
