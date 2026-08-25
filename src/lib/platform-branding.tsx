// Client hook + <BrandMark /> renderer for centralized platform branding.
// Falls back gracefully to the caller-provided default text/logo when no
// branding has been configured yet, so existing UI is unchanged until the
// Winner Admin publishes assets.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  getPlatformBranding,
  type BrandingAsset,
  type PlatformBranding,
} from "./platform-branding.functions";

export const PLACEMENT_KEYS = [
  "winner_header",
  "store_header",
  "sidebar",
  "mobile_header",
  "website_header",
  "customer_store",
  "auth_login",
  "auth_register",
  "auth_forgot",
  "footer",
  "checkout",
  "order_confirm",
  "loading",
  "invoice",
  "email",
] as const;

export type PlacementKey = (typeof PLACEMENT_KEYS)[number];

export const PLACEMENT_LABELS: Record<PlacementKey, string> = {
  winner_header: "Winner Admin Header",
  store_header: "Merchant Panel Header",
  sidebar: "Sidebar",
  mobile_header: "Mobile Header",
  website_header: "Website Header",
  customer_store: "Customer Store",
  auth_login: "Login Page",
  auth_register: "Register Page",
  auth_forgot: "Forgot Password Page",
  footer: "Footer",
  checkout: "Checkout",
  order_confirm: "Order Confirmation",
  loading: "Loading Screen",
  invoice: "Invoice",
  email: "Email Templates",
};

export function usePlatformBranding() {
  const fn = useServerFn(getPlatformBranding);
  return useQuery({
    queryKey: ["platform-branding"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}

type ResolvedPlacement = {
  mode: "logo" | "wordmark" | "both";
  layout: "left" | "top" | "centered";
  align: "start" | "center" | "end";
  gap: number;
  visible: boolean;
  logo: BrandingAsset;
  wordmark: BrandingAsset;
  logoSize: number;
  wordmarkSize: number;
};

export function resolvePlacement(
  b: PlatformBranding | null | undefined,
  key: PlacementKey,
  isDark = false,
): ResolvedPlacement | null {
  if (!b) return null;
  const p = b.placements?.[key] ?? {};
  const combo = b.combo ?? {};
  const custom = p.source === "custom";

  const pickAsset = (
    customAsset: BrandingAsset | undefined,
    globalPrimary: BrandingAsset | undefined,
    globalDark?: BrandingAsset | undefined,
    globalLight?: BrandingAsset | undefined,
  ): BrandingAsset => {
    if (custom && customAsset) return customAsset;
    if (isDark && globalDark) return globalDark;
    if (!isDark && globalLight) return globalLight;
    return globalPrimary ?? null;
  };

  const logo = pickAsset(
    p.logo,
    b.assets?.primaryLogo,
    b.assets?.darkLogo,
    b.assets?.lightLogo,
  );
  const wordmark = pickAsset(
    p.wordmark,
    b.assets?.primaryWordmark,
    b.assets?.darkWordmark,
    b.assets?.lightWordmark,
  );

  return {
    mode: (p.mode ?? combo.mode ?? "both") as ResolvedPlacement["mode"],
    layout: (p.layout ?? combo.layout ?? "left") as ResolvedPlacement["layout"],
    align: (p.align ?? combo.align ?? "start") as ResolvedPlacement["align"],
    gap: combo.gap ?? 8,
    visible: p.visible !== false,
    logo,
    wordmark,
    logoSize: combo.logoSize ?? 32,
    wordmarkSize: combo.wordmarkSize ?? 24,
  };
}

export function BrandMark({
  placement,
  fallbackText,
  className,
  isDark,
}: {
  placement: PlacementKey;
  /** Rendered when no branding assets are configured yet. Preserves existing UI. */
  fallbackText?: string;
  className?: string;
  isDark?: boolean;
}) {
  const { data } = usePlatformBranding();
  // Branding is fetched client-side, so the first client render must match the
  // SSR output (fallback text) — swap in the assets only after hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const resolved = useMemo(
    () => resolvePlacement(data ?? null, placement, !!isDark),
    [data, placement, isDark],
  );

  if (!hydrated || !resolved || !resolved.visible) {
    return fallbackText ? <span className={className}>{fallbackText}</span> : null;
  }

  const showLogo = (resolved.mode === "logo" || resolved.mode === "both") && !!resolved.logo?.url;
  const showWord =
    (resolved.mode === "wordmark" || resolved.mode === "both") && !!resolved.wordmark?.url;

  if (!showLogo && !showWord) {
    return fallbackText ? <span className={className}>{fallbackText}</span> : null;
  }

  const flexDir =
    resolved.layout === "top" ? "flex-col" : "flex-row";
  const justify =
    resolved.align === "center"
      ? "justify-center"
      : resolved.align === "end"
        ? "justify-end"
        : "justify-start";
  const itemsAlign = resolved.layout === "top" ? "items-center" : "items-center";

  const style: CSSProperties = { gap: resolved.gap };

  return (
    <span
      className={["inline-flex", flexDir, itemsAlign, justify, className ?? ""].join(" ")}
      style={style}
    >
      {showLogo && (
        <img
          src={resolved.logo!.url}
          alt=""
          style={{ height: resolved.logoSize, width: "auto" }}
          className="object-contain"
        />
      )}
      {showWord && (
        <img
          src={resolved.wordmark!.url}
          alt={fallbackText ?? "brand"}
          style={{ height: resolved.wordmarkSize, width: "auto" }}
          className="object-contain"
        />
      )}
    </span>
  );
}
