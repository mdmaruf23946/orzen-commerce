import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Applies the active store's branding to the document head:
 * favicon, apple-touch-icon and a real (server-served) per-store PWA manifest
 * so the storefront can be installed with the store's own app icon.
 */
export function StoreBranding({
  slug,
  name,
  iconUrl,
  faviconUrl,
  themeColor,
}: {
  slug?: string;
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

    // Real manifest URL (blob: manifests are ignored by Android install flows,
    // which is why the store icon never showed on the install dialog).
    const manifestHref = slug
      ? `/store/${slug}/manifest.webmanifest`
      : "/manifest.webmanifest";
    document
      .querySelectorAll<HTMLLinkElement>("link[rel='manifest']")
      .forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "manifest";
    link.dataset.storeBranding = "manifest";
    link.href = manifestHref;
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
    };
  }, [slug, name, icon, themeColor]);

  return <StoreInstallPrompt slug={slug} name={name} icon={icon} />;
}

/** Lightweight "Install app" banner for the storefront. */
function StoreInstallPrompt({
  slug,
  name,
  icon,
}: {
  slug?: string;
  name: string;
  icon: string | null;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissKey = `orzen_store_pwa_dismissed:${slug ?? name}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (localStorage.getItem(dismissKey) !== "1") setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [dismissKey]);

  if (!visible || !deferred) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-md rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary">
          {icon ? (
            <img src={icon} alt="" className="h-full w-full object-cover" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">Install this store as an app</p>
        </div>
        <button
          onClick={async () => {
            try {
              await deferred.prompt();
              await deferred.userChoice;
            } finally {
              setVisible(false);
              setDeferred(null);
            }
          }}
          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Install
        </button>
        <button
          aria-label="Dismiss install prompt"
          onClick={() => {
            localStorage.setItem(dismissKey, "1");
            setVisible(false);
          }}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
