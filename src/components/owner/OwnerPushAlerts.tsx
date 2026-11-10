import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveOwnerPushSubscription } from "@/lib/notifications/push.functions";

const VAPID_PUBLIC = "BCSPM69GqCsDrsA92VbGIwST3KZFbbcuywYsPHVy56nYiekIkai2q20jPixoJLWqCnoolgYyERVDmDZLQ1Gmdmg";

function allowed() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return false;
  if (window.self !== window.top) return false;
  const h = window.location.hostname.toLowerCase();
  if (/^(id-preview|preview)(-[a-z0-9]+)?--/.test(h) || h.endsWith("lovableproject.com") || h.includes("-dev.lovable.app")) return false;
  return true;
}

function toKey(b64: string) {
  const s = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** Registers this device for Winner Admin alerts (new merchants, plan requests). Rendered only for owners. */
export function OwnerPushAlerts() {
  const save = useServerFn(saveOwnerPushSubscription);
  useEffect(() => {
    if (!allowed()) return;
    let done = false;
    const subscribe = async () => {
      if (done || Notification.permission !== "granted") return;
      done = true;
      try {
        const reg = await navigator.serviceWorker.register("/push-sw.js");
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC) }));
        const j = sub.toJSON() as any;
        await save({ data: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 300) } });
      } catch (e) { done = false; console.error("owner push subscribe failed", e); }
    };
    const ask = async () => {
      if (Notification.permission === "default") { try { await Notification.requestPermission(); } catch { /* ignore */ } }
      await subscribe();
    };
    if (Notification.permission === "granted") void subscribe();
    else if (Notification.permission === "default") {
      void ask();
      window.addEventListener("pointerdown", ask, { once: true });
    }
    return () => window.removeEventListener("pointerdown", ask);
  }, [save]);
  return null;
}
