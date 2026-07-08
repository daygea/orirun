/* ─────────────────────────────────────────────────────────────
 *  Prevent pinch / double-tap zoom on iOS Safari, which ignores the
 *  viewport meta's user-scalable=no. touch-action (in CSS) blocks most
 *  zoom, but iOS still fires gesture* events on two-finger pinch and
 *  allows double-tap zoom — we cancel both here so the installed PWA
 *  feels native and can't be stretched. One-finger scrolling is not
 *  affected (we never touch single-touch touchmove).
 * ───────────────────────────────────────────────────────────── */
(function () {
  // Block iOS pinch-zoom gestures.
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (evt) {
    document.addEventListener(evt, function (e) { e.preventDefault(); }, { passive: false });
  });
  // Block double-tap-to-zoom (two taps under 300ms).
  var lastTouchEnd = 0;
  document.addEventListener("touchend", function (e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) { e.preventDefault(); }
    lastTouchEnd = now;
  }, { passive: false });
  // Extra guard: cancel any multi-touch (pinch) that starts.
  document.addEventListener("touchmove", function (e) {
    if (e.touches && e.touches.length > 1) { e.preventDefault(); }
  }, { passive: false });
})();

/* ─────────────────────────────────────────────────────────────
 *  App-vs-web detection — reveal the App Store / Google Play badges
 *  only in a real browser (hidden inside the installed app). Lives in
 *  this external file so it runs regardless of inline-script handling.
 * ───────────────────────────────────────────────────────────── */
(function () {
  function insideApp() {
    try { if (sessionStorage.getItem("or_app") === "1") return true; } catch (e) {}
    var ua = navigator.userAgent || "", hit = false;
    if (window.matchMedia && (matchMedia("(display-mode: standalone)").matches ||
        matchMedia("(display-mode: fullscreen)").matches ||
        matchMedia("(display-mode: minimal-ui)").matches)) hit = true;   /* installed PWA / Android TWA */
    if (!hit && window.navigator.standalone === true) hit = true;        /* iOS home-screen PWA */
    try { if (!hit && new URL(location.href).searchParams.get("source") === "pwa") hit = true; } catch (e) {}
    if (!hit) {                                                          /* iOS WKWebView wrapper */
      var iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (iOS && !/Safari/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua) && !/EdgiOS/.test(ua)) hit = true;
    }
    if (hit) { try { sessionStorage.setItem("or_app", "1"); } catch (e) {} }
    return hit;
  }
  if (!insideApp()) document.documentElement.classList.add("or-web");
})();

/* ─────────────────────────────────────────────────────────────
 *  Safari / iOS fallback for requestIdleCallback
 * ───────────────────────────────────────────────────────────── */
if (!window.requestIdleCallback) {
  window.requestIdleCallback = function (cb) {
    return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1);
  };
}
if (!window.cancelIdleCallback) {
  window.cancelIdleCallback = function (id) { clearTimeout(id); };
}

/* ─────────────────────────────────────────────────────────────
 *  SHARED HELPERS
 * ───────────────────────────────────────────────────────────── */
function showPreloader(message) {
  const preloader = document.getElementById("preloader");
  if (!preloader) return;
  const msg = message || '<span data-translate="loading">Loading...</span>';
  preloader.style.cssText = "display:flex;justify-content:center;align-items:center;";
  preloader.innerHTML = `
    <div class="loading-container" style="margin-top:50vh">
      <div class="guidance-card">
        <center>
          <p class="loading-text">
            <span class="spinner"></span>
            ${msg}
          </p>
        </center>
      </div>
    </div>`;
}

function hidePreloader() {
  const preloader = document.getElementById("preloader");
  if (preloader) preloader.style.display = "none";
}

function logSilently(path, body) {
  fetch(path, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body)
  }).catch(() => {});
}

/* ─────────────────────────────────────────────────────────────
 *  STARTUP — GEO, FREE ODUS, IFA FIGURES
 * ───────────────────────────────────────────────────────────── */
document.getElementById("year").textContent = new Date().getFullYear();

window.APP_GEO = window.APP_GEO || {};

async function initGeo() {
  try {
    const res  = await fetch("/api/geo");
    const data = res.ok ? await res.json() : { country: "NG" };
    window.APP_GEO.country   = data.country;
    window.APP_GEO.isNigeria = data.country === "NG";
    window.APP_GEO.ready     = true;
  } catch {
    window.APP_GEO = { country: "NG", isNigeria: true, ready: true };
  }
}

let freeOdus = [];
async function fetchFreeOdus() {
  await serverReady; // wait for config.js server selection
  try {
    const response = await fetch("/api/free-odus", {
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      cache:   "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data && Array.isArray(data.freeOdus)) {
      freeOdus = data.freeOdus;
    } else {
      throw new Error("Invalid response format");
    }
  } catch (error) {
    console.error("Failed to fetch freeOdus:", error);
    freeOdus = ["Ejiogbe", "Osa Owonrin"];
  }
  return freeOdus;
}

let ifaFigures = [];
async function getIfaFigures() {
  try {
    const response = await fetch("/api/ifafigures");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    ifaFigures = await response.json();
  } catch (error) {
    console.error("Error fetching Ifa figures:", error);
  }
}

// Kick off all three in parallel
Promise.all([initGeo(), fetchFreeOdus(), getIfaFigures()]);

/* ─────────────────────────────────────────────────────────────
 *  ENCRYPTION HELPERS
 * ───────────────────────────────────────────────────────────── */
function encryptData(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
}
function decryptData(encryptedData) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
 *  PAYMENT / ACCESS HELPERS
 * ───────────────────────────────────────────────────────────── */
function isOduPaid(oduName, orientation, specificOrientation, solution, solutionDetails) {
  const storedData = localStorage.getItem("paidOdus");
  if (!storedData) return false;
  const paidOdus = decryptData(storedData);
  if (!paidOdus) return false;
  const key = `${oduName}-${orientation}-${specificOrientation}-${solution}-${solutionDetails}`;
  const expiry = paidOdus[key];
  return expiry && Date.now() < expiry;
}

function grantOduAccess(oduName, orientation, specificOrientation, solution, solutionDetails) {
  let paidOdus = decryptData(localStorage.getItem("paidOdus")) || {};
  const key = `${oduName}-${orientation}-${specificOrientation}-${solution}-${solutionDetails}`;
  paidOdus[key] = Date.now() + 24 * 60 * 60 * 1000;
  logSilently("/api/divination/log", {
    oduName, orientation, specificOrientation, solution, solutionDetails, paid: true
  });
  localStorage.setItem("paidOdus", encryptData(paidOdus));
}

// Loads Paystack's inline.js on demand; resolves once PaystackPop is ready.
let __paystackPromise = null;
function ensurePaystack() {
  if (window.PaystackPop) return Promise.resolve();
  if (__paystackPromise) return __paystackPromise;
  __paystackPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { __paystackPromise = null; reject(new Error("Failed to load Paystack")); };
    document.head.appendChild(s);
  });
  return __paystackPromise;
}

async function payForOdu(oduName, orientation, specificOrientation, solution, solutionDetails, amount) {
  const payButton = document.getElementById("payButton");
  if (payButton) { payButton.disabled = true; payButton.textContent = "Processing..."; }

  try {
    if (!window.APP_GEO?.ready) { alert("Please wait, initializing payment..."); return; }

    const { isNigeria, country } = window.APP_GEO;
    const currency       = "NGN";
    const paymentAmount  = isNigeria ? amount : 300;
    const displayAmount  = isNigeria ? `₦${(amount / 100).toLocaleString()}` : "$3";

    const keyResponse = await fetch("/api/paystack-key");
    if (!keyResponse.ok) throw new Error("Failed to get Paystack key");
    const { key } = await keyResponse.json();

    await ensurePaystack();

    const handler = PaystackPop.setup({
      key,
      email:    "info@orirun.com",
      amount:   paymentAmount,
      currency,
      metadata: { oduName, orientation, specificOrientation, solution, solutionDetails, country },

      callback: function (response) {
        verifyPayment(response.reference).then((verification) => {
          if (verification.success) {
            grantOduAccess(oduName, orientation, specificOrientation, solution, solutionDetails);
            performUserDivination();
            logSilently("/api/payment/log", {
              amount: displayAmount, currency, country, status: "success",
              divination: { mainCast: oduName, orientation, specificOrientation, solution, solutionDetails }
            });
            if (typeof gtag === "function") {
              gtag("event", "payment_initiated", { amount: displayAmount, currency, country, status: "success" });
            }
            alert("Payment successful! Thank you for the donation.");
          } else {
            alert("Payment verification pending. Your access will be granted shortly.");
          }
        }).catch((err) => {
          console.error("Verification error:", err);
          alert("Donation received. Verification may take a moment.");
        });
      },

      onClose: function () {
        if (payButton) { payButton.disabled = false; payButton.textContent = "Donate Now"; }
      }
    });

    handler.openIframe();
  } catch (error) {
    console.error("Payment initialization error:", error);
    alert("Payment failed to start. Please try again.");
    if (payButton) { payButton.disabled = false; payButton.textContent = "Donate Now"; }
  }
}

async function verifyPayment(reference) {
  try {
    const response = await fetch(`/api/payment/verify/${reference}`);
    return await response.json();
  } catch (error) {
    console.error("Verification failed:", error);
    return { success: false };
  }
}

async function revealOduMeaning(oduName, orientation, specificOrientation, solution, solutionDetails) {
  if (isOduPaid(oduName, orientation, specificOrientation, solution, solutionDetails)) {
    const oduInfo = await fetch(`/api/odu/${oduName}`);
    const data    = await oduInfo.json();
    performUserDivination(data);
  } else {
    showPaymentModal(oduName, orientation, specificOrientation, solution, solutionDetails);
  }
}

/* ─────────────────────────────────────────────────────────────
 *  ODU DATA STRUCTURES
 * ───────────────────────────────────────────────────────────── */
const baseOdus = {
  "Ejiogbe":       ["|",  "|",  "|",  "|" ],
  "Oyeku Meji":    ["||", "||", "||", "||"],
  "Iwori Meji":    ["||", "|",  "|",  "||"],
  "Idi Meji":      ["|",  "||", "||", "|" ],
  "Irosun Meji":   ["|",  "|",  "||", "||"],
  "Owonrin Meji":  ["||", "||", "|",  "|" ],
  "Obara Meji":    ["|",  "||", "||", "||"],
  "Okanran Meji":  ["||", "||", "||", "|" ],
  "Ogunda Meji":   ["|",  "|",  "|",  "||"],
  "Osa Meji":      ["||", "|",  "|",  "|" ],
  "Ika Meji":      ["||", "|",  "||", "||"],
  "Oturupon Meji": ["||", "||", "|",  "||"],
  "Otura Meji":    ["|",  "||", "|",  "|" ],
  "Irete Meji":    ["|",  "|",  "||", "|" ],
  "Ose Meji":      ["|",  "||", "|",  "||"],
  "Ofun Meji":     ["||", "|",  "||", "|" ]
};

const imageMap = {
  "|":  "public/img/openOpele.png",
  "||": "public/img/closeOpele.png"
};

const getOduImages = (symbols) =>
  symbols.map(s => `<img src="${imageMap[s]}" alt="${s}" class="odu-line">`).join("");

const getNumerologyNumber = (number) => {
  while (number > 9 && number !== 11 && number !== 22) {
    number = number.toString().split("").reduce((sum, d) => sum + parseInt(d), 0);
  }
  return number;
};

const generateOduCombinations = () => {
  const baseOduNames = Object.keys(baseOdus);
  const allOdus = baseOduNames.map((odu, index) => ({
    id: index + 1, name: odu, numerology: getNumerologyNumber(index + 1), base: true
  }));

  let idCounter = baseOduNames.length + 1;
  baseOduNames.forEach(firstOdu => {
    baseOduNames.forEach(secondOdu => {
      if (firstOdu !== secondOdu) {
        const firstName  = firstOdu  === "Ejiogbe" ? "Ogbe" : firstOdu.split(" ")[0];
        const secondName = secondOdu === "Ejiogbe" ? "Ogbe" : secondOdu.split(" ")[0];
        allOdus.push({
          id: idCounter, name: `${firstName} ${secondName}`,
          numerology: getNumerologyNumber(idCounter), base: false
        });
        idCounter++;
      }
    });
  });
  return allOdus;
};

const allOdus = generateOduCombinations();

/* ─────────────────────────────────────────────────────────────
 *  DROPDOWN HELPERS
 * ───────────────────────────────────────────────────────────── */
const populateDropdown = (dropdown, options) => {
  const frag = document.createDocumentFragment();
  options.forEach(option => {
    const opt = document.createElement("option");
    opt.value = opt.textContent = option;
    frag.appendChild(opt);
  });
  dropdown.innerHTML = "";
  dropdown.appendChild(frag);
};

function getDefaultOrientationOptions(orientation) {
  return orientation === "Positive"
    ? ["Aiku", "Aje", "Isegun", "Igbale Ese", "Gbogbo Ire"]
    : ["Iku", "Arun", "Ejo", "Ofo", "Okutagbunilese"];
}

function getDefaultSolutionOptions(solution) {
  return solution === "Ebo"
    ? ["Akoru", "Esha"]
    : ["Ori", "Osha", "Eegun", "Ifa"];
}

const updateSpecificOrientation = async () => {
  const orientation = document.getElementById("orientation").value;
  const dropdown    = document.getElementById("specificOrientation");
  const mainCast    = document.getElementById("mainCast").value;

  if (!mainCast) {
    populateDropdown(dropdown, getDefaultOrientationOptions(orientation));
    return;
  }
  try {
    const response = await fetch(
      `/api/odu/orientations/${encodeURIComponent(mainCast)}/${encodeURIComponent(orientation)}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data    = await response.json();
    const options = data[orientation] || [];
    populateDropdown(dropdown, options.length ? options : getDefaultOrientationOptions(orientation));
  } catch (error) {
    console.error("Orientation fetch error:", error);
    populateDropdown(dropdown, getDefaultOrientationOptions(orientation));
  }
};

const updateSolutionDetails = async () => {
  const solution = document.getElementById("solution").value;
  const dropdown = document.getElementById("solutionDetails");
  const mainCast = document.getElementById("mainCast").value;

  if (!mainCast) {
    populateDropdown(dropdown, getDefaultSolutionOptions(solution));
    return;
  }
  try {
    const response = await fetch(
      `/api/odu/solutionDetails/${encodeURIComponent(mainCast)}/${encodeURIComponent(solution)}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data    = await response.json();
    const options = data[solution] || [];
    populateDropdown(dropdown, options.length ? options : getDefaultSolutionOptions(solution));
  } catch (error) {
    console.error("Solution details fetch error:", error);
    populateDropdown(dropdown, getDefaultSolutionOptions(solution));
  }
};

const populateDropdowns = async () => {
  try {
    const mainCastDropdown = document.getElementById("mainCast");
    populateDropdown(mainCastDropdown, allOdus.map(odu => odu.name));
    await Promise.all([updateSpecificOrientation(), updateSolutionDetails()]);
  } catch (error) {
    console.error("Error initializing dropdowns:", error);
    alert("Failed to load dropdown data. Please refresh the page.");
  }
};

/* ─────────────────────────────────────────────────────────────
 *  EVENT LISTENERS
 * ───────────────────────────────────────────────────────────── */
document.getElementById("orientation").addEventListener("change", updateSpecificOrientation);
document.getElementById("solution").addEventListener("change", updateSolutionDetails);

document.addEventListener("change", async function (event) {
  if (event.target.id === "mainCast") {
    const selectedOdu = event.target.value;
    await Promise.all([updateSpecificOrientation(), updateSolutionDetails()]);
    displayConfiguration(selectedOdu);
  }
});

document.addEventListener("keypress", async function (event) {
  if (event.target.id === "adminPassword" && event.key === "Enter") {
    event.preventDefault();
    await loginAdmin();
  }
});

/* ─────────────────────────────────────────────────────────────
 *  ODU SUMMARY HELPER
 * ───────────────────────────────────────────────────────────── */
function getOduSummary(mainCast, orientation = null) {
  const cleanedOdu = mainCast.replace("Meji", "").replace("Eji", "").trim();
  const [first, second] = cleanedOdu.split(" ");

  const findFigure = (name) =>
    ifaFigures.find(f => f.name.toLowerCase() === name.toLowerCase());

  const summaries = [], eboras = [], characters = [], ases = [];

  const addFigureData = (fig) => {
    if (!fig) return;
    summaries.push(`<p><span data-translate>${fig.meaning}</span></p>`);
    eboras.push(`<p>${fig.ebora}</p>`);
    characters.push(`<p><span data-translate>${fig.character}</span></p>`);
    if (fig.ase?.length) ases.push(...fig.ase.map(a => `<p>${a}</p>`));
  };

  const selectedFigures =
    orientation === "Positive" ? [second || first]  :
    orientation === "Negative" ? [first  || second] :
    second ? [first, second] : [first];

  selectedFigures.forEach(name => addFigureData(findFigure(name)));

  return {
    summaryHTML:   summaries.join(""),
    eboraHTML:     eboras.join(""),
    characterHTML: characters.join(""),
    aseHTML:       ases.join("")
  };
}

/* ─────────────────────────────────────────────────────────────
 *  ADMIN — SECRET TAP AREA
 * ───────────────────────────────────────────────────────────── */
let isAdminAuthenticated = false;
let adminToken = null;
/* ── Staff entrance ─────────────────────────────────────────────
   The nine-tap bird ritual is retired. Staff sign-in now opens from
   the quiet "Staff" link in the footer, or directly via the #staff
   URL hash (bookmarkable: orirun.com/#staff). The bird stays as pure
   decoration. Same sign-in machinery underneath — loginAdmin() and
   the role flow are untouched. */
function openStaffSignin() {
  const container = document.getElementById("adminPasswordContainer");
  if (!container) return;
  container.style.display = "block";
  container.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => document.getElementById("adminPassword")?.focus(), 250);
}
window.openStaffSignin = openStaffSignin;

window.closeStaffSignin = function () {
  const container = document.getElementById("adminPasswordContainer");
  if (container) container.style.display = "none";
  const input = document.getElementById("adminPassword");
  if (input) input.value = "";
  if (location.hash === "#staff") history.replaceState(null, "", location.pathname + location.search);
};

document.addEventListener("click", function (event) {
  const link = event.target.closest && event.target.closest("#staffLink");
  if (!link) return;
  event.preventDefault();
  openStaffSignin();
});

function _staffHashCheck() {
  if (location.hash === "#staff") openStaffSignin();
}
window.addEventListener("hashchange", _staffHashCheck);
document.addEventListener("DOMContentLoaded", _staffHashCheck);

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  const container = document.getElementById("adminPasswordContainer");
  if (container && container.style.display !== "none" && container.style.display !== "") {
    window.closeStaffSignin();
  }
});

/* ─────────────────────────────────────────────────────────────
 *  MEDIA LINK GENERATOR
 * ───────────────────────────────────────────────────────────── */
const getInputValue = (id, fallback) =>
  fallback || document.getElementById(id)?.value || "";

const generateMediaLinks = (data, type, openFunc, emoji, label) => {
  if (!Array.isArray(data) || !data.length) return "";
  const cell = (item, index) => {
    const safeUrl = item.url.replace(/'/g, "\\'");
    return `
          <p style="margin:0;padding:8px;background:#fafafa;border-radius:6px;box-shadow:0 0 3px rgba(0,0,0,0.1);">
            ${index + 1}.
            <a href="#" onclick="${openFunc}('${safeUrl}'); return false;" style="color:var(--of-green);text-decoration:none;">
              ${emoji} ${label}
            </a>
            <span style="color:var(--of-ink-soft);">of ${item.author}</span>
          </p>`;
  };
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start;">${data.map(cell).join("")}</div>`;
};

/* ─────────────────────────────────────────────────────────────
 *  PERFORM DIVINATION
 * ───────────────────────────────────────────────────────────── */

const performUserDivination = async (
  mainCastParam, orientationParam, specificOrientationParam,
  solutionParam, solutionDetailsParam
) => {
  const mainCast            = getInputValue("mainCast",            mainCastParam);
  const orientation         = getInputValue("orientation",         orientationParam);
  const specificOrientation = getInputValue("specificOrientation", specificOrientationParam);
  const solution            = getInputValue("solution",            solutionParam);
  const solutionDetails     = getInputValue("solutionDetails",     solutionDetailsParam);
  const orientationText     = orientation === "Positive" ? "Ire" : "Ayewo";
  const resultElement       = document.getElementById("divinationResult");

  showPreloader();

  try {
    const feedbackUrl =
      `/api/feedback/get?odu=${encodeURIComponent(mainCast)}` +
      `&orientation=${encodeURIComponent(orientation)}` +
      `&spec=${encodeURIComponent(specificOrientation)}` +
      `&solution=${encodeURIComponent(solution)}` +
      `&detail=${encodeURIComponent(solutionDetails)}`;

    const [oduRes, fbRes] = await Promise.all([
      fetch(`/api/odu/${encodeURIComponent(mainCast)}`),
      fetch(feedbackUrl).catch(() => null)
    ]);

    if (!oduRes.ok) throw new Error("Failed to fetch Odu data");
    const oduData = await oduRes.json();

    let visibilityScore = 1;
    if (fbRes?.ok) {
      try {
        const { positive = 0, negative = 0 } = await fbRes.json();
        if (negative > 0) {
          const ratio = positive / Math.max(negative, 1);
          visibilityScore = ratio < 0.2 ? 0.15 : ratio < 0.3 ? 0.4 : ratio < 0.5 ? 0.7 : 1;
        }
      } catch { /* non-critical */ }
    }

    const orientationBlock = oduData?.[orientation] ?? {};
    const specificBlock    = orientationBlock?.[specificOrientation] ?? {};

    const {
      Message: rawMessage = "No message available.",
      coreMessage = [], coreAudioData = [], coreVideoData = [],
      [solution]: solutionBlock = {}
    } = specificBlock;

    const solutionInfo = solutionBlock?.[solutionDetails] || "No solution info available.";

    const {
      AseIfa = [], Orisha: orisha, Taboo: taboo, Names: names,
      Occupation: occupation, Credit: credit,
      alias, herb, character, audioData = [], videoData = []
    } = oduData;

    const aseIfaHTML = AseIfa.map(p => `<p>${p}</p>`).join("");

    const { summaryHTML: oduSummary, characterHTML, aseHTML: oduSummaryAse } =
      getOduSummary(mainCast, orientation);

    const spiritualInsight = decodeIfaWithSpiritualContext(
      mainCast, orientation, specificOrientation, solution, solutionDetails
    );

    const generateAllMedia = () =>
      generateMediaLinks(coreAudioData, "audio", "openAudioModal", "🎧", `<span data-translate>Listen to Audio</span>`) +
      generateMediaLinks(audioData,     "audio", "openAudioModal", "🎧", `<span data-translate>Listen to Audio</span>`) +
      "<hr/>" +
      generateMediaLinks(coreVideoData, "video", "openVideoModal", "🎥", `<span data-translate>Watch Video</span>`) +
      generateMediaLinks(videoData,     "video", "openVideoModal", "🎥", `<span data-translate>Watch Video</span>`) +
      "<hr/>";

    const hasAccess =
      isAdminAuthenticated ||
      freeOdus.includes(mainCast) ||
      isOduPaid(mainCast, orientation, specificOrientation, solution, solutionDetails);

    // Donation model: the full reading is open to everyone and payment is a
    // voluntary donation ("Donate Now"). Set OPEN_ACCESS to false to restore
    // the original paywall — the teaser branch below is intact and current.
    const OPEN_ACCESS = true;

    if (OPEN_ACCESS || hasAccess) {
      const tip = (text) =>
        `<i class="ifa-tip" data-translate-attr="data-tip" data-tip="${text.replace(/"/g, "&quot;")}"
          onclick="openIfaTip(this, event)" role="button" aria-label="More information">i</i>`;

      /* ── Accordion helper ── */
      let _accId = 0;
      function _acc(title, bodyHtml, expandedByDefault) {
        const id   = "acc-dv-" + (++_accId);
        const open = !!expandedByDefault;
        return `
          <div class="dv-card${open ? " is-open" : ""}">
            <button type="button" class="dv-card__header"
              onclick="var c=this.parentNode;var b=c.querySelector('.dv-card__body');var o=c.classList.toggle('is-open');b.style.display=o?'block':'none';">
              <span class="dv-card__title">${title}</span>
              <span class="dv-arrow">▼</span>
            </button>
            <div id="${id}" class="dv-card__body" style="display:${open ? "block" : "none"};">
              ${bodyHtml}
            </div>
          </div>`;
      }

      const parts = [];

      /* ── Always visible: guide banner + heading + main message ── */
      parts.push(`
        <div class="dv-guide">
          <span style="font-weight:500;" data-translate>Are you new to Ifa divination?</span>
          <button id="guide-btn" onclick="handleGuideClick()" class="btn btn-md btn-default app-btn"
            style="display:flex;align-items:center;gap:6px;transform:none !important;">
            📖 <span data-translate>Read the guide</span>
          </button>
        </div>
        <div class="dv-hero">
          <div class="dv-hero__band">
            <h3 class="dv-hero__odu">${mainCast}</h3>
            <div class="dv-hero__tags">${orientationText} (${specificOrientation}) &middot; ${solution} ${solutionDetails}</div>
          </div>
          <div class="dv-hero__body">
            <p data-translate>${rawMessage} ${solutionInfo}</p>
          </div>
        </div>
      `);

      /* ── Words of Ifa / Ase Ifa — open by default ── */
      if (aseIfaHTML || coreMessage.length) {
        const coreMsgHTML = Array.isArray(coreMessage)
          ? coreMessage.map(m => `<p>${m}</p>`).join("")
          : `<p>${coreMessage}</p>`;

        const aseBody = `
          <div class="ase-verse" data-translate>${coreMsgHTML} ${aseIfaHTML}</div>
          ${(oduSummaryAse || characterHTML) ? `
            <div style="margin-top:14px;">
              <button class="ase-more-btn" id="readMoreAse">
                <span data-translate>Read more for ọmọ ${mainCast} ▼</span>
              </button>
              <div id="extraAse" style="display:none;margin-top:12px;line-height:1.75;">
                ${characterHTML ? `${characterHTML}<hr/>` : ""}
                ${oduSummaryAse ? `<span data-translate>${oduSummaryAse}</span>` : ""}
              </div>
            </div>` : ""}
        `;
        parts.push(_acc("Words of Ifa / Ase Ifa", aseBody, false));
      }

            /* ── Audio & Video — collapsed ── */
      const mediaHTML = generateAllMedia();
      if (coreAudioData.length || audioData.length || coreVideoData.length || videoData.length) {
        parts.push(_acc("Audio & Video", mediaHTML, false));
      }

      /* ── Odù Details — six correspondences grouped into one card ── */
      const _detailRows = [];
      const _row = (label, tipText, value, translate) => {
        if (!value) return;
        const v = translate ? `<span data-translate>${value}</span>` : value;
        _detailRows.push(
          `<div class="odu-detail"><div class="odu-detail__k">${label} ${tip(tipText)}</div><div class="odu-detail__v">${v}</div></div>`
        );
      };
      _row("Alias (Inagije)", "Alternative sacred names this Odu is known by among Babalawo.", alias, false);
      _row("Orisha — Ni Bibo (To Appease)", "The Orisha associated with this Odu who should be honoured or appeased.", orisha, false);
      _row("Plant (Ewe)", "Sacred plants associated with this Odu, used in spiritual baths and ritual preparation.", herb, false);
      _row("Names (Oruko)", "Names given to children born under this Odu.", names, false);
      _row("Occupation (Ise)", "Vocations naturally aligned with the energy of this Odu.", occupation, false);
      _row("Taboo (Eewo)", "Eewo are sacred prohibitions — things a person under this Odu must avoid.", taboo, true);
      if (_detailRows.length) {
        parts.push(_acc(
          `Odù Details ${tip("Key correspondences for this Odù — its Orisha, sacred plant, associated names, aligned vocations, and taboos.")}`,
          `<div class="odu-details">${_detailRows.join("")}</div>`, false
        ));
      }

      /* ── Spiritual Insight — collapsed ── */
      parts.push(_acc(
        `More Insight ${tip("This section decodes the Odu's pattern of marks line by line.")}`,
        spiritualInsight, false
      ));

      /* ── Action bar: new reading + share ── */
      // parts.push(`
      //   <div class="dv-actions">
      //     <button type="button" class="dv-actions__btn dv-actions__btn--ghost"
      //       onclick="var f=document.getElementById('main-content');if(f)f.scrollIntoView({behavior:'smooth'});">
      //       <span data-translate>New reading</span>
      //     </button>
      //     <button type="button" class="dv-actions__btn dv-actions__btn--solid"
      //       onclick="try{if(navigator.share){navigator.share({title:'Orírùn',text:'Ifá reading: ${mainCast} (${orientationText})',url:location.href}).catch(function(){});}else if(navigator.clipboard){navigator.clipboard.writeText(location.href);}}catch(e){}">
      //       <span data-translate>Share</span>
      //     </button>
      //   </div>
      // `);

      if (credit) {
        parts.push(`
          <section class="credits-section">
            <p style="font-weight:bold"><u><span data-translate>Credits & Acknowledgements</span></u></p>
            <p data-translate>Special appreciation is extended to all Babalawo, for their publicly
              shared teachings and insights, as well as to Dunad Solutions Limited and the Aminat
              Olanbiwoninu Kadri Foundation for their invaluable support.</p>
            <p style="font-size:0.92em;line-height:1.55;" data-translate>Are you a babaláwo or ìyánífá? <a href="#" onclick="openBabalawoContribution(); return false;" style="color:var(--primary,#0f7b3d);font-weight:600;text-decoration:underline;">Contribute a verse or teaching</a> — credited to you by name once a verifying elder has reviewed it.</p>
            <p style="font-style:italic;font-size:0.9em;color:var(--of-ink-soft);text-align:center;" data-translate>
              This content is inspired by collective Ifá traditions, scholarly works, and community-preserved
              teachings, shared for educational purposes only.
            </p>
          </section>
        `);
      }

      resultElement.innerHTML = parts.join("");

      /* Download / Share the reading as a branded PDF */
      if (window.orirunExport) {
        window.orirunExport.attachBar({
          key: "divination",
          sourceEl: resultElement,
          title: `${mainCast}`,
          subtitle: `${orientationText} · ${specificOrientation} · ${solution}`,
          filename: `orirun-${mainCast}-reading`.toLowerCase(),
          includeConfig: true
        });
      }

      renderFeedbackSection("Divination", {
        oduName: mainCast, orientationText: orientation,
        specificOrientation, solution, solutionDetails, hasAccess: true
      }, resultElement);

      document.getElementById("readMoreAse")?.addEventListener("click", e => {
        e.preventDefault();
        const extra    = document.getElementById("extraAse");
        const isHidden = extra.style.display === "none";
        extra.style.display = isHidden ? "block" : "none";
        e.target.textContent = isHidden ? "Show less ▲" : `Read more for ọmọ ${mainCast} ▼`;
      });

      logSilently("/api/divination/log", {
        oduName: mainCast, orientationText, specificOrientation, solution, solutionDetails
      });
      const syncToken = localStorage.getItem("syncToken");

      logSilently("/api/history/save", {
        deviceId, syncToken, type: "divination", mainCast, orientation: orientationText,
        specificOrientation, solution, solutionDetails,
        message: rawMessage, summary: spiritualInsight, timestamp: Date.now()
      });

      // if (typeof offerNotificationAfterDivination === "function") {
      //   offerNotificationAfterDivination();
      // }

      if (typeof gtag === "function") {
        gtag("event", "ifa_divination", {
          deviceId, type: "divination", mainCast,
          orientation: orientationText, specificOrientation, solution, solutionDetails
        });
      }

    } else {
      const { isNigeria } = window.APP_GEO || {};
      const displayAmount = isNigeria ? "N1,000" : "$3";

      resultElement.innerHTML = `
        <center>
          <h4 style="padding-top:30px;">
            <span data-translate>Kindly donate ${displayAmount} for a 24-hour access to</span>
            ${mainCast}, ${orientationText} (${specificOrientation}), ${solution} ${solutionDetails}.
          </h4>
          <br/>
          <button id="payButton" class="btn btn-lg btn-warning"
            onclick="payForOdu('${mainCast}','${orientation}','${specificOrientation}','${solution}','${solutionDetails}',100000)">
            <span data-translate>Donate Now</span>
          </button>
        </center>`;
    }

    displayConfiguration(mainCast);
    window.scrollTo({ top: resultElement.offsetTop, behavior: "smooth" });

    setTimeout(() => {
      if (!localStorage.getItem("ifa_guide_opened")) {
        const btn = document.getElementById("guide-btn");
        if (btn) btn.style.boxShadow = "0 0 12px rgba(46,125,50,0.6)";
      }
    }, 500);

  } catch (err) {
    resultElement.innerHTML = `
      <center><span class="alert alert-info" data-translate>${err.message}</span></center>`;
  } finally {
    hidePreloader();
    removeControl();
  }
};

/* ─────────────────────────────────────────────────────────────
 *  ODU CONFIGURATION DISPLAY
 * ───────────────────────────────────────────────────────────── */
const oduRenderCache = {};

const displayConfiguration = (oduName) => {
  const container = document.getElementById("configurationResult");

  if (oduRenderCache[oduName]) {
    container.innerHTML = oduRenderCache[oduName];
    return;
  }

  const odu        = allOdus.find(item => item.name === oduName);
  const oduId      = odu?.id ?? "N/A";
  const numerology = odu?.numerology ?? "N/A";

  const parts = [
  `<p><strong>No. ${oduId} Odù:</strong> ${oduName}</p>`,
  `<div class="odu-container" id="odu-container"
     style="
       background-image: url('public/img/opon.png');
       background-size: contain;
       background-position: center;
       background-repeat: no-repeat;
     ">`,
  `<img src="public/img/chain.png" alt="Odu Header" class="odu-header">`
];

  const base = baseOdus[oduName];

  if (base) {
    base.forEach(line => {
      parts.push(`<div class="odu-line-container">${getOduImages([line])} ${getOduImages([line])}</div>`);
    });
  } else {
    const [part1, part2] = oduName.split(" ");
    const firstPart      = part1 === "Ogbe" ? "Ejiogbe" : `${part1} Meji`;
    const secondPart     = part2 === "Ogbe" ? "Ejiogbe" : `${part2} Meji`;
    const firstConfig    = baseOdus[firstPart];
    const secondConfig   = baseOdus[secondPart];

    if (firstConfig && secondConfig) {
      firstConfig.forEach((line, i) => {
        parts.push(`<div class="odu-line-container">${getOduImages([secondConfig[i]])} ${getOduImages([line])}</div>`);
      });
    } else {
      container.innerHTML = `<h2>Odu</h2><p>Configuration not found for ${oduName}.</p>`;
      return;
    }
  }

  parts.push(
    `<img src="public/img/opeleFooter.png" alt="Odu Footer" class="odu-footer"></div>`,
    `<br/><p><a style="cursor:pointer;" class="btn btn-sm"
       onclick="displayMeaning(${numerology})">Numerology: ${numerology}</a></p>`
  );

  const html = parts.join("");
  container.innerHTML = html;
  oduRenderCache[oduName] = html;

  requestIdleCallback(() => {
    container.querySelectorAll("img").forEach(img => { new Image().src = img.src; });
  });
};

window.onload = async () => {
  const printArea     = document.getElementById("printArea");
  const loadingScreen = document.getElementById("loading-screen");
  const preloader     = document.getElementById("preloader");

  const savedLang = localStorage.getItem("appLanguage");
  if (savedLang && LANGUAGES[savedLang]) currentLang = savedLang;

  // Is a non-English translation pending? Only then must we hide the
  // content to avoid a flash of English before it translates. For English
  // (the default "baseline"), there's nothing to translate — so we reveal
  // the app IMMEDIATELY. This is the key LCP win: the largest content (the
  // homage banner) paints right away instead of waiting on the JS + server
  // chain behind the preloader.
  var _lang = (typeof currentLang !== "undefined") ? currentLang : "baseline";
  var _needsTranslation = _lang && _lang !== "baseline" && _lang !== "en";

  if (_needsTranslation) {
    // Non-English: keep the current behaviour — hide content, show loader,
    // wait briefly for the server, then reveal (translation applies after).
    printArea.style.display = "none";
    showLoading(currentLang);
    await Promise.race([
      serverReady,
      new Promise(resolve => setTimeout(resolve, 6000))
    ]);
    loadingScreen.style.display = "none";
    preloader.style.display     = "none";
    printArea.style.display     = "block";
  } else {
    // English / baseline: reveal the app AT ONCE. No preloader wait, no
    // hidden content — the browser paints the real page immediately, so
    // LCP is the homage banner at first paint, not after the JS chain.
    preloader.style.display     = "none";
    loadingScreen.style.display = "none";
    printArea.style.display     = "block";
    // The server can still warm up in the background; we don't block on it.
    Promise.race([serverReady, new Promise(r => setTimeout(r, 6000))]).catch(() => {});
  }

  const bdInput = document.getElementById("birthdate");
  if (bdInput) {
    const today = new Date().toISOString().split("T")[0];
    bdInput.max   = today;
    bdInput.value = today;
  }

  generateCircularButtons();

  // Populate dropdowns in the background; failures don't hold up the UI.
  populateDropdowns().catch((err) =>
    console.warn("⚠ Dropdown population failed:", err));


  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  document.addEventListener("click", () => speechSynthesis.getVoices(), { once: true });

  initDailyGuidance().catch(err => console.warn("Daily guidance init failed:", err));

};

/* ─────────────────────────────────────────────────────────────
 *  NUMEROLOGY CALCULATOR BUTTONS
 * ───────────────────────────────────────────────────────────── */
let canClick = true;

function generateCircularButtons() {
  if (!canClick) return;
  canClick = false;
  setTimeout(() => (canClick = true), 500);

  const calculatorDiv = document.getElementById("calculator");
  if (!calculatorDiv) return;

  const frag    = document.createDocumentFragment();
  const numbers = Array.from({ length: 9 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  const radius  = 80, centerX = 100, centerY = 100;

  numbers.forEach((num, index) => {
    const angle = index * (360 / numbers.length) * (Math.PI / 180);
    const x = centerX + radius * Math.cos(angle) - 25;
    const y = centerY + radius * Math.sin(angle) - 25;

    const button = document.createElement("button");
    button.textContent    = num;
    button.dataset.number = num;
    button.style.left = `${x}px`;
    button.style.top  = `${y}px`;
    button.onclick = function () {
      if (!canClick) return;
      this.classList.add("clicked");
      displayMeaning(this.dataset.number);
      setTimeout(generateCircularButtons, 1000);
    };
    frag.appendChild(button);
  });

  calculatorDiv.innerHTML = "";
  calculatorDiv.appendChild(frag);
}

/* ─────────────────────────────────────────────────────────────
 *  DISPLAY NUMEROLOGY MEANING
 * ───────────────────────────────────────────────────────────── */
/* The numerology "Energy N" body is server-rendered HTML that repeats each
   section's title inside the body (<p><strong>Title</strong></p>) directly
   under the accordion header, which already shows it. Remove that redundant
   restatement. Only strips a body's first <p> when its text exactly matches
   the section header — real content paragraphs never match the title. */
function _dedupeSectionHeadings(root) {
  if (!root) return;
  root.querySelectorAll("button").forEach(function (btn) {
    var headSpan = btn.querySelector("span:not(.acc-arrow)");
    var body     = btn.nextElementSibling;
    if (!headSpan || !body) return;
    var title = headSpan.textContent.trim();
    var first = body.firstElementChild;
    if (title && first && first.tagName === "P" && first.textContent.trim() === title) {
      first.remove();
    }
  });
}

async function displayMeaning(number) {
  const resultDiv = document.getElementById("result");
  const configEl  = document.getElementById("configurationResult");
  const resultEl  = document.getElementById("divinationResult");

  showPreloader();

  try {
    const response = await fetch(`/api/numerology/${number}`);
    if (!response.ok) throw new Error("Failed to fetch numerology meaning");

    const data  = await response.json();
    const label = data.label ?? "Unknown";

    logSilently("/api/divination/log", { numerology: number, label });

    if (typeof gtag === "function") {
      gtag("event", "numerology", { numerology: number, label });
    }

    resultDiv.style.display = "none";

    resultEl.innerHTML = `
      <h3 style="text-align:center;margin-top:14px;font-weight:bold;">
        <span data-translate>Energy ${number} - ${label}</span>
      </h3>
      <hr/>
      <p>${data.meaning || "No meaning found."}</p>
      <p style="font-style:italic;font-size:0.9em;color:var(--of-ink-soft);text-align:center;" data-translate>
        This content is inspired by collective scholarly works and community-preserved teachings,
        shared for educational purposes only.
      </p>`;

    _dedupeSectionHeadings(resultEl);

    configEl.innerHTML = `<img class="moving-bg" src="public/img/bird.gif" alt="bird" />`;

    /* Download / Share the number reading as a branded PDF */
    if (window.orirunExport) {
      window.orirunExport.attachBar({
        key: "picknumber",
        sourceEl: resultEl,
        title: `Energy ${number} — ${label}`,
        subtitle: "Sacred number reading",
        filename: `orirun-energy-${number}`
      });
    }

    renderFeedbackSection("Numerology", { numerology: number, label }, resultEl);
    window.scrollTo({ top: resultEl.offsetTop, behavior: "smooth" });

  } catch (error) {
    console.error("Error fetching numerology data:", error);
    document.getElementById("divinationResult").innerHTML =
      `<center><span class="alert alert-info">${error.message}</span></center>`;
  } finally {
    hidePreloader();
  }
}

/* ─────────────────────────────────────────────────────────────
 *  LOCATION & PLANETARY HOUR
 * ───────────────────────────────────────────────────────────── */
async function getLocationAndPlanetaryHour() {
  let userLocation = {}, planetaryHourData = null, locationDenied = false;

  async function fetchPlanetary(lat, lon) {
    try {
      const res = await fetch(`/api/planetary/current?lat=${lat}&lon=${lon}`);
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }

  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, timeout: 3000, maximumAge: 20000
      })
    );
    userLocation      = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    planetaryHourData = await fetchPlanetary(userLocation.lat, userLocation.lon);
  } catch (geoErr) {
    if (geoErr.code === 1) locationDenied = true;
    try {
      const ip = await fetch("https://ipapi.co/json/").then(r => r.json());
      userLocation = { lat: ip.latitude, lon: ip.longitude, city: ip.city, country: ip.country_name };
      planetaryHourData = await fetchPlanetary(ip.latitude, ip.longitude);
    } catch { /* planetary hour unavailable */ }
  }

  return { userLocation, planetaryHourData, locationDenied };
}

/* ─────────────────────────────────────────────────────────────
 *  EXTRACT PINNACLES HELPER
 * ───────────────────────────────────────────────────────────── */
function extractPinnacles(data, age) {
  const pinnacles  = data.pinnacleChallenge?.pinnacles  || [];
  const challenges = data.pinnacleChallenge?.challenges || [];

  const pinnaclePhases = pinnacles.map((p, i) => ({
    ageRange:         p.ageRange,
    pinnacleNumber:   p.number,
    pinnacleMeaning:  p.label,
    challengeNumber:  challenges[i]?.number || null,
    challengeMeaning: challenges[i]?.label  || null
  }));

  const currentIndex = pinnacles.findIndex(p => {
    const [start, end] = p.ageRange.split("–").map(Number);
    return age >= start && age <= end;
  });

  return {
    pinnaclePhases,
    currentPinnacleNumber:  pinnacles[currentIndex]?.number  || 0,
    currentChallengeNumber: challenges[currentIndex]?.number || 0
  };
}

// /* ─────────────────────────────────────────────────────────────
//  *  AI ENERGY INTERPRETATION
//  * ───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
 *  parseEnergyAccordion
 *  Splits the AI response on numbered section headers and
 *  renders each section as a collapsible accordion.
 *  Section 1 (Nature of the Person's Òrì) starts open.
 *  All others start collapsed.
 *
 *  Handles both formats the AI may return:
 *    1️⃣ **Title**         (emoji + bold)
 *    **1. Title**          (bold number)
 * ───────────────────────────────────────────────────────────── */
function parseEnergyAccordion(text) {
  /* Split on lines that start with a number emoji or bold number heading */
  const sectionRegex = /(?=(?:[1-9]️⃣|\*\*[1-9][.:])\s)/g;
  const rawSections  = text.split(sectionRegex).filter(s => s.trim());

  if (rawSections.length < 2) {
    /* AI didn't use expected structure — fall back to plain render */
    return `<div style="border-left:4px solid var(--of-green);padding:12px;border-radius:6px;line-height:1.65;">
      ${formatResponseAsHTML(text)}
    </div>`;
  }

  let _id = 0;
  return rawSections.map((section, idx) => {
    /* Extract the heading from the first line */
    const lines   = section.trim().split("\n");
    const heading = lines[0]
      .replace(/^[1-9]️⃣\s*/, "")          // remove emoji number
      .replace(/^\*\*[1-9][.:]\s*/, "")     // remove **1.
      .replace(/\*\*/g, "")                  // remove bold markers
      .trim();
    const body    = lines.slice(1).join("\n").trim();
    const id      = "ori-acc-" + (++_id);
    const open    = idx === 0;

    return `
      <div style="border:1px solid #d4edda;border-radius:10px;margin-bottom:8px;overflow:hidden;background:#fff;">
        <button
          onclick="var b=document.getElementById('${id}');var a=this.querySelector('.acc-arrow');var isOpen=b.style.display!=='none';b.style.display=isOpen?'none':'block';a.style.transform=isOpen?'rotate(0deg)':'rotate(180deg)';"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:11px 14px;background:linear-gradient(135deg,#f0f7f0,#e8f5e8);border:none;cursor:pointer;font-size:13px;font-weight:bold;color:#1b4332;text-align:left;gap:8px;transform:none !important;box-shadow:none !important;">
          <span data-translate>${heading}</span>
          <span class="acc-arrow" style="transition:transform 0.25s;transform:${open ? "rotate(180deg)" : "rotate(0deg)"};font-size:11px;flex-shrink:0;">▼</span>
        </button>
        <div id="${id}" style="display:${open ? "block" : "none"};padding:12px 14px;line-height:1.65;font-size:14px;">
          <span data-translate>${formatResponseAsHTML(body)}</span>
        </div>
      </div>`;
  }).join("");
}


async function getEnergyInterpretation(payload) {

const prompt = `
Interpret this life chart using African spiritual wisdom, with Yoruba cosmology as the primary lens.

Speak as an elder who observes patterns clearly.
Do not explain spirituality. Speak as if it is already understood.

------------------------
HIERARCHY OF INTERPRETATION
------------------------

CORE IDENTITY (DOMINANT)
- Life Path: ${payload.lifepath}
- Destiny: ${payload.destiny}
- Soul Urge: ${payload.soulUrge}

EXPRESSION LAYER
- Personality: ${payload.personality}
- Birthday Gift: ${payload.birthdayGift}
- Reality: ${payload.reality}

TIMING LAYER (CONTEXT ONLY)
- Pinnacle: ${payload.pinnacleNumber}
- Challenge: ${payload.challengeNumber}
- Year: ${payload.year}, Month: ${payload.month}, Week: ${payload.week}, Day: ${payload.day}

COSMIC LAYER (SUPPORT ONLY)
- Zodiac: ${payload.zodiac} (${payload.zodiacElement})
- Orisha: ${payload.zodiacOrisha}
- Planetary Hour: ${payload.planetaryHour} (${payload.planetaryOrisha})

If there is conflict, always prioritize CORE IDENTITY.

------------------------
STRICT RULES
------------------------

- Use exactly 8 sections, with the titles and order given below.
- Each section = 3 to 4 sentences.
- Each sentence < 20 words.
- Speak directly using "you".
- Every section must name a real, specific behaviour or lived pattern — something the person would recognise in themselves.
- Speak with certainty. Avoid "you may", "you tend to", "perhaps".

ANTI-GENERIC:
- If a sentence could describe almost anyone, rewrite it until it could not.

NUMBER USAGE:
- Do NOT mention numbers (e.g., 3, 7, 8).
- Speak only in meaning, not calculation.

COSMIC LAYER:
- Use zodiac, Orisha, and planetary hour only lightly, as support. Never lead with them.

STYLE:
- Grounded, observational, certain — the voice of an elder, not a coach.
- No motivational filler. No modern psychology.

PROHIBITED:
- No rituals, sacrifices, or ebo.

------------------------
STRUCTURE (use these exact titles, in this order)
------------------------

1️⃣ Nature of Òrì
- Core identity from Life Path, Destiny, and Soul Urge.
- Name the central drive, one inner contradiction, and one behaviour it repeats.

2️⃣ The Hidden Desire
- From Soul Urge: what the spirit privately longs for.
- Show how this quiet hunger shapes choices others never see.

3️⃣ The Face You Show
- From Personality: how people first read you, before they truly know you.
- Reveal where this outer self differs from who you are within.

4️⃣ Your Inborn Gift
- From Birthday Gift and Reality: the strength carried since birth.
- Show how it appears in ordinary, everyday moments.

5️⃣ Path & Work
- From Destiny and Reality: how this life is meant to build and contribute.
- Name the kind of work that fits this Ase, and what quietly drains it.

6️⃣ Love & Bonds
- How you give and receive closeness.
- Name what you need from others, and the tension that keeps returning in your bonds.

7️⃣ Present Season
- From Pinnacle, Challenge, and current timing: the lesson of this chapter.
- State the tension between pressure and opportunity, then say plainly: act, wait, adjust, or observe.

8️⃣ Guidance of Òrì
- Direct, practical guidance for habits, decisions, and mindset now.
- Stay grounded and clear to the end — never motivational.

FINAL LINE:
- After the eight sections, add one short sentence on its own, exposing a real pattern this person has already lived through.

Do not rush. Speak as one who has seen this life before.
`.trim();

  try {
    const response = await fetch("/api/ai/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        chatHistory: [
          {
            role: "system",
            content:
              "You are a multilingual Babalawo (Ifa priest) and elder interpreting a person's life chart. " +
              "You speak entirely from within Yoruba cosmology. Numbers are treated as vibrational Ase " +
              "(divine energy), not personality types. Speak as if consulting Ifa and reading " +
              "the Odu that governs this person's life."
          },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok || !data.message) throw new Error("AI interpretation failed");
    return data.message;
  } catch (error) {
    console.error("AI interpretation error:", error);
    return "The spiritual interpretation could not be generated at this moment. Please try again later.";
  }
}

/* ─────────────────────────────────────────────────────────────
 *  BIRTH CHART — MAIN ENTRY POINT
 * ───────────────────────────────────────────────────────────── */

const performBirthChart = async () => {
  const fullName  = document.getElementById("fullname").value.trim();
  const birthdate = document.getElementById("birthdate").value;

  const resultElement        = document.getElementById("divinationResult");
  const resultDiv            = document.getElementById("result");
  const configurationElement = document.getElementById("configurationResult");

  resultElement.innerHTML = "";
  resultDiv.innerHTML     = "";
  resultDiv.style.display = "none";

  if (!fullName) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;font-size:14px'>Please enter your full name</span>";
    return;
  }
  if (!birthdate) {
    resultDiv.style.display = "block";
    resultDiv.innerHTML = "<span style='color:red;font-size:14px'>Please select your birth date.</span>";
    return;
  }

  showPreloader('<span data-translate>Calculating your life energies…</span>');
  configurationElement.innerHTML = `<img class="moving-bg" src="public/img/bird.gif" alt="bird" />`;

  try {
    const [numerologyRes, locationResult] = await Promise.all([
      fetch("/api/numerology/", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullname: fullName, birthdate })
      }),
      getLocationAndPlanetaryHour()
    ]);

    if (!numerologyRes.ok) throw new Error("Failed to get numerology insights.");

    const data = await numerologyRes.json();
    const { userLocation, planetaryHourData, locationDenied } = locationResult;
    const { age } = data;
    const lifepath = data.vibrations.lifepath.label;
    const astro    = data.astrology;

    const { pinnaclePhases, currentPinnacleNumber, currentChallengeNumber } =
      extractPinnacles(data, age);

    logSilently("/api/divination/log", { fullName, birthdate, age, lifepath, location: userLocation });
    const syncToken = localStorage.getItem("syncToken");
    logSilently("/api/history/save", {
      deviceId, syncToken, type: "birthDetails", fullName, birthdate, age, lifepath,
      lifepathNo: data.vibrations.lifepath.number,
      destiny:    data.destiny.number,
      soulUrge:   data.soulUrge.number,
      quiescent:  data.quiescent.number,
      reality:    data.vibrations.reality.number,
      daily:      data.vibrations.day.number,
      weekly:     data.vibrations.week.number,
      monthly:    data.vibrations.month.number,
      yearly:     data.vibrations.year.number,
      timestamp:  new Date().toISOString()
    });

    if (typeof markNewBirthChart === "function") markNewBirthChart();
    if (typeof offerNotificationAfterDivination === "function") offerNotificationAfterDivination();
    if (typeof gtag === "function") gtag("event", "birth_details", { deviceId, fullName, birthdate, age });

    hidePreloader();

    /* ── Accordion helper ── */
    let _accId = 0;
    function _acc(title, bodyHtml, expandedByDefault) {
      const id   = "acc-bc-" + (++_accId);
      const open = !!expandedByDefault;
      return `
        <div style="border:1px solid #d4edda;border-radius:10px;margin-bottom:10px;overflow:hidden;background:#fff;">
          <button class="acc-header"
            onclick="var b=document.getElementById('${id}');var a=this.querySelector('.acc-arrow');var isOpen=b.style.display!=='none';b.style.display=isOpen?'none':'block';a.style.transform=isOpen?'rotate(0deg)':'rotate(180deg)';"
            style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(135deg,#f0f7f0,#e8f5e8);border:none;cursor:pointer;font-size:14px;font-weight:bold;color:#1b4332;text-align:left;gap:8px;">
            <span>${title}</span>
            <span class="acc-arrow" style="transition:transform 0.25s;transform:${open ? "rotate(180deg)" : "rotate(0deg)"};font-size:12px;flex-shrink:0;">▼</span>
          </button>
          <div id="${id}" style="display:${open ? "block" : "none"};padding:14px 16px;line-height:1.7;">
            ${bodyHtml}
          </div>
        </div>`;
    }

    /* ── parseEnergyAccordion
         Splits the AI response on numbered section headers and renders
         each section as a nested collapsible accordion.
         Section 1 (Nature of the Person's Òrì) starts open.
         Falls back to plain render if structure is not found.
    ── */

function parseEnergyAccordion(text) {
  const sectionRegex = /(?=(?:[1-9]️⃣|\*\*[1-9][.:])\s)/g;
  const rawSections  = text.split(sectionRegex).filter(s => s.trim());

  if (rawSections.length < 2) {
    return `<div style="border-left:4px solid var(--of-green);padding:12px;border-radius:6px;line-height:1.65;">
      ${formatResponseAsHTML(text)}
    </div>`;
  }

  let _sid = 0;
  return rawSections.map((section, idx) => {
    const lines = section.trim().split("\n");

    /* Extract heading — strip emoji number and bold markers */
    const heading = lines[0]
      .replace(/^[1-9]️⃣\s*/, "")
      .replace(/^\*\*[1-9][.:]\s*/, "")
      .replace(/\*\*/g, "")
      .trim();

    const body = lines.slice(1).join("\n").trim();

    /* Skip sections with no heading AND no body — blank AI artifact */
    if (!heading && !body) return "";

    /* If heading is empty but body exists, use a generic title */
    const displayTitle = heading || "Introduction";

    const sid  = "ori-sec-" + (++_sid);
    const open = idx === 0;

    return `
      <div style="border:1px solid #c8e6c9;border-radius:8px;margin-bottom:6px;overflow:hidden;background:#fafff9;">
        <button class="acc-header"
          onclick="var b=document.getElementById('${sid}');var a=this.querySelector('.acc-arrow');var isOpen=b.style.display!=='none';b.style.display=isOpen?'none':'block';a.style.transform=isOpen?'rotate(0deg)':'rotate(180deg)';"
          style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:linear-gradient(135deg,#f5fbf5,#edf7ed);border:none;cursor:pointer;font-size:13px;font-weight:bold;color:#1b4332;text-align:left;gap:8px;">
          <span data-translate>${displayTitle}</span>
          <span class="acc-arrow" style="transition:transform 0.25s;transform:${open ? "rotate(180deg)" : "rotate(0deg)"};font-size:11px;flex-shrink:0;">▼</span>
        </button>
        <div id="${sid}" style="display:${open ? "block" : "none"};padding:12px 14px;line-height:1.65;font-size:14px;">
          <span data-translate>${formatResponseAsHTML(body || heading)}</span>
        </div>
      </div>`;
  }).filter(Boolean).join("");
}

    const parts = [];

    /* 🧿 Voice of Òrì — PRIMARY EXPERIENCE */
    const _oriName = (fullName || "").trim().split(/\s+/)[0] || "";
    const oriFirst = _oriName ? _oriName.charAt(0).toUpperCase() + _oriName.slice(1) : "";
    parts.push(_acc(`🧿 ${oriFirst ? oriFirst + " — " : ""}The Voice of Your Òrì`, `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <small style="opacity:0.6;" data-translate>${oriFirst ? oriFirst + "\u2019s personal reading from name & birth date" : "Your personal reading from name & birth date"}</small>
        <button id="energy-toggle-btn" onclick="toggleEnergyBreakdown(this)"
          style="font-size:12px;border:1px solid #c8e6c9;background:#e8f5e9;color:#1b4332;padding:6px 12px;border-radius:20px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:background .2s;">
          <span class="etoggle-label" data-translate>View Energy Breakdown</span>
          <span class="etoggle-caret" style="display:inline-block;transition:transform .25s;">▾</span>
        </button>
      </div>

      <div id="ori-voice-slot" style="border-left:4px solid var(--of-green);border-radius:6px;padding:12px;min-height:60px;display:flex;align-items:center;gap:10px;color:var(--of-green);">
        <span class="spinner" style="width:18px;height:18px;"></span>
        <em>Your reading is being prepared...</em>
      </div>

      <div id="energy-breakdown" style="display:none;margin-top:12px;padding:14px;background:#f7fcf7;border:1px solid #e0efe0;border-radius:10px;font-size:13px;line-height:1.6;"></div>
    `, true));


    /* ⏳ Current Hour Influence is now rendered as a NESTED section inside
       the Voice of Òrì accordion (appended in the .then() below),
       so it matches the other sections instead of standing alone. */


    /* Disclaimer */
    parts.push(`
      <p style="font-style:italic;font-size:0.9em;color:var(--of-ink-soft);text-align:center;margin-top:12px;" data-translate>
        This content is inspired by collective scholarly works and community-preserved teachings, shared for educational purposes only.
      </p>
    `);
    resultElement.innerHTML = parts.join("");

    /* Download / Share the numerology chart as a branded PDF */
    if (window.orirunExport) {
      window.orirunExport.attachBar({
        key: "numerology",
        sourceEl: resultElement,
        title: `${fullName} — Numerology Chart`,
        subtitle: "Yorùbá numerology birth chart",
        filename: `orirun-${(fullName || "chart").replace(/\s+/g, "-")}-numerology`.toLowerCase()
      });
    }

    renderFeedbackSection("Birth Details",
      { fullName, birthdate, age, location: userLocation },
      resultElement
    );

    window.scrollTo({ top: resultElement.offsetTop, behavior: "smooth" });

    /* AI interpretation in background */
    getEnergyInterpretation({
      fullName, birthdate, age,
      birthdayGift:      data.birthdayGift?.number                  || 0,
      lifepath:          data.vibrations?.lifepath?.number           || 0,
      destiny:           data.destiny?.number                        || 0,
      soulUrge:          data.soulUrge?.number                       || 0,
      personality:       data.quiescent?.number                      || 0,
      reality:           data.vibrations?.reality?.number            || 0,
      pinnacleNumber:    currentPinnacleNumber,
      challengeNumber:   currentChallengeNumber,
      pinnaclePhases,
      year:              data.vibrations?.year?.number               || 0,
      month:             data.vibrations?.month?.number              || 0,
      week:              data.vibrations?.week?.number               || 0,
      day:               data.vibrations?.day?.number                || 0,
      zodiac:            data.astrology?.name                        || "",
      zodiacElement:     data.astrology?.element                     || "",
      zodiacOrisha:      data.astrology?.orisha                      || "",
      zodiacRuler:       data.astrology?.ruler                       || "",
      zodiacYorubaMonth: data.astrology?.yorubaMonth                 || "",
      zodiacStart:       data.astrology?.start                       || "",
      zodiacEnd:         data.astrology?.end                         || "",
      orishaDomain:      data.astrology?.orishaInfluence?.domain     || "",
      orishaEffect:      data.astrology?.orishaInfluence?.effect     || "",
      ifaWisdom:         data.astrology?.orishaInfluence?.ifaWisdom  || "",
      planetaryHour:     planetaryHourData?.planet                   || "",
      planetaryOrisha:   planetaryHourData?.orisha                   || "",
      planetaryEnergy:   planetaryHourData?.energy                   || ""
    }).then((aiInterpretation) => {
      const slot = document.getElementById("ori-voice-slot");
      if (!slot) return;
      slot.style.display    = "block";
      slot.style.alignItems = "unset";
      slot.style.minHeight  = "unset";
      /* Render AI sections as nested accordions inside the Voice of Ori */
      // slot.innerHTML = parseEnergyAccordion(aiInterpretation);
      slot.innerHTML = parseEnergyAccordion(aiInterpretation);

      /* ⏳ Current Hour Influence — appended as a nested section, same style as the rest */
      const _hourBody = planetaryHourData
        ? `<p style="margin:0 0 6px;"><strong data-translate>${planetaryHourData.orisha}</strong> <em style="font-size:0.85em;opacity:0.6">(${planetaryHourData.planet})</em></p><p style="margin:0;opacity:0.85;" data-translate>${planetaryHourData.energy}</p>`
        : (locationDenied
            ? `<p style="margin:0;color:var(--of-ink-soft)"><em data-translate>Current hour influence unavailable (location access denied).</em></p>`
            : "");
      if (_hourBody) {
        const _hid = "ori-hour-" + Date.now();
        slot.insertAdjacentHTML("beforeend",
          `<div style="border:1px solid #c8e6c9;border-radius:8px;margin-bottom:6px;overflow:hidden;background:#fafff9;">`
          + `<button class="acc-header" onclick="var b=document.getElementById('${_hid}');var a=this.querySelector('.acc-arrow');var isOpen=b.style.display!=='none';b.style.display=isOpen?'none':'block';a.style.transform=isOpen?'rotate(0deg)':'rotate(180deg)';" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:linear-gradient(135deg,#f5fbf5,#edf7ed);border:none;cursor:pointer;font-size:13px;font-weight:bold;color:#1b4332;text-align:left;gap:8px;">`
          + `<span data-translate>⏳ Current Hour Influence</span>`
          + `<span class="acc-arrow" style="transition:transform 0.25s;transform:rotate(0deg);font-size:11px;flex-shrink:0;">▼</span>`
          + `</button>`
          + `<div id="${_hid}" style="display:none;padding:12px 14px;line-height:1.65;font-size:14px;">${_hourBody}</div>`
          + `</div>`);
      }

      /* Populate Energy Breakdown */
      const breakdown = document.getElementById("energy-breakdown");
      if (breakdown) {
        breakdown.innerHTML =
          `<div style="font-size:12px;color:var(--of-ink-soft);margin-bottom:10px;" data-translate>These are the numbers behind your reading. Tap Read more on any to understand its energy.</div>`
          + _energyGroup("Core Identity",
              _energyRow("Life Path", data.vibrations?.lifepath?.number, data.vibrations?.lifepath?.label, "lifepath")
            + _energyRow("Destiny",   data.destiny?.number,              data.destiny?.label,              "destiny")
            + _energyRow("Soul Urge", data.soulUrge?.number,             data.soulUrge?.label,             "soulurge"))
          + _energyGroup("Expression Layer",
              _energyRow("Personality",   data.quiescent?.number,           data.quiescent?.label,           "personality")
            + _energyRow("Birthday Gift", data.birthdayGift?.number,        data.birthdayGift?.label,        "birthdaygift")
            + _energyRow("Reality",       data.vibrations?.reality?.number, data.vibrations?.reality?.label, "reality"))
          + _energyGroup("Current Cycle",
              _energyRow("Pinnacle",  currentPinnacleNumber,  "", "pinnacle")
            + _energyRow("Challenge", currentChallengeNumber, "", "challenge"))
          + _energyGroup("Time Flow",
              _energyRow("Personal Year",  data.vibrations?.year?.number,  "", "year")
            + _energyRow("Personal Month", data.vibrations?.month?.number, "", "month")
            + _energyRow("Personal Week",  data.vibrations?.week?.number,  "", "week")
            + _energyRow("Personal Day",   data.vibrations?.day?.number,   "", "day"));
      }
      window.scrollTo({ top: resultElement.offsetTop, behavior: "smooth" });
    }).catch(() => {
      const slot = document.getElementById("ori-voice-slot");
      if (slot) slot.innerHTML =
        `<em style="color:var(--of-muted);" data-translate>The spiritual interpretation could not be generated at this moment. Please try again later.</em>`;
    });

  } catch (error) {
    console.error(error);
    hidePreloader();
    resultElement.innerHTML =
      `<center><span class="alert alert-info" data-translate>${error.message}</span></center>`;
  }
};

/* ── Energy Breakdown: position meanings + number essences for "Read more" ── */
const ENERGY_POSITION_MEANING = {
  lifepath:     "Your Life Path is the main road of this lifetime \u2014 the central lessons and direction you grow into.",
  destiny:      "Your Destiny (Expression) shows the talents and purpose you are meant to develop and give.",
  soulurge:     "Your Soul Urge is the inner motivation \u2014 what your heart privately longs for beneath everything.",
  personality:  "Your Personality is the face others meet first, before they truly know you.",
  birthdaygift: "Your Birthday Gift is a natural talent you were born holding, often used without effort.",
  reality:      "Your Reality number points to what your life is quietly building toward in its later maturity.",
  pinnacle:     "Your Pinnacle marks the opportunity and theme of the chapter you are living now.",
  challenge:    "Your Challenge names the recurring lesson you are being asked to master in this season.",
  year:         "Your Personal Year sets the overall tone and lesson colouring this whole year.",
  month:        "Your Personal Month shades the current month within the year's larger theme.",
  week:         "Your Personal Week gives the near-term rhythm of these few days.",
  day:          "Your Personal Day is the energy of today itself."
};
const ENERGY_NUMBER_ESSENCE = {
  "1":"leadership, independence, and new beginnings.",
  "2":"partnership, sensitivity, and quiet diplomacy.",
  "3":"expression, creativity, and joy.",
  "4":"structure, discipline, and steady building.",
  "5":"freedom, change, and restless curiosity.",
  "6":"responsibility, care, and devotion to others.",
  "7":"introspection, wisdom, and the search for truth.",
  "8":"ambition, power, and material mastery.",
  "9":"compassion, completion, and service to the whole.",
  "11":"heightened intuition, vision, and spiritual insight (a master number).",
  "22":"the master builder \u2014 turning great vision into solid, lasting form.",
  "33":"the master teacher \u2014 healing through devoted, selfless love."
};
function energyMeaning(posKey, num) {
  const pos = ENERGY_POSITION_MEANING[posKey] || "";
  const ess = ENERGY_NUMBER_ESSENCE[String(num)] || "";
  return ess ? `${pos} Here it carries the energy of ${ess}` : pos;
}
function _energyRow(name, num, label, posKey) {
  const rid = "egy-" + posKey + "-" + Math.random().toString(36).slice(2, 7);
  const meaning = energyMeaning(posKey, num);
  const badge = (num || num === 0) ? num : "\u2013";
  return `<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-top:1px solid #eef4ee;">`
    + `<div style="flex:0 0 auto;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#0f7b3d,#0a5a2c);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${badge}</div>`
    + `<div style="flex:1 1 auto;min-width:0;">`
    +   `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">`
    +     `<span style="font-weight:600;color:#1b4332;" data-translate>${name}</span>`
    +     (label ? `<span style="font-size:12px;color:var(--of-ink-soft);text-align:right;" data-translate>${label}</span>` : "")
    +   `</div>`
    +   (meaning
        ? `<button onclick="var m=document.getElementById('${rid}');var o=m.style.display==='none';m.style.display=o?'block':'none';this.textContent=o?'Show less':'Read more';" style="margin-top:4px;background:none;border:none;padding:0;color:var(--of-green);font-size:12px;font-weight:600;cursor:pointer;" data-translate>Read more</button>`
          + `<div id="${rid}" style="display:none;margin-top:6px;font-size:13px;line-height:1.55;color:var(--of-ink);" data-translate>${meaning}</div>`
        : "")
    + `</div>`
    + `</div>`;
}
function _energyGroup(title, rows) {
  return `<div style="background:#fff;border:1px solid #d9ebd9;border-radius:10px;padding:4px 14px 12px;margin-bottom:10px;">`
    + `<div style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0a5a2c;background:#e8f5e9;padding:4px 10px;border-radius:20px;margin:12px 0 2px;" data-translate>${title}</div>`
    + rows
    + `</div>`;
}
function toggleEnergyBreakdown(btn) {
  const el = document.getElementById("energy-breakdown");
  if (!el) return;
  const opening = (el.style.display === "none" || !el.style.display);
  el.style.display = opening ? "block" : "none";

  const b = btn || document.getElementById("energy-toggle-btn");
  if (b) {
    const lbl = b.querySelector(".etoggle-label");
    const car = b.querySelector(".etoggle-caret");
    if (lbl) lbl.textContent = opening ? "Hide Energy Breakdown" : "View Energy Breakdown";
    if (car) car.style.transform = opening ? "rotate(180deg)" : "rotate(0deg)";
    b.style.background = opening ? "#d7eddf" : "#e8f5e9";
  }
  if (opening) {
    requestAnimationFrame(function () { el.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  }
}

/* ─────────────────────────────────────────────────────────────
 *  WHAT TO DO TEXT
 * ───────────────────────────────────────────────────────────── */
function getWhatToDoText(specificOrientationParam, solutionDetailsParam) {
  const orientationMap = {
    "Iku":            "Ó pa ẹran òṣì jẹ (Ìgbà òṣì ni ìgbà tí ó yẹ kí ẹnìyàn kọ́ iṣẹ́ tàbí kàwé tí ó kọ́ tí kò ṣe, bíi ìwọ kò bà tí ní iṣẹ́ lọwọ̀, ó ti pa ẹran òṣì jẹ). Propitiate Ṣàngó and Oyá",
    "Arun":           "Ó pa ẹran àdánù jẹ (Bí ẹnìyàn bá rí ẹbọ ní orítà, tí kò fí àdúrà ran ẹlẹ́bọ náà lọwọ̀ tàbí kí ó wùrè fún ara rẹ, tí ó wà wípé kí ẹbọ ẹlẹ́bọ padà lẹ́yìn ohun, ó ti pa ẹran àdánù jẹ). Propitiate Ọ̀rìṣànlá and Obalúayé",
    "Ejo":            "Ó pa ẹran ẹtì jẹ (Bí ẹnikẹ́ni bá ti jìnnà sí inú rere, ìwà rere, ọ̀rọ̀ ṣíṣẹ́, tí oni ohùn kò ṣe ọ̀rọ̀ mọ́, dájú dájú ó ti pa ẹran ẹtì jẹ). Propitiate Oyá and Ṣàngó",
    "Ofo":            "Ó pa ẹran ìyà jẹ (Ìgbà tí ẹnìyàn bá ti kó ẹyìn sí gbogbo Òrìṣà wà tí kò fí ọ̀rọ̀ lọ wọn mọ́. Tí ó ní ohun àtijọ́ tí rẹ̀kọjá lọ, ó ti pa ẹran ìyà jẹ). Propitiate Obalúayé and Ọ̀rìṣànlá",
    "Okutagbunilese": "Ó pa ẹran òṣì jẹ (Ìgbà òṣì ni ìgbà tí ó yẹ kí ẹnìyàn kọ́ iṣẹ́ tàbí kàwé tí ó kọ́ tí kò ṣe, bíi ìwọ kò bà tí ní iṣẹ́ lọwọ̀, ó ti pa ẹran òṣì jẹ). Propitiate Èlégbàrà and Ṣìgìdì",
    "Aiku":           "Ó pa ẹran ètè jẹ (Bí ẹnikàn bá ti sọ Èṣù di ọ̀tá rẹ, tí ó wà ń yẹ̀yẹ́ Èṣù tàbí sọ̀rọ̀ Èṣù ní aidára, dájú dájú, ó ti pa ẹran ètè jẹ). Propitiate Màlókùn and Àjé",
    "Aje":            "Ó pa ẹran ogun jẹ (Ní ìgbà tí ẹnìyàn kó ẹyìn sí Olódùmarè tí ó ní òwun ń bá Olódùmarè bínú, tí ó bà tí ń bá Olódùmarè bínú ó ti pa ẹran ogun jẹ). Propitiate Àjé and Màlókùn",
    "Isegun":         "Ó pa ẹran àrùn jẹ (Bí ẹnikàn bá ti kó ẹyìn sí ọ̀rọ̀ enu Ifá tí kò pa òfin mọ́, tí ó ní Ifá kò lè yàn fún ohùn mọ́ ó ti pa ẹran àrùn jẹ). Propitiate Olúwẹrí and Òṣun",
    "Igbale Ese":     "Ó pa ẹran ìdáàmú jẹ (Bí ẹnikẹ́ni bá ti ń fí ojú òṣó tàbí Àjé, tàbí wípé ohùn ní ónṣe mi wò ẹnikẹ́jì rẹ nílẹ̀ ayé tí kò di ẹbọ rírú àti ètùtù mú, dájú dájú ó ti pa ẹran ìdáàmú jẹ). Propitiate Òṣun and Olúwẹrí",
    "Gbogbo Ire":     "Ó pa ẹran ìdáàmú jẹ (Bí ẹnikẹ́ni bá ti ń fí ojú òṣó tàbí Àjé, tàbí wípé ohùn ní ónṣe mi wò ẹnikẹ́jì rẹ nílẹ̀ ayé tí kò di ẹbọ rírú àti ètùtù mú, dájú dájú ó ti pa ẹran ìdáàmú jẹ). Propitiate Òrígì and Ṣìgìdì"
  };

  const solutionMap = {
    "Akoru": "appease your Ori & Idodo in front of your Ifa.",
    "Esha":  "appease your Ori & Idodo in front of your Ifa.",
    "Ori":   "appease your Ori & Idodo in front of your Ifa.",
    "Eegun": "appease your Idodo & Ese in front of your Ifa.",
    "Osha":  "appease your Ori & Aya in front of your Ifa.",
    "Ifa":   "appease your Ori & Ese in front of your Ifa."
  };

  const orientationText = orientationMap[specificOrientationParam];
  const solutionText    = solutionMap[solutionDetailsParam];

  if (orientationText && solutionText) return `${orientationText} and ${solutionText}`;
  return orientationText || solutionText || null;
}

/* ─────────────────────────────────────────────────────────────
 *  DECODE IFA WITH SPIRITUAL CONTEXT
 * ───────────────────────────────────────────────────────────── */
function decodeIfaWithSpiritualContext(
  mainCastParam, orientationParam, specificOrientationParam,
  solutionParam, solutionDetailsParam
) {
  const elements = ["Fire", "Air", "Water", "Earth"];
  const elementSpiritualData = {
    Fire:  { orisha: "Sango",    essence: "Power, Will, Energy, Justice",               attributes: "Transformation, strength, courage, righteous action",       imbalance: "Anger, restlessness, impulsive actions",              focus: "Act with purpose, assert boundaries, align with justice, dance, use fire rituals" },
    Air:   { orisha: "Orunmila", essence: "Thought, Breath, Spirit, Intuition",         attributes: "Wisdom, foresight, clarity of mind, divine communication",   imbalance: "Confusion, anxiety, mental fog",                      focus: "Meditation, journaling, prayer, quiet study, dream interpretation" },
    Water: { orisha: "Obatala",  essence: "Emotion, Compassion, Healing, Purity",       attributes: "Peace, forgiveness, nurturing, gentleness",                  imbalance: "Emotional blockages, harshness, internal turmoil",    focus: "Engage in cleansing rituals, show kindness, offer peace, drink water mindfully, take spiritual baths" },
    Earth: { orisha: "Ogun",     essence: "Grounding, Labor, Structure, Manifestation", attributes: "Hard work, discipline, protection, practicality",             imbalance: "Laziness, instability, disconnection from purpose",   focus: "Get hands-on with projects, organize, plant something, work with iron/tools, connect to ancestors" }
  };

  const isDoubleOdu = Object.keys(baseOdus).includes(mainCastParam);
  const focusedOdu  = isDoubleOdu
    ? mainCastParam.replace(" Meji", "").replace("Eji", "")
    : orientationParam === "Positive"
      ? mainCastParam.split(" ")[1] || mainCastParam.split(" ")[0]
      : mainCastParam.split(" ")[0];

  const pattern = baseOdus[`${focusedOdu} Meji`] || ["|", "|", "|", "|"];

  const latentOrishaInsights = [];
  const markInterpretation   = pattern.map((mark, index) => {
    const element = elements[index];
    const mapping = elementSpiritualData[element];
    const isOpen  = mark === "|";
    if (!isOpen) {
      latentOrishaInsights.push(`
        <strong>${mapping.orisha}</strong><span data-translate> (${element})</span><br/>
        • <span data-translate> Essence: ${mapping.essence}</span><br/>
        • <span data-translate> Attributes: ${mapping.attributes}</span><br/>
        • <span data-translate> Imbalance: ${mapping.imbalance}</span><br/>
        • <span data-translate> Focus: ${mapping.focus}</span><br/><br/>
      `);
    }
    return `${index + 1}. Mark ${mark} → Element: <strong>${element}</strong>, Orisha: <strong>${mapping.orisha}</strong> — ${isOpen ? "open (energetically active)" : "closed (energetically latent)"}`;
  });

  const spiritualForce = orientationParam === "Positive"
    ? "Ẹ̀la Opitan (Aworomaja)" : "Ẹ̀la Osode (Ajagunmale)";

  const latentSection = latentOrishaInsights.length
    ? `<p><span data-translate>Latent Orisha Energies & Guidance:</span><br/>${latentOrishaInsights.join("")}</p>`
    : `<p>✅ <span data-translate>All Orisha Energies Are Active:</span> <span data-translate>You are fully aligned at this time.</span></p>`;

  const figureData = ifaFigures.find(fig => fig.name.toLowerCase() === focusedOdu.toLowerCase());
  const eboraText  = figureData ? `<p><strong>Ebora:</strong> ${figureData.ebora}</p>` : "";

  const whatToDo     = getWhatToDoText(specificOrientationParam, solutionDetailsParam);
  const whatToDoText = whatToDo ? `<p data-translate>${whatToDo}</p>` : "";

  const tip = (text) =>
    `<i class="ifa-tip" data-translate-attr="data-tip" data-tip="${text.replace(/"/g, "&quot;")}"
      onclick="openIfaTip(this, event)" role="button" aria-label="More information">i</i>`;

  return `
    <p>
      <strong data-translate>Odu in Focus:</strong> ${focusedOdu}
      ${tip("An Odu is a sacred chapter of Ifa — a body of wisdom, stories, and guidance revealed through divination.")}
    </p>
    <p>
      <strong data-translate>House:</strong> ${spiritualForce}
      ${tip("Every Odu belongs to a spiritual house. Ela Opitan (Aworomaja) oversees positive alignments; Ela Osode (Ajagunmale) oversees cautionary ones.")}
    </p>
    <p>${eboraText}</p>
    <p>${whatToDoText}</p>
    <hr/>
    <p>
      <strong data-translate>Line by Line Interpretation:</strong>
      ${tip("Each of the 4 lines corresponds to one of the 4 elements and their governing Orisha. An open mark (|) means that energy is active and flowing freely.")}
    </p>
    <ul>${markInterpretation.map(item => `<li><span data-translate>${item}</span></li>`).join("")}</ul>
    ${latentSection}
  `;
}

/* ─────────────────────────────────────────────────────────────
 *  DONATE BUTTON PULSE
 * ───────────────────────────────────────────────────────────── */
setTimeout(() => {
  document.querySelector(".donate-btn")?.classList.add("attention");
}, 60000);

/* ─────────────────────────────────────────────────────────────
 *  HISTORY
 * ───────────────────────────────────────────────────────────── */
let fullHistory     = [];
let historyPage     = 1;
let historyPageSize = 5;

function toggleHistory() {
  const container = document.getElementById("myHistoryContainer");
  const btn       = document.querySelector(".historyBtn");
  const arrow     = document.getElementById("historyArrow");
  const isHidden  = !container.classList.contains("show");

  if (isHidden) {
  container.style.display = "block";
  container.classList.add("show");
  btn.innerHTML = '<span data-translate>Hide History</span>';
  arrow.textContent = " ▲";
  btn.appendChild(arrow);
  if (typeof window.translateDynamicContent === "function") window.translateDynamicContent(btn);

  // ✅ FIX: don't overwrite restored history
  if (!fullHistory.length) {
    loadMyHistory();
  } else {
    renderHistoryPage();
  }

  setTimeout(() => window.scrollTo({ top: container.offsetTop - 20, behavior: "smooth" }), 50);
} else {
    container.classList.remove("show");
    setTimeout(() => {
      container.style.display = "none";
      btn.innerHTML = '<span data-translate>Show History</span>';
      arrow.textContent = " ▼";
      btn.appendChild(arrow);
      if (typeof window.translateDynamicContent === "function") window.translateDynamicContent(btn);
      window.scrollTo({ top: btn.offsetTop - 20, behavior: "smooth" });
    }, 300);
  }
}

async function loadMyHistory() {
  const historyListEl = document.getElementById("historyList");
  const paginationEl  = document.getElementById("historyPagination");
  historyListEl.innerHTML = "<p>Loading...</p>";

  try {
    const res     = await fetch("/api/history/" + deviceId);
    const history = await res.json();

    if (!history.length) {
      historyListEl.innerHTML = "<p data-translate>No history yet.</p>";
      paginationEl.style.display = "none";
      return;
    }

    fullHistory = normalizeHistory(history)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const totalPages = Math.ceil(fullHistory.length / historyPageSize);
    paginationEl.style.display = totalPages <= 1 ? "none" : "flex";
    renderHistoryPage();

  } catch (err) {
    console.error("Failed to load history:", err);
    historyListEl.innerHTML = "<p data-translate>Error loading history.</p>";
  }
}

function normalizeHistory(logs) {
  return logs.map(log => {
    const data = log.data || {};
    return {
      id:        data.id       || log.id,
      deviceId:  data.deviceId || log.deviceId,
      type:      log.type      || data.type  || "unknown",
      timestamp: log.timestamp || data.timestamp,
      note:      data.note     || log.note   || "",
      ...data,
      ...log
    };
  });
}

function renderHistoryPage() {
  const historyListEl = document.getElementById("historyList");
  const pageInfoEl    = document.getElementById("pageInfo");
  const paginationEl  = document.getElementById("historyPagination");
  const prevBtn       = document.getElementById("prevPageBtn");
  const nextBtn       = document.getElementById("nextPageBtn");

  const totalPages = Math.max(1, Math.ceil(fullHistory.length / historyPageSize));
  historyPage = Math.min(Math.max(historyPage, 1), totalPages);

  const start = (historyPage - 1) * historyPageSize;
  const end   = start + historyPageSize;

  const fmtTs = (ts) => new Date(ts).toLocaleString("en-US",{hour:"numeric",minute:"2-digit",hour12:true,year:"numeric",month:"short",day:"numeric"});

  const cardsHTML = fullHistory.slice(start, end).map((log, i) => {
    const base  = log.data ? { ...log.data } : { ...log };
    const entry = {
      ...base,
      id:        base.id        || log.data?.id   || log.id,
      deviceId:  base.deviceId  || log.deviceId,
      note:      base.note      || log.data?.note || log.note || "",
      type:      log.type       || base.type       || "unknown",
      timestamp: log.timestamp  || base.timestamp
    };

    const globalIndex = start + i + 1;
    const entryId = entry.id || entry._id || "";
    const note        = entry.note || "";

    const noteBlock = `
      <div class="history-note">
        <label class="note-label" data-translate>Your reflection</label>
        <textarea data-translate-attr="placeholder" placeholder="Write your personal reflection…"
          onblur="saveNote('${entryId}', this.value)">${note}</textarea>
        <small class="note-hint" data-translate>Saved automatically</small>
      </div>`;

    if (entry.type === "Birth Details" || entry.type === "birthDetails") {
      const energies = [
        entry.daily   != null ? `<span class="h-chip">Day ${entry.daily}</span>`     : "",
        entry.weekly  != null ? `<span class="h-chip">Week ${entry.weekly}</span>`   : "",
        entry.monthly != null ? `<span class="h-chip">Month ${entry.monthly}</span>` : "",
        entry.yearly  != null ? `<span class="h-chip">Year ${entry.yearly}</span>`   : ""
      ].join("");
      return `
        <div class="history-card numerology">
          <span class="history-badge numerology" data-translate>Numerology</span>
          <div class="h-title"><span class="h-index">${globalIndex}.</span>
            <span data-translate>${entry.fullName} — Life Path ${entry.lifepathNo} (${entry.lifepath})</span>
          </div>
          <div class="h-meta"><span data-translate>${entry.age} years • born ${new Date(entry.birthdate).toDateString()}</span></div>
          <div class="h-meta"><span data-translate>Accessed</span>&nbsp;${fmtTs(entry.timestamp)}</div>
          ${energies ? `<div class="h-meta" style="margin-top:5px;">${energies}</div>` : ""}
          ${noteBlock}
        </div>`;
    }

    return `
      <div class="history-card">
        <span class="history-badge" data-translate>Ifá Wisdom</span>
        <div class="h-title"><span class="h-index">${globalIndex}.</span>
          <span data-translate>${entry.mainCast}</span>
        </div>
        <div class="h-meta">
          <span class="h-chip" data-translate>${entry.orientation} ${entry.specificOrientation}</span>
          <span class="h-chip" data-translate>${entry.solution} ${entry.solutionDetails}</span>
        </div>
        <div class="h-meta"><span data-translate>Accessed</span>&nbsp;${fmtTs(entry.timestamp)}</div>
        ${noteBlock}
      </div>`;
  }).join("");

  historyListEl.innerHTML = fullHistory.length === 0
    ? `<div class="history-empty" data-translate>No saved readings yet. Your divinations and numerology readings will appear here.</div>`
    : cardsHTML;

  const showingStart = fullHistory.length === 0 ? 0 : start + 1;
  pageInfoEl.textContent =
    `Showing ${showingStart}-${Math.min(end, fullHistory.length)} of ${fullHistory.length}`;
  pageInfoEl.style.display = fullHistory.length ? "inline-block" : "none";

  renderPageNumbers(totalPages);
  paginationEl.style.display = totalPages <= 1 ? "none" : "flex";
  prevBtn.disabled = historyPage === 1;
  nextBtn.disabled = historyPage === totalPages;
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrapHistoryFromSync().then(found => {
    if (!found) loadMyHistory();
  });
  document.getElementById("nextPageBtn").addEventListener("click", () => {
    if (historyPage < Math.ceil(fullHistory.length / historyPageSize)) {
      historyPage++;
      renderHistoryPage();
    }
  });
  document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (historyPage > 1) { historyPage--; renderHistoryPage(); }
  });
});

function renderPageNumbers(totalPages) {
  const pageNumbersEl = document.getElementById("pageNumbers");
  pageNumbersEl.innerHTML = "";
  const windowSize = window.innerWidth < 600 ? 3 : 5;

  let start = Math.max(1, historyPage - Math.floor(windowSize / 2));
  let end   = Math.min(totalPages, start + windowSize - 1);
  if (end - start < windowSize - 1) start = Math.max(1, end - windowSize + 1);

  if (start > 1) {
    pageNumbersEl.appendChild(createPageBtn(1));
    if (start > 2) pageNumbersEl.appendChild(createEllipsis());
  }
  for (let i = start; i <= end; i++) pageNumbersEl.appendChild(createPageBtn(i));
  if (end < totalPages) {
    if (end < totalPages - 1) pageNumbersEl.appendChild(createEllipsis());
    pageNumbersEl.appendChild(createPageBtn(totalPages));
  }
}

function createPageBtn(page) {
  const btn = document.createElement("button");
  btn.textContent = page;
  btn.className   = "page-btn";
  if (page === historyPage) btn.classList.add("active");
  btn.onclick = () => { historyPage = page; renderHistoryPage(); };
  return btn;
}

function createEllipsis() {
  const span = document.createElement("span");
  span.textContent = "…";
  span.className   = "page-ellipsis";
  return span;
}

document.addEventListener("input", e => {
  if (e.target.matches(".history-note textarea")) {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  }
});

async function saveNote(entryId, note) {
  try {
    const res = await fetch(`/api/history/${entryId}/note`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ note })
    });
    if (res.ok) {
      const textarea = document.querySelector(`textarea[onblur="saveNote('${entryId}', this.value)"]`);
      if (textarea) { textarea.classList.add("saved"); setTimeout(() => textarea.classList.remove("saved"), 1500); }
    }
  } catch (err) {
    console.error("Error saving note:", err);
  }
}

/* ─────────────────────────────────────────────────────────────
 *  ADMIN — LOG IN / LOGOUT / ODU EDITOR
 * ───────────────────────────────────────────────────────────── */
async function loginAdmin() {
  const passwordInput = document.getElementById("adminPassword");
  const loginBtn      = document.getElementById("loginBtn");
  loginBtn.disabled   = true;
  showPreloader();
  try {
    const response = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: "admin", password: passwordInput.value })
    });
    if (!response.ok) throw new Error("INVALID_CREDENTIALS");
    const data = await response.json();
    isAdminAuthenticated = true;
    document.getElementById("adminPasswordContainer").style.display = "none";
    document.querySelectorAll(".admin-dashboard").forEach(el => { el.style.display = "none"; });
    if (data.role === "superadmin") {
      document.getElementById("dashboard-superadmin").style.display = "block";
    } else if (data.role === "printonly") {
      document.getElementById("dashboard-printonly").style.display = "block";
    }
  } catch (err) {
    console.error("Login error:", err);
    if (err.message === "INVALID_CREDENTIALS") {
      alert("❌ Incorrect password.");
    } else {
      alert("❌ Network error. Please check your connection and try again.");
    }
  } finally {
    hidePreloader();
    loginBtn.disabled = false;
  }
}

async function logoutAdmin() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.disabled = true;
  showPreloader();
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch (err) {
    console.warn("Server logout failed, proceeding locally:", err);
  } finally {
    isAdminAuthenticated = false;
    location.reload();
  }
}

function backToDashboard() {
  document.getElementById("odu-editor-panel").style.display = "none";
  document.getElementById("dashboard-superadmin").style.display = "block";
  showAnalytics();
}

function updateOdu() {
  document.querySelectorAll(".admin-dashboard").forEach(d => { d.style.display = "none"; });
  document.getElementById("logs").style.display      = "none";
  document.getElementById("analytics").style.display = "none";
  document.getElementById("odu-editor-panel").style.display = "block";
  document.getElementById("status").innerText = "";
  document.getElementById("editor").value    = "";
}

async function loadOdu() {
  const key = document.getElementById("oduKey").value.trim();
  if (!key) return alert("Please enter an Odù key");

  try {
    const res = await fetch(`/api/admin/odu/${key}`, { credentials: "include" });
    if (!res.ok) { document.getElementById("status").innerText = "Access denied or Odù not found"; return; }
    const data = await res.json();
    document.getElementById("editor").value     = JSON.stringify(data.data || data, null, 2);
    document.getElementById("status").innerText = `Odù "${key}" loaded.`;
  } catch (err) {
    console.error("Failed to load Odù:", err);
    document.getElementById("status").innerText = "Failed to load Odù";
  }
}

async function saveOdu() {
  const key           = document.getElementById("oduKey").value.trim();
  const editorContent = document.getElementById("editor").value;
  if (!key)           return alert("Please enter an Odù key");
  if (!editorContent) return alert("Editor is empty");

  let updates;
  try { updates = JSON.parse(editorContent); }
  catch { return alert("Invalid JSON in editor"); }

  showPreloader();
  try {
    const res = await fetch(`/api/admin/odu/${key}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updates),
      credentials: "include"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unknown error");
    document.getElementById("status").innerText = `Odù "${key}" saved successfully.`;
  } catch (err) {
    console.error("Failed to save Odù:", err);
    document.getElementById("status").innerText = "Failed to save Odù: " + err.message;
  } finally {
    hidePreloader();
  }
}

/* ─────────────────────────────────────────────────────────────
 *  PAYSTACK DONATION REDIRECT LOG
 * ───────────────────────────────────────────────────────────── */
(function logPaystackDonation() {
  const reference = new URLSearchParams(window.location.search).get("reference");
  if (!reference) return;

  logSilently("/api/payment/log", {
    reference, type: "donation", provider: "paystack",
    status: "success", amount: null, currency: "NGN", divination: null
  });

  window.history.replaceState({}, document.title, window.location.pathname);
})();