/* ==================================================================
   ORÍRÙN — offline-resilience.js
   Makes the app usable across three connection states:
     1. flaky      — short timeouts + SW NetworkFirst cache (handled in
                     config.js + sw.js); this file adds a live banner.
     2. offline    — reads fall back to cached data (SW); writes are
                     QUEUED here and replayed when the connection returns.
     3. reconnect  — queued writes flush automatically on "online".

   It is additive: load it AFTER config.js and main.js. It wraps
   window.logSilently (the shared POST helper) so history saves — and
   any other logSilently write — survive a dropped connection instead of
   being lost. Nothing existing needs to change to benefit.

   Storage: a small localStorage queue (works on every browser incl.
   iOS, which lacks Background Sync). Each entry is { path, body, ts }.
   ================================================================== */
(function () {
  "use strict";

  var QUEUE_KEY = "orirun_offline_queue";
  var MAX_QUEUE = 100;          // guard against unbounded growth
  var nativePost = null;        // set once we've captured the original

  /* ── tiny queue persistence ─────────────────────────────────── */
  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
    catch { return []; }
  }
  function writeQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE))); }
    catch { /* storage full or blocked — nothing we can do */ }
  }
  function enqueue(path, body) {
    var q = readQueue();
    q.push({ path: path, body: body, ts: Date.now() });
    writeQueue(q);
    updateBanner();
  }

  /* ── replay: fire queued writes in order; drop the ones that land ─ */
  var flushing = false;
  async function flushQueue() {
    if (flushing) return;
    var q = readQueue();
    if (!q.length) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    flushing = true;
    var remaining = [];
    for (var i = 0; i < q.length; i++) {
      var item = q[i];
      try {
        // Use the real fetch (window.fetch is fine — it resolves the
        // server + wakes it). A 2xx/3xx counts as delivered.
        var res = await fetch(item.path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body)
        });
        if (!res || (!res.ok && res.status !== 0)) remaining.push(item);
      } catch (e) {
        // still offline / server down — keep it and stop trying for now
        remaining.push(item);
        for (var j = i + 1; j < q.length; j++) remaining.push(q[j]);
        break;
      }
    }
    writeQueue(remaining);
    flushing = false;
    updateBanner();
    if (remaining.length && navigator.onLine) {
      // partial failure while nominally online — retry shortly
      setTimeout(flushQueue, 8000);
    }
  }

  /* ── wrap logSilently so writes queue instead of vanishing ──────
     logSilently is fire-and-forget; if the network is down the POST
     is lost. We try it live, and on failure (or when offline) we queue
     it for replay. Non-destructive: online behaviour is unchanged. */
  function wrapLogSilently() {
    if (typeof window.logSilently !== "function" || window.__offlineWrapped) {
      return typeof window.logSilently === "function";
    }
    nativePost = window.logSilently;
    window.logSilently = function (path, body) {
      if (navigator.onLine === false) { enqueue(path, body); return; }
      fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res || (!res.ok && res.status !== 0)) enqueue(path, body);
      }).catch(function () {
        enqueue(path, body);   // dropped mid-flight → queue for replay
      });
    };
    window.__offlineWrapped = true;
    return true;
  }

  /* ── a quiet connection banner (flaky / offline / syncing) ──────
     Non-intrusive strip at the top; announces state changes to screen
     readers via aria-live. Created lazily, styled inline to avoid a CSS
     dependency. */
  var bannerEl = null;
  function ensureBanner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement("div");
    bannerEl.id = "orirun-conn-banner";
    bannerEl.setAttribute("role", "status");
    bannerEl.setAttribute("aria-live", "polite");
    bannerEl.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:9999;transform:translateY(-100%);" +
      "transition:transform .28s ease;padding:8px 14px;text-align:center;" +
      "font:600 13px/1.4 'Poppins',system-ui,sans-serif;color:#fff;" +
      "box-shadow:0 2px 10px rgba(0,0,0,.15);";
    document.body.appendChild(bannerEl);
    return bannerEl;
  }
  function showBanner(text, bg) {
    var el = ensureBanner();
    el.textContent = text;
    el.style.background = bg;
    el.style.transform = "translateY(0)";
  }
  function hideBanner() {
    if (!bannerEl) return;
    bannerEl.style.transform = "translateY(-100%)";
  }
  function updateBanner() {
    var queued = readQueue().length;
    if (navigator.onLine === false) {
      showBanner(
        queued
          ? "You're offline — " + queued + " item" + (queued > 1 ? "s" : "") + " will sync when you reconnect."
          : "You're offline — readings you've opened still work.",
        "#8a6a10"
      );
    } else if (queued) {
      showBanner("Back online — syncing " + queued + " item" + (queued > 1 ? "s" : "") + "…", "#0f7b3d");
    } else {
      hideBanner();
    }
  }

  /* ── offline-aware guard for online-only features (chat, translate) ─
     Exposed so the chatbot/translation can ask before firing a request
     that can't be cached, and show an honest message instead of a spinner
     that never resolves. */
  window.orirunIsOnline = function () {
    return navigator.onLine !== false;
  };
  window.orirunOfflineNotice = function (feature) {
    return (feature || "This feature") +
      " needs an internet connection. Please reconnect and try again — " +
      "readings you've already opened still work offline.";
  };

  /* ── wiring ─────────────────────────────────────────────────── */
  window.addEventListener("online", function () { updateBanner(); flushQueue(); });
  window.addEventListener("offline", updateBanner);

  function boot() {
    // capture logSilently (defined in main.js); retry briefly if load
    // order ever shifts.
    if (!wrapLogSilently()) {
      var tries = 0;
      var iv = setInterval(function () {
        if (wrapLogSilently() || ++tries > 20) clearInterval(iv);
      }, 100);
    }
    updateBanner();
    // flush anything left from a previous session, once, on startup
    setTimeout(flushQueue, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // expose for tests / manual flush
  window.orirunFlushQueue = flushQueue;
  window.__orirunQueue = { read: readQueue, enqueue: enqueue };
})();
