
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

const deviceId = getOrCreateDeviceId();

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
const fetchWithTimeout = (url, options = {}, timeout = 45000) => {
  if (url.includes("/api/ai/chat")) {
    return nativeFetch(url, options);
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return nativeFetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
};

const checkServer = async (url) => {
  try {
    const res = await nativeFetch(`${url}/api/ping`, {
      cache: "no-store",
      signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined
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
  console.log("🚀 Server in use:", SERVER_URL);
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

  // Reuse in-flight promise so concurrent callers share one loop
  if (wakingServer) return wakingServer;

  wakingServer = new Promise(async (resolve) => {
    const maxAttempts = 6;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await nativeFetch(`${SERVER_URL}/api/ping`, {
          cache: "no-store"
        });
        if (res.ok) {
          console.log("🟢 Server awake");
          wakingServer = null;
          return resolve(true);
        }
      } catch {}

      console.log("⏳ Waking server...");
      await new Promise(r => setTimeout(r, 5000));
    }

    wakingServer = null;
    resolve(false);
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
    return await fetchWithTimeout(resource, options, 45000);
  } catch (err) {
    // If it truly fails, now treat it as offline
    if (!local) {
      await updateActiveServer();
      console.warn("Retrying request against:", SERVER_URL);
      await new Promise(r => setTimeout(r, 2000));
      return fetchWithTimeout(resource, options, 45000);
    }
    throw err;
  }
};
