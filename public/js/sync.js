
function openSyncModal() {
  if (!document.getElementById("syncModal")) _buildSyncModal();
  document.getElementById("syncModal").style.display = "flex";
  _switchSyncTab("save");

  // Pre-fill cached email
  try {
    const cached = localStorage.getItem("syncEmail");
    if (cached) {
      document.getElementById("syncEmail").value        = cached;
      document.getElementById("syncRestoreEmail").value = cached;
    }
  } catch {}
}

function closeSyncModal() {
  const m = document.getElementById("syncModal");
  if (m) m.style.display = "none";
}

function _switchSyncTab(tab) {
  const savePanel    = document.getElementById("syncPanelSave");
  const restorePanel = document.getElementById("syncPanelRestore");
  const saveTab      = document.getElementById("syncTabSave");
  const restoreTab   = document.getElementById("syncTabRestore");

  const active   = "2px solid green";
  const inactive = "1px solid #ccc";

  if (tab === "save") {
    savePanel.style.display    = "block";
    restorePanel.style.display = "none";
    saveTab.style.border       = active;
    saveTab.style.opacity      = "1";
    restoreTab.style.border    = inactive;
    restoreTab.style.opacity   = "0.55";
  } else {
    savePanel.style.display    = "none";
    restorePanel.style.display = "block";
    restoreTab.style.border    = active;
    restoreTab.style.opacity   = "1";
    saveTab.style.border       = inactive;
    saveTab.style.opacity      = "0.55";
  }
}

function _buildSyncModal() {
  const modal = document.createElement("div");
  modal.id = "syncModal";
  modal.style.cssText = `
    display:none; position:fixed; inset:0; z-index:6000;
    background:rgba(0,0,0,0.6);
    align-items:center; justify-content:center;
  `;

 modal.innerHTML = `
  <div style="
    background:#fff; border-radius:14px; padding:24px 20px;
    width:92%; max-width:370px; position:relative;
    font-family:Courier,monospace; color:#1b4332;
    box-shadow:0 20px 50px rgba(0,0,0,0.3);
  ">

    <!-- Close -->
    <button onclick="closeSyncModal()" style="
      position:absolute; top:10px; right:14px;
      background:none; border:none; font-size:22px;
      cursor:pointer; color:#aaa; line-height:1;
    ">✕</button>

    <!-- Title -->
    <h3 style="margin:0 0 4px;">🔗 Sync History</h3>
    <p style="font-size:12px;opacity:0.65;margin:0 0 16px;">
      Securely sync your divination history across devices using a private key.
      No email or account required.
    </p>

    <!-- Tabs -->
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button id="syncTabSave"
        onclick="_switchSyncTab('save')"
        class="app-btn"
        style="flex:1;padding:9px 6px;font-weight:bold;border:2px solid green;">
        🔑 Create Key
      </button>
      <button id="syncTabRestore"
        onclick="_switchSyncTab('restore')"
        class="app-btn"
        style="flex:1;padding:9px 6px;font-weight:bold;border:1px solid #ccc;opacity:0.55;">
        📥 Use Key
      </button>
    </div>

    <!-- ── CREATE KEY PANEL ── -->
    <div class="allow-copy" id="syncPanelSave">
      <p style="font-size:13px;margin:0 0 12px;">
        Generate your private sync key. Use it on another device to access your history.
      </p>

      <button onclick="doSyncRegister()"
        class="btn btn-md app-btn"
        style="width:100%;padding:10px;background:white;">
        🔑 Generate Sync Key
      </button>

      <textarea id="syncGeneratedKey"
        readonly
        placeholder="Your sync key will appear here..."
        style="
          width:100%; margin-top:10px; padding:10px;
          border-radius:8px; border:1px solid #ccc;
          font-family:Courier,monospace; font-size:12px;
          height:70px; resize:none;
        "></textarea>

      <button onclick="navigator.clipboard.writeText(document.getElementById('syncGeneratedKey').value)"
        style="margin-top:6px;width:100%;padding:8px;font-size:12px;">
        📋 Copy Key
      </button>

      <p id="syncSaveMsg"
        style="font-size:12px;margin-top:10px;text-align:center;min-height:18px;">
      </p>
    </div>

    <!-- ── RESTORE PANEL ── -->
    <div class="allow-paste" id="syncPanelRestore" style="display:none;">
      <p style="font-size:13px;margin:0 0 12px;">
        Paste your sync key to restore your history on this device.
      </p>

      <textarea id="syncPin"
        placeholder="Paste your sync key here..."
        style="
          width:100%; padding:10px;
          border-radius:8px; border:1px solid #ccc;
          font-family:Courier,monospace;
          font-size:12px; height:80px;
          box-sizing:border-box;
        "></textarea>

      <button onclick="doSyncRestore()"
        class="btn btn-md app-btn"
        style="width:100%;padding:10px;background:white;margin-top:8px;">
        📥 Sync Now
      </button>

      <p id="syncRestoreMsg"
        style="font-size:12px;margin-top:10px;text-align:center;min-height:18px;">
      </p>
    </div>

  </div>
`;

  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener("click", e => {
    if (e.target === modal) closeSyncModal();
  });
}

/* ── REGISTER ──────────────────────────────────────────────── */
async function doSyncRegister() {
  const msg  = document.getElementById("syncSaveMsg");
  const keyEl = document.getElementById("syncGeneratedKey");

  _setMsg(msg, "Creating secure sync…", "#0f7b3d");

  try {
    const res = await fetch("/api/sync/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    // ✅ Save token locally
    localStorage.setItem("syncToken", data.token);

    // ✅ DISPLAY KEY IN TEXTAREA (CRITICAL FIX)
    if (keyEl) {
      keyEl.value = data.token;
    }

    // Optional: auto-select for easy copy
    keyEl?.focus();
    keyEl?.select();

    _setMsg(
      msg,
      "✅ Sync key generated. Copy and use on another device.",
      "#0f7b3d"
    );

  } catch (err) {
    _setMsg(msg, "Failed to create sync.", "red");
    console.error(err);
  }
}

async function doSyncRestore() {
  const token = document.getElementById("syncPin").value.trim(); // reuse input
  const msg   = document.getElementById("syncRestoreMsg");

  if (!token) {
    _setMsg(msg, "Enter your sync key.", "red");
    return;
  }

  _setMsg(msg, "Syncing…", "#0f7b3d");

  try {
    const res = await fetch("/api/sync/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, deviceId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    const remote = (data.history || []).map(e => ({
      ...e,
      id: e.id || e._id
    }));

    let local = [];
    try {
      const r = await fetch("/api/history/" + deviceId);
      local = await r.json();
    } catch {}

    local = normalizeHistory(local);

    // 🔥 WhatsApp-style merge
    const map = new Map();

    const put = (entry) => {
      const id = entry.id || entry._id;
      if (!id) return;

      const existing = map.get(id);

      if (!existing) {
        map.set(id, entry);
      } else {
        map.set(id, {
          ...existing,
          ...entry,
          note: existing.note || entry.note || ""
        });
      }
    };

    local.forEach(put);
    remote.forEach(put);

    fullHistory = Array.from(map.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    renderHistoryPage();

    localStorage.setItem("syncToken", token);

    _setMsg(msg, `✅ Synced ${fullHistory.length} entries`, "#0f7b3d");

  } catch (err) {
    _setMsg(msg, "Invalid or expired sync key.", "red");
    console.error(err);
  }
}

async function bootstrapHistoryFromSync() {
  try {
    const token = localStorage.getItem("syncToken");
    if (!token) return false;

    /* Wait for server to be confirmed awake before calling sync.
       serverReady is the promise from config.js that resolves once
       the server responds — same guard used in window.onload */
    if (typeof serverReady !== "undefined") {
      await Promise.race([
        serverReady,
        new Promise(resolve => setTimeout(resolve, 10000))
      ]);
    }

    const res = await fetch("/api/sync/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, deviceId })
    }).catch(() => null);

    if (!res) return false;

    const data = await res.json();
    if (!data?.history) return false;

    fullHistory = normalizeHistory(data.history)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    renderHistoryPage();
    return true;

  } catch (err) {
    console.warn("Bootstrap sync failed:", err);
    return false;
  }
}

/* ── HELPER ────────────────────────────────────────────────── */
function _setMsg(el, text, color) {
  el.textContent = text;
  el.style.color = color;
}
