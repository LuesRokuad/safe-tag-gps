const CACHE_NAME = "safe-tag-v4";

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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
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

  // Pour les pages et fichiers du site, privilégier le réseau afin
  // d'éviter de servir une ancienne version du dashboard après un déploiement.
  if (
    requestUrl.origin === self.location.origin &&
    (
      event.request.mode === "navigate" ||
      requestUrl.pathname.endsWith(".js") ||
      requestUrl.pathname.endsWith(".css") ||
      requestUrl.pathname.endsWith(".html")
    )
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});