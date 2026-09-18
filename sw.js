const CACHE_NAME = "mylife-pwa-v16";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icons/mylife-icon.svg",
  "./css/variables.css",
  "./css/global.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/responsive.css",
  "./js/components/icons.js",
  "./js/components/toast.js",
  "./js/components/modal.js",
  "./js/components/charts.js",
  "./js/data.js",
  "./js/i18n.js",
  "./js/smart-assistant.js",
  "./js/navigation.js",
  "./js/dashboard.js",
  "./js/launcher.js",
  "./js/family.js",
  "./js/goals.js",
  "./js/money.js",
  "./js/calendar.js",
  "./js/memories.js",
  "./js/settings.js",
  "./js/app.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const freshExtensions = [".html", ".css", ".js", ".json", ".webmanifest"];
  const wantsFreshAsset = freshExtensions.some(extension => url.pathname.endsWith(extension)) || url.pathname.endsWith("/");
  if (wantsFreshAsset) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

