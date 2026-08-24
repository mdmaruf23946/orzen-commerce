import { useEffect } from "react";

/**
 * Applies the active store's branding to the document head:
 * favicon, apple-touch-icon and a per-store PWA manifest.
 * Falls back to no-op (keeps whatever is set) when the store has no icon.
 */
export function StoreBranding({
  name,
  iconUrl,
  faviconUrl,
  themeColor,
}: {
  name: string;
  iconUrl: string | null;
  faviconUrl: string | null;
  themeColor?: string | null;
}) {
  const icon = faviconUrl ?? iconUrl;

  useEffect(() => {
    if (typeof document === "undefined") return;

    const setLink = (rel: string, href: string) => {
      let el = document.querySelector<HTMLLinkElement>(`link[data-store-branding="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.rel = rel;
        el.dataset.storeBranding = rel;
        document.head.appendChild(el);
      }
      el.href = href;
    };

    if (icon) {
      // Remove platform-level icons so the store's own icon wins.
      document
        .querySelectorAll<HTMLLinkElement>("link[rel~='icon'],link[rel='apple-touch-icon']")
        .forEach((el) => {
          if (!el.dataset.storeBranding) el.remove();
        });
      setLink("icon", icon);
      setLink("apple-touch-icon", icon);
    }

    // Per-store web app manifest (install prompt shows the store, not the platform).
    const manifest = {
      name,
      short_name: name.slice(0, 12),
      start_url: window.location.origin + window.location.pathname,
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: themeColor || "#0f172a",
      icons: icon
        ? [
            { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
          ]
        : [],
    };
    const blobUrl = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }),
    );
    document
      .querySelectorAll<HTMLLinkElement>("link[rel='manifest']")
      .forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "manifest";
    link.dataset.storeBranding = "manifest";
    link.href = blobUrl;
    document.head.appendChild(link);

    let meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = themeColor || "#0f172a";

    return () => {
      link.remove();
      URL.revokeObjectURL(blobUrl);
    };
  }, [name, icon, themeColor]);

  return null;
}
