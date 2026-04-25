let speech = null;
let isPlaying = false;
let isPaused = false;
function togglePlayPause() {
    const playPauseBtn = document.getElementById("playPauseBtn");
    if (isPlaying && !isPaused) {
        // Pause the speech
        window.speechSynthesis.pause();
        isPaused = true;
        playPauseBtn.innerHTML = "▶️ Resume";
    } else if (isPaused) {
        // Resume the speech
        window.speechSynthesis.resume();
        isPaused = false;
        playPauseBtn.innerHTML = "⏸ Pause";
    } else {
        // Restart the speech from the beginning
        playResult();
        playPauseBtn.innerHTML = "⏸ Pause";
    }
    isPlaying = true;
}
function playResult() {
    const text = document.getElementById("divinationResult").textContent.trim();
    if (!text) return;
    // Cancel ongoing speech
    window.speechSynthesis.cancel();
    // Ensure voices are loaded (especially on iOS)
    function speakWithVoices() {
        const voices = window.speechSynthesis.getVoices();
        // Still no voices? Retry shortly.
        if (!voices.length) {
            setTimeout(speakWithVoices, 100);
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.voice = voices.find(v => v.lang === "en-US") || voices[0];
        utterance.onend = () => {
            isPlaying = false;
            isPaused = false;
            document.getElementById("playPauseBtn").innerHTML = "🔊 Play Voice";
        };
        window.speechSynthesis.speak(utterance);
        isPlaying = true;
        isPaused = false;
    }
    speakWithVoices();
}
function resetSpeechState() {
    // Cancel ongoing speech when navigating elsewhere
    window.speechSynthesis.cancel();
    isPlaying = false;
    isPaused = false;
    const playPauseBtn = document.getElementById("playPauseBtn");
    if (playPauseBtn) {
        playPauseBtn.innerHTML = "🔊 Play Voice"; // Reset button text
    }
}
function showControls() {
    let controls = document.getElementById("voiceControls");
    // If controls already exist, do nothing
    if (controls) return;
    // Create controls dynamically
    controls = document.createElement("div");
    controls.id = "voiceControls";
    controls.style.textAlign = "center";
    controls.style.marginTop = "20px";
    controls.innerHTML = `
        <button class="app-btn no-print" id="playPauseBtn" onclick="togglePlayPause()" style="padding: 10px; font-size: 16px; float: left;">🔊 Play Voice</button>
    `;
    document.getElementById("divinationResult").appendChild(controls);
}
function removeControl() {
    const controls = document.getElementById("voiceControls");
    if (controls) {
        controls.remove(); // Remove the entire div, not just hide it
    }
}
// Function to stop any ongoing speech before starting a new one
function stopSpeech() {
    if (speechSynthesis.speaking || speechSynthesis.paused) {
        speechSynthesis.cancel();
        isPaused = false;
        if (document.getElementById("pauseBtn")) {
            document.getElementById("pauseBtn").innerText = "Pause";
        }
    }
}
// Create the overlay once on page load
(function () {
  if (document.getElementById("ifa-tip-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "ifa-tip-overlay";
  overlay.innerHTML = `
    <div id="ifa-tip-box">
      <button class="ifa-tip-close" onclick="closeIfaTip()">✕</button>
      <span id="ifa-tip-content"></span>
    </div>
  `;
  document.body.appendChild(overlay);

  // Close on backdrop tap (mobile)
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeIfaTip();
  });
})();

function openIfaTip(el, event) {
  event.stopPropagation();

  const text = el.getAttribute("data-tip");
  const content = document.getElementById("ifa-tip-content");
  const box = document.getElementById("ifa-tip-box");
  const overlay = document.getElementById("ifa-tip-overlay");

  content.textContent = text;
  overlay.classList.add("visible");

  // On desktop: position near the icon
  if (window.innerWidth >= 640) {
    const rect = el.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;

    // Prevent overflow off right edge
    if (left + 260 > window.innerWidth - 16) {
      left = window.innerWidth - 276;
    }

    // Flip above if too close to bottom
    if (top + 200 > window.innerHeight) {
      top = rect.top - 210;
    }

    box.style.top = top + "px";
    box.style.left = left + "px";
    box.style.bottom = "auto";
  } else {
    // Mobile: reset to bottom sheet positioning
    box.style.top = "";
    box.style.left = "";
    box.style.bottom = "";
  }
}

function closeIfaTip() {
  document.getElementById("ifa-tip-overlay")?.classList.remove("visible");
}

// Close on Escape
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeIfaTip();
});

// Close when tapping anywhere else on the page
document.addEventListener("click", function (e) {
  if (!e.target.closest(".ifa-tip")) closeIfaTip();
});

function handleGuideClick() {
  openIfaGuideModal();
  localStorage.setItem("ifa_guide_opened", "true");
}

function openIfaGuideModal() {
  const modal = document.getElementById("ifaGuideModal");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden"; // prevent page scroll behind modal
}

function closeIfaGuideModal() {
  const modal = document.getElementById("ifaGuideModal");
  modal.style.display = "none";
  document.body.style.overflow = "";
}

// Close when clicking the dark backdrop
function closeIfaGuide(event) {
  if (event.target === document.getElementById("ifaGuideModal")) {
    closeIfaGuideModal();
  }
}

// Close on Escape key
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeIfaGuideModal();
});

const smoothScrollTo = (targetPosition, duration) => {
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    let startTime = null;
    const animation = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        window.scrollTo(0, startPosition + distance * easeInOutQuad(progress));
        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        }
    };
    const easeInOutQuad = (t) => {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    };
    requestAnimationFrame(animation);
};
// Encrypt data using AES
function encryptData(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
}
// Decrypt data
function decryptData(encryptedData) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (e) {
        return null;
    }
}
let SECRET_KEY = "";
let storedHashedPasswords = [];
const fetchSecureConfig = async () => {
  await serverReady;
  try {
    const response = await fetch("/api/secure-config", {
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    SECRET_KEY            = data.secretKey;
    storedHashedPasswords = data.storedHashedPasswords;
  } catch (error) {
    console.error("Failed to load secure config:", error);
  }
};

fetchSecureConfig();
// Function to hash the password using SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let currentPage = 1;
const rowsPerPage = 10;
let allLogs = [];
let currentLogType = null;

async function showLogs(logType) {
  try {
    // ✅ Use showPreloader() helper — does NOT destroy #loading-screen / #flag
    showPreloader();

    document.querySelectorAll(".app-section").forEach(sec => sec.style.display = "none");

    const resultElement = document.getElementById("divinationResultContainer");
    if (resultElement) resultElement.innerHTML = "";

    // ✅ urlMap replaces if-chain
    const urlMap = {
      divination:   "/api/divination/logs",
      chat:         "/api/chat/logs",
      feedback:     "/api/feedback/logs",
      payment:      "/api/payment/logs",
      contribution: "/api/contribution/logs"
    };

    const res = await fetch(urlMap[logType], {
      method: "GET", credentials: "include"
    });

    if (!res.ok) throw new Error("Failed to fetch logs");
    const data = await res.json();

    allLogs = Array.isArray(data) ? data : data.logs || [];
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    currentPage    = 1;
    currentLogType = logType;
    hidePreloader();
    renderTable();
  } catch (err) {
    console.error("Error fetching logs:", err);
    hidePreloader();
  }
}

function renderTable() {
  document.querySelectorAll(".app-section").forEach(sec => sec.style.display = "none");
  document.getElementById("logs").style.display = "block";

  const logType = currentLogType;
  const logContainer = document.getElementById("logs");
  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const logs = allLogs.slice(start, end);
  const summary = calculatePaymentSummary(allLogs);

  let tableHTML = `
    <div class="container-fluid py-3" style="color:green;">
     <!-- 🔢 SUMMARY TOTALS
      <div class="row g-2 mb-3">
        <div class="col-md-4">
          <div class="border rounded p-3 bg-light h-100">
            <div class="small text-muted">Total Donations</div>
            <div class="small text-muted">${summary.donationCount} donation(s)</div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="border rounded p-3 bg-light h-100">
            <div class="small text-muted">Total Odù Payments</div>
            <div class="fw-bold text-success fs-4">
              ₦${summary.totalPayments.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
     -->

      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap">
        <h3 class="fw-bold text-success mb-2">📜 ${logType.charAt(0).toUpperCase() + logType.slice(1)} Logs</h3>
        <button class="btn btn-outline-success btn-sm mb-2" onclick="logoutAdmin()">⬅ Back</button>
      </div>

      <div class="table-responsive">
        <table class="table table-bordered table-striped align-middle text-start">
          <thead class="table-success">
            <tr>
              <th scope="col">#</th>
              
              <th scope="col">Details</th>
              <th scope="col">Timestamp</th>
            </tr>
          </thead>
          <tbody>
  `;

  logs.forEach((log, index) => {
    const serialNumber = start + index + 1;
    const time = log.timestamp ? new Date(log.timestamp).toLocaleString() : "";

    const entry = log.data || log;
    let type = "Unknown";
    let details = "";

    // 🟢 IFÁ DIVINATION
    if (entry.type === "divination" || entry.oduName) {
      type = "Ifa Divination";
      details = `
        <div>
          <strong>${entry.oduName || ""}</strong><br>
          Orientation: ${entry.orientationText || ""} - ${entry.specificOrientation || ""}<br>
          Solution: ${entry.solution || ""} (${entry.solutionDetails || ""})
        </div>`;
    }

    // 🟢 BIRTH DETAILS
    else if (entry.type === "birthDetails" || entry.fullName) {
      type = "Birth Details";
      const loc = entry.location || {};
      const mapsLink = (loc.lat && loc.lon)
        ? `<a href="https://www.google.com/maps?q=${loc.lat},${loc.lon}" target="_blank" class="text-decoration-none text-success">📍 View on Map</a>`
        : "";
      details = `
        <div>
          <strong>${entry.fullName || ""}</strong><br>
          Birthdate: ${entry.birthdate || ""}<br>
          Age: ${entry.age || ""}<br>
          Lifepath: ${entry.lifepath || ""}<br>
          <span class="text-danger">Location: ${loc.city || ""} ${loc.country || ""} (${loc.lat || ""}, ${loc.lon || ""})</span><br>
          ${mapsLink}
        </div>`;
    }

    // 🟢 NUMEROLOGY
    else if (entry.type === "numerology" || entry.numerology) {
      type = "Numerology";
      details = `
        <div>
          Number: ${entry.numerology || ""}<br>
          Meaning: ${entry.label || ""}
        </div>`;
    }

    // 🟢 CHAT
    else if (entry.userMessage) {
      type = "Chat";
      details = `
        <div>
          <strong>Question:</strong> ${entry.userMessage}<br>
          <strong>Response:</strong> ${entry.botResponse || ""}
        </div>`;
    }

    // 🟢 FEEDBACK
    else if (entry.feedback) {
      type = "User Feedback";
      const context = entry.contextType || "N/A";
      const contextData = JSON.stringify(entry.contextData || {}, null, 2)
        .replace(/[{}"]/g, "")
        .replace(/,/g, "<br>");
      details = `
        <div>
          <strong>Feedback:</strong> ${entry.feedback.toUpperCase()}<br>
          <strong>Context:</strong> ${context}<br>
          <div class="small text-muted border p-2 rounded mt-1">${contextData}</div>
        </div>`;
    }

    // 🟢 PAYMENT + DONATION HANDLER (UPDATED)
    else if (entry.type === "donation") {

      type = "Donation (Paystack)";
      const statusColor = entry.status === "success" ? "success" : "danger";

      details = `
        <div class="border p-2 rounded bg-light">
          <div><strong>Reference:</strong> ${entry.reference || "N/A"}</div>
          <div>Provider: ${entry.provider || "paystack"}</div>
          <div>Status: <span class="text-${statusColor}">${entry.status || "success"}</span></div>
          ${entry.amount !== null && entry.amount !== undefined 
            ? `<div class="fw-bold mt-1 text-success">Amount: ₦${Number(entry.amount).toLocaleString()}</div>`
            : `<div class="text-muted small">Amount not verified</div>`
          }
        </div>`;
    }

    else if (entry.type === "payment") {

      type = "Odù Payment";
      const d = entry.divination || {};
      const statusColor = entry.status === "success" ? "success" : "danger";

      details = `
        <div class="border p-2 rounded bg-light">
          <div><strong>Divination:</strong> ${d.mainCast || "N/A"}</div>
          <div>Orientation: ${d.orientation || "N/A"} - ${d.specificOrientation || "N/A"}</div>
          <div>Solution: ${d.solution || "N/A"} (${d.solutionDetails || ""})</div>
          <div class="fw-bold mt-1 text-success">
            Amount: ₦${entry.amount ? Number(entry.amount).toLocaleString() : "N/A"}
          </div>
          <div>Status: <span class="text-${statusColor}">${entry.status}</span></div>
          ${entry.reference ? `<div class="small text-muted mt-1">Ref: ${entry.reference}</div>` : ""}
        </div>`;
    }

    // 🟢 CONTRIBUTIONS
    else if (entry.category) {
      type = "Contributions";
      details = `
        <div>
          <strong>Category: ${entry.category}</strong><br>
          Author: ${entry.name || ""}<br>
          ${entry.title || ""}<br>
          Text: ${entry.text || ""}<br>
          ${entry.media || ""}
        </div>`;
    }

    tableHTML += `
      <tr>
        <td>${serialNumber}</td>
      
        <td>${details}</td>
        <td>${time}</td>
      </tr>`;
  });

  tableHTML += `
          </tbody>
        </table>
      </div>

      <div id="pagination" class="d-flex justify-content-center mt-3 flex-wrap"></div>
    </div>
  `;

  logContainer.innerHTML = tableHTML;
  renderPagination();
}

function calculatePaymentSummary(logs) {
  let totalDonations = 0;
  let donationCount = 0;
  let totalPayments = 0;

  logs.forEach(log => {
    const entry = log.data || log;

    // Donations (Paystack)
    if (entry.type === "donation" && entry.status === "success") {
      donationCount++;
      if (typeof entry.amount === "number") {
        totalDonations += entry.amount;
      }
    }

    // Odù payments
    if (entry.type === "payment" && entry.status === "success") {
      if (typeof entry.amount === "number") {
        totalPayments += entry.amount;
      }
    }
  });

  return {
    totalDonations,
    donationCount,
    totalPayments
  };
}

// 🟢 Pagination
function renderPagination() {

  const pagination = document.getElementById("pagination");
  const totalPages = Math.ceil(allLogs.length / rowsPerPage);

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const windowSize = window.innerWidth < 600 ? 3 : 5;

  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);

  if (end - start < windowSize - 1) {
    start = Math.max(1, end - windowSize + 1);
  }

  let buttons = `
    <nav aria-label="Log navigation">
      <ul class="pagination pagination-sm justify-content-center">
  `;

  // Prev button
  buttons += `
    <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
      <button class="page-link text-success" onclick="goToPage(${currentPage - 1})">
        ⬅ Prev
      </button>
    </li>
  `;

  // First page
  if (start > 1) {
    buttons += `
      <li class="page-item">
        <button class="page-link" onclick="goToPage(1)">1</button>
      </li>
    `;

    if (start > 2) {
      buttons += `
        <li class="page-item disabled">
          <span class="page-link">…</span>
        </li>
      `;
    }
  }

  // Page window
  for (let i = start; i <= end; i++) {
    buttons += `
      <li class="page-item ${i === currentPage ? "active" : ""}">
        <button class="page-link" onclick="goToPage(${i})">${i}</button>
      </li>
    `;
  }

  // Last page
  if (end < totalPages) {

    if (end < totalPages - 1) {
      buttons += `
        <li class="page-item disabled">
          <span class="page-link">…</span>
        </li>
      `;
    }

    buttons += `
      <li class="page-item">
        <button class="page-link" onclick="goToPage(${totalPages})">${totalPages}</button>
      </li>
    `;
  }

  // Next button
  buttons += `
    <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
      <button class="page-link text-success" onclick="goToPage(${currentPage + 1})">
        Next ➡
      </button>
    </li>
  `;

  buttons += `
      </ul>
    </nav>
  `;

  pagination.innerHTML = buttons;
}

function goToPage(page) {
  currentPage = page;
  renderTable();
}

function printDivinationResult() {
    const printHeader = document.getElementById("configurationResult").innerHTML;
    const printContent = document.getElementById("divinationResult").innerHTML;
    // Create an iframe
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
        <html>
        <head>
            <title>Orírùn – Ifa Divination, Numerology, Astrology & African Spirituality</title>
            <style>
            body{
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            color: green;
            background-color: white;
            background-image: url('../img/background.jpg');
            background-position: center;
              background-repeat: no-repeat;
              background-size: cover;
            font-family: Courier, monospace;
            font-weight: bold;
         }
          /* Watermark styling */
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 80px;
            color: rgba(0, 128, 0, 0.15);
            white-space: nowrap;
            pointer-events: none;
            z-index: 9999;
            font-weight: bold;
        }
        .odu-container {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
        /*    width: fit-content;*/
            width: 12%;
            margin: auto;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }
        .odu-header {
            position: absolute;
            top: -25px; /* Adjust this value to move it up/down */
            z-index: 2;
            width: 80px;
        }
        .odu-footer {
            position: absolute;
            bottom: -25px; /* Adjust this value to move it up/down */
            z-index: 2;
            width: 80px;
        }
        .odu-line-container {
            display: flex;
            justify-content: center;
            gap: 22px;
            position: relative;
            z-index: 1;
        }
        .odu-line {
            width: 30px;
            height: 50px;
        }
        @media print {
            body { visibility: visible; }
            .no-print, .no-print *
            {
                display: none !important;
            }
        }
            </style>
        </head>
        <body>
         <!-- Watermark text -->
            <div class="watermark">Orírùn</div>
        <center><a href="/" style="color: green; text-decoration: none;"><img src="public/img/logo.png" style="height:75px" alt="Orírùn Logo"/></a></center>
        <center> <p style="
                  background: linear-gradient(135deg, #f0f7f0, #e8f5e8);
                  padding: 12px 24px;
                  text-align: center;
                  color: #1b4332;
                  font-size: 13px;
                  line-height: 1.7;
                  letter-spacing: 0.3px;
                "><span data-translate="header">I pay homage to OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Òlógboòjè, Ègàn, Gbogbo Ẹlẹ́yẹ, Gbogbo Irunmole, Ooni of Ife, Gbogbo Ọba Aláde, Àràbà Agbaye. I pay homage to all Elders.</span></p></center>
            
           <center> ${printHeader} </center> <br/>
            <p>${printContent}</p>
            <hr/>
            <center> Ire o. <br/> <i>🌐</i> Website: <a style='text-decoration:none; color: green;' href='https://orirun.com'>https://orirun.com</a></center>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500); // Give time to render
}

async function downloadDivinationPDF() {
    const { jsPDF } = window.jspdf;
    const divinationResult = document.getElementById("divinationResult").innerHTML;

    /* ------------------------------
       CREATE TRANSPARENT WATERMARK
    --------------------------------*/
    function createWatermarkCanvas() {
        const c = document.createElement("canvas");
        c.width = 800;
        c.height = 800;
        const ctx = c.getContext("2d");

        ctx.font = "bold 150px Courier";
        ctx.fillStyle = "rgba(0,128,0,0.10)"; // transparent green
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate(-45 * Math.PI / 180);
        ctx.textAlign = "center";
        ctx.fillText("Orírùn", 0, 0);

        return c.toDataURL("image/png");
    }

    const watermarkImg = createWatermarkCanvas();



    /* ------------------------------
       BUILD HTML CONTAINER FOR CANVAS
    --------------------------------*/
    const container = document.createElement("div");
    Object.assign(container.style, {
        backgroundColor: "#ffffff",
        color: "green",
        fontFamily: "Courier, monospace",
        fontWeight: "bold",
        padding: "40px",       // big padding for spacing
        position: "relative",
        width: "800px",
        boxSizing: "border-box"
    });

    // Logo
    const logo = document.createElement("img");
    logo.src = "https://orirun.com/public/img/logo.png";
    logo.style.height = "75px";
    logo.style.display = "block";
    logo.style.margin = "0 auto 20px auto";
    container.appendChild(logo);

    // Header
    const header = document.createElement("div");
    header.innerHTML = `
        <p style="
                  background: linear-gradient(135deg, #f0f7f0, #e8f5e8);
                  padding: 12px 24px;
                  text-align: center;
                  color: #1b4332;
                  font-size: 13px;
                  line-height: 1.7;
                  letter-spacing: 0.3px;
                "><span data-translate="header">I pay homage to OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Òlógboòjè, Ègàn, Gbogbo Ẹlẹ́yẹ, Gbogbo Irunmole, Ooni of Ife, Gbogbo Ọba Aláde, Àràbà Agbaye. I pay homage to all Elders.</span></p>
    `;
    header.style.textAlign = "center";
    header.style.marginBottom = "20px";
    container.appendChild(header);

    // Main Content
    const resultDiv = document.createElement("div");
    resultDiv.innerHTML = divinationResult;
    resultDiv.style.margin = "20px 0";
    container.appendChild(resultDiv);

    // Footer
    const footer = document.createElement("center");
    footer.innerHTML = `
        <p style="margin-top:20px;">
            Ire o. <br/>
            🌐 <a href="https://orirun.com" style="color:green; text-decoration:none;">
                https://orirun.com
            </a>
        </p>
    `;
    container.appendChild(footer);

    // Add temporary for rendering
    document.body.appendChild(container);

    /* ------------------------------
       RENDER TO CANVAS
    --------------------------------*/
    const canvas = await html2canvas(container, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/png");

    document.body.removeChild(container);

    /* ------------------------------
       BUILD PDF WITH WATERMARK ON ALL PAGES
    --------------------------------*/
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = 210;
    const pdfHeight = 297;

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    let page = 1;

    function drawWatermark(pdfInstance) {
        pdfInstance.addImage(
            watermarkImg,
            "PNG",
            10,          // x
            30,          // y
            pdfWidth - 20,
            pdfHeight - 60
        );
    }

    /* ------- FIRST PAGE ------- */
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    drawWatermark(pdf);

    pdf.setFontSize(10);
    pdf.text(`Page ${page}`, pdfWidth - 25, pdfHeight - 10);

    heightLeft -= pdfHeight;

    /* ------- NEXT PAGES ------- */
    while (heightLeft > 0) {
        pdf.addPage();
        page++;

        position = heightLeft - imgHeight;

        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        drawWatermark(pdf);

        pdf.setFontSize(10);
        pdf.text(`Page ${page}`, pdfWidth - 25, pdfHeight - 10);

        heightLeft -= pdfHeight;
    }

    /* ------------------------------
       SAVE PDF
    --------------------------------*/
    pdf.save("Orirun_Divination_Result.pdf");
}



function showAboutModal() {
    const modal = document.getElementById("aboutModal");
    const closeBtn = modal.querySelector(".aboutClose");
    const aboutContent = document.getElementById("aboutContent");
    // Show modal and insert HTML from variable
    modal.style.display = "block";
    aboutContent.innerHTML = aboutHtml;
    // Close modal on click
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };
  }

function showTermsModal() {
    const modal = document.getElementById("termsModal");
    const closeBtn = modal.querySelector(".termsClose");
    const termsContent = document.getElementById("termsContent");
    // Show modal and insert HTML from variable
    modal.style.display = "block";
    termsContent.innerHTML = termsHtml;
    // Close modal on click
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };
  }

const aboutHtml = `
<h3 class="title"><b><span>ABOUT US</span></b></h3>
<p>Orírùn Cultural Foundation is a not-for-profit, non-political organisation dedicated to the preservation, promotion, and advancement of African ancestral wisdom, spirituality, and cultural heritage. Through innovative programs and technology, we connect communities with the richness of Africa's traditions while creating modern pathways for education, empowerment, and sustainable development.</p>

<h3>Mission</h3>
<p>To preserve and promote African ancestral wisdom, spirituality, and cultural heritage by integrating traditional knowledge with modern innovation for the empowerment, education, and advancement of communities across Africa and beyond.</p>

<h3>Vision</h3>
<p>To safeguard Africa's ancestral legacy, inspire cultural pride, and create pathways for future generations to thrive through heritage, knowledge, and innovation.</p>

<h3>Core Values</h3>
<p>
<strong>Heritage</strong> – Safeguarding Africa's ancestral knowledge and traditions.<br><br>
<strong>Wisdom</strong> – Promoting cultural and spiritual insights for human development.<br><br>
<strong>Innovation</strong> – Integrating tradition with modern tools and technology.<br><br>
<strong>Community</strong> – Empowering people through education and collective growth.<br><br>
<strong>Integrity</strong> – Operating with transparency, accountability, and respect.
</p>

<h3>Objectives</h3>
<p>
Establish cultural centres, libraries, and archives while promoting peaceful coexistence, intercultural dialogue, and lawful charitable activities.<br><br>
Safeguard and disseminate African indigenous knowledge, cultural heritage, spirituality, and ancestral wisdom.<br><br>
Organise workshops, seminars, and conferences on African heritage, values, and spirituality.<br><br>
Integrate ancestral knowledge with modern innovation for social, cultural, and economic development.<br><br>
Work with cultural institutions, traditional leaders, academia, and international organisations to advance African heritage.<br><br>
Support and encourage youth interested in African culture, spirituality, and innovation.
</p>

<h3>Programs & Initiatives</h3>
<p>
<strong>Orírùn Application</strong> – A digital tool for cultural preservation, Ifá divination, and ancestral wisdom, making heritage accessible to communities across Africa and the diaspora.<br><br>
<strong>Heritage Education & Research</strong> – Workshops, seminars, and publications that document and promote African traditions, values, and spirituality.<br><br>
<strong>Youth Empowerment</strong> – Supporting young people in reconnecting with their cultural roots, fostering innovation, and sustaining African indigenous knowledge for future generations.<br><br>
<strong>Cultural Exchange Platforms</strong> – Collaborations across Africa and the diaspora to strengthen cultural identity, unity, and intercultural dialogue.
</p>

<h3>Contact Information</h3>
<div class="contact-info">
  <p><i>📍</i> Head Office: B26, Angel Martin Estate, Lugbe, Abuja, FCT, Nigeria</p>
  <p><i>📧</i> Email: info@orirun.com</p>
  <p><i>📞</i> Phone: +2348027573121</p>
  <p><i>🌐</i> Website: <a href="https://orirun.com" style="color:green;">https://orirun.com</a></p>
</div>
`;

const termsHtml = `
<h3 class="title"><b><span>TERMS OF SERVICE</span></b></h3>
<p>These Terms of Service ("Terms") govern your use of the Orírùn website ("Website") and the services provided. By accessing or using our Website and Services, you agree to be bound by these Terms. If you do not agree to these Terms, please refrain from using our Website and Services.</p>

<p><strong>1. Use of Services:</strong></p>
<p>You must be at least 18 years old to use our Services independently. Minors may engage with our youth-focused programs and resources under the supervision of a parent or legal guardian. By using our Services, you confirm that you meet the applicable age requirement or have the necessary parental consent.</p>
<p>You agree to use our Services only for lawful purposes and in accordance with these Terms and any applicable laws and regulations of the Federal Republic of Nigeria.</p>

<p><strong>2. Non-Professional Advice Disclaimer:</strong></p>
<p>Orírùn Cultural Foundation is not a licensed professional body. Any advice or guidance provided through our Website or Services is intended solely for personal development, spiritual guidance, educational, and self-exploration purposes, and should not be interpreted as professional advice of any kind.</p>
<p>You are solely responsible for any decisions you make based on the information provided. We shall not be liable for any damages or injuries arising from your use of our Services, and you agree to waive any related claims against Orírùn Cultural Foundation.</p>

<p><strong>3. Intellectual Property:</strong></p>
<p>Some content on this Website is sourced from third parties, with appropriate credit given where applicable. Unless otherwise stated, all original content produced by Orírùn Cultural Foundation is the intellectual property of the Foundation. You must not modify, reproduce, redistribute, commercially exploit, or create derivative works from any content on the Website without the express written consent of Orírùn Cultural Foundation and, where applicable, the credited resource owners.</p>

<p><strong>4. User Content:</strong></p>
<p>By submitting any content or resources to our Website or through our Services, you grant Orírùn Cultural Foundation a non-exclusive, royalty-free, perpetual, irrevocable, and fully sublicensable right to use, reproduce, modify, adapt, publish, translate, distribute, and display such content worldwide in any media.</p>

<p><strong>5. Payment and Billing:</strong></p>
<p>Where applicable, you agree to pay all fees and charges associated with your use of our Services as outlined on our Website or in any separate agreements. Orírùn Cultural Foundation also gratefully accepts donations and grants in support of its mission. Payments are generally non-refundable; however, refund requests may be considered on a case-by-case basis at the discretion of the Foundation. Please contact us at info@orirun.com for any payment-related enquiries.</p>

<p><strong>6. Termination:</strong></p>
<p>We reserve the right to suspend or terminate your access to our Services at any time and for any reason without notice or liability. Upon termination, you must cease all use of our Services, and any provisions of these Terms that by their nature should survive termination will continue to apply.</p>

<p><strong>7. Limitation of Liability:</strong></p>
<p>We shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising from your use of our Website or Services.</p>

<p><strong>8. Governing Law:</strong></p>
<p>These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to its conflict of law principles.</p>

<p><strong>9. Changes to Terms:</strong></p>
<p>We reserve the right to update or modify these Terms at any time without prior notice. Any changes will be effective immediately upon posting on this page. Continued use of our Website or Services after such changes constitutes your acceptance of the revised Terms.</p>

<h3 class="title"><b><span>PRIVACY POLICY</span></b></h3>
<p>This Privacy Policy describes how Orírùn Cultural Foundation collects, uses, and protects the personal information you provide on our website.</p>

<p><strong>1. Information Collection:</strong></p>
<p>We may collect personal information such as your name, date of birth, email address, phone number, and payment details when you make a donation, subscribe to, or use our Services. We may also collect non-personal information such as IP addresses, browser types, operating systems, and referring websites for statistical purposes and to improve our website's functionality.</p>

<p><strong>2. Information Usage:</strong></p>
<p>We use the personal information you provide for service delivery and payment processing. Your information may also be used to personalise your experience on our website and to send you newsletters and updates about our programs and initiatives. We may use non-personal information for analytical purposes to better understand our website's performance and user demographics.</p>

<p><strong>3. Information Protection:</strong></p>
<p>We are committed to ensuring the security of your personal information and employ industry-standard security measures to safeguard against unauthorised access, disclosure, alteration, or destruction of data. Your payment information is encrypted and stored securely.</p>

<p><strong>4. Information Sharing:</strong></p>
<p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as required by law or to fulfil our contractual obligations. Your personal information may be shared with trusted third-party service providers who assist us in operating our website or servicing you, as long as they agree to keep your information confidential.</p>

<p><strong>5. Cookie Usage:</strong></p>
<p>Our website may use cookies and similar tracking technologies to enhance your browsing experience, analyse website traffic, and personalise content. You may choose to disable cookies through your browser settings, but please note that certain features of our website may not function properly without cookies enabled.</p>

<p><strong>6. Data Retention:</strong></p>
<p>We will retain your personal information only for as long as necessary to fulfil the purposes outlined in this Privacy Policy or as required by law.</p>

<p><strong>7. Your Rights:</strong></p>
<p>You have the right to request access to, update, or deletion of your personal information at any time. You may also request to opt out of receiving communications from us by contacting us at info@orirun.com.</p>

<p><strong>8. Changes to This Policy:</strong></p>
<p>We reserve the right to update or modify this Privacy Policy at any time. Any changes will be effective immediately upon posting on this page. By continuing to use our website, you consent to the terms of this Privacy Policy.</p>
`;

window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get("open") === "contribute") {
        showContributionModal();
    }
    if (params.get("open") === "about") {
        showAboutModal();
    }
    if (params.get("open") === "terms") {
        showTermsModal();
    }
    if (params.get("open") === "chat") {
        toggleChatbot();
    }
});


function showContributionModal() {
    const modal = document.getElementById("contributionModal");
    const closeBtn = modal.querySelector(".customClose");

    modal.style.display = "block";

    closeBtn.onclick = () => modal.style.display = "none";

    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    };
}

document.getElementById("contributionCategory").addEventListener("change", function () {
    const ifaFields = document.getElementById("ifaFields");
    ifaFields.style.display = this.value === "Ifa" ? "block" : "none";
});

/* -----------------------------
   CATEGORY TOGGLE LOGIC
-------------------------------- */

document.addEventListener("change", function (e) {
    if (e.target.id !== "contributionCategory") return;

    const category = e.target.value;
    const ifaFields = document.getElementById("ifaFields");
    const titleField = document.getElementById("ifaTitle");
    const mediaField = document.getElementById("ifaMedia");

    if (category === "Ifa") {
        ifaFields.style.display = "block";
        setTimeout(() => titleField.focus(), 50);
    } else {
        ifaFields.style.display = "none";
        titleField.value = "";
        mediaField.value = "";
    }
});


/* -----------------------------
   SUBMIT HANDLER
-------------------------------- */

async function submitContribution() {
    const btn = document.querySelector(".btn.btn-primary.mt-2");
    btn.disabled = true;
    btn.innerText = "Submitting...";

    const category = document.getElementById("contributionCategory").value;
    const name = document.getElementById("contributorName").value || "Anonymous";
    const text = document.getElementById("contributionText").value.trim();
    const title = document.getElementById("ifaTitle").value.trim();
    const media = document.getElementById("ifaMedia").value.trim();

    if (!text) {
        alert("Please enter your contribution.");
        resetButton(btn);
        return;
    }

    if (category === "Ifa" && !title) {
        alert("Title is required for Ifá content.");
        resetButton(btn);
        return;
    }

    const payload = {
        name,
        category,
        text,
        title: category === "Ifa" ? title : "",
        media: category === "Ifa" ? media : ""
    };

    try {
        const res = await fetch("/api/contribution/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!result.success) throw new Error();

        resetForm();
        closeModal();
        showSuccessPopup();

    } catch (err) {
        alert("Submission failed. Please try again.");
    }

    resetButton(btn);
}


/* -----------------------------
   HELPERS
-------------------------------- */

function resetButton(btn) {
    btn.disabled = false;
    btn.innerText = "Submit";
}

function resetForm() {
    document.getElementById("contributorName").value = "";
    document.getElementById("contributionText").value = "";
    document.getElementById("ifaTitle").value = "";
    document.getElementById("ifaMedia").value = "";
    document.getElementById("contributionCategory").value = "General";
    document.getElementById("ifaFields").style.display = "none";
}

function closeModal() {
    const modal = document.getElementById("contributionModal");
    modal.style.opacity = "0";
    setTimeout(() => {
        modal.style.display = "none";
        modal.style.opacity = "1";
    }, 300);
}

function showSuccessPopup() {
    const popup = document.getElementById("successPopup");
    popup.classList.add("show");

    setTimeout(() => {
        popup.classList.remove("show");
    }, 2500);
}


/* ─────────────────────────────────────────────────────────────
 *  Orírùn — PWA Install Handler
 * ───────────────────────────────────────────────────────────── */
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const installBtn = document.getElementById("installLink");
  if (installBtn) installBtn.style.display = "inline";
});

function isInAppBrowser() {
  return /FBAN|FBAV|Instagram|WhatsApp|Twitter|Line|MicroMessenger/i
    .test(navigator.userAgent);
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function installPWA() {
  /* ── In-app browser (Facebook, Instagram, WhatsApp etc.) ── */
  if (isInAppBrowser()) {
    alert(
      "To install Orírùn, please open this page in Chrome.\n\n" +
      "Tap the three dots (⋮) or share button and choose 'Open in Chrome'."
    );
    return;
  }

  /* ── Android / Desktop Chrome — native prompt available ── */
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      console.log("PWA install choice:", choice.outcome);
      deferredPrompt = null;
      const installBtn = document.getElementById("installLink");
      if (installBtn) installBtn.style.display = "none";
    });
    return;
  }

  /* ── iOS Safari — manual steps required ── */
  if (isIOS()) {
    if (!isSafari()) {
      alert(
        "To install Orírùn on iPhone, please open this page in Safari first.\n\n" +
        "Chrome on iPhone cannot install apps directly."
      );
      return;
    }
    alert(
      "To install Orírùn on iPhone:\n\n" +
      "1. Tap the Share button (□↑) at the bottom of Safari\n" +
      "2. Scroll down and tap 'Add to Home Screen'\n" +
      "3. Tap 'Add'"
    );
    return;
  }

  /* ── Already installed or prompt not yet fired ── */
  if (window.matchMedia("(display-mode: standalone)").matches) {
    alert("Orírùn is already installed on your device.");
    return;
  }

  /* ── Generic fallback ── */
  alert(
    "To install Orírùn:\n\n" +
    "• Android: tap the three dots (⋮) in Chrome → 'Add to Home Screen'\n" +
    "• iPhone: tap Share (□↑) in Safari → 'Add to Home Screen'"
  );
}

window.addEventListener("appinstalled", () => {
  console.log("Orírùn PWA installed successfully");

  /* Hide install button once installed */
  const installBtn = document.getElementById("installLink");
  if (installBtn) installBtn.style.display = "none";

  /* Register periodic sync now that the app is installed —
     this is when Background Sync becomes available on Android */
  navigator.serviceWorker?.ready.then(async (swReg) => {
    if (typeof _registerPeriodicSync === "function") {
      await _registerPeriodicSync(swReg);
      console.log("🗓 Periodic sync registered after PWA install");
    }
  }).catch(() => {});
});

/* Hide install button if already running as installed PWA */
if (window.matchMedia("(display-mode: standalone)").matches) {
  document.addEventListener("DOMContentLoaded", () => {
    const installBtn = document.getElementById("installLink");
    if (installBtn) installBtn.style.display = "none";
  });
}

window.installPWA = installPWA;