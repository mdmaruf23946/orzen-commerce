// Invisible-by-default Cloudflare Turnstile widget.
// Renders nothing when VITE_TURNSTILE_SITE_KEY is not configured, so forms
// keep working while the bot shield is being rolled out.
import { useEffect, useRef } from "react";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("turnstile-script"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function turnstileConfigured(): boolean {
  return !!import.meta.env["VITE_TURNSTILE_SITE_KEY"];
}

export const CAPTCHA_WAIT_BN =
  "নিরাপত্তা যাচাই চলছে — কয়েক সেকেন্ড অপেক্ষা করে আবার চেষ্টা করুন।";


export function TurnstileWidget({
  onToken,
  className,
}: {
  onToken: (token: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const siteKey = import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          "error-callback": () => onToken(""),
          "expired-callback": () => onToken(""),
          appearance: "interaction-only",
        });
      })
      .catch(() => {
        /* network blocked — form stays usable */
      });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className={className} />;
}

export default TurnstileWidget;
