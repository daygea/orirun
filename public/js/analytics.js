let currentTrendView = "daily"; // default

async function showAnalytics() {
  if(isAdminAuthenticated){
  try {
    const preloader = document.getElementById("preloader");

    // --- Show preloader (optimized DOM write) ---
    preloader.style.cssText = "display:flex;justify-content:center;align-items:center;";
    preloader.innerHTML = `
        <div class="loading-container" style="margin-top:50vh">
            <div class="guidance-card">
                <p class="loading-text">
                    <span class="spinner"></span>
                    <span data-translate="loading">Loading...</span>
                </p>
            </div>
        </div>
    `;
    const res = await fetch("/api/analytics/summary" , { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load analytics");
    const data = await res.json();
    preloader.style.display = "none";
    document.querySelectorAll(".app-section").forEach(sec => sec.style.display = "none");
        // CLEAR DIVINATION RESULT
    const resultElement = document.getElementById("divinationResultContainer");
    if (resultElement) resultElement.innerHTML = "";
    
        // ✅ Clear the logs container content
    const logContainer = document.getElementById("logs");
    if (logContainer) logContainer.innerHTML = "";

    const analyticsSection = document.getElementById("analytics");
    const summaryDiv = document.getElementById("analytics-summary");
    analyticsSection.style.display = "block";

    // 🟢 Format latest feedback entries
    const feedbackListHTML = data.latestFeedbacks.map(f => {
      const ctx = f.contextType || "unknown";
      const summary = Object.entries(f.contextData || {})
        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join(", ");
      return `
        <li class="list-group-item">
          <strong>${ctx}</strong> → ${f.feedback.toUpperCase()}<br>
          <small>${summary}</small><br>
          <em>${new Date(f.timestamp).toLocaleString()}</em>
        </li>`;
    }).join("");

    // 🟢 Feedback by Type table
    const fbTypes = Object.entries(data.feedbackOverview.byType || {});
    const fbTypeRows = fbTypes.length
      ? fbTypes.map(([type, vals]) =>
          `<tr>
            <td>${type}</td>
            <td>${vals.total}</td>
            <td>${vals.yes}</td>
            <td>${vals.no}</td>
            <td>${Math.round((vals.yes / vals.total) * 100)}%</td>
          </tr>`
        ).join("")
      : "<tr><td colspan='5'>No feedback yet</td></tr>";

    // 🟢 Responsive layout
    summaryDiv.innerHTML = `
      <div class="container-fluid py-3" style="color:green;">
        <div class="text-center mb-3">
          <h3 class="fw-bold text-success">📊 Platform Summary</h3>
          <p class="text-muted">Insights from Orirun interactions</p>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-6 col-md-3">
            <div class="card shadow-sm text-center border-success">
              <div class="card-body">
                <h6 class="text-muted">Divinations</h6>
                <h3 class="text-success"><a style="text-decoration: none; cursor: pointer;" onclick="showLogs('divination')">${data.divinationCount}</a></h3>
              </div>
            </div>
          </div>

          <div class="col-6 col-md-3">
            <div class="card shadow-sm text-center border-success">
              <div class="card-body">
                <h6 class="text-muted">Chats</h6>
                <h3 class="text-success"><a style="text-decoration: none; cursor: pointer;" onclick="showLogs('chat')">${data.chatCount}</a></h3>
              </div>
            </div>
          </div>

          <div class="col-6 col-md-3">
            <div class="card shadow-sm text-center border-success">
              <div class="card-body">
                <h6 class="text-muted">Feedback</h6>
                <h3 class="text-success"><a style="text-decoration: none; cursor: pointer;" onclick="showLogs('feedback')">${data.feedbackCount}</a></h3>
              </div>
            </div>
          </div>

          <div class="col-6 col-md-3">
            <div class="card shadow-sm text-center border-success">
              <div class="card-body">
                <h6 class="text-muted">Satisfaction</h6>
                <h3 class="text-success">${data.feedbackOverview.satisfactionRate}%</h3>
              </div>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="fw-bold text-success mb-0">🧿 Top 5 Odù</h5>
          <button class="btn btn-outline-success btn-sm" onclick="exportAnalyticsCSV()">📤 Export CSV</button>
          <button class="btn btn-success btn-sm ms-2" onclick="exportAnalyticsPDF()">📄 Download PDF</button>
        </div>
        <ul class="list-group mb-4">
          ${data.topOdu.map(o => `<li class="list-group-item d-flex justify-content-between align-items-center">${o.name}<span class="badge bg-success" style="color:white;">${o.count}</span></li>`).join("")}
        </ul>

        <h5 class="fw-bold text-success mb-2">💬 Latest Feedback</h5>
        <ul class="list-group mb-4">${feedbackListHTML}</ul>

        <h5 class="fw-bold text-success mb-2">🗂 Feedback by Context</h5>
        <div class="table-responsive mb-4">
          <table class="table table-striped table-bordered align-middle text-center">
            <thead class="table-success">
              <tr>
                <th>Type</th>
                <th>Total</th>
                <th>Yes</th>
                <th>No</th>
                <th>Positivity</th>
              </tr>
            </thead>
            <tbody>${fbTypeRows}</tbody>
          </table>
        </div>

        <div class="text-center mb-3">
          <label class="fw-bold me-2">View Trend:</label>
          <select id="trendSelect" class="form-select d-inline-block w-auto" onchange="updateTrendChart(this.value)">
            <option value="daily" selected>Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div class="text-center">
          <canvas id="activityTrendChart" class="w-100 mb-4" style="max-width:700px; margin:auto;"></canvas>
          <canvas id="feedbackSentimentChart" class="w-100" style="max-width:400px; margin:auto;"></canvas>
        </div>
      </div>
    `;

    window.analyticsData = data;
    renderTrendChart(data.trends[currentTrendView]);
    renderFeedbackSentimentChart(data.feedbackOverview);
  } catch (err) {
    console.error("Error loading analytics:", err);
  }
}
}


// 📈 Trend Chart (toggle view)
function renderTrendChart(trendData) {
  const ctx = document.getElementById("activityTrendChart").getContext("2d");
  if (window.trendChart) window.trendChart.destroy();

  const labels = Object.keys(trendData);
  const values = Object.values(trendData);

  window.trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `${currentTrendView.toUpperCase()} Activity`,
        data: values,
        borderColor: "#4caf50",
        tension: 0.3,
        fill: false
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: `User Activity (${currentTrendView})` }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// 📊 Feedback Sentiment Chart (based on yes/no)
function renderFeedbackSentimentChart(feedbackOverview) {
  const ctx = document.getElementById("feedbackSentimentChart").getContext("2d");
  if (window.sentimentChart) window.sentimentChart.destroy();

  const yes = feedbackOverview.yesCount;
  const no = feedbackOverview.noCount;
  const neutral = feedbackOverview.total - (yes + no);

  window.sentimentChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Yes (Positive)", "No (Negative)"],
      datasets: [{
        data: [yes, no],
        backgroundColor: ["#4caf50", "#f44336"]
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: "Feedback Overview" }
      }
    }
  });
}

// 🧭 Toggle Trend View
function updateTrendChart(type) {
  currentTrendView = type;
  renderTrendChart(window.analyticsData.trends[type]);
}

async function exportAnalyticsPDF() {
  if (!window.analyticsData) {
    alert("No analytics data to export yet.");
    return;
  }

  const trendCanvas = document.getElementById("activityTrendChart");
  const sentimentCanvas = document.getElementById("feedbackSentimentChart");

  const trendImage = trendCanvas ? trendCanvas.toDataURL("image/png") : null;
  const sentimentImage = sentimentCanvas ? sentimentCanvas.toDataURL("image/png") : null;

  const data = window.analyticsData;
  const trend = data.trends[currentTrendView] || {};
  const feedbacks = Array.isArray(data.latestFeedbacks) ? data.latestFeedbacks : [];

  const payload = {
    currentTrendView,
    date: new Date().toISOString(),
    summary: {
      divinationCount: data.divinationCount,
      chatCount: data.chatCount,
      feedbackCount: data.feedbackCount,
      satisfactionRate: data.feedbackOverview?.satisfactionRate || 0,
    },
    trends: Object.entries(trend),
    feedbacks: feedbacks.map(f => ({
      contextType: f.contextType || "unknown",
      feedback: f.feedback || "",
      timestamp: f.timestamp ? new Date(f.timestamp).toLocaleString() : "",
    })),
    topOdu: data.topOdu || [], // ✅ NEW: include top Odù section
    images: {
      trendImage,
      sentimentImage,
    },
  };

  try {
    const res = await fetch("/api/analytics/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Failed to generate PDF");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Orirun-Analytics-${currentTrendView}-${new Date().toISOString().split("T")[0]}.pdf`;
    link.click();
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("❌ Could not generate PDF. Please try again later.");
  }
}




function exportAnalyticsCSV() {
  if (!window.analyticsData) {
    alert("No analytics data available to export.");
    return;
  }

  const data = window.analyticsData;
  const timestamp = new Date().toLocaleString();
  const trendEntries = Object.entries(data.trends[currentTrendView]);

  // 🟢 Add CSV sections
  const rows = [];

  // --- Header section ---
  rows.push(["ORIRUN ANALYTICS REPORT"]);
  rows.push([`Exported On:, ${timestamp}`]);
  rows.push([`Trend View:, ${currentTrendView.toUpperCase()}`]);
  rows.push([]); // blank line

  // --- Summary section ---
  rows.push(["SUMMARY"]);
  rows.push(["Divinations", data.divinationCount]);
  rows.push(["Chats", data.chatCount]);
  rows.push(["Feedback Entries", data.feedbackCount]);
  if (data.feedbackOverview?.satisfactionRate !== undefined) {
    rows.push(["Satisfaction Rate (%)", `${data.feedbackOverview.satisfactionRate}%`]);
  }
  rows.push([]); // blank line

  // --- Top Odù section ---
  rows.push(["TOP 5 ODÙ"]);
  rows.push(["Name", "Count"]);
  (data.topOdu || []).forEach(o => {
    rows.push([o.name, o.count]);
  });
  rows.push([]); // blank line

  // --- Feedback Overview section ---
  rows.push(["FEEDBACK OVERVIEW"]);
  rows.push(["Total", "Yes", "No", "Positivity (%)"]);
  if (data.feedbackOverview?.byType) {
    Object.entries(data.feedbackOverview.byType).forEach(([type, stats]) => {
      const positivity = Math.round((stats.yes / stats.total) * 100) || 0;
      rows.push([type, stats.total, stats.yes, stats.no, positivity]);
    });
  }
  rows.push([]); // blank line

  // --- Trend data section ---
  rows.push([`${currentTrendView.toUpperCase()} TREND DATA`]);
  rows.push(["Date/Period", "Activity Count"]);
  trendEntries.forEach(([period, count]) => rows.push([period, count]));

  // --- Latest Feedbacks section ---
  rows.push([]);
  rows.push(["LATEST FEEDBACK"]);
  rows.push(["Type", "Feedback", "Context Summary", "Timestamp"]);
  (data.latestFeedbacks || []).forEach(f => {
    const contextSummary = Object.entries(f.contextData || {})
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("; ");
    rows.push([
      f.contextType || "Unknown",
      f.feedback,
      contextSummary,
      new Date(f.timestamp).toLocaleString()
    ]);
  });

  // 🟢 Escape commas and quotes safely
  const csv = rows
    .map(r =>
      r
        .map(cell => {
          if (typeof cell === "string" && (cell.includes(",") || cell.includes('"') || cell.includes("\n"))) {
            return `"${cell.replace(/"/g, '""')}"`; // escape quotes
          }
          return cell;
        })
        .join(",")
    )
    .join("\n");

  // 🟢 Create downloadable file
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Orirun-Analytics-${currentTrendView}-${new Date().toISOString().split("T")[0]}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
