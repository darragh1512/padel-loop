// Padel Loop service worker.
//
// THE ONE RULE: this caches the SHELL, never the CONTENT.
//
// A stale game time is worse than a spinner. Somebody who opens the app and
// reads "Malahide, 19:30, 1 spot left" from a cache has been told something
// that may have been true an hour ago, and they act on it — they turn up, or
// they don't bother because it looked full. A spinner is honest; a stale
// answer is not. So nothing that can change is ever served from cache:
//
//   NEVER CACHED
//     • Supabase (games, players, chat, results) — anything on *.supabase.co
//     • HTML documents — every page in this app renders live data
//     • Anything that isn't a GET
//     • The Sentry tunnel at /monitoring
//
//   CACHED, because it cannot go stale by definition
//     • /_next/static/* — content-hashed by the build. A change means a new
//       URL, so a cached copy is never the wrong copy.
//     • Icons, splash screens, fonts.
//
// Its other job is being here at all: an installable app needs a registered
// service worker with a fetch handler before Chrome will offer to install it.

const VERSION = "v1";
const SHELL_CACHE = `padel-loop-shell-${VERSION}`;

// Cached on install so the app opens instantly and, more importantly, so the
// launch is not a white screen while the icon loads.
const PRECACHE = [
  "/icons/icon-192.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one missing file cannot fail the whole install and
      // leave the app uninstallable.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

// Drop caches from older versions, so a deploy cannot leave last week's
// assets sitting around.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* Is this a request we are allowed to answer from cache? Written as an
   ALLOW-list: anything not explicitly named here goes to the network, so a
   new kind of request added later is live by default rather than stale by
   default. */
function isCacheableAsset(request, url) {
  if (request.method !== "GET") return false;
  // Same origin only — never cache another service's responses.
  if (url.origin !== self.location.origin) return false;
  // Never cache a page. Every one of them renders live data.
  if (request.mode === "navigate") return false;
  if (request.destination === "document") return false;
  // The Sentry tunnel.
  if (url.pathname.startsWith("/monitoring")) return false;

  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/splash/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (!isCacheableAsset(event.request, url)) {
    // Explicitly do nothing: the browser handles it as if there were no
    // service worker at all. No offline fallback either — showing a cached
    // shell with no data would look like an app with no games in it.
    return;
  }

  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;

      return fetch(event.request).then((response) => {
        // Only store complete, successful, same-origin responses.
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const copy = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
