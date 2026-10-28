import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { savePushSubscription, removePushSubscription, sendTestPush } from "@/lib/push.functions";

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

export function PushNotificationButton({ storeId }: { storeId: string | null }) {
  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);
  const test = useServerFn(sendTestPush);
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushAllowedHere()) return;
    setSupported(true);
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "orzen-push") playNotifySound(e.data.kind); };
    navigator.serviceWorker.addEventListener("message", onMsg);
    navigator.serviceWorker.getRegistration("/push-sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setOn(!!sub && Notification.permission === "granted");
    });
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  if (!supported || !storeId) return null;

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { toast.error("ব্রাউজারে নোটিফিকেশন অনুমতি দিন।"); return; }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(VAPID_PUBLIC) }));
      const j = sub.toJSON() as any;
      await save({ data: { store_id: storeId!, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 300) } });
      setOn(true);
      playNotifySound("order");
      await test({ data: { store_id: storeId! } });
      toast.success("নোটিফিকেশন চালু হয়েছে — নতুন অর্ডার ও মেসেজ এলে জানানো হবে।");
    } catch (e) {
      console.error(e);
      toast.error("নোটিফিকেশন চালু করা যায়নি, আবার চেষ্টা করুন।");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await remove({ data: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      setOn(false);
      toast.success("এই ডিভাইসে নোটিফিকেশন বন্ধ করা হয়েছে।");
    } finally { setBusy(false); }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={on ? disable : enable}
      title={on ? "নোটিফিকেশন চালু (বন্ধ করতে ক্লিক করুন)" : "নোটিফিকেশন চালু করুন"}
      aria-label="Push notifications"
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full border hover:bg-muted ${on ? "text-primary" : "text-muted-foreground"}`}
    >
      {on ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      {!on && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />}
    </button>
  );
}
