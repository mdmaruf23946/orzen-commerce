import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePushSubscription } from "@/lib/push.functions";

const VAPID_PUBLIC = "BCSPM69GqCsDrsA92VbGIwST3KZFbbcuywYsPHVy56nYiekIkai2q20jPixoJLWqCnoolgYyERVDmDZLQ1Gmdmg";

export function playNotifySound(kind: "order" | "message" = "message") {
  try { const a = new Audio(`/sounds/${kind}.mp3`); a.volume = 0.85; void a.play().catch(() => {}); } catch { /* ignore */ }
}

function pushAllowedHere() {
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

/** Always-on push: no toggle. Subscribes automatically; asks permission on first tap if needed. */
export function PushNotificationButton({ storeId }: { storeId: string | null }) {
  const save = useServerFn(savePushSubscription);

  useEffect(() => {
    if (!storeId || !pushAllowedHere()) return;
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "orzen-push") playNotifySound(e.data.kind); };
    navigator.serviceWorker.addEventListener("message", onMsg);
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
        await save({ data: { store_id: storeId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 300) } });
      } catch (e) { done = false; console.error("push subscribe failed", e); }
    };
    const ask = async () => {
      if (Notification.permission === "default") { try { await Notification.requestPermission(); } catch { /* ignore */ } }
      await subscribe();
    };
    if (Notification.permission === "granted") void subscribe();
    else if (Notification.permission === "default") {
      void ask();
      // Some browsers only allow the permission prompt after a tap.
      window.addEventListener("pointerdown", ask, { once: true });
    }
    return () => { navigator.serviceWorker.removeEventListener("message", onMsg); window.removeEventListener("pointerdown", ask); };
  }, [storeId, save]);

  return null;
}
