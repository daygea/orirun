// Orirun PWA Service Worker (Optimized + Store Ready + Daily Guidance Notifications)
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");

// 🔁 Bump BUILD on EVERY deploy so returning users fetch the new files
// instead of the previously cached ones.
const BUILD           = "2026-06-08t";
const APP_SHELL_CACHE = "orirun-shell-v2";
const RUNTIME_CACHE   = "orirun-runtime-v2";
const OFFLINE_PAGE    = "./offline.html";

// ---------------------------------------------------------
// 1. Precache Only Essential App Shell Files
// ---------------------------------------------------------
workbox.precaching.precacheAndRoute([
  { url: "./",                         revision: BUILD },
  { url: "./index.html",               revision: BUILD },
  { url: "./public/manifest.json",     revision: BUILD },
  { url: OFFLINE_PAGE,                 revision: BUILD },
  { url: "./public/css/style.css",     revision: BUILD },
  { url: "./public/js/main.js",        revision: BUILD },
  { url: "./public/js/translation.js", revision: BUILD },
  { url: "./public/js/chatbot.js",     revision: BUILD },
  { url: "./public/js/utils.js",       revision: BUILD },
  { url: "./public/js/orirun-tour.js", revision: BUILD }
]);

// ---------------------------------------------------------
// 1b. Activate the new version promptly and clear old caches
// ---------------------------------------------------------
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => /^orirun-(shell|runtime)-/.test(k) && !k.includes("-v2"))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

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
const FALLBACK_IMG = "./public/img/bird.gif";
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
        body:               body || "Your daily guidance is ready.",
        icon:               icon || "./public/img/bird.gif",
        badge:              icon || "./public/img/bird.gif",
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

  const targetUrl = event.notification.data?.url || "./";

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

      return self.registration.showNotification("🧿 Orírùn — Daily Guidance", {
        body:    "Your daily message from the Ori is waiting.",
        icon:    "./public/img/bird.gif",
        badge:   "./public/img/bird.gif",
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
    title: "🧿 Orírùn — Daily Guidance",
    body:  "Your daily message from the Ori is waiting.",
    icon:  "./public/img/bird.gif",
    badge: "./public/img/bird.gif",
    tag:   "orirun-daily",
    url:   "./"
  };

  if (event.data) {
    try { Object.assign(payload, event.data.json()); } catch {}
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:               payload.body,
      icon:               payload.icon  || "./public/img/bird.gif",
      badge:              payload.badge || "./public/img/bird.gif",
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