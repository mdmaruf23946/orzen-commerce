import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Applies a landing page's own branding to the document head — favicon,
 * apple-touch-icon, theme colour and a real (server-served) per-page PWA
 * manifest — so the page installs as its own app and never inherits the ORZEN
 * platform app icon/name.
 */
export function LandingBranding({
  slug,
  name,
  icon,
  themeColor,
}: {
  slug: string;
  name: string;
  icon: string | null;
  themeColor?: string | null;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const setLink = (rel: string, href: string) => {
      let el = document.querySelector<HTMLLinkElement>(`link[data-lp-branding="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.rel = rel;
        el.dataset.lpBranding = rel;
        document.head.appendChild(el);
      }
      el.href = href;
    };

    if (icon) {
      document
        .querySelectorAll<HTMLLinkElement>("link[rel~='icon'],link[rel='apple-touch-icon']")
        .forEach((el) => {
          if (!el.dataset.lpBranding) el.remove();
        });
      setLink("icon", icon);
      setLink("apple-touch-icon", icon);
    }

    // Landing pages served on their own host install at the root; on the
    // platform host the scope stays under /lp/<slug>/ so the two never overlap.
    const onOwnHost = !window.location.pathname.startsWith("/lp/");
    document.querySelectorAll<HTMLLinkElement>("link[rel='manifest']").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "manifest";
    link.dataset.lpBranding = "manifest";
    link.href = `/api/public/lp-manifest/${slug}${onOwnHost ? "?root=1" : ""}`;
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
  }, [slug, icon, themeColor]);

  return <LandingInstallPrompt slug={slug} name={name} icon={icon} />;
}

/** Lightweight "Install app" banner for a landing page. */
function LandingInstallPrompt({
  slug,
  name,
  icon,
}: {
  slug: string;
  name: string;
  icon: string | null;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissKey = `orzen_lp_pwa_dismissed:${slug}`;

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
    <div className="fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-md rounded-xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-100 text-neutral-700">
          {icon ? (
            <img src={icon} alt="" className="h-full w-full object-cover" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
          <p className="truncate text-xs text-neutral-500">Install this page as an app</p>
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
          className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
        >
          Install
        </button>
        <button
          aria-label="Dismiss install prompt"
          onClick={() => {
            localStorage.setItem(dismissKey, "1");
            setVisible(false);
          }}
          className="rounded-md p-1 text-neutral-400 hover:text-neutral-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
