const CACHE_NAME = "safe-tag-v3";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./styles.css",
  "./auth.css",
  "./dashboard.css",
  "./auth.js",
  "./dashboard.js",
  "./firebase-config.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (
    requestUrl.hostname.includes("firebaseio.com") ||
    requestUrl.hostname.includes("firebasedatabase.app") ||
    requestUrl.hostname.includes("googleapis.com") ||
    requestUrl.hostname.includes("firebaseapp.com")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});