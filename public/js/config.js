
function getOrCreateDeviceId() {
  const COOKIE_NAME = "orirun_device_id";
  const LS_BACKUP   = "orirun_device_backup";

  const cookieMatch = document.cookie
    .split("; ")
    .find(row => row.startsWith(COOKIE_NAME + "="));

  if (cookieMatch) {
    const deviceId = cookieMatch.split("=")[1];
    try { localStorage.setItem(LS_BACKUP, deviceId); } catch {}
    return deviceId;
  }

  let deviceId;
  try { deviceId = localStorage.getItem(LS_BACKUP); } catch {}

  if (!deviceId) {
    deviceId = crypto.randomUUID();
  }

  document.cookie = `${COOKIE_NAME}=${deviceId}; path=/; max-age=${
    60 * 60 * 24 * 365 * 20
  }; SameSite=Lax`;

  try { localStorage.setItem(LS_BACKUP, deviceId); } catch {}

  return deviceId;
}

/* ── IndexedDB layer: a THIRD store for the device id ────────────────
   A "clear cache" often wipes cached files but leaves IndexedDB intact, so
   keeping the id here too lets it survive clears that erase the cookie and
   localStorage. IndexedDB is async, so the id is generated synchronously above
   (fast path) and reconciled with IndexedDB just after: if the cookie+LS were
   wiped but IndexedDB still holds the ORIGINAL id, we recover it, re-heal the
   cookie/LS, and reload history under the recovered id. */
const _IDB = { name: "orirun_id", store: "kv", key: "deviceId" };
function _idbGet() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(_IDB.name, 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore(_IDB.store); } catch {} };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(_IDB.store)) return resolve(null);
          const tx = db.transaction(_IDB.store, "readonly");
          const g = tx.objectStore(_IDB.store).get(_IDB.key);
          g.onsuccess = () => resolve(g.result || null);
          g.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
    } catch { resolve(null); }
  });
}
function _idbSet(value) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(_IDB.name, 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore(_IDB.store); } catch {} };
      req.onerror = () => resolve(false);
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(_IDB.store, "readwrite");
          tx.objectStore(_IDB.store).put(value, _IDB.key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch { resolve(false); }
      };
    } catch { resolve(false); }
  });
}

let deviceId = getOrCreateDeviceId();

// Async reconcile with IndexedDB. Runs once at startup; recovers the original
// id if the faster stores were cleared but IndexedDB survived.
(async function _reconcileDeviceId() {
  try {
    const stored = await _idbGet();
    if (!stored) {
      // First time (or IDB was also cleared) → persist the current id for future.
      await _idbSet(deviceId);
      return;
    }
    if (stored === deviceId) return; // all in sync
    // IndexedDB has a DIFFERENT (original) id → cookie+LS had been wiped and we
    // generated a new one. Prefer the recovered original so history is retained.
    deviceId = stored;
    try { localStorage.setItem("orirun_device_backup", stored); } catch {}
    document.cookie = `orirun_device_id=${stored}; path=/; max-age=${60*60*24*365*20}; SameSite=Lax`;
    window.deviceId = stored;
    // Reload history under the recovered id, if the app is ready for it.
    if (typeof window.loadMyHistory === "function") { try { window.loadMyHistory(); } catch {} }
    window.dispatchEvent(new CustomEvent("orirun:deviceIdRecovered", { detail: { deviceId: stored } }));
  } catch { /* best-effort — never block startup */ }
})();

/* ─────────────────────────────────────────────────────────────
 *  ENVIRONMENT FLAGS
 * ───────────────────────────────────────────────────────────── */
const isFileProtocol = location.protocol === "file:";

const isLocal =
  isFileProtocol ||
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  ["orirun.com"].includes(location.hostname.toLowerCase());

/* ─────────────────────────────────────────────────────────────
 *  isLocalRequest()
 *  True when a URL targets localhost / 127.0.0.1 — those
 *  requests never need internet connectivity.
 * ───────────────────────────────────────────────────────────── */
function isLocalRequest(resource) {
  if (typeof resource !== "string") return false;
  if (
    resource.startsWith("http://localhost") ||
    resource.startsWith("http://127.0.0.1")
  ) return true;
  if (
    resource.startsWith("/") &&
    (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ) return true;
  return false;
}

/* ─────────────────────────────────────────────────────────────
 *  PRINT PROTECTION
 * ───────────────────────────────────────────────────────────── */
window.onbeforeprint = function () {
  if (!isAdminAuthenticated) {
    alert("Printing is disabled on this application.");
    setTimeout(() => window.stop(), 100);
  }
};

window.addEventListener("keydown", function (event) {
  if (!isAdminAuthenticated && event.ctrlKey && event.key === "p") {
    alert("Printing is disabled.");
    event.preventDefault();
  }
});

/* ─────────────────────────────────────────────────────────────
 *  CLIPBOARD / RIGHT-CLICK PROTECTION
 * ───────────────────────────────────────────────────────────── */
document.addEventListener("contextmenu", function (e) {
  const allowed = e.target.closest(".allow-copy, .allow-paste");
  if (!allowed) e.preventDefault();
});

document.addEventListener("copy", function (e) {
  const allowed = e.target.closest(".allow-copy");
  if (!allowed) e.preventDefault();
});

document.addEventListener("cut", function (e) {
  const allowed = e.target.closest(".allow-copy");
  if (!allowed) e.preventDefault();
});

document.addEventListener("paste", function (e) {
  const allowed = e.target.closest(".allow-paste");
  if (!allowed) e.preventDefault();
});

/* ─────────────────────────────────────────────────────────────
 *  DEVTOOLS KEY BLOCKING  (F12 / Ctrl+Shift+I/J/C / Ctrl+U)
 * ───────────────────────────────────────────────────────────── */
document.addEventListener("keydown", function (e) {
  if (
    e.keyCode === 123 ||
    (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
    (e.ctrlKey && e.key === "U")
  ) {
    e.preventDefault();
  }
});

/* ─────────────────────────────────────────────────────────────
 *  HEADLESS BROWSER DETECTION
 * ───────────────────────────────────────────────────────────── */
if (!isLocal && navigator.webdriver) {
  console.warn("Headless browser detected! Blocking access...");
  setTimeout(() => window.location.href = "https://orirun.com", 2000);
}

/* ─────────────────────────────────────────────────────────────
 *  CONSOLE SUPPRESSION  (production only — local keeps logs)
 * ───────────────────────────────────────────────────────────── */
(function () {
  if (!isLocal) {
    ["log", "info", "warn", "error", "debug"].forEach(method => {
      console[method] = function () {};
    });
    Object.defineProperty(console, "_commandLineAPI", {
      get: function () {
        throw new Error("Unauthorized console access detected.");
      }
    });
  }
})();

/* ─────────────────────────────────────────────────────────────
 *  SERVER CANDIDATES
 *
 *  When running from file:// or localhost we prepend the local
 *  server so it is tried first. If it is down, the code
 *  automatically falls through to the remote Render server.
 * ───────────────────────────────────────────────────────────── */
const REMOTE_CANDIDATES = [
  "https://ancestra-nhhh.onrender.com",
  // "https://orirun-4ov0.onrender.com",
];

// Local server is tried first when developing locally
const SERVER_CANDIDATES =
  (isFileProtocol ||
   location.hostname === "localhost" ||
   location.hostname === "127.0.0.1")
    ? ["http://localhost:10000", ...REMOTE_CANDIDATES]
    : REMOTE_CANDIDATES;

// Capture native fetch BEFORE the override
const nativeFetch = window.fetch.bind(window);

// Restore last known working server
let cachedServer = localStorage.getItem("activeServer");
let SERVER_URL;

if (cachedServer && SERVER_CANDIDATES.includes(cachedServer)) {
  SERVER_URL = cachedServer;
} else {
  SERVER_URL = SERVER_CANDIDATES[0];
}

/* ─────────────────────────────────────────────────────────────
 *  fetchWithTimeout
 *  AI chat requests are never aborted (OpenAI can be slow).
 * ───────────────────────────────────────────────────────────── */
const fetchWithTimeout = (url, options = {}, timeout = 12000) => {
  if (url.includes("/api/ai/chat")) {
    return nativeFetch(url, options);
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return nativeFetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
};

const checkServer = async (url) => {
  // Offline → remote servers are unreachable; don't wait out the timeout.
  // BUT localhost/127.0.0.1 needs no internet — a locally-run backend is still
  // reachable when the browser reports offline (this is exactly the run-from-
  // local / DB-outage test case), so we must still probe it.
  const isLocal = url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
  if (navigator.onLine === false && !isLocal) return null;
  try {
    const res = await nativeFetch(`${url}/api/ping`, {
      cache: "no-store",
      signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
    });
    return res.ok ? url : null;
  } catch {
    return null;
  }
};

const updateActiveServer = async () => {
  const results    = await Promise.all(SERVER_CANDIDATES.map(checkServer));
  const firstAlive = results.find(Boolean);

  if (firstAlive) {
    if (SERVER_URL !== firstAlive) {
      console.log(`✅ Switched to server: ${firstAlive}`);
    }
    SERVER_URL = firstAlive;
    localStorage.setItem("activeServer", firstAlive);
  } else {
    console.warn(`⚠️ All servers failed — keeping current: ${SERVER_URL}`);
  }
};

/* ─────────────────────────────────────────────────────────────
 *  INITIAL SERVER CHECK
 * ───────────────────────────────────────────────────────────── */
let serverReady = updateActiveServer().then(() => {
  // console.log("🚀 Server in use:", SERVER_URL);
});

/* ─────────────────────────────────────────────────────────────
 *  PERIODIC SERVER CHECK  (every 30 s)
 *  This is what detects a stopped local server and switches
 *  over to the Render fallback automatically.
 * ───────────────────────────────────────────────────────────── */
setInterval(updateActiveServer, 30000);

/* ─────────────────────────────────────────────────────────────
 *  KEEP-ALIVE PING  (every 5 min — prevents Render cold starts)
 *  Skipped for localhost targets (no cold-start concern).
 * ───────────────────────────────────────────────────────────── */
setInterval(() => {
  if (!navigator.onLine)                return;
  if (isLocalRequest(SERVER_URL + "/")) return;

  nativeFetch(`${SERVER_URL}/api/ping`, { cache: "no-store" })
    .then(() => console.log("🟢 Keep-alive ping"))
    .catch(() => {});
}, 5 * 60 * 1000);

/* ─────────────────────────────────────────────────────────────
 *  ONLINE / OFFLINE RECOVERY
 * ───────────────────────────────────────────────────────────── */
window.addEventListener("online", () => {
  console.log("🟢 Internet restored — rechecking servers");
  updateActiveServer();
});

window.addEventListener("offline", () => {
  console.warn("🔴 Internet disconnected");
});

/* ─────────────────────────────────────────────────────────────
 *  wakeServer()
 *  Polls until the server responds (handles Render cold starts).
 *  Returns immediately for localhost (always warm).
 * ───────────────────────────────────────────────────────────── */
let wakingServer = null;

async function wakeServer(targetUrl) {
  // Local server needs no wake-up
  if (isLocalRequest((targetUrl || SERVER_URL) + "/")) return true;

  // Fail fast when the browser is certain there's no connection — don't
  // spend 30s "waking" a server we can't possibly reach. The request that
  // follows will fail immediately and the offline UI kicks in at once.
  if (navigator.onLine === false) return false;

  // Reuse in-flight promise so concurrent callers share one loop
  if (wakingServer) return wakingServer;

  // Async executors swallow thrown errors silently; use a plain async
  // function that resolves the outer promise instead.
  wakingServer = new Promise((resolve) => {
    (async () => {
    // Fewer attempts, each with its own short timeout so a hung ping can't
    // stall the loop, and a shorter wait between tries. Total worst case
    // ~3 × (3s ping + 2s wait) ≈ 15s for a genuinely cold Render server,
    // versus the old 30s — and effectively instant when actually offline.
    const maxAttempts = 3;

    for (let i = 0; i < maxAttempts; i++) {
      // If the connection drops mid-loop, stop immediately.
      if (navigator.onLine === false) break;
      try {
        const res = await nativeFetch(`${SERVER_URL}/api/ping`, {
          cache: "no-store",
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (res.ok) {
          // console.log("🟢 Server awake");
          wakingServer = null;
          return resolve(true);
        }
      } catch {}

      if (i < maxAttempts - 1) {
        console.log("⏳ Waking server...");
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    wakingServer = null;
    resolve(false);
    })();
  });

  return wakingServer;
}

window.fetch = async function (resource, options = {}) {
  if (typeof resource === "string" && resource.startsWith("/")) {
    resource = SERVER_URL + resource;
  }

  const local = isLocalRequest(resource);

  // Only block if we're certain we're offline AND the last ping also failed.
  // navigator.onLine is unreliable on macOS — don't use it as a hard gate.
  if (!local) {
    await wakeServer(SERVER_URL);
  }

  try {
    return await fetchWithTimeout(resource, options, 12000);
  } catch (err) {
    // When the browser knows it's offline, don't run the slow recovery
    // path (server re-check + 2s wait + retry) — there's nothing to switch
    // to. Fail now so the caller can show the offline state immediately.
    if (!local && navigator.onLine !== false) {
      await updateActiveServer();
      console.warn("Retrying request against:", SERVER_URL);
      await new Promise(r => setTimeout(r, 1000));
      return fetchWithTimeout(resource, options, 12000);
    }
    throw err;
  }
};
