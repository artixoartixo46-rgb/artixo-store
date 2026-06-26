// ARTIXO Service Worker — v6 Push-Only (no asset caching)
// Caching removed entirely to prevent stale JS bundles.
// This SW only handles push notifications.

const SW_VERSION = "v6-push-only";

// ── Install — skip waiting immediately, delete ALL old caches ────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.skipWaiting();
});

// ── Activate — claim all clients + force-reload every tab ────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then((clients) => {
        clients.forEach((c) => {
          try { c.navigate(c.url); } catch (_) {}
        });
      })
  );
});

// ── Fetch — NO caching; every request goes straight to network ───────────────
// (No fetch handler = browser handles all requests normally)

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "ARTIXO", {
      body:  data.body  || "You have a new notification",
      icon:  "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      data:  { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
