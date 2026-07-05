/* ─────────────────────────────────────────────────────────────
 *  Orírùn — dailyGuidance.js
 *
 *  Replaces the generic inactivity popup in translation.js with
 *  a personalised AI reading drawn from the user's history.
 *  Also manages the once-per-day mobile notification flow.
 *
 *  Load order in index.html (must be AFTER all other scripts):
 *    <script src="public/js/dailyGuidance.js" defer></script>
 *
 *  Globals expected from earlier scripts:
 *    deviceId                          — config.js
 *    currentLang, getGuidance()        — translation.js
 *    extractPinnacles()                — main.js
 *    getLocationAndPlanetaryHour()     — main.js
 * ───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
 *  CONSTANTS
 * ───────────────────────────────────────────────────────────── */
const DG_DAILY_KEY      = "orirun_last_daily_notif";
const DG_NOTIF_ASKED    = "orirun_notif_asked";
const DG_CACHE_KEY      = "orirun_daily_guidance_cache";
const DG_CACHE_TTL      = 6  * 60 * 60 * 1000;   // 6 h — reuse same AI result
const DG_DAILY_INTERVAL = 24 * 60 * 60 * 1000;   // 24 h between daily fires
const DG_TOUR_KEY       = "orirun_tour_v2";        // must match TOUR_KEY in orirun-tour.js
const DG_NOTIF_DISABLED = "orirun_notif_disabled"; // user opted out of notifications
const DG_PUSH_SUB_KEY   = "orirun_push_subscribed"; // push subscription saved to server
const DG_BIRTH_TS_KEY   = "orirun_last_birth_ts";   // timestamp of most recent birth chart

/* ─────────────────────────────────────────────────────────────
 *  TOUR GUARD
 *  Returns true once the user has completed or skipped the tour.
 *  We never ask for notification permission until then, so new
 *  users are not interrupted during onboarding.
 * ───────────────────────────────────────────────────────────── */
function _tourDone() {
  try { return localStorage.getItem(DG_TOUR_KEY) === "1"; } catch { return false; }
}

/* ─────────────────────────────────────────────────────────────
 *  SHORT AI PROMPT  (3–4 sentences, ~5 s to generate)
 *  Intentionally avoids the full getEnergyInterpretation()
 *  so the popup appears quickly.
 * ───────────────────────────────────────────────────────────── */
async function _getDailyAIMessage(p) {
  const lines = [
    `Name: ${p.fullName}`,
    `Life Path: ${p.lifepath} — ${p.lifepathLabel}`,
    `Destiny: ${p.destiny}`,
    `Soul Urge: ${p.soulUrge}`,
    `Reality: ${p.reality}`,
    `Day / Week / Month / Year / Pinnacle: ${p.day} / ${p.week} / ${p.month} / ${p.year} / ${p.pinnacleNumber}`,
    `Zodiac: ${p.zodiac}  Element: ${p.zodiacElement}  Orisha: ${p.zodiacOrisha}`
    // p.planetaryHour ? `Hour: ${p.planetaryHour} (${p.planetaryOrisha})` : ""
  ].filter(Boolean).join("\n");

  const res = await fetch("/api/ai/chat", {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      chatHistory: [
        {
          role:    "system",
          content: "You are an Ifa elder giving a person their daily spiritual guidance. " +
                   "Focus on TODAY — what energy is active, what the person should do, " +
                   "avoid, or pay attention to specifically on this day. " +
                   "Use their first name once. " +
                   "Speak to the quality of the energy, not the numbers themselves. " +
                   "Be practical and grounded — not vague or poetic for its own sake. " +
                   "ONE short paragraph, max 54 words. " +
                   "No greetings, no ritual language, no bullet points, no line breaks."
        },
        { role: "user", content: lines }
      ]
    })
  });

  const data = await res.json();
  if (!data.message) throw new Error("No AI message returned");
  return data.message;
}

/* ─────────────────────────────────────────────────────────────
 *  FETCH PERSONAL GUIDANCE
 *  1. Return 6-hour cached result if available.
 *  2. Pull the most recent birth-chart history entry for this device.
 *  3. Re-run numerology so today's day/month numbers are live.
 *  4. Call the short AI prompt.
 *  5. Cache and return.
 * ───────────────────────────────────────────────────────────── */
async function fetchPersonalGuidance() {
  /* 1 — cache hit, but only if no newer birth chart has been completed
     since the cache was built.  DG_BIRTH_TS_KEY is written by
     markNewBirthChart() which is called from performBirthChart(). */
  try {
    const c       = JSON.parse(localStorage.getItem(DG_CACHE_KEY) || "null");
    const birthTs = parseInt(localStorage.getItem(DG_BIRTH_TS_KEY) || "0", 10);
    const cacheIsValid = c &&
      (Date.now() - c.ts) < DG_CACHE_TTL &&
      c.ts >= birthTs;   // cache was built AFTER the last birth chart
    if (cacheIsValid) return c.data;
  } catch {}

  if (typeof deviceId === "undefined") return null;

  /* 2 — latest birth-chart history entry */
  const histRes = await fetch(`/api/history/${deviceId}`);
  if (!histRes.ok) return null;
  const history = await histRes.json();

  const birthEntry = history
    .map((h) => h.data || h)
    .filter((h) => h.birthdate && h.fullName)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

  if (!birthEntry) return null;

  /* 3 — recompute numerology for live day/month vibrations */
  const numRes = await fetch("/api/numerology/", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      fullname:  birthEntry.fullName,
      birthdate: birthEntry.birthdate
    })
  });
  if (!numRes.ok) return null;
  const nd   = await numRes.json();
  const astro = nd.astrology || {};

  /* current pinnacle */
  let pinnacleNumber = 0;
  if (typeof extractPinnacles === "function") {
    pinnacleNumber = extractPinnacles(nd, nd.age).currentPinnacleNumber;
  }

  /* planetary hour — 5 s cap so popup isn't held up */
  let ph = null;
  try {
    if (typeof getLocationAndPlanetaryHour === "function") {
      const loc = await Promise.race([
        getLocationAndPlanetaryHour(),
        new Promise((r) => setTimeout(() => r({}), 5000))
      ]);
      ph = loc?.planetaryHourData || null;
    }
  } catch {}

  /* 4 — AI message */
  const insight = await _getDailyAIMessage({
    fullName:        birthEntry.fullName,
    lifepath:        nd.vibrations?.lifepath?.number || 0,
    lifepathLabel:   nd.vibrations?.lifepath?.label  || "",
    destiny:         nd.destiny?.number  || 0,
    soulUrge:        nd.soulUrge?.number || 0,
    reality:         nd.vibrations?.reality?.number  || 0,
    day:             nd.vibrations?.day?.number   || 0,
    week:            nd.vibrations?.week?.number  || 0,
    month:           nd.vibrations?.month?.number || 0,
    year:            nd.vibrations?.year?.number  || 0,
    pinnacleNumber,
    zodiac:          astro.name    || "",
    zodiacElement:   astro.element || "",
    zodiacOrisha:    astro.orisha  || astro.ruler || "",
    // planetaryHour:   ph?.planet || "",
    // planetaryOrisha: ph?.orisha || ""
  });

  const result = {
    name:     birthEntry.fullName,
    insight,
    lifepath: nd.vibrations?.lifepath?.number || 0,
    day:      nd.vibrations?.day?.number   || 0,
    month:    nd.vibrations?.month?.number || 0,
    year:     nd.vibrations?.year?.number  || 0
    /* planetary hour is always fetched live in showGuidancePopup */
  };

  /* 5 — cache (store current timestamp so birthTs comparisons work) */
  try {
    localStorage.setItem(DG_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result }));
  } catch {}

  return result;
}

/* ─────────────────────────────────────────────────────────────
 *  MARK NEW BIRTH CHART
 *  Call this from main.js at the end of a successful
 *  performBirthChart() to bust the guidance cache so the next
 *  popup fetches fresh data for the new history entry.
 *
 *    // in main.js, inside performBirthChart() try block,
 *    // after logSilently("/api/history/save", ...):
 *    if (typeof markNewBirthChart === "function") markNewBirthChart();
 * ───────────────────────────────────────────────────────────── */
function markNewBirthChart() {
  try {
    localStorage.setItem(DG_BIRTH_TS_KEY, String(Date.now()));
    localStorage.removeItem(DG_CACHE_KEY);  // force immediate refresh
    console.log("🔄 Daily guidance cache cleared — new birth chart detected");
  } catch {}
}

/* True if any content modal is currently open (so we don't stack on top of it) */
function _anotherModalOpen() {
  var ids = ["audioModal","videoModal","termsModal","aboutModal",
             "contributionModal","paymentModal","ifaGuideModal","successPopup"];
  return ids.some(function (id) {
    var el = document.getElementById(id);
    return el && window.getComputedStyle(el).display !== "none";
  });
}

async function showGuidancePopup(lang, _retries) {
  if (document.getElementById("guidance-overlay")) return;
  /* Do not interrupt the onboarding tour */
  if (document.querySelector("#driver-page-overlay") || document.querySelector("#or-tour-dim") || document.getElementById("or-onboard")) return;
  /* Do not stack on top of another open modal — wait until it is dismissed */
  if (_anotherModalOpen()) {
    if ((_retries || 0) < 20) {
      setTimeout(function () { showGuidancePopup(lang, (_retries || 0) + 1); }, 3000);
    }
    return;
  }

  const fallback =
    typeof getGuidance === "function"
      ? getGuidance(lang || "en")
      : "The ancestors guide your steps today.";

  /* Build overlay immediately with spinner */
  const overlay = document.createElement("div");
  overlay.id    = "guidance-overlay";
  overlay.innerHTML = `
    <div class="guidance-popup" style="
      width: clamp(300px, 92vw, 560px);
      max-width: 560px;
      box-sizing: border-box;
    ">
      <h4 style="text-align:center;margin-bottom:12px;">
        🧿 <span data-translate>Daily Guidance</span>
      </h4>
      <div id="dg-popup-body"
        style="min-height:72px;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span class="spinner" style="width:18px;height:18px;flex-shrink:0;"></span>
        <em style="font-size:13px;" data-translate>Loading…</em>
      </div>
      <div style="text-align:center;margin-top:14px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-md btn-default app-btn"
          style="border:1px solid green;"
          onclick="closeGuidancePopup()">
          <span data-translate>Close</span>
        </button>
        <button class="btn btn-md btn-default app-btn"
          id="dg-share-btn"
          style="border:1px solid #2e7d32;display:none;transform:none !important;"
          onclick="_shareDailyGuidance()">
          📤 <span data-translate>Share</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  /* Fetch cached guidance AND live planetary hour in parallel */
  try {
    const [personal, locResult] = await Promise.all([
      fetchPersonalGuidance(),
      typeof getLocationAndPlanetaryHour === "function"
        ? Promise.race([
            getLocationAndPlanetaryHour(),
            new Promise((r) => setTimeout(() => r({}), 5000))
          ]).catch(() => ({}))
        : Promise.resolve({})
    ]);

    const livePh = locResult?.planetaryHourData || null;
    const bodyEl = document.getElementById("dg-popup-body");
    if (!bodyEl) return;

    if (personal) {
      /* Store share data on the overlay for _shareDailyGuidance to read */
      overlay._shareData = {
        day:      personal.day,
        month:    personal.month,
        year:     personal.year,
        lifepath: personal.lifepath,
        insight:  personal.insight,
        orisha:   livePh?.orisha  || "",
        planet:   livePh?.planet  || "",
        energy:   livePh?.energy  || ""
      };

      bodyEl.innerHTML = `
        <div style="width:100%;">
          <p style="margin:0 0 6px;font-size:11px;color:#2e7d32;font-weight:bold;">
            Energy:
            <span style="font-weight:normal;opacity:.7;">
              Today ${personal.day}
              ·&nbsp;Month ${personal.month}
              ·&nbsp;Year ${personal.year}
              ·&nbsp;Lifepath ${personal.lifepath}
            </span>
          </p>
          <p style="
            margin:0 0 10px;
            font-size:13px;
            line-height:1.6;
            border-left:3px solid #2e7d32;
            padding-left:10px;
          ">
            <span data-translate>${personal.insight}</span>
          </p>
          ${livePh?.orisha ? `
          <p style="
            margin:0;
            font-size:11px;
            color:#555;
            border-top:1px solid #e8f5e8;
            padding-top:8px;
          ">
            Current hour: 🪐 <strong>${livePh.orisha} (${livePh.planet})</strong>
            <br/>
            <span style="opacity:.7;">
              &nbsp;·&nbsp;${livePh.energy}
            </span>
          </p>` : ""}
        </div>`;
      _showShareButton();
    } else {
      bodyEl.innerHTML = `<p style="text-align:center;"><em>${fallback}</em></p>`;
    }
  } catch {
    const bodyEl = document.getElementById("dg-popup-body");
    if (bodyEl)
      bodyEl.innerHTML = `<p style="text-align:center;"><em>${fallback}</em></p>`;
  }
}

async function _shareDailyGuidance() {
  const btn     = document.getElementById("dg-share-btn");
  const overlay = document.getElementById("guidance-overlay");

  if (!overlay) return;

  /* Read stored data — no DOM scraping, no opacity issues */
  const d = overlay._shareData;
  if (!d) { _shareDailyGuidanceText(); return; }

  if (typeof html2canvas === "undefined") {
    _shareDailyGuidanceText();
    return;
  }

  const originalHTML = btn ? btn.innerHTML : "";
  if (btn) btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;margin-right:4px;"></span>`;

  /* Build a completely standalone capture div — no classes, no
     inherited styles, no overlay behind it, everything inline */
  const capture = document.createElement("div");
  capture.style.cssText = [
    "position:fixed",
    "top:-9999px",
    "left:-9999px",
    "width:520px",
    "background:#f0f7f0",
    "border-radius:14px",
    "padding:24px 28px",
    "font-family:Courier,monospace",
    "font-weight:bold",
    "box-sizing:border-box",
    "z-index:999999"
  ].join(";");

  capture.innerHTML = `
    <div style="text-align:center;margin-bottom:16px;">
      <img src="public/img/logo.png"
           style="height:52px;width:auto;display:block;margin:0 auto 8px auto;"
           crossorigin="anonymous" />
      <span style="font-size:18px;font-weight:bold;color:#1b4332;">Daily Guidance</span>
    </div>
    <p style="margin:0 0 10px;font-size:12px;color:#2e7d32;font-weight:bold;text-align:center;">
      Energy:
      <span style="font-weight:normal;color:#2e7d32;">
        Today ${d.day} · Month ${d.month} · Year ${d.year} · Lifepath ${d.lifepath}
      </span>
    </p>
    <p style="
      margin:0 0 14px;
      font-size:14px;
      line-height:1.7;
      color:#1b4332;
      border-left:4px solid #2e7d32;
      padding-left:12px;
      font-weight:bold;
    ">${d.insight}</p>
    ${d.orisha ? `
    <p style="
      margin:0 0 14px;
      font-size:12px;
      color:#555;
      border-top:1px solid #c8e6c9;
      padding-top:10px;
      font-weight:bold;
    ">
     Current hour: 🪐 <strong style="color:#1b4332;">${d.orisha} (${d.planet})</strong>
      <br/>
      <span style="color:#555;">${d.energy}</span>
    </p>` : ""}
    <p style="
      margin:0;
      font-size:10px;
      color:black;
      text-align:center;
      font-weight:normal;
      letter-spacing:0.5px;
    ">www.orirun.com</p>
  `;

  document.body.appendChild(capture);

  try {
    await ensureLib("html2canvas"); // lazy: loads on first share, not at boot
    const canvas = await html2canvas(capture, {
      backgroundColor: "#f0f7f0",
      scale:           2,
      useCORS:         true,
      allowTaint:      true,
      logging:         false,
      width:           capture.offsetWidth,
      height:          capture.offsetHeight
    });

    document.body.removeChild(capture);
    if (btn) btn.innerHTML = originalHTML;

    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png")
    );

    const file = new File([blob], "orirun-daily-guidance.png", { type: "image/png" });

    /* Native share on mobile */
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Daily Guidance — Orírùn",
        text:  "Get yours at www.orirun.com"
      });
      return;
    }

    /* Desktop — download */
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = "orirun-daily-guidance.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    if (btn) {
      btn.innerHTML = "✅ <span>Saved!</span>";
      setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
    }

  } catch (err) {
    if (document.body.contains(capture)) document.body.removeChild(capture);
    if (btn) btn.innerHTML = originalHTML;
    if (err?.name !== "AbortError") {
      console.warn("Share image failed:", err);
      _shareDailyGuidanceText();
    }
  }
}

/* Text fallback */
function _shareDailyGuidanceText() {
  const overlay = document.getElementById("guidance-overlay");
  const d       = overlay?._shareData;
  const insight = d?.insight || "";
  const energies = d
    ? `Today ${d.day} · Month ${d.month} · Year ${d.year} · Lifepath ${d.lifepath}`
    : "";

  const text = [
    "🧿 My daily guidance from Orírùn:",
    "",
    insight,
    energies ? `Energies: ${energies}` : "",
    "",
    "Get yours at www.orirun.com"
  ].filter(Boolean).join("\n");

  if (navigator.share) {
    navigator.share({ title: "Daily Guidance", text, url: "https://orirun.com" })
      .catch(() => {});
    return;
  }

  navigator.clipboard?.writeText(text).then(() => {
    const btn = document.getElementById("dg-share-btn");
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = "✅ <span>Copied!</span>";
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
  }).catch(() => prompt("Copy your guidance:", text));
}

function _showShareButton() {
  const btn = document.getElementById("dg-share-btn");
  if (btn) btn.style.display = "inline-flex";
}

/* ─────────────────────────────────────────────────────────────
 *  CLOSE GUIDANCE POPUP  (replaces translation.js version)
 * ───────────────────────────────────────────────────────────── */
function closeGuidancePopup() {
  const ov = document.getElementById("guidance-overlay");
  if (ov) ov.remove();
  if (typeof resetInactivityTimer === "function") {
    resetInactivityTimer(typeof currentLang !== "undefined" ? currentLang : "en");
  }
}

/* ─────────────────────────────────────────────────────────────
 *  NOTIFICATION HELPERS
 * ───────────────────────────────────────────────────────────── */


/* ─────────────────────────────────────────────────────────────
 *  VAPID PUSH SUBSCRIPTION HELPERS
 * ───────────────────────────────────────────────────────────── */

/** Convert a VAPID base64 public key to a Uint8Array for the browser API */
function _urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Fetch the VAPID public key, create a PushSubscription in the browser,
 * and POST it to /api/push/subscribe so the server can send pushes.
 * Safe to call multiple times — skips if already subscribed.
 */
async function _subscribeToPush(swReg) {
  if (!swReg) { console.warn("🔔 Push: no SW registration"); return false; }
  if (!("PushManager" in window)) { console.warn("🔔 Push: PushManager not supported"); return false; }
  if (localStorage.getItem(DG_NOTIF_DISABLED) === "1") { console.log("🔔 Push: opted out"); return false; }

  try {
    /* Check if already subscribed in this browser */
    const existing = await swReg.pushManager.getSubscription();
    if (existing) {
      console.log("🔔 Push: existing subscription found");
      /* Make sure the server also has it (re-send on fresh installs) */
      if (!localStorage.getItem(DG_PUSH_SUB_KEY)) {
        await _savePushSubscriptionToServer(existing);
        localStorage.setItem(DG_PUSH_SUB_KEY, "1");
      }
      return true;
    }

    console.log("🔔 Push: fetching VAPID public key...");
    /* Fetch VAPID public key from our server */
    const keyRes = await fetch("/api/push/vapid-public-key");
    if (!keyRes.ok) {
      console.error("🔔 Push: VAPID key fetch failed —", keyRes.status);
      return false;
    }
    const { publicKey } = await keyRes.json();
    if (!publicKey) { console.error("🔔 Push: VAPID public key is empty"); return false; }
    console.log("🔔 Push: VAPID key received, subscribing...");

    /* Subscribe */
    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: _urlBase64ToUint8Array(publicKey)
    });
    console.log("🔔 Push: browser subscription created, saving to server...");

    /* Send to our backend */
    const saved = await _savePushSubscriptionToServer(subscription);
    if (saved) {
      localStorage.setItem(DG_PUSH_SUB_KEY, "1");
      console.log("🔔 Push: fully active ✓");
    }
    return saved;

  } catch (err) {
    console.error("🔔 Push: subscription failed —", err.message);
    return false;
  }
}

async function _savePushSubscriptionToServer(subscription) {
  if (typeof deviceId === "undefined") {
    console.warn("🔔 Push: deviceId not available — subscription not saved to server");
    return false;
  }
  try {
    const res = await fetch("/api/push/subscribe", {
      method:      "POST",
      headers:     { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        deviceId,
        subscription: subscription.toJSON()
      })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("🔔 Push: server rejected subscription —", res.status, err);
      return false;
    }
    console.log("🔔 Push: subscription saved to server ✓");
    return true;
  } catch (err) {
    console.error("🔔 Push: network error saving subscription —", err.message);
    return false;
  }
}

async function _unsubscribeFromPush(swReg) {
  try {
    if (swReg) {
      const sub = await swReg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    localStorage.removeItem(DG_PUSH_SUB_KEY);

    if (typeof deviceId !== "undefined") {
      await fetch("/api/push/unsubscribe", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deviceId })
      });
    }
    console.log("🔕 Push subscription removed");
  } catch (err) {
    console.warn("Push unsubscribe failed:", err.message);
  }
}

async function _requestNotifPermission() {
  if (!("Notification" in window))           return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied")  return false;
  if (localStorage.getItem(DG_NOTIF_ASKED))  return false;
  if (!_tourDone())                          return false; // wait for tour completion

  localStorage.setItem(DG_NOTIF_ASKED, "1");
  await new Promise((r) => setTimeout(r, 4500)); // let the page fully settle
  return (await Notification.requestPermission()) === "granted";
}

async function _registerPeriodicSync(swReg) {
  if (!swReg || !("periodicSync" in swReg)) return;
  try {
    const tags = await swReg.periodicSync.getTags();
    if (!tags.includes("orirun-daily-guidance")) {
      await swReg.periodicSync.register("orirun-daily-guidance", {
        minInterval: DG_DAILY_INTERVAL
      });
    }
  } catch { /* not supported on this browser/device — silent */ }
}

async function _sendWebNotification(title, body) {
  if (Notification.permission !== "granted") return;
  if (localStorage.getItem(DG_NOTIF_DISABLED) === "1") return; // user opted out

  /* Route through the SW controller so it works even when the
     page is in the background */
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_NOTIFICATION",
      title, body,
      icon: "/public/img/bird.gif",
      tag:  "orirun-daily",
      url:  "/"
    });
  } else {
    /* Fallback: direct Notification (only visible when tab is focused) */
    new Notification(title, {
      body,
      icon: "/public/img/bird.gif",
      tag:  "orirun-daily"
    });
  }
}

/* ─────────────────────────────────────────────────────────────
 *  DAILY CHECK
 *  Fires once per 24 h per device.
 *  OS notification if permitted, in-app popup otherwise.
 *  Skipped entirely on first visit (before tour is done).
 * ───────────────────────────────────────────────────────────── */
async function _checkDailyGuidance() {
  const last = parseInt(localStorage.getItem(DG_DAILY_KEY) || "0", 10);
  if ((Date.now() - last) < DG_DAILY_INTERVAL) return; // already shown today

  localStorage.setItem(DG_DAILY_KEY, String(Date.now()));

  /* Best one-sentence body for the OS notification */
  let notifBody = "Your daily message from the Ori is waiting.";
  try {
    const c = JSON.parse(localStorage.getItem(DG_CACHE_KEY) || "null");
    if (c?.data?.insight) {
      notifBody = c.data.insight.split(/[.!?]/)[0].trim() + ".";
    }
  } catch {}

  if ("Notification" in window && Notification.permission === "granted") {
    await _sendWebNotification("🧿 Orírùn — Daily Guidance", notifBody);
  } else if (_tourDone() && localStorage.getItem(DG_NOTIF_DISABLED) !== "1") {
    /* No OS permission but tour done → in-app popup after brief delay */
    setTimeout(async () => {
      await showGuidancePopup(typeof currentLang !== "undefined" ? currentLang : "en");
    }, 3500);
  }
  /*
   * First-time visitor: tour key is not yet set, so we do nothing this
   * session. On their next visit the tour key will be set and the full
   * flow activates normally.
   */
}

/* ─────────────────────────────────────────────────────────────
 *  PUBLIC: enableDailyNotifications()
 *  Attach to an optional "Enable Notifications" button.
 *  Clears the "already asked" flag so the browser re-prompts.
 *
 *  Example button (put it in your About modal or footer):
 *    <button onclick="enableDailyNotifications()"
 *      class="btn btn-sm btn-default app-btn">
 *      🔔 <span data-translate>Enable Daily Guidance</span>
 *    </button>
 * ───────────────────────────────────────────────────────────── */
async function enableDailyNotifications() {
  if (!("Notification" in window)) {
    alert("Your browser does not support notifications.");
    return;
  }
  localStorage.removeItem(DG_NOTIF_ASKED);
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    alert("✅ Daily guidance notifications enabled!");
    const swReg = await navigator.serviceWorker?.ready.catch(() => null);
    if (swReg) {
      await _registerPeriodicSync(swReg);
      await _subscribeToPush(swReg);
    }
  } else {
    alert("Notifications are blocked. Please enable them in your browser settings.");
  }
}


/* ─────────────────────────────────────────────────────────────
 *  CONTEXTUAL NOTIFICATION BANNER
 *  Injected at the bottom of #divinationResult after a
 *  successful reading. Only shown once per session and only
 *  when permission has not yet been granted or denied.
 *
 *  Call from main.js inside performUserDivination(), just
 *  before the finally block:
 *
 *    offerNotificationAfterDivination();
 * ───────────────────────────────────────────────────────────── */
const DG_BANNER_SESSION_KEY = "orirun_notif_banner_shown";

function offerNotificationAfterDivination() {
  /* Only relevant browsers */
  if (!("Notification" in window)) return;

  /* Already granted or permanently denied — nothing to do */
  if (Notification.permission === "granted") return;
  if (Notification.permission === "denied")  return;

  /* Only once per browser session */
  if (sessionStorage.getItem(DG_BANNER_SESSION_KEY)) return;
  sessionStorage.setItem(DG_BANNER_SESSION_KEY, "1");

  /* Only after tour is complete */
  if (!_tourDone()) return;

  const resultEl = document.getElementById("divinationResult");
  if (!resultEl) return;

  /* Small delay so the reading result renders first */
  setTimeout(() => {
    /* Don't stack if banner already exists */
    if (document.getElementById("dg-notif-banner")) return;

    const banner = document.createElement("div");
    banner.id = "dg-notif-banner";
    banner.innerHTML = `
      <div style="
        margin-top: 20px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #f0f7f0, #e8f5e8);
        border: 1px solid #2e7d32;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
        font-size: 13px;
        max-width: 420px;
        margin-left: auto;
        margin-right: auto;
        text-align: center;
      ">
        <span style="color:#1b4332;">
          🧿 <span data-translate>Receive your daily guidance as a notification?</span>
        </span>
        <div style="display:flex;gap:8px;flex-shrink:0;">
          <button
            onclick="_handleNotifBannerYes()"
            class="btn btn-sm btn-default app-btn"
            style="border:1px solid #2e7d32;color:#2e7d32;font-size:12px;">
            <span data-translate>Yes, enable</span>
          </button>
          <button
            onclick="_dismissNotifBanner()"
            style="background:none;border:none;color:#888;font-size:18px;cursor:pointer;line-height:1;padding:0 4px;"
            aria-label="Dismiss">✕</button>
        </div>
      </div>`;

    resultEl.appendChild(banner);
  }, 1200);
}

async function _handleNotifBannerYes() {
  _dismissNotifBanner();
  /* Clear the "already asked" flag so _requestNotifPermission
     won't block — we are asking at the right moment now */
  localStorage.removeItem(DG_NOTIF_ASKED);
  localStorage.setItem(DG_NOTIF_ASKED, "1"); /* mark as asked */

  const perm = await Notification.requestPermission();

  if (perm === "granted") {
    /* Register periodic sync + VAPID push subscription */
    const swReg = await navigator.serviceWorker?.ready.catch(() => null);
    if (swReg) {
      await _registerPeriodicSync(swReg);
      await _subscribeToPush(swReg);  // ← saves subscription to MongoDB
    }

    /* Show a small confirmation instead of an alert */
    const resultEl = document.getElementById("divinationResult");
    if (resultEl) {
      const confirm = document.createElement("div");
      confirm.style.cssText = "margin-top:10px;padding:8px 14px;background:#e8f5e8;" +
        "border:1px solid #2e7d32;border-radius:6px;font-size:12px;color:#1b4332;text-align:center;";
      confirm.innerHTML = `✅ <span data-translate>Daily guidance notifications enabled.</span>`;
      resultEl.appendChild(confirm);
      setTimeout(() => confirm.remove(), 4000);
    }
  }
}

function _dismissNotifBanner() {
  const b = document.getElementById("dg-notif-banner");
  if (b) b.remove();
}


/* ─────────────────────────────────────────────────────────────
 *  OPT-OUT TOGGLE
 *  Renders a notification preference row that can be injected
 *  into any container (About modal, settings panel, footer).
 *
 *  Usage — call once after the container is visible:
 *    renderNotifToggle(document.getElementById("about-notif-slot"));
 *
 *  Or place this in your HTML wherever you want it to appear:
 *    <div id="notif-toggle-slot"></div>
 *  Then call renderNotifToggle() with no argument to target
 *  #notif-toggle-slot automatically.
 * ───────────────────────────────────────────────────────────── */

function _isNotifEnabled() {
  return (
    "Notification" in window &&
    Notification.permission === "granted" &&
    localStorage.getItem(DG_NOTIF_DISABLED) !== "1"
  );
}

function _notifAvailable() {
  /* Returns false if the browser has no Notification support,
     or if the user hard-blocked at the browser level (denied).
     In that case we show an info message instead of a toggle. */
  if (!("Notification" in window)) return false;
  return Notification.permission !== "denied";
}

function renderNotifToggle(container) {
  const slot = container || document.getElementById("notif-toggle-slot");
  if (!slot) return;

  const uid      = slot.id || ("dg-" + Math.random().toString(36).slice(2, 7));
  const thumbId  = "dg-thumb-"  + uid;
  const statusId = "dg-status-" + uid;
  const cbId     = "dg-cb-"     + uid;

  const enabled    = _isNotifEnabled();
  const hardBlock  = "Notification" in window && Notification.permission === "denied";

  /* iOS Safari — not installed as PWA */
  const isIOS      = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInPWA    = window.matchMedia("(display-mode: standalone)").matches;
  const iosNoSupport = isIOS && !isInPWA && !("Notification" in window);

  slot.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:flex-start;
      gap:12px;
      padding:12px 0;
      border-top:1px solid #e0e0e0;
      flex-wrap:wrap;
      max-width:420px;
      margin:0 auto;
    ">
      <div style="flex:1;min-width:160px;">
        <p style="margin:0;font-size:13px;font-weight:bold;color:#1b4332;">
          🔔 <span data-translate>Daily Guidance</span>
        </p>
        <p style="margin:4px 0 0;font-size:11px;color:#666;" id="${statusId}">
          ${iosNoSupport
            ? '<span data-translate>To receive notifications on iPhone, add Orirun to your Home Screen first.</span>'
            : hardBlock
              ? '<span data-translate>Blocked in browser settings. To enable, update your browser notification permissions for this site.</span>'
              : enabled
                ? '<span data-translate>You will receive a daily personalised guidance notification.</span>'
                : '<span data-translate>Enable to receive a daily personalised guidance notification.</span>'
          }
        </p>
      </div>

      ${(hardBlock || iosNoSupport) ? "" : `
      <button
        role="switch"
        aria-checked="${enabled}"
        tabindex="0"
        data-thumb="${thumbId}"
        data-status="${statusId}"
        data-cb="${cbId}"
        onclick="_handleNotifToggleClick(this)"
        style="
          position:relative;
          display:inline-block;
          width:44px;
          height:24px;
          flex-shrink:0;
          cursor:pointer;
          border-radius:24px;
          background:${enabled ? "#2e7d32" : "#ccc"};
          transition:background 0.2s;
          border:none;
          padding:0;
          outline:none;
          -webkit-tap-highlight-color:transparent;
        "
        id="${cbId}"
      >
        <span id="${thumbId}" style="
          position:absolute;
          top:3px;
          left:${enabled ? "23px" : "3px"};
          width:18px;height:18px;
          background:#fff;
          border-radius:50%;
          transition:left 0.2s;
          box-shadow:0 1px 3px rgba(0,0,0,0.3);
          pointer-events:none;
        "></span>
      </button>`}
    </div>`;
}

function _handleNotifToggleClick(el) {
  const isCurrentlyOn = el.getAttribute("aria-checked") === "true";
  const willTurnOn    = !isCurrentlyOn;
  const thumbId  = el.getAttribute("data-thumb");
  const statusId = el.getAttribute("data-status");
  const cbId     = el.id;

  if (!willTurnOn) {
    /* Turning off — no permission needed, update immediately */
    const thumb      = document.getElementById(thumbId);
    const statusText = document.getElementById(statusId);
    localStorage.setItem(DG_NOTIF_DISABLED, "1");
    el.style.background = "#ccc";
    el.setAttribute("aria-checked", "false");
    if (thumb) thumb.style.left = "3px";
    if (statusText) statusText.innerHTML =
      '<span data-translate>Daily guidance notifications are off.</span>';
    navigator.serviceWorker?.ready.catch(() => null).then(swReg => {
      _unsubscribeFromPush(swReg);
    });
    return;
  }

  /* Turning on */
  if (Notification.permission === "granted") {
    /* Already granted — update immediately */
    _applyToggleOn(el, thumbId, statusId);
    navigator.serviceWorker?.ready.catch(() => null).then(async swReg => {
      if (swReg) { await _registerPeriodicSync(swReg); await _subscribeToPush(swReg); }
    });
    return;
  }

  /* Need to request — MUST call requestPermission synchronously
     from this user gesture. Safari invalidates the gesture on any await. */
  if (!("Notification" in window)) {
    const s = document.getElementById(statusId);
    if (s) s.innerHTML = '<span data-translate>Notifications not supported in this browser.</span>';
    return;
  }

  /* Call synchronously — no await before this */
  const permPromise = Notification.requestPermission();

  /* Handle result asynchronously */
  permPromise.then(perm => {
    const freshEl     = document.getElementById(cbId)     || el;
    const freshThumb  = document.getElementById(thumbId);
    const freshStatus = document.getElementById(statusId);

    if (perm !== "granted") {
      if (freshStatus) freshStatus.innerHTML =
        '<span data-translate>Permission denied. Enable notifications in your browser settings.</span>';
      return;
    }

    _applyToggleOn(freshEl, thumbId, statusId);
    navigator.serviceWorker?.ready.catch(() => null).then(async swReg => {
      if (swReg) { await _registerPeriodicSync(swReg); await _subscribeToPush(swReg); }
    });
  });
}

function _applyToggleOn(el, thumbId, statusId) {
  localStorage.removeItem(DG_NOTIF_DISABLED);
  localStorage.setItem(DG_NOTIF_ASKED, "1");
  const thumb      = document.getElementById(thumbId);
  const statusText = document.getElementById(statusId);
  el.style.background = "#2e7d32";
  el.setAttribute("aria-checked", "true");
  if (thumb) thumb.style.left = "23px";
  if (statusText) statusText.innerHTML =
    '<span data-translate>You will receive a daily personalised guidance notification.</span>';
}

/* ─────────────────────────────────────────────────────────────
 *  INIT — called once from window.onload in main.js:
 *
 *    initDailyGuidance().catch(err => console.warn(err));
 *
 *  The SW is already registered by the inline <script> at the
 *  bottom of index.html, so we just wait for .ready.
 * ───────────────────────────────────────────────────────────── */
async function initDailyGuidance() {
  let swReg = null;
  if ("serviceWorker" in navigator) {
    try { swReg = await navigator.serviceWorker.ready; } catch {}
  }

  const granted = await _requestNotifPermission();
  if (granted && swReg) {
    await _registerPeriodicSync(swReg);
    await _subscribeToPush(swReg);   // VAPID push subscription
  }

  await _checkDailyGuidance();
}