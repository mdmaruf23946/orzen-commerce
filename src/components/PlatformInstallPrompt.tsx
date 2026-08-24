import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "orzen_pwa_dismissed";

/**
 * Platform (orzen.top) install support.
 *
 * - Links the platform manifest, but only on platform pages: storefront and
 *   landing-page routes keep their own manifest (see StoreBranding) so the
 *   two install scopes never overlap.
 * - Shows a lightweight install banner when the browser offers one.
 */
export function PlatformInstallPrompt() {
  const pathname = useRouterState({ select: (st): string => st.location.pathname });
  const isTenant = pathname.startsWith("/store/") || pathname.startsWith("/lp/");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Manifest link — platform pages only.
  useEffect(() => {
    if (typeof document === "undefined" || isTenant) return;
    let link = document.querySelector<HTMLLinkElement>("link[data-platform-manifest]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      link.dataset.platformManifest = "true";
      link.href = "/manifest.webmanifest";
      document.head.appendChild(link);
    }
    let meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#0f172a";
      document.head.appendChild(meta);
    }
    return () => {
      link?.remove();
    };
  }, [isTenant]);

  useEffect(() => {
    if (typeof window === "undefined" || isTenant) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (localStorage.getItem(DISMISS_KEY) !== "1") setVisible(true);
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
  }, [isTenant]);

  if (isTenant || !visible || !deferred) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:right-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">ORZEN - Smart Commerce</p>
          <p className="truncate text-xs text-muted-foreground">Install the app for faster access</p>
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
            localStorage.setItem(DISMISS_KEY, "1");
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
