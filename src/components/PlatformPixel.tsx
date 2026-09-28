// ORZEN main-website Meta Pixel + consent banner.
// Loads ONLY on the ORZEN platform hosts and never on merchant store pages,
// uses `trackSingle` so no other pixel on the page receives our events, and
// mirrors every browser event to the server (CAPI) with the same event id.
import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPlatformPixelPublic, trackAccountConversions } from "@/lib/platform-meta.functions";

const NOTICE_VERSION = "2026-09-28";
const CONSENT_COUNTRIES = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH".split(" "),
);

function isPlatformHost(h: string) {
  h = h.toLowerCase();
  return h === "orzen.top" || h === "www.orzen.top" || h === "localhost" || h.endsWith(".lovable.app") || h.endsWith(".lovableproject.com");
}
function excludedPath(p: string) {
  return p.startsWith("/store/") || p.startsWith("/owner") || p.startsWith("/api/") || p.startsWith("/lp/");
}
function getCookie(name: string) {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}
function setCookie(name: string, value: string, days: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${secure}`;
}
function newId(prefix: string) {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`.replace(".", "");
  return `${prefix}_${r}`;
}

async function needsConsentRegion(): Promise<boolean> {
  const cached = sessionStorage.getItem("orzen_region");
  if (cached) return cached === "consent";
  let consent = true;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch("/cdn-cgi/trace", { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (r.ok) {
      const loc = (await r.text()).match(/^loc=(\w+)/m)?.[1]?.toUpperCase();
      consent = !loc || loc === "XX" || loc === "T1" || CONSENT_COUNTRIES.has(loc);
    }
  } catch {
    consent = true;
  }
  sessionStorage.setItem("orzen_region", consent ? "consent" : "free");
  return consent;
}

type W = Window & { fbq?: any; _fbq?: any; __orzenPixel?: string };

function loadPixel(pixelId: string) {
  const w = window as W;
  if (w.__orzenPixel === pixelId) return true;
  if (w.fbq && !w.__orzenPixel) {
    // Another (merchant) pixel is already on this page — a clean reload keeps them apart.
    if (!sessionStorage.getItem("orzen_px_reload")) {
      sessionStorage.setItem("orzen_px_reload", "1");
      location.reload();
    }
    return false;
  }
  if (!w.fbq) {
    const n: any = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    };
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    w.fbq = n;
    w._fbq = n;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  w.fbq("set", "autoConfig", false, pixelId);
  w.fbq("init", pixelId);
  w.__orzenPixel = pixelId;
  return true;
}

function ensureClickIds() {
  const fbclid = new URLSearchParams(location.search).get("fbclid");
  if (fbclid) setCookie("_fbc", `fb.1.${Date.now()}.${fbclid}`, 90);
  if (!getCookie("_fbp")) setCookie("_fbp", `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`, 90);
}

export function PlatformPixel() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const getCfg = useServerFn(getPlatformPixelPublic);
  const trackAccount = useServerFn(trackAccountConversions);
  const [cfg, setCfg] = useState<{ pixel_id: string; events: Record<string, boolean> } | null>(null);
  const [consentRegion, setConsentRegion] = useState<boolean | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const lastPath = useRef<string | null>(null);

  const eligible = typeof window !== "undefined" && isPlatformHost(location.hostname) && !excludedPath(pathname);
  const allowed = !!cfg && consentRegion !== null && (consentRegion ? choice === "accepted" : choice !== "rejected");

  // Load config + region once.
  useEffect(() => {
    if (!isPlatformHost(location.hostname)) return;
    setChoice(getCookie("orzen_consent"));
    getCfg()
      .then((c: any) => (c?.active ? setCfg({ pixel_id: c.pixel_id, events: c.events ?? {} }) : null))
      .catch(() => null);
    needsConsentRegion().then(setConsentRegion);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "orzen_consent") setChoice(getCookie("orzen_consent"));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [getCfg]);

  useEffect(() => {
    if (cfg && consentRegion && !choice && eligible) setShowBanner(true);
  }, [cfg, consentRegion, choice, eligible]);

  const send = (event: string, eventId: string, custom?: Record<string, string | number>) => {
    if (!cfg || cfg.events[event] === false) return;
    try {
      (window as W).fbq?.("trackSingle", cfg.pixel_id, event, custom ?? {}, { eventID: eventId });
    } catch {
      /* pixel blocked — server copy still goes */
    }
    fetch("/api/public/platform-meta/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, event_id: eventId, url: location.href, custom_data: custom }),
      keepalive: true,
    }).catch(() => undefined);
  };

  // Page views + funnel pages on every SPA navigation.
  useEffect(() => {
    if (!eligible) {
      // Leaving the main site for a merchant store page: full reload so our pixel is gone.
      if ((window as W).__orzenPixel && excludedPath(pathname) && pathname.startsWith("/store/")) location.reload();
      return;
    }
    if (!allowed || !cfg) return;
    if (!loadPixel(cfg.pixel_id)) return;
    ensureClickIds();
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    send("PageView", newId("pv"));
    const checkout = pathname.match(/^\/admin\/billing\/checkout\/([\w-]+)/);
    if (checkout) send("InitiateCheckout", `ic_${checkout[1]}_${new Date().toISOString().slice(0, 10)}`, { content_ids: checkout[1]! });
    else if (/^\/admin\/billing\/?$|^\/pricing\/?$|^\/admin\/subscription\/?$/.test(pathname)) send("ViewContent", newId("vc"), { content_type: "plans" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, allowed, cfg, eligible]);

  // Signup / new store / trial — server decides (idempotent ids), browser mirrors the same ids.
  useEffect(() => {
    if (!allowed || !cfg) return;
    const run = async () => {
      if (sessionStorage.getItem("orzen_acct_tracked")) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      sessionStorage.setItem("orzen_acct_tracked", "1");
      const r: any = await trackAccount({ data: { url: location.href } }).catch(() => null);
      for (const e of r?.events ?? []) {
        try {
          (window as W).fbq?.("trackSingle", cfg.pixel_id, e.event, {}, { eventID: e.id });
        } catch {
          /* ignore */
        }
      }
    };
    void run();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setTimeout(() => void run(), 1500);
      if (event === "SIGNED_OUT") sessionStorage.removeItem("orzen_acct_tracked");
    });
    return () => sub.subscription.unsubscribe();
  }, [allowed, cfg, trackAccount]);

  const decide = (c: "accepted" | "rejected") => {
    let vid = getCookie("orzen_vid");
    if (!vid) {
      vid = newId("v").slice(0, 60);
      setCookie("orzen_vid", vid, 365);
    }
    setCookie("orzen_consent", c, 180);
    localStorage.setItem("orzen_consent", `${c}:${Date.now()}`);
    setChoice(c);
    setShowBanner(false);
    fetch("/api/public/platform-meta/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: vid, choice: c, notice_version: NOTICE_VERSION }),
    }).catch(() => undefined);
    if (c === "rejected" && (window as W).__orzenPixel) location.reload();
  };

  if (!eligible || !cfg || !consentRegion) return null;
  if (!showBanner) {
    return (
      <button
        type="button"
        onClick={() => setShowBanner(true)}
        className="fixed bottom-2 left-2 z-40 rounded-md bg-muted/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur hover:text-foreground"
      >
        Cookie settings
      </button>
    );
  }
  return (
    <div role="dialog" aria-label="Cookie consent" className="fixed inset-x-2 bottom-2 z-50 mx-auto max-w-xl rounded-xl border bg-card p-4 text-card-foreground shadow-lg sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <p className="text-sm">
        We use Meta (Facebook) cookies to measure our ads and improve ORZEN. This shares page visits, sign-ups and
        purchases with Meta. You can change your choice any time. See our{" "}
        <a href="/privacy-policy" className="underline">Privacy Policy</a>.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => decide("rejected")}>Reject</Button>
        <Button size="sm" className="flex-1" onClick={() => decide("accepted")}>Accept</Button>
      </div>
    </div>
  );
}
