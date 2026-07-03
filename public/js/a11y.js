/* ==================================================================
   ORÍRÙN — Global Standards layer (a11y.js)
   Companion to a11y-global.css. Additive and reversible: remove the
   <script> tag and the app behaves exactly as before.

   What it does (and nothing more):
   1. Injects a skip-to-content link targeting #app-main.
   2. Gives unnamed controls accessible names (language select,
      chatbot toggle, history button, hidden decorative bird).
   3. Keeps aria-expanded in sync on the generated accordions, so
      screen readers announce open/closed state.
   4. Tags Yorùbá liturgical content with lang="yo", so screen
      readers pronounce àṣẹ verses with Yorùbá phonology instead of
      mangling them as English.
   5. Lets Escape close the informational modals.
   ================================================================== */
(function () {
  "use strict";

  function onReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* ── 1. Skip link ── */
  onReady(function () {
    if (document.querySelector(".skip-link")) return;
    var main = document.getElementById("app-main");
    if (!main) return;
    main.setAttribute("tabindex", "-1"); // focus target
    var a = document.createElement("a");
    a.className = "skip-link";
    a.href = "#app-main";
    a.textContent = "Skip to content";
    a.addEventListener("click", function () { main.focus(); });
    document.body.insertBefore(a, document.body.firstChild);
  });

  /* ── 2. Accessible names ── */
  onReady(function () {
    var langSelect = document.getElementById("language-select");
    if (langSelect && !langSelect.getAttribute("aria-label")) {
      langSelect.setAttribute("aria-label", "Language");
    }
    var chatToggle = document.getElementById("chatbot-toggle");
    if (chatToggle && !chatToggle.getAttribute("aria-label")) {
      chatToggle.setAttribute("aria-label", "Open Ifá chat assistant");
    }
    var chatInput = document.getElementById("chatbot-input");
    if (chatInput && !chatInput.getAttribute("aria-label")) {
      chatInput.setAttribute("aria-label", "Message the Ifá assistant");
    }
    var bird = document.getElementById("hiddenTapArea");
    if (bird) bird.setAttribute("aria-hidden", "true"); // decorative
    document.querySelectorAll(".historyBtn").forEach(function (b) {
      if (!b.getAttribute("aria-label")) b.setAttribute("aria-label", "Show or hide reading history");
    });
  });

  /* ── 3. Accordion state for screen readers ──
     The reading accordions are generated with inline onclick handlers
     that toggle a sibling panel's display. Inline handlers run before
     this delegated listener, so by the time we read the panel its new
     state is final. Initial state is set on insertion (observer). */
  function syncAccordion(btn) {
    var panel = null;
    // Generated markup: button.acc-header followed by the panel div,
    // or an onclick that targets a div by id.
    var onclick = btn.getAttribute("onclick") || "";
    var idMatch = onclick.match(/getElementById\('([^']+)'\)/);
    if (idMatch) panel = document.getElementById(idMatch[1]);
    if (!panel && btn.nextElementSibling) panel = btn.nextElementSibling;
    if (!panel) return;
    var open = panel.style.display !== "none";
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".acc-header, button");
    if (!btn) return;
    if (btn.classList.contains("acc-header") || btn.querySelector(".acc-arrow")) {
      // allow the inline toggle to finish in this tick
      setTimeout(function () { syncAccordion(btn); }, 0);
    }
  });

  /* ── 4. Yorùbá language tagging + initial accordion state,
          applied to dynamically inserted reading content ── */
  function enhanceWithin(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(".ase-verse, #extraAse").forEach(function (el) {
      if (!el.getAttribute("lang")) el.setAttribute("lang", "yo");
    });
    root.querySelectorAll(".acc-header").forEach(function (btn) {
      if (!btn.hasAttribute("aria-expanded")) syncAccordion(btn);
    });
  }

  onReady(function () {
    enhanceWithin(document);
    var watched = ["divinationResult", "result", "divinationResultContainer"];
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes && m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1) enhanceWithin(n);
        });
      });
    });
    watched.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el, { childList: true, subtree: true });
    });
  });

  /* ── 5. Escape closes informational modals ──
     Scoped to the safe set; the payment modal is deliberately excluded
     so a stray keypress cannot interrupt a transaction. */
  var ESCAPABLE = ["aboutModal", "contributionModal", "audioModal"];
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    ESCAPABLE.forEach(function (id) {
      var m = document.getElementById(id);
      if (m && m.style.display && m.style.display !== "none") {
        m.style.display = "none";
      }
    });
  });
})();
