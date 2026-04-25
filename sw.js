// Orirun PWA Service Worker (Optimized + Store Ready + Daily Guidance Notifications)
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

const APP_SHELL_CACHE = "orirun-shell-v1";
const RUNTIME_CACHE   = "orirun-runtime-v1";
const OFFLINE_PAGE    = "./offline.html";

// ---------------------------------------------------------
// 1. Precache Only Essential App Shell Files
// ---------------------------------------------------------
workbox.precaching.precacheAndRoute([
  { url: "./",                       revision: null },
  { url: "./index.html",             revision: null },
  { url: "./public/manifest.json",   revision: null },
  { url: OFFLINE_PAGE,              revision: null },
  { url: "./public/css/style.css",   revision: null },
  { url: "./public/js/main.js",      revision: null }
]);

// ---------------------------------------------------------
// 2. Runtime Caching for CSS / JS / Fonts
// ---------------------------------------------------------
workbox.routing.registerRoute(
  ({ request }) =>
    ["style", "script", "font"].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: `${RUNTIME_CACHE}-assets`
  })
);

// ---------------------------------------------------------
// 3. Cache Images (with fallback)
// ---------------------------------------------------------
const FALLBACK_IMG = "./public/img/logo.png";
workbox.routing.registerRoute(
  ({ request }) => request.destination === "image",
  new workbox.strategies.CacheFirst({
    cacheName: `${RUNTIME_CACHE}-images`,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries:    40,
        maxAgeSeconds: 30 * 24 * 60 * 60
      }),
      {
        handlerDidError: () => caches.match(FALLBACK_IMG)
      }
    ]
  })
);

// ---------------------------------------------------------
// 4. Offline Fallback for Navigation
// ---------------------------------------------------------
workbox.routing.registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event }) => {
    try {
      return await fetch(event.request);
    } catch (e) {
      return caches.match(OFFLINE_PAGE);
    }
  }
);

// ---------------------------------------------------------
// 5. Messages from the main thread
//    Handles both the existing SKIP_WAITING and the new
//    SHOW_NOTIFICATION dispatched by dailyGuidance.js
// ---------------------------------------------------------
self.addEventListener("message", (event) => {
  if (!event.data) return;

  // Existing: immediate activation when a new SW is waiting
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  // New: show a notification requested by dailyGuidance.js
  if (event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, icon, url, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || "🧿 Orírùn", {
        body:               body || "Your daily Ifa guidance is ready.",
        icon:               icon || "./public/img/logo.png",
        badge:              icon || "./public/img/logo.png",
        tag:                tag  || "orirun-daily",
        requireInteraction: false,
        data:               { url: url || "./" },
        vibrate:            [200, 100, 200],
        actions: [
          { action: "open",    title: "Open App" },
          { action: "dismiss", title: "Later"    }
        ]
      })
    );
  }
});

// ---------------------------------------------------------
// 6. Notification click — focus existing tab or open new one
// ---------------------------------------------------------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// ---------------------------------------------------------
// 7. Periodic Background Sync  (Android Chrome PWA only)
//    Fires once per day when the device is online and the
//    app is NOT currently visible — avoids duplicating the
//    in-app popup that dailyGuidance.js already shows.
// ---------------------------------------------------------
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "orirun-daily-guidance") return;

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((wins) => {
      const anyVisible = wins.some((w) => w.visibilityState === "visible");
      if (anyVisible) return; // app is open — JS handles it

      return self.registration.showNotification("🧿 Orírùn — Daily Ifa Guidance", {
        body:    "Your daily message from the Ori is waiting.",
        icon:    "./public/img/logo.png",
        badge:   "./public/img/logo.png",
        tag:     "orirun-daily",
        data:    { url: "./" },
        vibrate: [200, 100, 200]
      });
    })
  );
});

// ---------------------------------------------------------
// 8. Web Push — receives VAPID pushes from the Orirun server
//    Payload shape: { title, body, icon, badge, tag, url }
// ---------------------------------------------------------
self.addEventListener("push", (event) => {
  let payload = {
    title: "🧿 Orírùn — Daily Ifa Guidance",
    body:  "Your daily message from the Ori is waiting.",
    icon:  "./public/img/logo.png",
    badge: "./public/img/logo.png",
    tag:   "orirun-daily",
    url:   "./"
  };

  if (event.data) {
    try { Object.assign(payload, event.data.json()); } catch {}
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:               payload.body,
      icon:               payload.icon  || "./public/img/logo.png",
      badge:              payload.badge || "./public/img/logo.png",
      tag:                payload.tag   || "orirun-daily",
      requireInteraction: false,
      vibrate:            [200, 100, 200],
      data:               { url: payload.url || "./" },
      actions: [
        { action: "open",    title: "Open App" },
        { action: "dismiss", title: "Later"    }
      ]
    })
  );
});
