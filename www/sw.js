const CACHE_NAME = "mylife-pwa-v70";
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

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }
  const freshExtensions = [".html", ".css", ".js", ".json", ".webmanifest"];
  const wantsFreshAsset = freshExtensions.some(extension => url.pathname.endsWith(extension)) || url.pathname.endsWith("/");
  const hasVersionQuery = url.searchParams.has("v");
  if (wantsFreshAsset && hasVersionQuery) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
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
