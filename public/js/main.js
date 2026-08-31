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

/* Render a verse-based reading (step 2). Leads with the most-specific verified
   interpretation, then offers the other verified analyses beneath ("Ifá also
   speaks…"). Every interpretation shows its named provenance — the verse
   contributor and the babaláwo who verified it — so the seeker sees whose
   wisdom this is. Only reached when the corpus HAS a verified interpretation;
   otherwise the caller shows the oduData Message. */
function _verseReadingHTML(vr, solutionInfo) {
  const esc = (s) => String(s == null ? "" : s);
  const credit = (r) => {
    // Seeker-facing attribution — recognition for those who carry the corpus:
    // the one who recorded the verse and the elder who verified it. Naming the
    // verifying elder also dignifies the reading (a real elder vouched for this).
    const rec = r.provenance?.contributor;
    const ver = r.verifiedBy;
    if (!rec && !ver) return "";
    const bits = [];
    if (rec) bits.push(`recorded by ${esc(rec)}`);
    if (ver) bits.push(`verified by ${esc(ver)}`);
    return `<div style="font-size:11.5px;color:var(--of-ink-soft);margin-top:8px;font-style:italic;">${bits.join(" · ")}</div>`;
  };
  // Collapsible verse — the source the interpretation rests on. Shown beneath
  // the interpretation, closed by default so the reading stays clean. Only
  // rendered when the Yorùbá looks normalized (tone-marked); raw, un-normalized
  // submissions are held back from public view until an elder normalizes them.
  const STRUCT_LABEL = {
    awo: "The diviners", client: "Cast for", reason: "The reason",
    instruction: "The instruction", outcome: "The outcome", thanksgiving: "Thanksgiving",
  };

  // Lead VERSE — the ẹsẹ Ifá itself now leads the reading, prominent and open.
  // Its interpretation follows as an expandable beneath, so the words of Ifá are
  // what the seeker meets first and the reading rests on the verse, not the gloss.
  // (Verse shown only when normalized/tone-marked; otherwise we lead with the
  // interpretation as a fallback so the reading still stands.)
  const leadVerseBlock = (r) => {
    if (!r.normalized || !(r.yoruba && r.yoruba.length)) return "";
    const yor = r.yoruba.map((l) => esc(l)).join("<br>");
    const eng = (r.english && r.english.length)
      ? `<div style="margin-top:8px;color:var(--of-ink-soft);font-style:italic;" data-translate>${r.english.map(esc).join("<br>")}</div>` : "";
    let struct = "";
    if (r.structure && typeof r.structure === "object") {
      const parts = Object.entries(r.structure)
        .filter(([, v]) => v && v.origin !== "absent" && (v.lines || []).length)
        .map(([k, v]) => {
          const recon = v.origin === "reconstructed"
            ? ` <span style="font-size:10px;color:#b8860b;font-style:italic;">(reconstructed)</span>` : "";
          return `<div style="margin-top:6px;"><span style="font-size:11px;font-weight:600;color:var(--of-green-deep,#0a5a2c);" data-translate>${STRUCT_LABEL[k] || k}</span>${recon}<br><span data-translate>${(v.lines || []).map(esc).join(" ")}</span></div>`;
        }).join("");
      if (parts) struct = `<div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--of-line,#e0efe0);">${parts}</div>`;
    }
    return `
      <div style="font-size:15px;line-height:1.8;color:var(--of-ink);padding:12px 14px;background:var(--of-paper-2,#f5f1e6);border-radius:8px;">
        <div data-translate>${yor}</div>
        ${eng}
        ${struct}
      </div>`;
  };
  const interpDisc = (r) => `
      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--of-green-deep,#0a5a2c);" data-translate>What Ifá says</summary>
        <p class="ori-section-text" style="margin-top:8px;" data-translate>${esc(r.interpretation)}</p>
      </details>`;

  const leadR = vr.lead;
  const _leadVerse = leadVerseBlock(leadR);
  const leadHTML = _leadVerse
    ? `
    <div>
      ${_leadVerse}
      ${interpDisc(leadR)}
      ${credit(leadR)}
    </div>`
    : `
    <div>
      <p class="ori-section-text" data-translate>${esc(leadR.interpretation)}</p>
      ${credit(leadR)}
    </div>`;

  // Ẹbọ — the actionable heart, surfaced into its own box rather than buried.
  const eboBox = solutionInfo && solutionInfo !== "No solution info available." ? `
    <div style="background:var(--of-brass-wash,#fbf5e9);border:1px solid var(--of-brass-line,#e7d6a8);border-radius:8px;padding:11px 13px;margin:16px 0;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--of-brass,#8a5a2b);font-weight:700;margin-bottom:4px;" data-translate>The ẹbọ to make</div>
      <div style="font-size:13.5px;color:var(--of-ink);line-height:1.5;" data-translate>${esc(solutionInfo)}</div>
    </div>` : "";

  // Supporting verses — collapsed cards, capped. A reading is focused, not a
  // library dump: we render the lead + up to MAX_SHOWN ranked supporting verses
  // (the most relevant, since ranking floats them up), then show a count for
  // the rest WITHOUT rendering them — so the page stays fast no matter how large
  // the corpus grows. Titles and workflow names are hidden; each card leads with
  // its interpretation and the contributor.
  // Render what the backend sent in the initial reading (INITIAL_OTHERS = 8).
  // "See all" then continues from this offset, fetching further pages — so no
  // verse is both rendered here and re-fetched. A reading stays focused; the
  // full corpus is one tap (and paged) away.
  const MAX_SHOWN = 8;
  const others = vr.others || [];
  const shown = others.slice(0, MAX_SHOWN);
  const remaining = Math.max(0, others.length - shown.length);
  const teaser = (t) => {
    const first = String(t || "").split(/(?<=[.!?])\s/)[0] || String(t || "");
    return first.length > 90 ? first.slice(0, 88).trim() + "…" : first;
  };
  // A short teaser of the VERSE itself (its first Yorùbá line) for the collapsed
  // card summary — so supporting verses, like the lead, are met as verse first.
  const verseTeaser = (r) => {
    if (r.normalized && r.yoruba && r.yoruba.length) {
      const first = esc(r.yoruba[0]);
      return first.length > 90 ? first.slice(0, 88).trim() + "…" : first;
    }
    // No public verse text (un-normalized) → fall back to the interpretation
    // teaser so the card still says something meaningful.
    return esc(teaser(r.interpretation));
  };
  const card = (r) => `
    <details class="verse-card" style="border:1px solid var(--of-line,#e6efe4);border-radius:8px;margin-bottom:7px;overflow:hidden;">
      <summary style="cursor:pointer;list-style:none;padding:10px 12px;display:flex;align-items:center;gap:10px;">
        <span style="flex:1;min-width:0;font-size:12.5px;color:var(--of-ink-soft,#7a8a80);" data-translate>${verseTeaser(r)}</span>
        ${r.provenance?.contributor ? `<span style="font-size:10px;color:#aaa;white-space:nowrap;">${esc(r.provenance.contributor)}</span>` : ""}
      </summary>
      <div style="padding:0 12px 12px;">
        ${leadVerseBlock(r) || `<p class="ori-section-text" style="margin:0 0 4px;" data-translate>${esc(r.interpretation)}</p>`}
        ${leadVerseBlock(r) ? interpDisc(r) : ""}
        ${credit(r)}
      </div>
    </details>`;

  let othersHTML = "";
  if (shown.length) {
    const cards = shown.map(card).join("");
    // "See all" — when more supporting verses exist than we render, offer a tap
    // that fetches the rest in pages (kept out of the initial payload for scale).
    const total = (typeof vr.totalOthers === "number") ? vr.totalOthers : others.length;
    const remaining = Math.max(0, total - shown.length);
    const seeAll = remaining > 0 ? `
      <div style="text-align:center;margin-top:12px;">
        <button type="button" class="verse-see-all btn btn-ghost btn-sm"
          data-odu="${esc(vr.odu || "")}" data-ori="${esc(vr.orientation || "")}" data-offset="${shown.length}"
          data-translate>See all ${total} verses ↓</button>
      </div>
      <div class="verse-more-slot" style="margin-top:8px;"></div>` : "";
    othersHTML = `
      <div class="verse-others" style="margin-top:18px;">
        <div style="font-size:11px;font-weight:700;color:var(--of-ink-soft,#8a9a8f);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;" data-translate>Ifá also speaks through these verses</div>
        ${cards}
        ${seeAll}
      </div>`;
  }

  // PART B — optional "confirm your enquiry" step. Mirrors the babaláwo asking
  // the seeker their enquiry AFTER chanting, to confirm specificity. Opt-in and
  // post-reading — it never changes the reading above. If used, it surfaces one
  // verse that speaks to the stated enquiry.
  const confirmHTML = (vr.odu && vr.orientation) ? `
    <div class="enquiry-confirm" style="margin-top:22px;padding-top:16px;border-top:1px solid var(--of-line,#e6efe4);">
      <div style="font-size:11px;font-weight:700;color:var(--of-ink-soft,#8a9a8f);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;" data-translate>Confirm your enquiry</div>
      <p style="font-size:12.5px;color:var(--of-ink-soft,#7a8a80);margin:0 0 8px;" data-translate>If you wish, share what you came to ask — Ifá may speak to it through a further verse.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input type="text" class="enquiry-input" maxlength="500" placeholder="Your enquiry (optional)"
          data-odu="${esc(vr.odu)}" data-ori="${esc(vr.orientation)}"
          style="flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--of-line,#e6efe4);border-radius:8px;font-size:13px;" data-translate-attr="placeholder" />
        <button type="button" class="enquiry-confirm-btn btn btn-ghost btn-sm" data-translate>Confirm</button>
      </div>
      <div class="enquiry-result" style="margin-top:10px;"></div>
    </div>` : "";

  // Browse-all — exploration path, distinct from the reading. Shown only when
  // the corpus holds more verses than the (capped) reading surfaced, so seekers
  // can reach every verse for this cast — or widen to the whole Odù — if they wish.
  const corpusTotal = (typeof vr.corpusTotal === "number") ? vr.corpusTotal : 0;
  const readingShown = (typeof vr.totalOthers === "number") ? vr.totalOthers : (vr.others || []).length;
  const browseHTML = (corpusTotal > readingShown && vr.odu && vr.orientation) ? `
    <div class="verse-browse" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--of-line,#e6efe4);"
         data-odu="${esc(vr.odu)}" data-ori="${esc(vr.orientation)}">
      <button type="button" class="verse-browse-open btn btn-ghost btn-sm" data-translate>Browse all ${corpusTotal} verses for this cast</button>
      <div class="verse-browse-panel" style="display:none;margin-top:12px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
          <button type="button" class="browse-scope active" data-scope="cast" style="font-size:12px;padding:5px 10px;border:1px solid var(--of-line,#e6efe4);border-radius:6px;background:var(--of-tint,#fbfdfa);cursor:pointer;" data-translate>This cast</button>
          <button type="button" class="browse-scope" data-scope="odu" style="font-size:12px;padding:5px 10px;border:1px solid var(--of-line,#e6efe4);border-radius:6px;background:#fff;cursor:pointer;" data-translate>Whole Odù</button>
        </div>
        <div class="browse-list"></div>
        <button type="button" class="browse-more btn btn-ghost btn-sm" style="display:none;margin-top:10px;" data-translate>Load more</button>
      </div>
    </div>` : "";

  return leadHTML + eboBox + othersHTML + browseHTML + confirmHTML;
}

/* PART B — wire the "confirm your enquiry" control. Delegated so it works for
 * dynamically-rendered readings. Sends the enquiry, shows the one matching verse
 * (or an honest "the reading already speaks to this"). Never alters the reading.
 * (The confirmation itself is a signal the capture layer will record — built in
 * the next phase; this phase only surfaces the confirming verse.) */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".enquiry-confirm-btn");
  if (!btn) return;
  const box = btn.closest(".enquiry-confirm");
  const input = box && box.querySelector(".enquiry-input");
  const slot = box && box.querySelector(".enquiry-result");
  if (!input || !slot) return;
  // Local escape (this handler is top-level; the render helper's esc is not in scope).
  const escT = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const enquiry = (input.value || "").trim();
  if (!enquiry) { slot.innerHTML = ""; return; }
  const odu = input.getAttribute("data-odu");
  const ori = input.getAttribute("data-ori");
  slot.innerHTML = `<span style="font-size:12px;color:#8a9a8f;" data-translate>Consulting Ifá…</span>`;
  if (window.translateDynamicContent) { try { window.translateDynamicContent(slot); } catch {} }
  try {
    // Relative URL + plain fetch — same pattern as the "see all" loader.
    const url = `/api/verses/reading/${encodeURIComponent(odu)}/${encodeURIComponent(ori)}/confirm?enquiry=${encodeURIComponent(enquiry)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.matched && data.verse) {
      const v = data.verse;
      // Show the actual ẹsẹ Ifá (Yorùbá) — same normalized-gate as the main
      // reading: raw, un-normalized text is held back until an elder normalizes.
      const yorHTML = (v.normalized && Array.isArray(v.yoruba) && v.yoruba.length)
        ? `<div style="margin-top:8px;font-size:13px;line-height:1.7;padding:10px 12px;background:var(--of-paper-2,#f5f1e6);border-radius:8px;" data-translate>${v.yoruba.map(escT).join("<br>")}</div>`
        : "";
      const engHTML = (Array.isArray(v.english) && v.english.length)
        ? `<div style="margin-top:8px;color:var(--of-ink-soft,#7a8a80);font-style:italic;" data-translate>${v.english.map(escT).join("<br>")}</div>`
        : "";
      slot.innerHTML = `
        <div style="border:1px solid var(--of-line,#e6efe4);border-radius:8px;padding:12px;background:var(--of-tint,#fbfdfa);">
          <div style="font-size:11px;font-weight:700;color:var(--of-ink-soft,#8a9a8f);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;" data-translate>A verse that speaks to your enquiry</div>
          <p class="ori-section-text" style="margin:0;" data-translate>${escT(v.interpretation)}</p>
          ${yorHTML}
          ${engHTML}
        </div>`;
      // Confirm the interaction resolved: mark the button done and lock the
      // input so it's clear the enquiry was received (not left looking inert).
      btn.textContent = "Confirmed ✓";
      btn.disabled = true;
      input.setAttribute("readonly", "readonly");
      input.style.opacity = "0.7";
      // Record the confirmed-recognition signal (a stronger signal than a yes/no
      // vote): the seeker stated their enquiry and this verse matched. Fire-and-
      // forget — never block or break the reading if it fails.
      if (v.verseId) {
        try {
          fetch("/api/reading/confirm-signal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ oduName: odu, specificOrientation: ori, verseId: v.verseId }),
          }).catch(() => {});
        } catch {}
      }
    } else {
      slot.innerHTML = `<span style="font-size:12.5px;color:#7a8a80;" data-translate>The reading above already speaks to your enquiry.</span>`;
    }
    if (window.translateDynamicContent) { try { window.translateDynamicContent(slot); } catch {} }
  } catch {
    slot.innerHTML = `<span style="font-size:12px;color:#c0392b;" data-translate>Could not reach Ifá just now — please try again.</span>`;
    if (window.translateDynamicContent) { try { window.translateDynamicContent(slot); } catch {} }
  }
});

// If the seeker edits their enquiry after a confirm, reset the control so they
// can ask again (the confirm handler locks it on success).
document.addEventListener("input", (e) => {
  const input = e.target.closest(".enquiry-input");
  if (!input) return;
  const box = input.closest(".enquiry-confirm");
  const btn = box && box.querySelector(".enquiry-confirm-btn");
  if (btn && btn.disabled) {
    btn.disabled = false;
    btn.textContent = "Confirm";
    input.removeAttribute("readonly");
    input.style.opacity = "1";
  }
});

// Browse-all (exploration path). Open the panel, switch scope (this cast / whole
// Odù), and page the full set. Distinct from the reading — this is the corpus.
document.addEventListener("click", (e) => {
  const open = e.target.closest(".verse-browse-open");
  if (!open) return;
  const wrap = open.closest(".verse-browse");
  const panel = wrap && wrap.querySelector(".verse-browse-panel");
  if (!panel) return;
  const showing = panel.style.display !== "none";
  panel.style.display = showing ? "none" : "block";
  if (!showing && !panel.dataset.loaded) {
    _browseLoad(wrap, "cast", 0, true);
    panel.dataset.loaded = "1";
  }
});

document.addEventListener("click", (e) => {
  const tab = e.target.closest(".browse-scope");
  if (!tab) return;
  const wrap = tab.closest(".verse-browse");
  const panel = wrap && wrap.querySelector(".verse-browse-panel");
  if (!panel) return;
  panel.querySelectorAll(".browse-scope").forEach((b) => {
    b.classList.toggle("active", b === tab);
    b.style.background = b === tab ? "var(--of-tint,#fbfdfa)" : "#fff";
  });
  _browseLoad(wrap, tab.getAttribute("data-scope"), 0, true);
});

document.addEventListener("click", (e) => {
  const more = e.target.closest(".browse-more");
  if (!more) return;
  const wrap = more.closest(".verse-browse");
  const scope = wrap.dataset.scope || "cast";
  const offset = parseInt(wrap.dataset.offset, 10) || 0;
  _browseLoad(wrap, scope, offset, false);
});

async function _browseLoad(wrap, scope, offset, reset) {
  const odu = wrap.getAttribute("data-odu");
  const ori = wrap.getAttribute("data-ori");
  const panel = wrap.querySelector(".verse-browse-panel");
  const list = panel.querySelector(".browse-list");
  const moreBtn = panel.querySelector(".browse-more");
  if (reset) { list.innerHTML = '<span style="font-size:12px;color:#8a9a8f;" data-translate>Loading…</span>'; wrap.dataset.scope = scope; }
  try {
    const url = `/api/verses/reading/${encodeURIComponent(odu)}/${encodeURIComponent(ori)}/browse?scope=${encodeURIComponent(scope)}&offset=${offset}&limit=10`;
    const res = await fetch(url);
    const data = await res.json();
    const cards = (data.items || []).map(_verseCardHTML).join("");
    if (reset) list.innerHTML = cards || '<span style="font-size:12.5px;color:#7a8a80;" data-translate>No verses to show.</span>';
    else list.insertAdjacentHTML("beforeend", cards);
    const newOffset = offset + (data.items || []).length;
    wrap.dataset.offset = newOffset;
    if (data.hasMore) {
      moreBtn.style.display = "";
      moreBtn.textContent = `Load more (${data.total - newOffset} left)`;
    } else {
      moreBtn.style.display = "none";
    }
    if (window.translateDynamicContent) { try { window.translateDynamicContent(list); } catch {} }
  } catch {
    list.innerHTML = '<span style="font-size:12px;color:#c0392b;" data-translate>Could not load verses.</span>';
  }
}

// Lived-outcome capture — the strongest learning signal. On a PAST reading in
// history, the seeker affirms whether it bore fruit. Records to the per-verse
// score (outcomes) and stamps the history entry so it isn't asked again.
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".outcome-btn");
  if (!btn) return;
  const box = btn.closest(".history-outcome");
  if (!box) return;
  const val = btn.getAttribute("data-val"); // "yes" | "no"
  const verseId = box.getAttribute("data-vid");
  const odu = box.getAttribute("data-odu");
  const ori = box.getAttribute("data-ori");
  const historyId = box.getAttribute("data-hid");
  if (!verseId || !odu || !ori) return;
  // Optimistic UI: replace the prompt with the recorded outcome.
  const label = val === "yes" ? "This reading has come to pass ✓" : "This reading has not yet come to pass";
  box.innerHTML = `<div style="font-size:12px;color:var(--of-ink-soft,#7a8a80);" data-translate>${label}</div>`;
  if (window.translateDynamicContent) { try { window.translateDynamicContent(box); } catch {} }
  try {
    fetch("/api/reading/outcome-signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oduName: odu, specificOrientation: ori, verseId, outcome: val, historyId }),
    }).catch(() => {});
  } catch {}
});

/* "See all" paged loader — fetches the next page of supporting verses for the
   cast's Odù + orientation and appends them as the same collapsed cards. Kept
   as a delegated handler so it works for dynamically-rendered readings. */
function _verseCardHTML(r) {
  const esc = (s) => String(s == null ? "" : s);
  const teaser = (t) => {
    const first = String(t || "").split(/(?<=[.!?])\s/)[0] || String(t || "");
    return first.length > 90 ? first.slice(0, 88).trim() + "…" : first;
  };
  const contributor = r.provenance?.contributor
    ? `<span style="font-size:10px;color:#aaa;white-space:nowrap;">${esc(r.provenance.contributor)}</span>` : "";
  const cred = r.provenance?.contributor
    ? `<div style="font-size:11.5px;color:var(--of-ink-soft);margin-top:8px;font-style:italic;">verse from ${esc(r.provenance.contributor)}</div>` : "";
  // Verse-first, matching the lead and the initial supporting cards: the ẹsẹ Ifá
  // shows prominently, its interpretation is the collapsed "What Ifá says".
  const hasVerse = r.normalized && r.yoruba && r.yoruba.length;
  const verseTeaser = hasVerse
    ? (esc(r.yoruba[0]).length > 90 ? esc(r.yoruba[0]).slice(0, 88).trim() + "…" : esc(r.yoruba[0]))
    : esc(teaser(r.interpretation));
  const verseBlock = hasVerse
    ? `<div style="font-size:15px;line-height:1.8;color:var(--of-ink);padding:12px 14px;background:var(--of-paper-2,#f5f1e6);border-radius:8px;" data-translate>${r.yoruba.map(esc).join("<br>")}</div>`
    : `<p class="ori-section-text" style="margin:0 0 4px;" data-translate>${esc(r.interpretation)}</p>`;
  const interp = hasVerse
    ? `<details style="margin-top:10px;"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--of-green-deep,#0a5a2c);" data-translate>What Ifá says</summary>
      <p class="ori-section-text" style="margin-top:8px;" data-translate>${esc(r.interpretation)}</p></details>`
    : "";
  return `<details class="verse-card" style="border:1px solid var(--of-line,#e6efe4);border-radius:8px;margin-bottom:7px;overflow:hidden;">
      <summary style="cursor:pointer;list-style:none;padding:10px 12px;display:flex;align-items:center;gap:10px;">
        <span style="flex:1;min-width:0;font-size:12.5px;color:var(--of-ink-soft,#7a8a80);" data-translate>${verseTeaser}</span>${contributor}
      </summary>
      <div style="padding:0 12px 12px;">${verseBlock}${interp}${cred}</div>
    </details>`;
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".verse-see-all");
  if (!btn) return;
  const odu = btn.dataset.odu, ori = btn.dataset.ori;
  let offset = parseInt(btn.dataset.offset, 10) || 0;
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Loading…";
  try {
    const url = `/api/verses/reading/${encodeURIComponent(odu)}/${encodeURIComponent(ori)}/verses?offset=${offset}&limit=5`;
    const res = await fetch(url);
    const data = await res.json();
    const slot = btn.closest(".verse-others")?.querySelector(".verse-more-slot");
    if (slot && data.items) slot.insertAdjacentHTML("beforeend", data.items.map(_verseCardHTML).join(""));
    offset += (data.items || []).length;
    btn.dataset.offset = offset;
    if (data.hasMore) {
      btn.disabled = false;
      btn.textContent = `Load more (${data.total - offset} left)`;
    } else {
      btn.remove(); // all loaded
    }
  } catch {
    btn.disabled = false;
    btn.textContent = original;
  }
});

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

/* Binary value of a cast Odù — derived from the SAME marks that render above,
   so the number always matches the picture. Convention (single mark = 1,
   double mark = 0), the framing credited to Prof. Olu Longe: each Odù is 8
   marks = two columns of four = two nibbles = one byte. Following the Yorùbá
   right-to-left reading, each row is read right mark then left mark, top to
   bottom. */
function _oduBinaryHTML(oduName) {
  const bit = (m) => (m === "|" ? "1" : "0");
  let rows;
  const base = baseOdus[oduName];
  if (base) {
    rows = base.map((l) => [l, l]);
  } else {
    const [p1, p2] = oduName.split(" ");
    const firstPart  = p1 === "Ogbe" ? "Ejiogbe" : `${p1} Meji`;
    const secondPart = p2 === "Ogbe" ? "Ejiogbe" : `${p2} Meji`;
    const fC = baseOdus[firstPart], sC = baseOdus[secondPart];
    if (!fC || !sC) return ""; // unknown odu → show nothing rather than guess
    rows = fC.map((l, i) => [sC[i], l]); // [left = second figure, right = first]
  }
  // Right-to-left per row: right mark before left. Nibbles shown right | left.
  const rightNibble = rows.map((r) => bit(r[1])).join("");
  const leftNibble  = rows.map((r) => bit(r[0])).join("");
  const byte = rows.map((r) => bit(r[1]) + bit(r[0])).join("");
  const value = parseInt(byte, 2);
  // Display reads right-to-left: left-column nibble shown first on screen. The
  // value is unchanged — this only flips the visual order of the two nibbles.
  return `<p class="odu-binary" style="margin:6px 0 0;font-size:13px;color:var(--of-ink-soft,#5a6a60);">`
    + `<span style="font-family:monospace;letter-spacing:1px;color:var(--of-green-deep,#0b3d22);font-weight:600;">${leftNibble} ${rightNibble}</span>`
    // + ` <span data-translate>· binary</span> `
    // + `<span style="font-weight:600;color:var(--of-green-deep,#0b3d22);">${value}</span>`
    // + ` <span style="opacity:.7;" data-translate>of 256</span></p>`;
}

/* The Odù's numerology now flows from its own binary value (its actual marks),
   not its list position. Reduce the 0–255 value to a single digit, preserving
   master numbers 11 and 22. The all-double Odù reduces to 0, which is not a
   valid numerology number — we map it to 9 (completion/endings), which fits
   its meaning. Returns the lookup number (1–9, 11, 22). */
function _oduBinaryValue(oduName) {
  const bit = (m) => (m === "|" ? "1" : "0");
  let rows;
  const base = baseOdus[oduName];
  if (base) {
    rows = base.map((l) => [l, l]);
  } else {
    const [p1, p2] = oduName.split(" ");
    const fC = baseOdus[p1 === "Ogbe" ? "Ejiogbe" : `${p1} Meji`];
    const sC = baseOdus[p2 === "Ogbe" ? "Ejiogbe" : `${p2} Meji`];
    if (!fC || !sC) return null;
    rows = fC.map((l, i) => [sC[i], l]);
  }
  return parseInt(rows.map((r) => bit(r[1]) + bit(r[0])).join(""), 2);
}
function _oduNumerology(oduName) {
  const v = _oduBinaryValue(oduName);
  if (v === null) return null;
  let n = v;
  while (n > 9 && n !== 11 && n !== 22) {
    n = n.toString().split("").reduce((s, d) => s + parseInt(d, 10), 0);
  }
  return n; // 0 (Ọ̀yẹ̀kú, all-double) keeps its true value — it has its own meaning
}
/* Master numbers show as "11/2" and "22/4" — the master number and its root —
   while the tap still fetches the master number's own meaning. */
function _numerologyLabel(n) {
  if (n === 11) return "11/2";
  if (n === 22) return "22/4";
  return String(n);
}

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

  // Populate sensible defaults IMMEDIATELY so the dropdown is never empty on a
  // slow connection, then quietly refine with the server list when it arrives.
  // Preserve the user's current pick if it still exists after refining.
  populateDropdown(dropdown, getDefaultOrientationOptions(orientation));
  const priorValue = dropdown.value;

  try {
    const response = await fetch(
      `/api/odu/orientations/${encodeURIComponent(mainCast)}/${encodeURIComponent(orientation)}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data    = await response.json();
    const options = data[orientation] || [];
    if (options.length) {
      populateDropdown(dropdown, options);
      // Restore the earlier selection if the refined list still contains it.
      if (priorValue && options.includes(priorValue)) dropdown.value = priorValue;
    }
  } catch (error) {
    console.error("Orientation fetch error:", error);
    // Defaults are already showing — nothing more to do.
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

  // Instant defaults, then refine — same pattern as orientation, so the
  // dropdown is never blank while the server responds on a slow link.
  populateDropdown(dropdown, getDefaultSolutionOptions(solution));
  const priorValue = dropdown.value;

  try {
    const response = await fetch(
      `/api/odu/solutionDetails/${encodeURIComponent(mainCast)}/${encodeURIComponent(solution)}`
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data    = await response.json();
    const options = data[solution] || [];
    if (options.length) {
      populateDropdown(dropdown, options);
      if (priorValue && options.includes(priorValue)) dropdown.value = priorValue;
    }
  } catch (error) {
    console.error("Solution details fetch error:", error);
    // Defaults already showing.
  }
};

/* ─────────────────────────────────────────────────────────────
 *  SEARCHABLE ODÙ COMBOBOX
 *  Filters the 256 Odù locally (no network, no library) and drives the
 *  hidden <select id="mainCast">. Selecting an item fires the select's native
 *  "change" event, so ALL existing logic runs unchanged. Only a valid Odù can
 *  be chosen; free text never leaks through.
 * ───────────────────────────────────────────────────────────── */
function initOduCombobox() {
  const input = document.getElementById("mainCastSearch");
  const list = document.getElementById("mainCastList");
  const select = document.getElementById("mainCast");
  if (!input || !list || !select) return;

  const names = allOdus.map((o) => o.name);
  let active = -1; // highlighted index in the current filtered list

  // Match on any part of a compound name ("owo" finds "Osa Owonrin").
  const filter = (q) => {
    const s = q.trim().toLowerCase();
    if (!s) return names; // no query → show all 256 (the list scrolls)
    return names.filter((n) => n.toLowerCase().includes(s));
  };

  const choose = (name) => {
    if (!names.includes(name)) return; // guard: only valid Odù
    select.value = name;
    input.value = name;
    close();
    // Fire the SAME event the old <select> fired, so nothing downstream changes.
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const render = (items) => {
    list.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "No matching Odù";
      li.style.cssText = "padding:8px 10px;color:#8a9a8f;font-style:italic;";
      list.appendChild(li);
      open();
      return;
    }
    items.forEach((name, i) => {
      const li = document.createElement("li");
      li.textContent = name;
      li.setAttribute("role", "option");
      li.dataset.name = name;
      li.style.cssText = "padding:8px 10px;border-radius:6px;cursor:pointer;font-size:14px;" + (i === active ? "background:var(--of-green-wash,#eef6ee);" : "");
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(name); });
      li.addEventListener("mouseenter", () => { active = i; highlight(); });
      list.appendChild(li);
    });
    open();
  };

  const highlight = () => {
    Array.from(list.children).forEach((li, i) => {
      li.style.background = i === active ? "var(--of-green-wash,#eef6ee)" : "";
    });
    const el = list.children[active];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  };

  const open = () => { list.style.display = "block"; input.setAttribute("aria-expanded", "true"); };
  const close = () => { list.style.display = "none"; input.setAttribute("aria-expanded", "false"); active = -1; };

  input.addEventListener("focus", () => { active = -1; render(filter(input.value)); });
  input.addEventListener("input", () => { active = -1; render(filter(input.value)); });
  input.addEventListener("keydown", (e) => {
    const items = Array.from(list.querySelectorAll("li[data-name]"));
    if (e.key === "ArrowDown") { e.preventDefault(); if (list.style.display === "none") render(filter(input.value)); active = Math.min(active + 1, items.length - 1); highlight(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); highlight(); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && items[active]) choose(items[active].dataset.name); }
    else if (e.key === "Escape") { close(); }
  });
  // Clicking away closes; if the text isn't a valid Odù, restore the last valid.
  document.addEventListener("click", (e) => {
    if (!document.getElementById("mainCastCombo")?.contains(e.target)) {
      close();
      if (input.value !== select.value) input.value = select.value || "";
    }
  });
}

const populateDropdowns = async () => {
  try {
    const mainCastDropdown = document.getElementById("mainCast");
    populateDropdown(mainCastDropdown, allOdus.map(odu => odu.name));
    // No silent default: prepend an empty option and select it, so the Odù
    // field starts genuinely unset (matching the empty combobox placeholder)
    // rather than auto-selecting Ejiogbe. A reading requires a real choice.
    const blankOpt = document.createElement("option");
    blankOpt.value = "";
    blankOpt.textContent = "";
    mainCastDropdown.insertBefore(blankOpt, mainCastDropdown.firstChild);
    mainCastDropdown.value = "";
    initOduCombobox();
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
    // Render the opele FIRST — it's drawn purely from local baseOdus and needs
    // no network, so it must never wait on (or be blocked by) the dropdown
    // fetches below. This keeps the cast visual instant and offline-perfect.
    displayConfiguration(selectedOdu);
    try {
      await Promise.all([updateSpecificOrientation(), updateSolutionDetails()]);
    } catch (_) { /* offline: dropdowns update later; opele already rendered */ }
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

  // No Odù chosen yet — the field starts empty by design. Prompt for a real
  // selection rather than silently reading a phantom default.
  if (!mainCast) {
    const search = document.getElementById("mainCastSearch");
    if (resultElement) {
      resultElement.innerHTML =
        "<p style='color:#0c3d24;font-size:14px;text-align:center;padding:10px;'>" +
        "Please choose an Odù to reveal its wisdom — type to search the 256 Odù, or cast with the opèlè." +
        "</p>";
    }
    if (search) { try { search.focus(); } catch (e) {} }
    return;
  }

  showPreloader();

  try {
    const feedbackUrl =
      `/api/feedback/get?odu=${encodeURIComponent(mainCast)}` +
      `&orientation=${encodeURIComponent(orientation)}` +
      `&spec=${encodeURIComponent(specificOrientation)}` +
      `&solution=${encodeURIComponent(solution)}` +
      `&detail=${encodeURIComponent(solutionDetails)}`;

    // Verse-based reading (step 2): composed from the VERIFIED ẹsẹ corpus.
    // Returns { hasReading:false } when no verified interpretation exists yet,
    // in which case we keep the existing oduData Message below (graceful fallback).
    const verseReadingUrl =
      `/api/verses/reading/${encodeURIComponent(mainCast)}/${encodeURIComponent(specificOrientation)}` +
      `?spec=${encodeURIComponent(specificOrientation)}` +
      `&solution=${encodeURIComponent(solution)}` +
      `&detail=${encodeURIComponent(solutionDetails)}`;

    const [oduRes, fbRes, verseRes] = await Promise.all([
      fetch(`/api/odu/${encodeURIComponent(mainCast)}`),
      fetch(feedbackUrl).catch(() => null),
      fetch(verseReadingUrl).catch(() => null)
    ]);

    if (!oduRes.ok) throw new Error("Failed to fetch Odu data");
    const oduData = await oduRes.json();

    // Verse reading, if the corpus has a verified interpretation for this cast.
    let verseReading = null;
    if (verseRes?.ok) {
      try {
        const vr = await verseRes.json();
        if (vr && vr.hasReading) verseReading = vr;
      } catch { /* fall back to Message */ }
    }

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
      Orisha: orisha, Taboo: taboo, Names: names,
      Occupation: occupation, Credit: credit,
      alias, herb, character, audioData = [], videoData = []
    } = oduData;

    // Verified Ase Ifá is surfaced within the main reading card: composeReading
    // includes verse-pending Ase Ifá records (verified interpretation, no verse
    // text) whose orientation matches the cast, so the reading shows the Ase Ifá
    // relevant to THIS cast. A separate all-orientations accordion duplicated it
    // and was removed.

    const { summaryHTML: oduSummary, characterHTML, aseHTML: oduSummaryAse } =
      getOduSummary(mainCast, orientation);

    const spiritualInsight = decodeIfaWithSpiritualContext(
      mainCast, orientation, specificOrientation, solution, solutionDetails
    );

    // Collect verse recordings in the SAME order the verses appear in the
    // reading (lead first, then supporting verses in display order), split by
    // type. Each is labelled "from the verse" to distinguish it from the Odù-
    // level blob media, and credited to whoever recorded it.
    const collectVerseMedia = (kind) => {
      if (!verseReading) return [];
      const out = [];
      const push = (r) => {
        const items = Array.isArray(r?.media) ? r.media : [];
        for (const m of items) {
          if (m && m.url && (m.type === kind)) out.push({ url: m.url, author: m.author || "", fromVerse: true });
        }
      };
      if (verseReading.lead) push(verseReading.lead);
      for (const r of (verseReading.others || [])) push(r);
      return out;
    };
    const verseAudio = collectVerseMedia("audio");
    const verseVideo = collectVerseMedia("video");

    // Verse recordings render first (top), then the Odù-level blob media below.
    const generateAllMedia = () =>
      generateMediaLinks(verseAudio,    "audio", "openAudioModal", "🎧", `<span data-translate>Listen to the verse recording</span>`) +
      generateMediaLinks(coreAudioData, "audio", "openAudioModal", "🎧", `<span data-translate>Listen to Audio</span>`) +
      generateMediaLinks(audioData,     "audio", "openAudioModal", "🎧", `<span data-translate>Listen to Audio</span>`) +
      "<hr/>" +
      generateMediaLinks(verseVideo,    "video", "openVideoModal", "🎥", `<span data-translate>Watch the verse recording</span>`) +
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
        <div class="ori-reading-card" style="background:var(--of-paper,#fffef9);border:1px solid var(--of-line,#dce8dc);border-radius:16px;overflow:hidden;box-shadow:0 3px 14px rgba(10,60,40,.10);margin-bottom:14px;">
          <div class="ori-reading-head">
            <div class="ori-reading-eyebrow" data-translate>· The Odù Speaks ·</div>
            <div class="ori-reading-title">${mainCast}</div>
            <div class="ori-reading-sub" style="font-family:system-ui,-apple-system,sans-serif;font-style:normal;letter-spacing:.02em;">${orientationText} (${specificOrientation}) &middot; ${solution} ${solutionDetails}</div>
          </div>
          <div class="ori-reading-body" style="padding:18px 20px 20px;">
            ${verseReading ? _verseReadingHTML(verseReading, solutionInfo) : `<p class="ori-section-text" data-translate>${rawMessage} ${solutionInfo}</p>`}
            ${(Array.isArray(coreMessage) ? coreMessage.length : (coreMessage && String(coreMessage).trim()))
              ? `<div class="ori-core-message" data-translate>${Array.isArray(coreMessage) ? coreMessage.map(m => `<p>${m}</p>`).join("") : `<p>${coreMessage}</p>`}</div>`
              : ""}
          </div>
        </div>
      `);

      /* ═══════════════════════════════════════════════════════════
         Reading structure (three-tier, after the content-unification):
           Tier 1 — the reading itself (verse or Message baseline) — above.
           Tier 2 — Words of Ifá / verified Ase Ifá (sacred supporting text).
           Tier 3 — the Odù's nature (character/summary from ifaFigures).
           Then — reference correspondences, media, deeper insight, credits.
         The ifaFigures character/summary is now its OWN tier, no longer nested
         under (and hidden with) the Ase Ifá section — so it shows whether or
         not verified Ase Ifá exists.
         ═══════════════════════════════════════════════════════════ */

      /* ── Tier 2 was a separate "Ase Ifá" accordion. Removed: verified
         Ase Ifá / interpretations are already surfaced in the main reading
         card above (the first result div), so a separate section duplicated it.
         The interpretive core (coreMessage) is folded into that card too. ── */


      /* ── Tier 3 · The Odù's nature — character + line-by-line meaning ──
         From ifaFigures (a separate, always-available dataset). Previously this
         was buried inside the Ase Ifá "Read more", so it vanished whenever there
         was no verified Ase Ifá. It now stands as its own section, always shown
         when the figure data exists. */
      if (characterHTML || oduSummaryAse) {
        const natureBody = `
          ${characterHTML ? `<div class="odu-nature__character" data-translate>${characterHTML}</div>` : ""}
          ${(characterHTML && oduSummaryAse) ? `<hr style="border:none;border-top:1px solid var(--of-line,rgba(20,40,30,.12));margin:12px 0;">` : ""}
          ${oduSummaryAse ? `<div class="odu-nature__summary" data-translate>${oduSummaryAse}</div>` : ""}
        `;
        parts.push(_acc(
          `The nature of ọmọ ${mainCast} ${tip("The character and disposition of those born under this Odù, and the line-by-line meaning of its marks.")}`,
          natureBody, false
        ));
      }

      /* ── Reference · Odù correspondences (from OduReference) ── */
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

      /* ── Media — collapsed ── */
      const mediaHTML = generateAllMedia();
      if (coreAudioData.length || audioData.length || coreVideoData.length || videoData.length || verseAudio.length || verseVideo.length) {
        parts.push(_acc("Audio & Video", mediaHTML, false));
      }

      /* ── Deeper insight — the marks decoded line by line — collapsed ── */
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

      // The reading is rendered dynamically here — translate it into the seeker's
      // language explicitly, so the whole result (verse, interpretation, labels)
      // is localised rather than relying on the passive observer catching it.
      if (window.translateDynamicContent) {
        try { window.translateDynamicContent(resultElement); } catch {}
      }

      /* Download / Share the reading as a branded PDF */
      if (window.orirunExport) {
        window.orirunExport.attachBar({
          key: "divination",
          sourceEl: resultElement,
          title: `${mainCast}`,
          subtitle: `${orientationText} (${specificOrientation}), ${solution} ${solutionDetails}`,
          filename: `orirun-${mainCast}-reading`.toLowerCase(),
          includeConfig: true
        });
      }

      renderFeedbackSection("Divination", {
        oduName: mainCast, orientationText: orientation,
        specificOrientation, solution, solutionDetails, hasAccess: true,
        // Step 5: attach the verse that led this reading, so feedback attaches
        // to the specific interpretation shown — letting rank improve per verse
        // over time. Absent when the reading fell back to the placeholder Message.
        verseId: verseReading?.lead?.verseId || null
      }, resultElement);

      logSilently("/api/divination/log", {
        oduName: mainCast, orientationText, specificOrientation, solution, solutionDetails
      });
      const syncToken = localStorage.getItem("syncToken");

      logSilently("/api/history/save", {
        deviceId, syncToken, type: "divination", mainCast, orientation: orientationText,
        specificOrientation, solution, solutionDetails,
        message: rawMessage, summary: spiritualInsight, timestamp: Date.now(),
        // Carry the verse that led the reading, so the history "did this bear
        // fruit?" outcome prompt can attach the signal to the right verse.
        verseId: verseReading?.lead?.verseId || null
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
    // Covers both branches above (full reading OR the paywall prompt) — ensure
    // whichever rendered is shown in the seeker's language.
    if (window.translateDynamicContent) {
      try { window.translateDynamicContent(resultElement); } catch {}
    }
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
    if (window.translateDynamicContent) { try { window.translateDynamicContent(resultElement); } catch {} }
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
    _oduBinaryHTML(oduName),
    (() => {
      const num = _oduNumerology(oduName);
      const n = (num === null) ? numerology : num; // fallback to index-based if unresolved
      return `<br/><p><a style="cursor:pointer;" class="btn btn-sm"
       onclick="displayMeaning(${n})">Numerology: ${_numerologyLabel(n)}</a></p>`;
    })()
  );

  const html = parts.join("");
  container.innerHTML = html;
  oduRenderCache[oduName] = html;

  requestIdleCallback(() => {
    container.querySelectorAll("img").forEach(img => { new Image().src = img.src; });
  });
};

async function _oriBoot() {
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

}

// Boot on DOMContentLoaded instead of window.onload: reveal + setup no longer
// wait for every image and late resource. main.js is a deferred script, so
// DOMContentLoaded is guaranteed to fire AFTER it (and after translation.js,
// which defines LANGUAGES) — never run _oriBoot synchronously here, or it would
// execute mid-defer-chain before its dependencies exist.
document.addEventListener("DOMContentLoaded", _oriBoot);

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

  /* Center target: the image the numbers rotate around is now tappable and
     reveals the 0 reading (Ọ̀yẹ̀kú's void / infinite potential). Sits at dead
     centre, so the container's slow rotation spins it in place invisibly. */
  const center = document.createElement("button");
  center.className        = "calc-center";
  center.dataset.number   = 0;
  center.setAttribute("aria-label", "Reveal the meaning of zero");
  center.onclick = function () {
    if (!canClick) return;
    this.classList.add("clicked");
    displayMeaning(0);
    setTimeout(generateCircularButtons, 1000);
  };
  frag.appendChild(center);

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
      <div class="ori-reading-card" style="background:var(--of-paper,#fffef9);border:1px solid var(--of-line,#dce8dc);border-radius:16px;overflow:hidden;box-shadow:0 3px 14px rgba(10,60,40,.10);margin-bottom:14px;">
        <div class="ori-reading-head">
          <div class="ori-reading-eyebrow" data-translate>· Sacred Number ·</div>
          <div class="ori-reading-title"><span data-translate>Energy ${number} - ${label}</span></div>
        </div>
        <div class="ori-reading-body" style="padding:18px 20px 20px;">
          <p class="ori-section-text">${data.meaning || "No meaning found."}</p>
          <p style="font-style:italic;font-size:0.85em;color:var(--of-ink-soft);text-align:center;margin-top:14px;" data-translate>
            This content is inspired by collective scholarly works and community-preserved teachings,
            shared for educational purposes only.
          </p>
        </div>
      </div>`;

    if (window.translateDynamicContent) { try { window.translateDynamicContent(resultEl); } catch {} }

    _dedupeSectionHeadings(resultEl);

    configEl.innerHTML = `<img class="moving-bg" src="public/img/bird.gif" alt="bird" width="168" height="159" loading="lazy" decoding="async" />`;

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
          <span ${window._aiWroteInLanguage ? "" : "data-translate"}>${formatResponseAsHTML(body)}</span>
        </div>
      </div>`;
  }).join("");
}


async function getEnergyInterpretation(payload) {

// Build the pinnacle arc as past/present/future chapters for the prompt.
// pinnaclePhases is the full four-chapter array already computed upstream;
// we mark each relative to the current one so the reading can speak in the
// right tense for each. Falls back silently if phases are unavailable.
function buildPinnacleArc(phases, currentNumber, age) {
  if (!Array.isArray(phases) || !phases.length) return "";
  const lines = phases.map((p) => {
    const [start, end] = String(p.ageRange).split("–").map(Number);
    let status = "future (not yet entered)";
    if (age != null && !isNaN(start)) {
      if (age > (end || Infinity)) status = "past (already lived)";
      else if (age >= start && age <= (end || Infinity)) status = "PRESENT (living now)";
    }
    const meaning = p.pinnacleMeaning ? ` — ${p.pinnacleMeaning}` : "";
    const chal = p.challengeMeaning ? `; challenge: ${p.challengeMeaning}` : "";
    return `- Ages ${p.ageRange}: ${status}${meaning}${chal}`;
  });
  return lines.join("\n");
}
const pinnacleArc = buildPinnacleArc(payload.pinnaclePhases, payload.pinnacleNumber, payload.age);

// Language-aware generation: when the seeker is reading in a non-English
// language, ask the model to WRITE the reading directly in that language. This
// is faster and higher-quality than generating English then translating it —
// and the render path skips re-translating this block (it arrives already
// localised). Section TITLES stay in a fixed form the UI translates separately.
const _dgLang = (typeof currentLang !== "undefined") ? currentLang : "en";
const _dgLangName = (typeof _langName === "function") ? _langName(_dgLang) : "English";
const _writeInLanguage = (_dgLang && _dgLang !== "en" && _dgLang !== "baseline")
  ? `\n\nIMPORTANT — LANGUAGE:\nWrite the ENTIRE reading in ${_dgLangName}. Every sentence of the body must be in ${_dgLangName}, natural and fluent, not translated word-for-word. Keep the section header lines (the ones starting with 1️⃣, 2️⃣, etc.) EXACTLY as given in the structure below — do not translate those header labels. Only the sentences under each header are in ${_dgLangName}.`
  : "";
// Remember whether this reading was generated already-localised, so the render
// path can skip re-translating the AI prose (the static labels still translate).
window._aiWroteInLanguage = !!_writeInLanguage;

const prompt = `
Interpret this life chart using African spiritual wisdom, with Yoruba cosmology as the primary lens.

Speak as an elder who observes patterns clearly.
Speak as if this wisdom is already true and settled — never hedge or justify it.
When you use a Yorùbá term (Òrì, Orí, Àṣẹ, Orisha), let its meaning show through how you use it in the sentence, so any reader anywhere feels it — without stopping to define it like a textbook.

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
- Challenge: ${payload.challengeNumber}
- Year: ${payload.year}, Month: ${payload.month}, Week: ${payload.week}, Day: ${payload.day}

PINNACLE ARC — the life-chapters, past to future${pinnacleArc ? `
${pinnacleArc}` : `
- Pinnacle: ${payload.pinnacleNumber}`}

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
- Write for a person who may be meeting Yorùbá wisdom for the first time, yet never talk down. The reading should feel equally true to an elder in Yorùbáland and a seeker across the world.

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

7️⃣ The Chapter You Are Living
- Speak the arc of life-chapters in three voices, but keep the PRESENT dominant (most of the words go here).
- PAST chapters (already lived): speak with the certainty of hindsight — name what they shaped in you, what they asked and how it marked you. Never guess at events; speak to the pattern they built.
- PRESENT chapter (the one whose ages you are now within): this is the heart of the section. Name its opportunity and its tension. Then say plainly: act, wait, adjust, or observe.
- FUTURE chapter (not yet entered): speak ONLY as theme and preparation, never as prophecy or event. Say what it will ask of you and how the present readies you for it. Never predict what will happen. Never name gain or loss as fixed.
- Do not turn this into a list or timeline. It must read as one flowing passage, elder to seeker.

8️⃣ Guidance of Òrì
- Direct, practical guidance for habits, decisions, and mindset now.
- Stay grounded and clear to the end — never motivational.

FINAL LINE:
- After the eight sections, add one short sentence on its own, exposing a real pattern this person has already lived through.

Do not rush. Speak as one who has seen this life before.
${_writeInLanguage}
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
  configurationElement.innerHTML = `<img class="moving-bg" src="public/img/bird.gif" alt="bird" width="168" height="159" loading="lazy" decoding="async" />`;

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

    /* Kick off the AI interpretation IMMEDIATELY — the moment its inputs are
       ready — so it runs in parallel with all the DOM building below instead
       of starting only after the page is assembled. This meaningfully shortens
       (often removes) the second "being prepared" wait. */
    const _aiInterpretationPromise = getEnergyInterpretation({
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
    });

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
            <span data-translate>${title}</span>
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

    /* Sections read open and flowing (a reading is read top-to-bottom, not
       clicked open one at a time). The first section carries the deep-green
       rule; the rest use the softer sage rule for a quiet hierarchy. */
    const secClass = idx === 0 ? "ori-section" : "ori-section ori-section-2";

    return `
      <div class="${secClass}">
        <div class="ori-section-head">
          <span class="ori-section-rule"></span>
          <span class="ori-section-label" data-translate>${displayTitle}</span>
        </div>
        <p class="ori-section-text" ${window._aiWroteInLanguage ? "" : "data-translate"}>${formatResponseAsHTML(body || heading)}</p>
      </div>`;
  }).filter(Boolean).join("");
}

    const parts = [];

    /* 🧿 Voice of Òrì — PRIMARY EXPERIENCE */
    const _oriName = (fullName || "").trim().split(/\s+/)[0] || "";
    const oriFirst = _oriName ? _oriName.charAt(0).toUpperCase() + _oriName.slice(1) : "";
    parts.push(`
      <div class="ori-reading-card" style="background:var(--of-paper,#fffef9);border:1px solid var(--of-line,#dce8dc);border-radius:16px;overflow:hidden;box-shadow:0 3px 14px rgba(10,60,40,.10);margin-bottom:14px;">

        <div class="ori-reading-head">
          <div class="ori-reading-eyebrow" data-translate>· The Voice of Your Òrì ·</div>
          <div class="ori-reading-title">${oriFirst ? oriFirst + " \u2014 " : ""}<span data-translate>the inner head speaks</span></div>
          <div class="ori-reading-sub" data-translate>${oriFirst ? oriFirst + "\u2019s reading from name & birth date" : "Your reading from name & birth date"}</div>
        </div>

        <div class="ori-reading-body">
          <div id="ori-voice-slot" style="min-height:60px;">
            <div style="display:flex;align-items:center;gap:9px;color:var(--of-green);margin-bottom:14px;">
              <span class="spinner" style="width:16px;height:16px;flex-shrink:0;"></span>
              <em style="font-size:13.5px;" data-translate>Your Òrì is composing this reading…</em>
            </div>
            <div class="ori-skel" style="height:11px;width:92%;border-radius:6px;margin:11px 0;"></div>
            <div class="ori-skel" style="height:11px;width:85%;border-radius:6px;margin:11px 0;"></div>
            <div class="ori-skel" style="height:11px;width:96%;border-radius:6px;margin:11px 0;"></div>
            <div class="ori-skel" style="height:11px;width:70%;border-radius:6px;margin:11px 0;"></div>
          </div>
        </div>

        <div style="padding:6px 20px 20px;">
          <button id="energy-toggle-btn" onclick="toggleEnergyBreakdown(this)"
            style="display:none;width:100%;padding:12px;border:1px dashed #cbdccb;background:transparent;color:var(--of-green-deep,#0a5a2c);border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;align-items:center;justify-content:center;gap:8px;transition:background .2s,border-color .2s;">
            <span class="etoggle-label" data-translate>Show the numbers behind this reading</span>
            <span class="etoggle-caret" style="display:inline-block;transition:transform .25s;">▾</span>
          </button>
          <div id="energy-breakdown" style="display:none;margin-top:12px;padding:14px;background:#f7fcf7;border:1px solid var(--of-line,#e0efe0);border-radius:10px;font-size:13px;line-height:1.6;"></div>
        </div>

      </div>
    `);


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

    // Translate the freshly-rendered chart card (labels, headings, toggles) into
    // the seeker's language right away — before the AI reading arrives — so no
    // part of the result flashes or lingers in English.
    if (window.translateDynamicContent) {
      try { window.translateDynamicContent(resultElement); } catch {}
    }

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

    /* AI interpretation — already in flight (started right after the data
       arrived, above). We just attach the render here. */
    _aiInterpretationPromise.then((aiInterpretation) => {
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
        // Reveal the deep-dive toggle now that the reading has composed and
        // the numbers behind it are ready.
        const _etBtn = document.getElementById("energy-toggle-btn");
        if (_etBtn) _etBtn.style.display = "inline-flex";
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
              _pinnacleArcSpine(pinnaclePhases, age))
          + _energyGroup("Time Flow",
              _energyRow("Personal Year",  data.vibrations?.year?.number,  "", "year")
            + _energyRow("Personal Month", data.vibrations?.month?.number, "", "month")
            + _energyRow("Personal Week",  data.vibrations?.week?.number,  "", "week")
            + _energyRow("Personal Day",   data.vibrations?.day?.number,   "", "day"));
      }
      window.scrollTo({ top: resultElement.offsetTop, behavior: "smooth" });
      // The Voice-of-Òrì reading, its accordions, and the energy breakdown are
      // rendered here dynamically (the AI arrives in this .then, well after the
      // initial page render). Explicitly translate the whole result container so
      // a non-English seeker sees it in their language — the passive observer
      // alone doesn't reliably catch this multi-stage async render.
      if (window.translateDynamicContent) {
        try {
          window.translateDynamicContent(document.getElementById("ori-voice-slot"));
          const _bd = document.getElementById("energy-breakdown");
          if (_bd) window.translateDynamicContent(_bd);
          if (resultElement) window.translateDynamicContent(resultElement);
        } catch {}
      }
    }).catch(() => {
      const slot = document.getElementById("ori-voice-slot");
      if (slot) slot.innerHTML =
        `<em style="color:var(--of-muted);" data-translate>The spiritual interpretation could not be generated at this moment. Please try again later.</em>`;
      if (slot && window.translateDynamicContent) { try { window.translateDynamicContent(slot); } catch {} }
      // If the breakdown numbers did get populated before the failure,
      // still let the user open them; otherwise leave the toggle hidden.
      const _etBtn = document.getElementById("energy-toggle-btn");
      const _bd = document.getElementById("energy-breakdown");
      if (_etBtn && _bd && _bd.innerHTML.trim()) {
        _etBtn.style.display = "inline-flex";
      }
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

/* Pinnacle arc-spine: a slim row of the four life-chapters with the current
   one lit, ages beneath. A "you are here" map, not four cards of content —
   the reading carries the meaning; this only orients the person on the path.
   Each node is tappable: it reveals that chapter's pinnacle + challenge
   meaning in a shared panel below, so a person can look back at chapters
   lived and ahead at the one coming, without four cards cluttering the view. */
function _pinnacleArcSpine(phases, age) {
  if (!Array.isArray(phases) || !phases.length) return "";
  const gid = "parc-" + Math.random().toString(36).slice(2, 7);
  let presentIdx = -1;

  const meta = phases.map((p, i) => {
    const [start, end] = String(p.ageRange).split("\u2013").map(Number);
    let state = "future";
    if (age != null && !isNaN(start)) {
      if (age > (end || Infinity)) state = "past";
      else if (age >= start && age <= (end || Infinity)) { state = "present"; presentIdx = i; }
    }
    return { p, i, state };
  });

  // Detail text per chapter: pinnacle meaning + challenge meaning, framed by
  // whether the chapter is lived, current, or coming. Each shows its own
  // number badge, so clicking a chapter updates the pinnacle AND challenge.
  const badge = (num) => {
    const b = (num || num === 0) ? num : "\u2013";
    return `<div style="flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#0f7b3d,#0a5a2c);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${b}</div>`;
  };
  const detailRow = (title, num, meaning) =>
      `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-top:1px solid #e3efe7;">`
    +   badge(num)
    +   `<div style="flex:1 1 auto;min-width:0;">`
    +     `<div style="font-weight:600;color:#1b4332;font-size:13px;" data-translate>${title}</div>`
    +     (meaning ? `<div style="font-size:12.5px;line-height:1.5;color:var(--of-ink);margin-top:3px;" data-translate>${meaning}</div>` : "")
    +   `</div>`
    + `</div>`;

  const details = meta.map(({ p, i, state }) => {
    const pin = energyMeaning("pinnacle", p.pinnacleNumber);
    const cha = energyMeaning("challenge", p.challengeNumber);
    const frame = state === "past"
        ? "A chapter you have already lived."
      : state === "present"
        ? "The chapter you are living now."
        : "A chapter still ahead of you.";
    return `<div id="${gid}-d${i}" class="parc-detail" style="display:${i === presentIdx ? "block" : "none"};">`
      + `<div style="font-size:12px;font-weight:700;color:#0a5a2c;margin-bottom:2px;" data-translate>Ages ${p.ageRange}</div>`
      + `<div style="font-size:12px;color:var(--of-ink-soft);font-style:italic;margin-bottom:4px;" data-translate>${frame}</div>`
      + detailRow("Pinnacle", p.pinnacleNumber, pin)
      + detailRow("Challenge", p.challengeNumber, cha)
      + `</div>`;
  }).join("");

  const nodes = meta.map(({ p, state, i }) => {
    const isNow = state === "present";
    const dot = isNow ? "#0f7b3d" : (state === "past" ? "#9cc4a8" : "#d4e6d8");
    const ring = isNow ? "box-shadow:0 0 0 4px rgba(15,123,61,.15);" : "";
    const num = (p.pinnacleNumber || p.pinnacleNumber === 0) ? p.pinnacleNumber : "\u2013";
    const txtColor = isNow ? "#0a5a2c" : "var(--of-ink-soft)";
    const weight = isNow ? "700" : "500";
    // Clicking selects this chapter: show its detail, hide others, lift its node.
    const onclick =
      `var g='${gid}';` +
      `document.querySelectorAll('#'+g+' .parc-node').forEach(function(n){n.style.outline='none';});` +
      `document.querySelectorAll('#'+g+' .parc-detail').forEach(function(d){d.style.display='none';});` +
      `var d=document.getElementById(g+'-d${i}'); if(d) d.style.display='block';` +
      `this.querySelector('.parc-node').style.outline='2px solid #0f7b3d';` +
      `this.querySelector('.parc-node').style.outlineOffset='2px';`;
    return `<div role="button" tabindex="0" aria-label="Chapter, ages ${p.ageRange}" onclick="${onclick}" `
      + `onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}" `
      + `style="flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;min-width:0;cursor:pointer;">`
      + `<div class="parc-node" style="width:${isNow ? 30 : 22}px;height:${isNow ? 30 : 22}px;border-radius:50%;background:${dot};${ring}${i === presentIdx ? "outline:2px solid #0f7b3d;outline-offset:2px;" : ""}display:flex;align-items:center;justify-content:center;color:${isNow ? "#fff" : "#3a5c47"};font-weight:700;font-size:${isNow ? 13 : 11}px;">${num}</div>`
      + `<div style="font-size:10.5px;color:${txtColor};font-weight:${weight};white-space:nowrap;">${p.ageRange}</div>`
      + (isNow ? `<div style="font-size:9.5px;color:#0f7b3d;font-weight:700;text-transform:uppercase;letter-spacing:.04em;" data-translate>now</div>` : "")
      + `</div>`;
  }).join(`<div style="flex:0 0 auto;height:2px;width:14px;background:#d4e6d8;margin-top:11px;"></div>`);

  return `<div id="${gid}">`
    + `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:2px;padding:12px 2px 6px;">${nodes}</div>`
    + `<div style="font-size:11px;color:var(--of-ink-soft);text-align:center;padding-bottom:8px;" data-translate>Tap any chapter to look back or ahead. You are in the lit one.</div>`
    + `<div style="background:#f6faf6;border:1px solid #e3efe7;border-radius:8px;padding:10px 12px;">${details}</div>`
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
    if (lbl) lbl.textContent = opening ? "Hide the numbers" : "Show the numbers behind this reading";
    if (car) car.style.transform = opening ? "rotate(180deg)" : "rotate(0deg)";
    // Solidify the toggle when open so it reads as an active section header.
    b.style.background  = opening ? "#eef7ef" : "transparent";
    b.style.borderStyle = opening ? "solid" : "dashed";
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

    // Lived-outcome prompt — the strongest learning signal. Ask, on a PAST
    // reading, whether it bore fruit. Only for divination entries that carry the
    // verse that led the reading and haven't been answered yet. Once answered,
    // show the recorded outcome instead of re-asking.
    const _vid = entry.verseId || entry.lead?.verseId || "";
    let outcomeBlock = "";
    if (_vid && (entry.mainCast) ) {
      if (entry.outcomeAnswered) {
        const label = entry.outcome === "yes" ? "This reading has come to pass ✓" : "This reading has not yet come to pass";
        outcomeBlock = `<div class="history-outcome answered" style="margin-top:8px;font-size:12px;color:var(--of-ink-soft,#7a8a80);" data-translate>${label}</div>`;
      } else {
        outcomeBlock = `
          <div class="history-outcome" style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--of-line,#e6efe4);"
               data-vid="${_vid}" data-odu="${entry.mainCast || ""}" data-ori="${entry.specificOrientation || ""}" data-hid="${entryId}">
            <div style="font-size:12px;color:var(--of-ink-soft,#7a8a80);margin-bottom:6px;" data-translate>Has this reading come to pass?</div>
            <button type="button" class="outcome-btn" data-val="yes" style="margin-right:6px;padding:5px 12px;border:1px solid var(--of-line,#e6efe4);border-radius:6px;background:#fff;cursor:pointer;font-size:12px;" data-translate>Yes, it did</button>
            <button type="button" class="outcome-btn" data-val="no" style="padding:5px 12px;border:1px solid var(--of-line,#e6efe4);border-radius:6px;background:#fff;cursor:pointer;font-size:12px;" data-translate>Not yet</button>
          </div>`;
      }
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
        ${outcomeBlock}
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
  if (window.translateDynamicContent && historyListEl) {
    try { window.translateDynamicContent(historyListEl); } catch {}
  }
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