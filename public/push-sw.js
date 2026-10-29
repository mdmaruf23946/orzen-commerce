// ORZEN merchant push notifications (messaging only — no page caching).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "ORZEN", body: event.data && event.data.text() }; }
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Open panel plays the premium in-app sound.
    wins.forEach((c) => c.postMessage({ type: "orzen-push", kind: d.kind || "message" }));
    await self.registration.showNotification(d.title || "ORZEN", {
      body: d.body || "",
      icon: "/push-icon-192.png",
      badge: d.badge || "/push-icon-192.png",
      tag: d.tag || undefined,
      renotify: true,
      vibrate: d.kind === "order" ? [120, 60, 120, 60, 220] : [90, 50, 140],
      data: { url: d.url || "/admin" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(self.location.origin) && "focus" in c) { await c.focus(); return c.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
