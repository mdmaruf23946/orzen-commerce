import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { usePlatformBranding } from "@/lib/platform-branding";
import { getMyStore } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

type StoreBranding = {
  source?: "platform" | "custom";
  mode?: "logo" | "wordmark" | "both";
  logo_url?: string | null;
  wordmark_url?: string | null;
  name?: string | null;
};

function useIsDark() {
  const [dark, setDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function StoreBrandMark({
  iconOnly = false,
  compact = false,
  className,
}: {
  iconOnly?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const fetchStore = useServerFn(getMyStore);
  const { data: store } = useQuery({
    queryKey: ["admin", "store"],
    queryFn: () => fetchStore(),
    staleTime: 60_000,
  });
  const { data: platform } = usePlatformBranding();
  const isDark = useIsDark();

  const branding: StoreBranding = ((store as any)?.branding ?? { source: "platform" }) as StoreBranding;
  const iconSize = compact ? 22 : 26;
  const wordSize = compact ? 16 : 18;

  // Custom store branding
  if (branding.source === "custom") {
    const mode = branding.mode ?? "both";
    const showLogo = (mode === "logo" || mode === "both") && !!branding.logo_url;
    const showWord = mode === "wordmark" || mode === "both";
    const wordText = branding.name || (store as any)?.name || "";
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        {showLogo && (
          <img
            src={branding.logo_url!}
            alt=""
            style={{ height: iconSize, width: "auto" }}
            className="object-contain"
          />
        )}
        {!iconOnly && showWord && (
          branding.wordmark_url ? (
            <img
              src={branding.wordmark_url}
              alt={wordText}
              style={{ height: wordSize, width: "auto" }}
              className="object-contain"
            />
          ) : (
            <span className="truncate font-bold tracking-tight" style={{ fontSize: wordSize }}>
              {wordText}
            </span>
          )
        )}
      </span>
    );
  }

  // Platform (ORZEN) default branding, theme aware
  const assets = platform?.assets ?? {};
  const logo =
    (isDark ? assets.darkLogo : assets.lightLogo) ?? assets.primaryLogo ?? null;
  const wordmark =
    (isDark ? assets.darkWordmark : assets.lightWordmark) ?? assets.primaryWordmark ?? null;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {logo?.url ? (
        <img
          src={logo.url}
          alt=""
          style={{ height: iconSize, width: "auto" }}
          className="object-contain"
        />
      ) : (
        <span
          className="grid shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground font-black"
          style={{ height: iconSize, width: iconSize, fontSize: iconSize * 0.55 }}
        >
          O
        </span>
      )}
      {!iconOnly && (
        wordmark?.url ? (
          <img
            src={wordmark.url}
            alt="ORZEN"
            style={{ height: wordSize, width: "auto" }}
            className="object-contain"
          />
        ) : (
          <span className="font-black tracking-tight" style={{ fontSize: wordSize }}>
            ORZEN
          </span>
        )
      )}
    </span>
  );
}
