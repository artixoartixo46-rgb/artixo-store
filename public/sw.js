const CACHE_NAME = "artixo-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Install — cache static shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - HTML pages → Network first, fallback to cache (always fresh content)
// - JS/CSS/fonts → Cache first (fast loads)
// - API calls → Network only (never cache)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external API calls
  if (request.method !== "GET") return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.hostname.includes("googleapis.com")) return;
  if (url.hostname.includes("resend.com")) return;

  // HTML navigation — network first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // JS/CSS/images/fonts — cache first
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            return res;
          })
      )
    );
    return;
  }
});

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "ARTIXO", {
      body: data.body || "You have a new notification",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || "/")
  );
});
