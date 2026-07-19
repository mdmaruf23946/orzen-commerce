import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyActiveAds, type ActiveAd } from "@/lib/ads-public.functions";
import { useIsMobile } from "@/hooks/use-mobile";

const SLOT_KEY = "admin_mobile_sticky_bottom";

export function StickyMobileAdBar() {
  const isMobile = useIsMobile();
  const fn = useServerFn(getMyActiveAds);
  const { data } = useQuery({
    queryKey: ["my-ads"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
    retry: false,
    enabled: isMobile,
  });

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Small delay so it doesn't compete with initial paint
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  if (!isMobile) return null;
  const ad = (data ?? []).find((a: ActiveAd) => a.slot_key === SLOT_KEY);
  if (!ad || !ad.code) return null;

  return (
    <div
      role="complementary"
      aria-label="advertisement"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center border-t bg-background/95 backdrop-blur md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        height: `calc(50px + env(safe-area-inset-bottom))`,
      }}
    >
      {visible && (
        <iframe
          title="ad"
          srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>html,body{margin:0;padding:0;overflow:hidden;font-family:system-ui;display:flex;align-items:center;justify-content:center}</style></head><body>${ad.code}</body></html>`}
          sandbox="allow-scripts allow-popups allow-same-origin allow-popups-to-escape-sandbox"
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{ width: 320, height: 50, maxWidth: "100%", border: 0, display: "block" }}
        />
      )}
    </div>
  );
}
