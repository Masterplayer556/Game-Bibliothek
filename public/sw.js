// Service worker of the home-screen app: starts without waiting for the network and opens
// without a connection. Only the app itself (pages, scripts, styles, icons) of this site is
// kept; data from Supabase and covers from other sites never pass through here (the data is
// cached by the app itself, see src/lib/offline-cache.ts).
//
//   /_next/static/…  never changes (names carry a hash): from the cache, else the network
//   pages            network first; after NAVIGATION_TIMEOUT_MS or offline the cached page
//   everything else  network first, the cached copy offline
//
// Plain JavaScript in public/, served as /<basePath>/sw.js. Tested in src/lib/service-worker.test.ts.

const CACHE = "gb-app-v1";
const NAVIGATION_TIMEOUT_MS = 3500;
/** Hashed files kept at most; the oldest go first (old versions pile up after updates). */
const MAX_STATIC = 400;
/** The pages of the app, relative to the scope: kept at install, so each opens offline. */
const PAGES = ["", "bibliothek/", "statistiken/", "erfolge/", "chronik/", "rueckblick/", "hinzufuegen/", "plattformen/", "spiel/"];

/** «static», «page», «other» or null (not ours: other site, not GET, outside the scope). */
function strategyFor(request, scope) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (!url.href.startsWith(scope)) return null;
  if (url.pathname.includes("/_next/static/")) return "static";
  if (request.mode === "navigate") return "page";
  return "other";
}

/** The hashed files a page needs (scripts, styles, fonts), as absolute URLs. */
function staticAssetsIn(html, pageUrl) {
  const found = new Set();
  for (const match of html.matchAll(/["'(]((?:[^"'()\s\\]*)\/_next\/static\/[^"'()\s\\]+)/g)) {
    try {
      found.add(new URL(match[1], pageUrl).href);
    } catch {
      // not a URL
    }
  }
  return [...found];
}

/** Cache key of a page or file: without the query (?id=… of a game, ?_rsc=… of Next). */
function keyOf(url) {
  const u = new URL(url);
  u.search = "";
  u.hash = "";
  return u.href;
}

async function trim(cache) {
  const keys = (await cache.keys()).filter((r) => r.url.includes("/_next/static/"));
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) await cache.delete(old);
}

async function precache() {
  const cache = await caches.open(CACHE);
  const scope = self.registration.scope;
  await Promise.allSettled(
    PAGES.map(async (page) => {
      const url = new URL(page, scope).href;
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok || response.redirected) return;
      const html = await response.clone().text();
      await cache.put(url, response);
      await Promise.allSettled(
        staticAssetsIn(html, url).map(async (asset) => {
          if (await cache.match(asset)) return;
          const file = await fetch(asset);
          if (file.ok) await cache.put(asset, file);
        }),
      );
    }),
  );
}

async function fromCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic" && !response.redirected) {
    await cache.put(request, response.clone());
    void trim(cache);
  }
  return response;
}

async function fromNetworkFirst(request, timeoutMs) {
  const cache = await caches.open(CACHE);
  const key = keyOf(request.url);
  const network = fetch(request).then(async (response) => {
    if (response.ok && response.type === "basic" && !response.redirected) await cache.put(key, response.clone());
    return response;
  });
  // When the cached copy answered first, a later network failure is no error.
  network.catch(() => undefined);
  const cached = () => cache.match(key);
  try {
    if (!timeoutMs) return await network;
    // Slow network: the cached page now, the fresh one is stored for the next start.
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const first = await Promise.race([network, timeout.then(cached)]);
    return first || (await network);
  } catch {
    const hit = await cached();
    if (hit) return hit;
    // A page never opened before: the start page, which knows every route.
    if (request.mode === "navigate") {
      const home = await cache.match(self.registration.scope);
      if (home) return home;
    }
    return Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("gb-app-") && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const strategy = strategyFor(event.request, self.registration.scope);
  if (!strategy) return;
  if (strategy === "static") event.respondWith(fromCacheFirst(event.request));
  else event.respondWith(fromNetworkFirst(event.request, strategy === "page" ? NAVIGATION_TIMEOUT_MS : 0));
});
