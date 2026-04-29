
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
let tapCount = 0;
let tapTimeout;

document.addEventListener("click", function (event) {
  const hiddenTapArea     = document.getElementById("hiddenTapArea");
  const passwordContainer = document.getElementById("adminPasswordContainer");
  const logsContainer     = document.getElementById("logsContainer");
  if (!hiddenTapArea || !hiddenTapArea.contains(event.target)) return;

  tapCount++;
  if (tapCount === 9) {
    if (passwordContainer) { passwordContainer.style.display = "block"; passwordContainer.style.zIndex = "1"; }
    if (logsContainer)     { logsContainer.style.display = "block"; }
    hiddenTapArea.style.pointerEvents = "none";
    hiddenTapArea.style.zIndex = "0";
    tapCount = 0;
  }
  clearTimeout(tapTimeout);
  tapTimeout = setTimeout(() => { tapCount = 0; }, 3000);
});

/* ─────────────────────────────────────────────────────────────
 *  MEDIA LINK GENERATOR
 * ───────────────────────────────────────────────────────────── */
const getInputValue = (id, fallback) =>
  fallback || document.getElementById(id)?.value || "";

const generateMediaLinks = (data, type, openFunc, emoji, label) => {
  if (!Array.isArray(data) || !data.length) return "";
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;align-items:start;">
      ${data.map((item, index) => {
        const safeUrl = item.url.replace(/'/g, "\\'");
        return `
          <p style="margin:0;padding:8px;background:#fafafa;border-radius:6px;box-shadow:0 0 3px rgba(0,0,0,0.1);">
            ${index + 1}.
            <a href="#" onclick="${openFunc}('${safeUrl}'); return false;" style="color:#0056b3;text-decoration:none;">
              ${emoji} ${label}
            </a>
            <span style="color:#555;">of ${item.author}</span>
          </p>`;
      }).join("")}
    </div>`;
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

    if (true) {
      const tip = (text) =>
        `<i class="ifa-tip" data-tip="${text.replace(/"/g, "&quot;")}"
          onclick="openIfaTip(this, event)" role="button" aria-label="More information">i</i>`;

      /* ── Accordion helper ── */
      let _accId = 0;
      function _acc(title, bodyHtml, expandedByDefault) {
        const id   = "acc-dv-" + (++_accId);
        const open = !!expandedByDefault;
        return `
          <div style="border:1px solid #d4edda;border-radius:10px;margin-bottom:10px;overflow:hidden;background:#fff;">
            <button
              onclick="var b=document.getElementById('${id}');var a=this.querySelector('.acc-arrow');var isOpen=b.style.display!=='none';b.style.display=isOpen?'none':'block';a.style.transform=isOpen?'rotate(0deg)':'rotate(180deg)';"
              style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(135deg,#f0f7f0,#e8f5e8);border:none;cursor:pointer;font-size:14px;font-weight:bold;color:#1b4332;text-align:left;gap:8px;transform:none !important;box-shadow:none !important;">
              <span>${title}</span>
              <span class="acc-arrow" style="transition:transform 0.25s;transform:${open ? "rotate(180deg)" : "rotate(0deg)"};font-size:12px;flex-shrink:0;">▼</span>
            </button>
            <div id="${id}" style="display:${open ? "block" : "none"};padding:14px 16px;line-height:1.7;">
              ${bodyHtml}
            </div>
          </div>`;
      }

      const parts = [];

      /* ── Always visible: guide banner + heading + main message ── */
      parts.push(`
        <div style="background:linear-gradient(135deg,#f0f7f0,#e8f5e8);border:1px solid #2e7d32;
          border-radius:10px;padding:14px 18px;margin-top:18px;font-size:14px;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:8px;text-align:center;animation:fadeInGuide 0.5s ease;
          max-width:420px;margin-left:auto;margin-right:auto;">
          <span style="font-weight:500;" data-translate>Are you new to Ifa divination?</span>
          <button id="guide-btn" onclick="handleGuideClick()" class="btn btn-md btn-default app-btn"
            style="display:flex;align-items:center;gap:6px;transform:none !important;">
            📖 <span data-translate>Read the guide</span>
          </button>
        </div>
        <h3 style="text-align:center;margin-top:20px;font-weight:bold;">
          ${mainCast}, ${orientationText} (${specificOrientation}), ${solution} ${solutionDetails}
        </h3>
        <p data-translate>${rawMessage} ${solutionInfo}</p>
      `);

      /* ── Words of Ifa / Ase Ifa — open by default ── */
      if (aseIfaHTML || coreMessage.length) {
        const coreMsgHTML = Array.isArray(coreMessage)
          ? coreMessage.map(m => `<p>${m}</p>`).join("")
          : `<p>${coreMessage}</p>`;

        const aseBody = `
          <span data-translate>${coreMsgHTML} ${aseIfaHTML}</span>
          ${(oduSummaryAse || characterHTML) ? `
            <div style="margin-top:10px;">
            <center>
              <button class="btn btn-sm btn-default" id="readMoreAse"
                style="color:#007bff;cursor:pointer;border:1px solid green;transform:none !important;">
                <span style="color: green" data-translate>Read more for ọmọ ${mainCast} ▼ </span> 
              </button>
            </center>
              <div id="extraAse" style="display:none;margin-top:10px;">
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

      /* ── Alias — collapsed ── */
      if (alias) {
        parts.push(_acc(
          `Alias (Inagije) ${tip("Alternative sacred names this Odu is known by among Babalawo.")}`,
          `<p>${alias}</p>`, false
        ));
      }

      /* ── Orisha — collapsed ── */
      if (orisha) {
        parts.push(_acc(
          `Orisha — Ni Bibo (To Appease) ${tip("The Orisha associated with this Odu who should be honoured or appeased.")}`,
          `<p>${orisha}</p>`, false
        ));
      }

      /* ── Plant — collapsed ── */
      if (herb) {
        parts.push(_acc(
          `Plant (Ewe) ${tip("Sacred plants associated with this Odu, used in spiritual baths and ritual preparation.")}`,
          `<p>${herb}</p>`, false
        ));
      }

      /* ── Names — collapsed ── */
      if (names) {
        parts.push(_acc(
          `Names (Oruko) ${tip("Names given to children born under this Odu.")}`,
          `<p>${names}</p>`, false
        ));
      }

      /* ── Occupation — collapsed ── */
      if (occupation) {
        parts.push(_acc(
          `Occupation (Ise) ${tip("Vocations naturally aligned with the energy of this Odu.")}`,
          `<p>${occupation}</p>`, false
        ));
      }

      /* ── Taboo — collapsed ── */
      if (taboo) {
        parts.push(_acc(
          `Taboo (Eewo) ${tip("Eewo are sacred prohibitions — things a person under this Odu must avoid.")}`,
          `<span data-translate>${taboo}</span>`, false
        ));
      }

      /* ── Spiritual Insight — collapsed ── */
      parts.push(_acc(
        `More Insight ${tip("This section decodes the Odu's pattern of marks line by line.")}`,
        spiritualInsight, false
      ));

      if (credit) {
        parts.push(`
          <section class="credits-section">
            <p style="font-weight:bold"><u><span data-translate>Credits & Acknowledgements</span></u></p>
            <p data-translate>Special appreciation is extended to all Babalawo, for their publicly
              shared teachings and insights, as well as to Dunad Solutions Limited and the Aminat
              Olanbiwoninu Kadri Foundation for their invaluable support.</p>
            <p style="font-style:italic;font-size:0.9em;color:red;text-align:center;" data-translate>
              This content is inspired by collective Ifá traditions, scholarly works, and community-preserved
              teachings, shared for educational purposes only.
            </p>
          </section>
        `);
      }

      resultElement.innerHTML = parts.join("");

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

  // printArea hidden while loading
  printArea.style.display = "none";

  showLoading(currentLang);

  await Promise.race([
    serverReady,
    new Promise(resolve => setTimeout(resolve, 20000))
  ]);

  try {
    await populateDropdowns();
  } catch (err) {
    console.warn("⚠ Dropdown population failed:", err);
  }

  // Hide the preloader and show the app
  loadingScreen.style.display = "none";
  preloader.style.display     = "none";

  generateCircularButtons();
  printArea.style.display = "block";
  

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
      <h3 style="text-align:center;margin-top:20px;font-weight:bold;">
        <span data-translate>Energy ${number} - ${label}</span>
      </h3>
      <hr/>
      <p>${data.meaning || "No meaning found."}</p>
      <p style="font-style:italic;font-size:0.9em;color:red;text-align:center;" data-translate>
        This content is inspired by collective scholarly works and community-preserved teachings,
        shared for educational purposes only.
      </p>`;

    configEl.innerHTML = `<img class="moving-bg" src="public/img/bird.gif" alt="bird" />`;

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
  const sectionRegex = /(?=(?:1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|\*\*[1-6][.:])\s)/g;
  const rawSections  = text.split(sectionRegex).filter(s => s.trim());

  if (rawSections.length < 2) {
    /* AI didn't use expected structure — fall back to plain render */
    return `<div style="border-left:4px solid #2e7d32;padding:12px;border-radius:6px;line-height:1.8;">
      ${formatResponseAsHTML(text)}
    </div>`;
  }

  let _id = 0;
  return rawSections.map((section, idx) => {
    /* Extract the heading from the first line */
    const lines   = section.trim().split("\n");
    const heading = lines[0]
      .replace(/^[1-6]️⃣\s*/, "")          // remove emoji number
      .replace(/^\*\*[1-6][.:]\s*/, "")     // remove **1.
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
        <div id="${id}" style="display:${open ? "block" : "none"};padding:12px 14px;line-height:1.8;font-size:14px;">
          <span data-translate>${formatResponseAsHTML(body)}</span>
        </div>
      </div>`;
  }).join("");
}


async function getEnergyInterpretation(payload) {

  const prompt = `
Interpret this life chart using African spiritual wisdom,
with Yoruba cosmology as the primary lens.

Speak like an elder who sees beyond appearances.
Your tone must feel grounded, wise, and observant — not instructional, not modern, not clinical.

IMPORTANT:
- Do NOT include any form of ebo, sacrifice, ritual, or offering.
- Avoid modern psychological language.
- Do not sound generic. Speak directly to the person as if you understand their path.
- Reveal both strength and imbalance.

PERSON
Name: ${payload.fullName}
Age: ${payload.age}
Birthdate: ${payload.birthdate}

CORE ÒRÌ NUMBERS
Birthday Gift: ${payload.birthdayGift}
Life Path: ${payload.lifepath}
Destiny / Expression: ${payload.destiny}
Soul Urge: ${payload.soulUrge}
Personality: ${payload.personality}
Reality / Life Purpose: ${payload.reality}

DESTINY PHASES (Pinnacles)
${payload.pinnaclePhases.map(p => `
Age ${p.ageRange}
Energy: ${p.pinnacleNumber} – ${p.pinnacleMeaning}
Challenge: ${p.challengeNumber || "None"} – ${p.challengeMeaning || ""}
`).join("")}

CURRENT DESTINY WIND
Active Pinnacle: ${payload.pinnacleNumber}
Active Challenge: ${payload.challengeNumber}

TIME CURRENTS
Year: ${payload.year}  Month: ${payload.month}  Week: ${payload.week}  Day: ${payload.day}

ASTROLOGICAL FOUNDATION
Zodiac Sign: ${payload.zodiac}  Element: ${payload.zodiacElement}
Orisha Ruler: ${payload.zodiacOrisha} (Western planet: ${payload.zodiacRuler})
Yoruba Birth Season: ${payload.zodiacYorubaMonth} (${payload.zodiacStart} – ${payload.zodiacEnd})
Orisha Domain: ${payload.orishaDomain}
Orisha Influence: ${payload.orishaEffect}
Ifa Wisdom for this Sign: ${payload.ifaWisdom}

COSMIC HOUR
Planetary Ruler: ${payload.planetaryHour}
Orisha Influence: ${payload.planetaryOrisha}
Energy: ${payload.planetaryEnergy}

STRUCTURE YOUR RESPONSE AS:

1️⃣ **Nature of the Person's Òrì**
- Describe their inner nature and outer expression.
- Reveal what comes naturally to them and what they often struggle to understand about themselves.
- Show both their strength and their hidden imbalance.

2️⃣ **Path of Life Phases**
- Explain how their life unfolds across phases.
- Highlight repeating patterns or lessons.
- Show how past phases may still be influencing the present.

3️⃣ **Present Season of Life**
- Speak clearly about what they are currently facing.
- Identify the tension between their opportunity and their challenge.
- Explain what may feel difficult and why.

4️⃣ **Movement of Time**
- Interpret the year, month, week, and day as flowing energies.
- Show how these layers interact (not separately).
- Indicate whether this is a time to act, wait, reflect, or realign.

5️⃣ **Cosmic Alignment**
- Explain how their zodiac, element, and Orisha influence their behavior and decisions.
- Reveal where they are aligned — and where they may be acting against their nature.

6️⃣ **Guidance of Òrì**
- Speak as an elder giving grounded life direction.
- Be specific: mention behaviors, attitudes, or habits to watch or cultivate.
- Do not be vague. Let the guidance feel practical, observable, and real.

Include one sentence that makes the person reflect on a real-life pattern they may have experienced.
FINAL INSTRUCTION:
Do not rush. Let the interpretation feel like it was carefully observed, not generated.
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
  const sectionRegex = /(?=(?:1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|\*\*[1-6][.:])\s)/g;
  const rawSections  = text.split(sectionRegex).filter(s => s.trim());

  if (rawSections.length < 2) {
    return `<div style="border-left:4px solid #2e7d32;padding:12px;border-radius:6px;line-height:1.8;">
      ${formatResponseAsHTML(text)}
    </div>`;
  }

  let _sid = 0;
  return rawSections.map((section, idx) => {
    const lines = section.trim().split("\n");

    /* Extract heading — strip emoji number and bold markers */
    const heading = lines[0]
      .replace(/^[1-6]️⃣\s*/, "")
      .replace(/^\*\*[1-6][.:]\s*/, "")
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
        <div id="${sid}" style="display:${open ? "block" : "none"};padding:12px 14px;line-height:1.8;font-size:14px;">
          <span data-translate>${formatResponseAsHTML(body || heading)}</span>
        </div>
      </div>`;
  }).filter(Boolean).join("");
}

    const parts = [];

    /* Voice of Ori — open by default, AI loads here */
    parts.push(_acc("🧿 The Voice of Òrì", `
      <div id="ori-voice-slot" style="border-left:4px solid #2e7d32;border-radius:6px;padding:12px;min-height:60px;display:flex;align-items:center;gap:10px;color:green;">
        <span class="spinner" style="width:18px;height:18px;flex-shrink:0;"></span>
        <em data-translate>Your reading is being prepared...</em>
      </div>
    `, true));

    /* Nature & Character — collapsed */
    parts.push(_acc("Nature & Character", `
      <p><strong data-translate>Birthday Gift – ${data.birthdayGift?.number}</strong> – <span data-translate>${data.birthdayGift?.label || ""}</span></p>
      <p><strong data-translate>Life Path – ${data.vibrations?.lifepath?.number}</strong> – <span data-translate>${data.vibrations?.lifepath?.label}</span></p>
      <p><strong data-translate>Purpose – ${data.vibrations?.reality?.number}</strong> – <span data-translate>${data.vibrations?.reality?.label}</span></p>
      <p><strong data-translate>Destiny – ${data.destiny?.number}</strong> – <span data-translate>${data.destiny?.label}</span></p>
      <p><strong data-translate>Soul Urge – ${data.soulUrge?.number}</strong> – <span data-translate>${data.soulUrge?.label}</span></p>
      <p><strong data-translate>Personality – ${data.quiescent?.number}</strong> – <span data-translate>${data.quiescent?.label}</span></p>
    `, false));

    /* Astrology — collapsed */
    if (astro) {
      parts.push(_acc(`Astrology Insight: ${astro.name} ${astro.symbol}`, `
        <p><strong data-translate>Yoruba Birth Season:</strong> <span data-translate>${astro.yorubaMonth || ""}</span></p>
        <p><strong data-translate>Element:</strong> <span data-translate>${astro.element}</span></p>
        <p><strong data-translate>Ruling Orisha:</strong> <span data-translate>${astro.orisha || astro.ruler}</span>${astro.orisha ? ` <em style="font-size:0.85em;opacity:0.6">(${astro.ruler})</em>` : ""}</p>
        <p><strong data-translate>Domain:</strong> <span data-translate>${astro.orishaInfluence?.domain || ""}</span></p>
        <p><strong data-translate>Traits:</strong> <span data-translate>${astro.traits}</span></p>
        <p><strong data-translate>Strengths:</strong> <span data-translate>${astro.strengths}</span></p>
        <p><strong data-translate>Weaknesses:</strong> <span data-translate>${astro.weaknesses}</span></p>
        <p><em data-translate>${astro.message}</em></p>
        ${astro.orishaInfluence?.ifaWisdom ? `<p style="border-left:3px solid #2e7d32;padding-left:10px;font-style:italic;"><span data-translate>${astro.orishaInfluence.ifaWisdom}</span></p>` : ""}
        ${astro.transits?.orishaEnergy ? `<p><strong data-translate>Orisha Energy:</strong> <span data-translate>${astro.transits.orishaEnergy}</span></p>` : ""}
      `, false));
    }

    /* Planetary Hour — collapsed */
    if (planetaryHourData) {
      parts.push(_acc("Planetary Hour", `
        <p><strong data-translate>Ruling Orisha of this Hour:</strong> <span data-translate>${planetaryHourData.orisha}</span> <em style="font-size:0.85em;opacity:0.6">(${planetaryHourData.planet})</em></p>
        <p><strong data-translate>Energy:</strong> <span data-translate>${planetaryHourData.energy}</span></p>
        <p><strong data-translate>Counsel:</strong> <span data-translate>${planetaryHourData.advice}</span></p>
      `, false));
    } else if (locationDenied) {
      parts.push(`<p style="color:orange"><em data-translate>Planetary hour unavailable (location access denied).</em></p>`);
    }

    parts.push(`
      <p style="font-style:italic;font-size:0.9em;color:red;text-align:center;margin-top:12px;" data-translate>
        This content is inspired by collective scholarly works and community-preserved teachings, shared for educational purposes only.
      </p>
    `);

    resultElement.innerHTML = parts.join("");

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
      slot.innerHTML = parseEnergyAccordion(aiInterpretation);
      window.scrollTo({ top: resultElement.offsetTop, behavior: "smooth" });
    }).catch(() => {
      const slot = document.getElementById("ori-voice-slot");
      if (slot) slot.innerHTML =
        `<em style="color:#888;" data-translate>The spiritual interpretation could not be generated at this moment. Please try again later.</em>`;
    });

  } catch (error) {
    console.error(error);
    hidePreloader();
    resultElement.innerHTML =
      `<center><span class="alert alert-info" data-translate>${error.message}</span></center>`;
  }
};

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
    `<i class="ifa-tip" data-tip="${text.replace(/"/g, "&quot;")}"
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
  btn.textContent = "Hide History";
  arrow.textContent = " ▲";
  btn.appendChild(arrow);

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
      btn.textContent = "Show History";
      arrow.textContent = " ▼";
      btn.appendChild(arrow);
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
        <textarea placeholder="Write your personal reflection…"
          onblur="saveNote('${entryId}', this.value)">${note}</textarea>
        <small class="note-hint" data-translate>Saved automatically</small>
      </div>`;

    if (entry.type === "Birth Details" || entry.type === "birthDetails") {
      return `
        <div class="history-card">
          <h6>
            <strong>${globalIndex}.</strong>
            <span data-translate>
              ${entry.fullName} (${entry.age} years old) born on
              ${new Date(entry.birthdate).toDateString()}
              with lifepath(${entry.lifepathNo}) - ${entry.lifepath}.
            </span><br/>
            <small data-translate>
              Accessed on ${new Date(entry.timestamp).toLocaleString("en-US",{
                hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true,
                year:"numeric",month:"short",day:"numeric"
              })}
              • Energies (Day/Week/Month/Year) as
              ${entry.daily}/${entry.weekly}/${entry.monthly}/${entry.yearly}
            </small>
          </h6>
          ${noteBlock}
        </div>`;
    }

    return `
      <div class="history-card">
        <h6>
          <strong>${globalIndex}.</strong>
          ${entry.mainCast} (${entry.orientation} ${entry.specificOrientation})
          (${entry.solution} ${entry.solutionDetails})<br/>
          <small>Accessed on ${new Date(entry.timestamp).toLocaleString("en-US",{
            hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true,
            year:"numeric",month:"short",day:"numeric"
          })}</small>
        </h6>
        ${noteBlock}
      </div>`;
  }).join("");

  historyListEl.innerHTML = cardsHTML;

  const showingStart = fullHistory.length === 0 ? 0 : start + 1;
  pageInfoEl.textContent =
    `Showing ${showingStart}-${Math.min(end, fullHistory.length)} of ${fullHistory.length}`;

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
