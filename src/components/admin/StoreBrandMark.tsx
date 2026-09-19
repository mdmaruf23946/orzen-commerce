import { useEffect, useState } from "react";
import { usePlatformBranding } from "@/lib/platform-branding";
import { cn } from "@/lib/utils";

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
  const { data: platform } = usePlatformBranding();
  const isDark = useIsDark();

  const iconSize = compact ? 32 : 40;
  const wordSize = compact ? 22 : 28;

  const assets = platform?.assets ?? {};
  const darkLogo = isDark ? assets.darkLogo : null;
  const darkWordmark = isDark ? assets.darkWordmark : null;
  const logo = darkLogo ?? (isDark ? null : assets.lightLogo) ?? assets.primaryLogo ?? null;
  const wordmark =
    darkWordmark ?? (isDark ? null : assets.lightWordmark) ?? assets.primaryWordmark ?? null;

  // When no dedicated dark asset exists, the light artwork (dark ink on a
  // transparent background) disappears against the dark sidebar. Invert it to
  // a crisp white so the brand stays legible.
  const invertWordmark = isDark && !darkWordmark;

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
            className={cn("object-contain", invertWordmark && "brightness-0 invert")}
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
