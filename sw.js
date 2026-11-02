/* Garten-App service worker.
   data/garten.json: network-first (offline fallback to the last good copy).
   Static shell: cache-first, refreshed in the background for the next visit.
   Paths are relative to the registration scope so the app works under
   https://hcrjsy9nf9-sketch.github.io/garten-app/ */

const STATIC_CACHE = "garten-static-v4";
const DATA_CACHE = "garten-data-v1";

const FILES = [
  "",
  "index.html",
  "styles.css",
  "garden-ui.js",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

function scopeUrl(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        FILES.map(async (path) => {
          const url = scopeUrl(path);
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) await cache.put(url, response);
          } catch (error) {
            /* A single missing asset must not block install. */
          }
        })
      );
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isDataRequest(url) {
  return url.pathname.endsWith("/data/garten.json");
}

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  const cacheKey = scopeUrl("data/garten.json");
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(cacheKey, response.clone());
      return response;
    }
    const cached = await cache.match(cacheKey);
    return cached || response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return { response: cached, update };
  const response = await update;
  if (response) return { response, update: null };

  if (request.mode === "navigate") {
    const index = await cache.match(scopeUrl("index.html"));
    if (index) return { response: index, update: null };
    const root = await cache.match(scopeUrl(""));
    if (root) return { response: root, update: null };
  }

  return {
    response: new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
    update: null,
  };
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  if (isDataRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    (async () => {
      const result = await cacheFirst(request);
      if (result.update) {
        const pending = result.update.catch(() => null);
        try {
          event.waitUntil(pending);
        } catch (error) {
          /* The response is already cached-first; the refresh can finish on its own. */
        }
      }
      return result.response;
    })()
  );
});
