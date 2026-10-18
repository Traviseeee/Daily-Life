const CACHE_NAME = "mylife-pwa-v81";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icons/mylife-icon.svg",
  "./assets/icons/mylife-icon-180.png",
  "./assets/icons/mylife-icon-192.png",
  "./assets/icons/mylife-icon-512.png",
  "./css/variables.css",
  "./css/global.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/responsive.css",
  "./css/notification-center.css",
  "./css/theme-polish.css",
  "./js/components/icons.js",
  "./js/components/toast.js",
  "./js/components/modal.js",
  "./js/components/charts.js",
  "./js/sync.js",
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
  "./js/daily.js",
  "./js/notifications.js",
  "./js/push.js",
  "./js/event-form.js",
  "./js/expense-form.js",
  "./js/family-form.js",
  "./js/setup-form-ux.js",
  "./js/memory-form.js",
  "./js/hobby-form.js",
  "./js/goal-form.js",
  "./js/report-export.js",
  "./js/smart-money.js",
  "./js/today.js",
  "./js/automation-settings.js",
  "./js/notification-center.js",
  "./js/app.js",
  "./js/sound-hooks.js",
  "./js/smart-parse.js",
  "./js/money-insights.js",
  "./js/report-telegram.js",
  "./js/chat-bot.js",
  "./js/telegram-arrivals.js"
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

function notificationUrl(value) {
  try {
    const destination = new URL(value || "/#home", self.location.origin);
    return destination.origin === self.location.origin ? destination.href : `${self.location.origin}/#home`;
  } catch (error) {
    return `${self.location.origin}/#home`;
  }
}

self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let data = {};
    try {
      const parsed = event.data ? event.data.json() : {};
      data = parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      let body = "";
      try {
        body = event.data?.text() || "";
      } catch (textError) {
        body = "";
      }
      data = { body };
    }

    await self.registration.showNotification(data.title || "MYLIFE", {
      body: data.body || "You have a new reminder.",
      icon: "/assets/icons/mylife-icon-192.png",
      badge: "/assets/icons/mylife-icon-192.png",
      data: { url: notificationUrl(data.url) }
    });
    // an open MYLIFE window pulls the new data right away
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach(client => client.postMessage({ type: "mylife-pull" }));
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = notificationUrl(event.notification.data?.url);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ("navigate" in existing) await existing.navigate(url);
      return;
    }
    await self.clients.openWindow(url);
  })());
});

// Opening from the Home Screen must not wait for the network (that is the white
// screen on iPhone): the app shell answers from the cache at once and refreshes
// itself in the background; the next open gets the new version.
const SHELL_KEY = new URL("./", self.registration.scope).href;
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

async function fromCacheThenRefresh(event, request, key = request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(key);
  const refresh = fetch(request).then(response => {
    if (response && (response.ok || response.type === "opaque")) cache.put(key, response.clone());
    return response;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return (await refresh) || (await caches.match(key)) || Response.error();
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.includes(url.hostname)) event.respondWith(fromCacheThenRefresh(event, request));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }
  // the page itself (any ?r= / #hash) → one cached copy of the app shell
  if (request.mode === "navigate") {
    event.respondWith(fromCacheThenRefresh(event, request, SHELL_KEY));
    return;
  }
  // versioned files (?v=) never change under the same URL
  if (url.searchParams.has("v")) {
    event.respondWith(cacheFirst(request).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(fromCacheThenRefresh(event, request));
});
