/**
 * Orírùn — First-Time User Onboarding Tour
 * ─────────────────────────────────────────
 * Based on stable v1 code.
 * Changes made:
 *  1. wrapFieldsForTour() — wraps each label + its input/select
 *     into one div so Driver.js highlights both together.
 *     Affects: Odu Ifa, Orientation, Specific Orientation,
 *              Solution, Specific Solution, Full Name box,
 *              Pick a Number calculator.
 *  2. Tour steps updated to target the new wrapper IDs.
 *  3. Boot delay increased: waits for #divination-btn to
 *     exist, then waits a further 2.5 s before showing the
 *     modal so the page is fully settled.
 */

document.addEventListener("DOMContentLoaded", function () {

  /* ═══════════════════════════════════════════════════════
   *  0. CONSTANTS & HELPERS
   * ═══════════════════════════════════════════════════════ */
  var TOUR_KEY  = "orirun_tour_v2";
  var isMobile  = window.innerWidth <= 767;
  var isTablet  = window.innerWidth >= 768 && window.innerWidth <= 1024;
  var isDesktop = window.innerWidth >= 1025;

  function pos(desktopSide) {
    if (isMobile) return "bottom";
    if (isTablet) return "bottom";
    return desktopSide || "right";
  }

  /**
   * Position for right-edge fixed elements (#chatbot-toggle,
   * .historyBtn).
   *   mobile/tablet → "bottom-right": popover sits below the
   *     element, arrow on the RIGHT side of the card, so the
   *     card body extends leftward into the visible viewport.
   *   desktop       → "left": popover sits to the left of the
   *     element (they are on the right edge so this is fine).
   */
  function posLeft() {
    return "bottom";  // ← always centred below, works on every screen size
  }

  function posRight1() {
    if (isMobile || isTablet) return "bottom-right";
    return "left";
  }

  function posRight2() {
    if (isMobile || isTablet) return "top-right";
    return "top-right";
  }
  
  function el(selector) {
    return document.querySelector(selector);
  }

  function waitFor(selector, timeout) {
    timeout = timeout || 4000;
    return new Promise(function (resolve) {
      var deadline = Date.now() + timeout;
      (function check() {
        var node = el(selector);
        if (node) return resolve(node);
        if (Date.now() > deadline) return resolve(null);
        setTimeout(check, 120);
      })();
    });
  }

  /* ── i18n: translate tour text through the shared translation engine ── */
  function tourLang() {
    return (typeof currentLang !== "undefined") ? currentLang : "baseline";
  }
  function tourTranslatable() {
    var l = tourLang();
    return l && l !== "baseline" && l !== "en" && typeof translateWithCache === "function";
  }
  async function tr(text) {
    if (!text || !tourTranslatable()) return text;
    try { return await translateWithCache(text, tourLang()); }
    catch (e) { return text; }
  }
  // Translate many strings with limited concurrency; returns {original: translated}.
  async function translateMany(strings, concurrency) {
    concurrency = concurrency || 4;
    var uniq = Array.from(new Set(strings.filter(Boolean)));
    var map = {}, i = 0;
    async function worker() {
      while (i < uniq.length) { var idx = i++; map[uniq[idx]] = await tr(uniq[idx]); }
    }
    var workers = [], n = Math.min(concurrency, uniq.length);
    for (var w = 0; w < n; w++) workers.push(worker());
    await Promise.all(workers);
    return map;
  }

  /* ═══════════════════════════════════════════════════════
   *  1. LABEL WRAPPERS
   *     For each input/select, grab the label element that
   *     sits immediately before it and wrap both together
   *     in a single <div>.  Driver.js then highlights the
   *     wrapper, so the user sees the label AND the control.
   * ═══════════════════════════════════════════════════════ */

  /**
   * Wraps anchorEl and its immediately preceding sibling
   * (the label div/element) inside a new <div id=wrapperId>.
   * Safe to call multiple times — skips if already wrapped.
   */
  function wrapWithLabel(wrapperId, anchorEl) {
    if (!anchorEl) return;
    if (document.getElementById(wrapperId)) return; // already done

    var labelEl = anchorEl.previousElementSibling;
    if (!labelEl) return;

    var wrapper = document.createElement("div");
    wrapper.id = wrapperId;

    /* Insert wrapper exactly where the label currently sits */
    anchorEl.parentNode.insertBefore(wrapper, labelEl);
    wrapper.appendChild(labelEl);
    wrapper.appendChild(anchorEl);

    /* Absorb any trailing <br> so page layout stays intact */
    var next = wrapper.nextSibling;
    if (next && next.nodeName === "BR") wrapper.appendChild(next);
  }

  function wrapFieldsForTour() {
    /* Divination selects — label-div sits directly before each <select> */
    wrapWithLabel("tour-g-maincast",   document.getElementById("mainCast"));
    wrapWithLabel("tour-g-orient",     document.getElementById("orientation"));
    wrapWithLabel("tour-g-specorient", document.getElementById("specificOrientation"));
    wrapWithLabel("tour-g-solution",   document.getElementById("solution"));
    wrapWithLabel("tour-g-soldetail",  document.getElementById("solutionDetails"));

    /* Numerology — "Enter your full name" label sits before #fullname-box */
    wrapWithLabel("tour-g-fullname",   document.getElementById("fullname-box"));

    /* Pick a Number — the flex label-div sits before #calculator */
    wrapWithLabel("tour-g-picknum",    document.getElementById("calculator"));
  }

  /* ═══════════════════════════════════════════════════════
   *  2. TOUR STEPS
   *     Identical structure to the stable v1 code, but step
   *     elements now point to the wrapper IDs so both the
   *     label and the control are highlighted together.
   * ═══════════════════════════════════════════════════════ */
  function buildSteps() {
    var steps = [

       {
        element: ".languageBtn",
        popover: {
          title:       "Language Support",
          description: "Orírùn supports multiple languages. " +
                       "Switch language at any time using this selector.",
          position:    posLeft(),
          showButtons: true
        }
      },

      {
        element: ".historyBtn",
        popover: {
          title:       "Your Divination History",
          description: "Every reading you make is saved here on your device. You can revisit it, " +
                       "add personal reflections, and track your spiritual journey over time.",
          position:    posRight1(),
          showButtons: true
        }
      },

      {
        element: "#mainCast",
        popover: {
          title:       "Choose Your Odù Ifá",
          description: "An Odù is a sacred chapter of Ifá. There are 256 in total. " +
                       "Select the one that appeared in your divination — or explore any Odù you feel drawn to.",
          position:    pos("right"),
          showButtons: true
        }
      },

      {
        element: "#orientation",
        popover: {
          title:       "Set the Orientation",
          description: "<strong>Ire</strong> — the Odù appears in a favourable alignment: blessings are available.<br/>" +
                       "<strong>Ayewo</strong> — a cautionary alignment: something needs your attention or spiritual action.",
          position:    pos("right"),
          showButtons: true
        }
      },

      {
        element: "#specificOrientation",
        popover: {
          title:       "Specific Orientation",
          description: "Narrow down exactly which area of life the Odù is speaking to — " +
                       "Longevity (Aiku), wealth (Aje), victory (Isegun), and more.",
          position:    pos("right"),
          showButtons: true
        }
      },

      {
        element: "#solution",
        popover: {
          title:       "Choose a Solution Type",
          description: "<strong>Ebo</strong> — a prescribed offering or action to activate blessings or resolve challenges.<br/>" +
                       "<strong>Adimu</strong> — a personal offering made directly to an Orisha.",
          position:    pos("right"),
          showButtons: true
        }
      },

      {
        element: "#solutionDetails",
        popover: {
          title:       "Specific Solution",
          description: "Each Ebo or Adimu type carries its own sacred items and actions " +
                       "as revealed by the Odù — for example, <em>Akoru</em>, <em>Esha</em>, <em>Adimu Ori</em> and so on.",
          position:    pos("right"),
          showButtons: true
        }
      },

      {
        element: "#divination-btn",
        popover: {
          title:       "Reveal Wisdom",
          description: "When all fields are set, click <em>Reveal Wisdom</em> to receive the message. " +
                       "The Odù's wisdom, Orisha guidance, Ebo prescription, Taboos, and spiritual insight will appear below.",
          position:    pos("bottom"),
          showButtons: true
        }
      },

      {
        element: "#fullname-box",
        popover: {
          title:       "Enter Your Full Name",
          description: "Your full name is the first half of your Yorùbá numerology chart — " +
                       "type it just as you'd like it to be read.",
          position:    pos("left"),
          showButtons: true
        }
      },

      {
        element: "#birthdate-box",
        popover: {
          title:       "Add Your Birth Date",
          description: "Your birth date completes the chart. With both in place, tap " +
                       "<em>Reveal Message</em> to generate your Life Path, Destiny, Soul Urge, and Orisha alignment.",
          position:    pos("left"),
          showButtons: true
        }
      },

      {
        element: "#calculator",
        popover: {
          title:       "Pick a Sacred Number",
          description: "Choose any number from 1–9 to instantly explore its Àṣẹ (divine energy) — " +
                       "its essence, personality traits, and spiritual associations within Yoruba wisdom.",
          position:    pos("left"),
          showButtons: true
        }
      },

      {
        element: "#chatbot-toggle",
        popover: {
          title:       "Learning Corner",
          description: "Have questions about Ifá, Orishas, or Yoruba spirituality? " +
                       "Open the Learning Corner chatbot — your interactive guide to ancestral wisdom. You can also type <b>Help</b> in the chat area to view the list of resources available.",
          position:    posRight2(),
          showButtons: true
        }
      },

      {
        element: "#tour-guidance-link",
        popover: {
          title:       "Today's Guidance",
          description: "Tap here at any time to receive your personalised daily guidance — " +
                       "rooted in your numerology, your Orisha alignment, and the energy of the current hour.",
          position:    pos("top"),
          showButtons: true
        }
      },

      // {
      //   element: ".donate-btn",
      //   popover: {
      //     title:       "Support the Project",
      //     description: "Orírùn is a free educational resource. " +
      //                  "Your support helps preserve and share Africa's ancestral wisdom with the world. " +
      //                  "Every contribution is deeply appreciated as it helps keep this free for all.",
      //     position:    pos("top"),
      //     showButtons: true,
      //     doneBtnText: "✅ Done"
      //   }
      // }

    ];

    /* Mobile only (<576px): the two-system tabs exist just under this width.
       Introduce them so first-time users know how to switch systems. */
    if (window.innerWidth < 576) {
      steps.splice(2, 0, {
        element: ".form-tabs",
        popover: {
          title:       "Two Paths to Wisdom",
          description: "Orírùn offers two systems: <strong>Ifá Wisdom</strong> for Odù divination, " +
                       "and <strong>Numerology</strong> for your sacred numbers. Tap these tabs to switch between them anytime.",
          position:    pos("bottom"),
          showButtons: true
        }
      });
    }

    return steps;
  }

  /* ═══════════════════════════════════════════════════════
   *  3. DRIVER INSTANCE
   * ═══════════════════════════════════════════════════════ */
  function createDriver(labels) {
    if (typeof Driver === "undefined") {
      console.warn("Orírùn tour: Driver.js not loaded.");
      return null;
    }

    labels = labels || {};
    return new Driver({
      animate:            true,
      opacity:            0.78,
      padding:            isMobile ? 6 : 12,
      showButtons:        true,
      doneBtnText:        labels.doneBtnText  || "✅ Done",
      closeBtnText:       labels.closeBtnText || "✕",
      nextBtnText:        labels.nextBtnText  || "Next →",
      prevBtnText:        labels.prevBtnText  || "← Back",
      allowClose:         true,
      overlayClickNext:   false,
      keyboardControl:    true,
      scrollIntoViewOptions: { behavior: "smooth", block: "center" },

      onHighlightStarted: function (element) {
        if (window.innerWidth >= 576 || typeof window.orFormTab !== "function") return;
        var node = element ? (element.node || (typeof element.getNode === "function" ? element.getNode() : element)) : null;
        var id = node && node.id ? node.id : "";
        if (id === "fullname-box" || id === "birthdate-box") {
          window.orFormTab("numerology");
          if (typeof window.orNumMethod === "function") window.orNumMethod("namedate");
        } else if (id === "calculator") {
          window.orFormTab("numerology");
          if (typeof window.orNumMethod === "function") window.orNumMethod("picknum");
        } else if (id === "mainCast" || id === "orientation" || id === "specificOrientation" || id === "solution" || id === "solutionDetails") {
          window.orFormTab("discover");
        }
      },

      onReset: function () {
        if (window.innerWidth < 576 && typeof window.orFormTab === "function") {
          window.orFormTab("discover");
        }
        [
          "#driver-page-overlay",
          "#driver-highlighted-element-stage",
          "#driver-popover-item"
        ].forEach(function (s) {
          var n = document.querySelector(s);
          if (n) n.style.display = "none";
        });
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
   *  4. START TOUR
   * ═══════════════════════════════════════════════════════ */
  async function startTour() {
    /* Purge any leftover Driver DOM from previous runs */
    [
      "#driver-page-overlay",
      "#driver-highlighted-element-stage",
      "#driver-popover-item"
    ].forEach(function (s) {
      var n = document.querySelector(s);
      if (n && n.parentNode) n.parentNode.removeChild(n);
    });

    /* Filter out steps whose target element doesn't exist */
    var validSteps = buildSteps().filter(function (step) {
      if (step.element === "body") return true;
      return !!document.querySelector(step.element);
    });

    if (!validSteps.length) {
      console.warn("Orírùn tour: No valid target elements found.");
      return;
    }

    /* Button labels — translated below when a language is active */
    var labels = {
      doneBtnText:  "✅ Done",
      closeBtnText: "✕",
      nextBtnText:  "Next →",
      prevBtnText:  "← Back"
    };

    /* Translate step titles/descriptions + button labels into the selected language */
    if (tourTranslatable()) {
      var strings = [];
      validSteps.forEach(function (st) {
        if (st.popover) strings.push(st.popover.title, st.popover.description);
      });
      strings.push(labels.doneBtnText, labels.nextBtnText, labels.prevBtnText);

      var map = await translateMany(strings, 4);

      validSteps.forEach(function (st) {
        if (!st.popover) return;
        st.popover.title       = map[st.popover.title]       || st.popover.title;
        st.popover.description = map[st.popover.description] || st.popover.description;
      });
      labels.doneBtnText = map[labels.doneBtnText] || labels.doneBtnText;
      labels.nextBtnText = map[labels.nextBtnText] || labels.nextBtnText;
      labels.prevBtnText = map[labels.prevBtnText] || labels.prevBtnText;
    }

    var driverInstance = createDriver(labels);
    if (!driverInstance) return;

    driverInstance.defineSteps(validSteps);
    driverInstance.start();

    try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}

    /* Re-orient steps on resize / rotate */
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        isMobile  = window.innerWidth <= 767;
        isTablet  = window.innerWidth >= 768 && window.innerWidth <= 1024;
        isDesktop = window.innerWidth >= 1025;
        if (driverInstance.isActivated) {
          driverInstance.reset();
          startTour();
        }
      }, 300);
    });
  }

  /* ═══════════════════════════════════════════════════════
   *  5. ONBOARDING MODAL
   * ═══════════════════════════════════════════════════════ */
  function buildModal() {
    var existing = document.getElementById("onboarding-modal");
    if (existing) existing.parentNode.removeChild(existing);

    var modal = document.createElement("div");
    modal.id = "onboarding-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "onboarding-title");
    modal.innerHTML = [
      '<div class="ob-backdrop"></div>',
      '<div class="ob-card">',
      '  <div class="ob-logo">',
      '    <img src="public/img/logo.png" alt="Orírùn" />',
      '  </div>',
      '  <h2 id="onboarding-title" data-translate>Ekáàbọ̀ — Welcome to Orírùn</h2>',
      '  <p class="ob-sub" data-translate>',
      '    Discover yourself through Ifá, numerology, astrology and ancestral wisdom.',
      '    Take a quick tour to get the most from your experience.',
      '  </p>',
      '  <div class="ob-actions">',
      '    <button id="ob-start-btn" class="ob-btn ob-btn--primary">',
      '      📖 <span data-translate>Take the Tour</span> <span class="ob-badge">~1 min</span>',
      '    </button>',
      '    <button id="ob-skip-btn" class="ob-btn ob-btn--ghost" data-translate>',
      '      Skip for now',
      '    </button>',
      '  </div>',
      '  <p class="ob-footer-note" data-translate>',
      '    You can restart this tour any time from the About section.',
      '  </p>',
      '</div>'
    ].join("\n");

    var style = document.createElement("style");
    style.textContent = [
      "#onboarding-modal {",
      "  position: fixed; inset: 0;",
      "  z-index: 99999;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  padding: 16px;",
      "  font-family: Courier, monospace;",
      "}",
      ".ob-backdrop {",
      "  position: absolute; inset: 0;",
      "  background: rgba(0,0,0,0.65);",
      "  backdrop-filter: blur(3px);",
      "  -webkit-backdrop-filter: blur(3px);",
      "}",
      ".ob-card {",
      "  position: relative;",
      "  background: #ffffff;",
      "  border-radius: 18px;",
      "  padding: clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px);",
      "  max-width: 420px;",
      "  width: 100%;",
      "  text-align: center;",
      "  box-shadow: 0 24px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(46,125,50,0.15);",
      "  animation: ob-slide-up 0.45s cubic-bezier(0.22,1,0.36,1) both;",
      "}",
      "@keyframes ob-slide-up {",
      "  from { opacity: 0; transform: translateY(28px) scale(0.96); }",
      "  to   { opacity: 1; transform: translateY(0)    scale(1);    }",
      "}",
      ".ob-logo { margin-bottom: 14px; }",
      ".ob-logo img { height: 52px; width: auto; }",
      "#onboarding-modal h2 {",
      "  color: #1b4332;",
      "  font-size: clamp(18px, 4vw, 22px);",
      "  margin: 0 0 10px;",
      "  line-height: 1.3;",
      "}",
      ".ob-sub {",
      "  color: #444;",
      "  font-size: clamp(13px, 3vw, 15px);",
      "  line-height: 1.6;",
      "  margin: 0 0 22px;",
      "}",
      ".ob-actions {",
      "  display: flex;",
      "  flex-direction: column;",
      "  gap: 10px;",
      "  align-items: center;",
      "}",
      ".ob-btn {",
      "  cursor: pointer;",
      "  border-radius: 9px;",
      "  font-family: Courier, monospace;",
      "  font-weight: bold;",
      "  font-size: clamp(13px, 3vw, 15px);",
      "  padding: 12px 28px;",
      "  width: 100%;",
      "  max-width: 300px;",
      "  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;",
      "  border: none;",
      "}",
      ".ob-btn--primary {",
      "  background: #2e7d32;",
      "  color: #ffffff;",
      "  box-shadow: 0 4px 18px rgba(46,125,50,0.35);",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  gap: 8px;",
      "}",
      ".ob-btn--primary:hover {",
      "  background: #1b5e20;",
      "  transform: translateY(-2px);",
      "  box-shadow: 0 8px 24px rgba(46,125,50,0.4);",
      "}",
      ".ob-btn--ghost {",
      "  background: transparent;",
      "  color: #555;",
      "  border: 1.5px solid #ccc;",
      "}",
      ".ob-btn--ghost:hover {",
      "  background: #f5f5f5;",
      "  transform: translateY(-1px);",
      "}",
      ".ob-badge {",
      "  background: rgba(255,255,255,0.25);",
      "  border-radius: 20px;",
      "  padding: 2px 8px;",
      "  font-size: 11px;",
      "  font-weight: normal;",
      "  letter-spacing: 0.3px;",
      "}",
      ".ob-footer-note {",
      "  margin-top: 16px;",
      "  font-size: 11px;",
      "  color: #aaa;",
      "  font-style: italic;",
      "}",
      /* Driver.js popover overrides */
      "#driver-popover-item {",
      "  border-radius: 12px !important;",
      "  font-family: Courier, monospace !important;",
      "  max-width: min(360px, 92vw) !important;",
      "  border: 1.5px solid #2e7d32 !important;",
      "  box-shadow: 0 12px 40px rgba(0,0,0,0.22) !important;",
      "}",
      "#driver-popover-item .driver-popover-title {",
      "  color: #1b4332 !important;",
      "  font-size: clamp(13px, 3.5vw, 16px) !important;",
      "  font-weight: bold !important;",
      "  border-bottom: 1px solid #e0f0e0 !important;",
      "  padding-bottom: 8px !important;",
      "  margin-bottom: 8px !important;",
      "}",
      "#driver-popover-item .driver-popover-description {",
      "  font-size: clamp(12px, 3vw, 14px) !important;",
      "  line-height: 1.6 !important;",
      "  color: #333 !important;",
      "}",
      "#driver-popover-item .driver-popover-footer button {",
      "  background: #2e7d32 !important;",
      "  color: #fff !important;",
      "  border: none !important;",
      "  border-radius: 6px !important;",
      "  padding: 6px 14px !important;",
      "  font-size: 13px !important;",
      "  font-family: Courier, monospace !important;",
      "  font-weight: bold !important;",
      "  cursor: pointer !important;",
      "}",
      "#driver-popover-item .driver-popover-footer button:hover {",
      "  background: #1b5e20 !important;",
      "}",
      "#driver-popover-item .driver-close-btn {",
      "  color: #555 !important;",
      "  font-size: 18px !important;",
      "}",
      "@media (max-width: 480px) {",
      "  .ob-card { padding: 22px 16px; border-radius: 14px; }",
      "  #driver-popover-item { max-width: 96vw !important; margin: 0 2vw !important; }",
      "}"
    ].join("\n");

    document.head.appendChild(style);
    document.body.appendChild(modal);
    return modal;
  }

  /* ═══════════════════════════════════════════════════════
   *  6. SHOW MODAL / WIRE BUTTONS
   * ═══════════════════════════════════════════════════════ */
  function showOnboarding() {
    var modal = buildModal();

    /* Translate the onboarding modal into the active language */
    if (tourTranslatable() && typeof window.translateDynamicContent === "function") {
      window.translateDynamicContent(modal);
    }

    function closeModal() {
      modal.style.opacity    = "0";
      modal.style.transition = "opacity 0.3s ease";
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 320);
    }

    document.getElementById("ob-start-btn").addEventListener("click", function () {
      closeModal();
      setTimeout(startTour, 380);
    });

    document.getElementById("ob-skip-btn").addEventListener("click", function () {
      try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}
      closeModal();
    });

    modal.querySelector(".ob-backdrop").addEventListener("click", function () {
      try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}
      closeModal();
    });

    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", onEsc);
        try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}
        closeModal();
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
   *  7. EXPOSE orirun.restartTour() globally
   * ═══════════════════════════════════════════════════════ */
  window.orirun = window.orirun || {};
  window.orirun.restartTour = function () {
    try { localStorage.removeItem(TOUR_KEY); } catch (e) {}
    wrapFieldsForTour();
    showOnboarding();
  };

  /* ═══════════════════════════════════════════════════════
   *  8. BOOT
   *     Step 1 — wait for #divination-btn to exist in the
   *              DOM (confirms the app has rendered).
   *     Step 2 — wait a further 2500 ms so fonts, images,
   *              dropdowns, and animations are all settled
   *              before the modal appears.
   * ═══════════════════════════════════════════════════════ */
  var alreadySeen = false;
  try { alreadySeen = localStorage.getItem(TOUR_KEY) === "1"; } catch (e) {}

  // if (!alreadySeen) {
  //   waitFor("#divination-btn", 8000).then(function (found) {
  //     if (!found) return; // app never rendered — bail silently
  //     wrapFieldsForTour();
  //     setTimeout(showOnboarding, 2500);
  //   });
  // }

  if (!alreadySeen) {
    waitFor("#divination-btn", 8000).then(function (found) {
      if (!found) return; // app never rendered — bail silently
      wrapFieldsForTour();

      /* Wait until the preloader is actually hidden before showing
         the modal — on slow connections the server may still be
         waking up even after #divination-btn appears in the DOM */
      var deadline = Date.now() + 25000; // max 25s
      (function waitForPreloader() {
        var preloader = document.getElementById("preloader");
        var isGone    = !preloader || preloader.style.display === "none";
        if (isGone) {
          setTimeout(showOnboarding, 600); // brief settle delay
          return;
        }
        if (Date.now() > deadline) {
          setTimeout(showOnboarding, 600); // timeout — show anyway
          return;
        }
        setTimeout(waitForPreloader, 200);
      })();
    });
  }

}); // end DOMContentLoaded