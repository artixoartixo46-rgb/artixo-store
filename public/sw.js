// ARTIXO Service Worker — v3 Load Balancer Edition
// Layers:
//   1. Static assets  → Cache-first (JS/CSS/fonts/images)
//   2. HTML shell     → Network-first, fallback to cache
//   3. Supabase public REST GET → Stale-while-revalidate (5-30 min TTL)
//   4. Auth / mutations / realtime / storage → Network-only (never cache)

const STATIC_CACHE  = "artixo-static-v3";
const API_CACHE     = "artixo-api-v3";

// Public Supabase endpoints we are allowed to cache (read-only, not user-specific)
const CACHEABLE_API = [
  "/rest/v1/products",
  "/rest/v1/categories",
  "/rest/v1/site_settings",
  "/rest/v1/reviews",
  "/rest/v1/profiles",
];

// TTL per path prefix (seconds)
const API_TTL = {
  "/rest/v1/categories":    30 * 60,   // 30 min — rarely changes
  "/rest/v1/site_settings": 10 * 60,   // 10 min
  "/rest/v1/profiles":       5 * 60,   //  5 min
  "/rest/v1/reviews":        5 * 60,
  "/rest/v1/products":       3 * 60,   //  3 min — product list
};

function getTTL(pathname) {
  for (const [prefix, ttl] of Object.entries(API_TTL)) {
    if (pathname.startsWith(prefix)) return ttl * 1000; // ms
  }
  return 3 * 60 * 1000;
}

function isCacheableSupabase(url, method) {
  if (method !== "GET") return false;
  if (url.hostname !== "djmrevzcetdpjzbggavj.supabase.co") return false;
  // Never cache auth, realtime, storage, functions
  if (url.pathname.startsWith("/auth/"))      return false;
  if (url.pathname.startsWith("/realtime/"))  return false;
  if (url.pathname.startsWith("/storage/"))   return false;
  if (url.pathname.startsWith("/functions/")) return false;
  return CACHEABLE_API.some((p) => url.pathname.startsWith(p));
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(["/", "/index.html", "/manifest.json"])
    )
  );
  self.skipWaiting();
});

// ── Activate — evict old caches ──────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET (mutations go straight to network)
  if (request.method !== "GET") return;

  // ── Strategy 1: Supabase public API — Stale-While-Revalidate ──────────────
  if (isCacheableSupabase(url, request.method)) {
    event.respondWith(supabaseStaleWhileRevalidate(request, url));
    return;
  }

  // ── Strategy 2: HTML navigation — Network-first ───────────────────────────
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // ── Strategy 3: Static assets — Cache-first ───────────────────────────────
  if (url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  // All other requests: network only
});

// ── Stale-While-Revalidate for Supabase API ──────────────────────────────────
async function supabaseStaleWhileRevalidate(request, url) {
  const cache     = await caches.open(API_CACHE);
  const cached    = await cache.match(request);
  const ttl       = getTTL(url.pathname);
  const now       = Date.now();

  if (cached) {
    const cachedAt = Number(cached.headers.get("X-SW-Cached-At") || 0);
    const age      = now - cachedAt;

    if (age < ttl) {
      // Fresh — return immediately, no background revalidation needed
      return cached;
    }

    // Stale — serve immediately, revalidate in background
    revalidate(request, cache, url);
    return cached;
  }

  // No cache — fetch, store, return
  return fetchAndStore(request, cache, url);
}

async function fetchAndStore(request, cache, url) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const headers = new Headers(res.headers);
      headers.set("X-SW-Cached-At", String(Date.now()));
      const stored = new Response(await res.clone().arrayBuffer(), {
        status:  res.status,
        headers,
      });
      cache.put(request, stored);
    }
    return res;
  } catch {
    // Network failure — return whatever is in cache even if stale
    return cache.match(request) || Response.error();
  }
}

async function revalidate(request, cache, url) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const headers = new Headers(res.headers);
      headers.set("X-SW-Cached-At", String(Date.now()));
      const stored = new Response(await res.clone().arrayBuffer(), {
        status:  res.status,
        headers,
      });
      cache.put(request, stored);
    }
  } catch {
    // Silent — stale data is already being served
  }
}

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
