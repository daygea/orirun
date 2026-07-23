/**
 * Orírùn — First-Time User Onboarding Tour  (self-contained, v3)
 * ─────────────────────────────────────────────────────────────
 * Rewritten from scratch. No external tour library (Driver.js is gone).
 * We own the overlay, the spotlight, and the popover, so positioning is
 * deterministic and never fights a third-party engine.
 *
 * How it works
 *  • A dim layer covers the page; a "spotlight" element sits over the
 *    current target, its huge box-shadow dimming everything around it so
 *    the target stays bright.
 *  • The popover is position:fixed, placed next to the target in VIEWPORT
 *    coordinates — below if there's room, else above, always clamped fully
 *    on-screen. Everything viewport-fixed → no document/viewport coordinate
 *    confusion, no library to race. On scroll/resize we recompute from the
 *    live rect.
 *  • Mobile: before a step whose field lives under a tab, switch tabs
 *    (orFormTab / orNumMethod) and scroll the field into view first.
 *
 * Public API (unchanged): window.orirun.restartTour()
 */

document.addEventListener("DOMContentLoaded", function () {

  var TOUR_KEY = "orirun_tour_v2";

  function buildSteps() {
    var steps = [
      { target: ".languageBtn", title: "Language Support",
        body: "Orírùn supports multiple languages. Switch language at any time using this selector." },
      { target: ".historyBtn", title: "Your Divination History",
        body: "Every reading you make is saved here on your device. You can revisit it, add personal reflections, and track your spiritual journey over time." },
      { target: "#mainCast", title: "Choose Your Odù Ifá",
        body: "An Odù is a sacred chapter of Ifá. There are 256 in total. Select the one that appeared in your divination — or explore any Odù you feel drawn to.",
        tabForMobile: "discover" },
      { target: "#orientation", title: "Set the Orientation",
        body: "<strong>Ire</strong> — the Odù appears in a favourable alignment: blessings are available.<br/><strong>Ayewo</strong> — a cautionary alignment: something needs your attention or spiritual action.",
        tabForMobile: "discover" },
      { target: "#specificOrientation", title: "Specific Orientation",
        body: "Narrow down exactly which area of life the Odù is speaking to — Longevity (Aiku), wealth (Aje), victory (Isegun), and more.",
        tabForMobile: "discover" },
      { target: "#solution", title: "Choose a Solution Type",
        body: "<strong>Ebo</strong> — a prescribed offering or action to activate blessings or resolve challenges.<br/><strong>Adimu</strong> — a personal offering made directly to an Orisha.",
        tabForMobile: "discover" },
      { target: "#solutionDetails", title: "Specific Solution",
        body: "Each Ebo or Adimu type carries its own sacred items and actions as revealed by the Odù — for example, <em>Akoru</em>, <em>Esha</em>, <em>Adimu Ori</em> and so on.",
        tabForMobile: "discover" },
      { target: "#divination-btn", title: "Reveal Wisdom",
        body: "When all fields are set, tap <em>Reveal Wisdom</em> to receive the message. The Odù's wisdom, Orisha guidance, Ebo prescription, Taboos, and spiritual insight will appear below.",
        tabForMobile: "discover" },
      { target: "#fullname-box", title: "Enter Your Full Name",
        body: "Your full name is the first half of your Yorùbá numerology chart — type it just as you'd like it to be read.",
        tabForMobile: "numerology", methodForMobile: "namedate" },
      { target: "#birthdate-box", title: "Add Your Birth Date",
        body: "Your birth date completes the chart. With both in place, tap <em>Reveal Message</em> to generate your Life Path, Destiny, Soul Urge, and Orisha alignment.",
        tabForMobile: "numerology", methodForMobile: "namedate" },
      { target: "#calculator", title: "Pick a Sacred Number",
        body: "Choose any number from 1–9 to instantly explore its Àṣẹ (divine energy) — its essence, personality traits, and spiritual associations within Yorùbá wisdom.",
        tabForMobile: "numerology", methodForMobile: "picknum" },
      { target: "#chatbot-toggle", title: "Learning Corner",
        body: "Have questions about Ifá, Orishas, or Yorùbá spirituality? Open the Learning Corner chatbot — your interactive guide to ancestral wisdom. You can also type <b>Help</b> in the chat to see the resources available." },
      { target: "#tour-guidance-link", title: "Today's Guidance",
        body: "Tap here any time to receive your personalised daily guidance — rooted in your numerology, your Orisha alignment, and the energy of the current hour." },
      { target: "#or-cast-link", title: "Cast Ifá",
        body: "You've seen how to set each part of a reading yourself. <strong>Cast Ifá</strong> is the other way: tap it and the cast falls as it does with the opèlè — the Odù, its orientation, and the prescribed offering all settle on their own, and the wisdom is revealed. Use it when you'd rather let Ifá speak first." }
    ];

    if (window.innerWidth < 576) {
      steps.splice(2, 0, {
        target: ".form-tabs", title: "Two Paths to Wisdom",
        body: "Orírùn offers two systems: <strong>Ifá Wisdom</strong> for Odù divination, and <strong>Numerology</strong> for your sacred numbers. Tap these tabs to switch between them anytime.",
        tabForMobile: "discover"
      });
    }
    return steps.filter(function (s) { return !!document.querySelector(s.target); });
  }

  /* i18n */
  function tourLang() { return (typeof currentLang !== "undefined") ? currentLang : "baseline"; }
  function tourTranslatable() {
    var l = tourLang();
    return l && l !== "baseline" && l !== "en" && typeof translateWithCache === "function";
  }
  async function tr(text) {
    if (!text || !tourTranslatable()) return text;
    try { return await translateWithCache(text, tourLang()); } catch (e) { return text; }
  }
  async function translateSteps(steps, labels) {
    if (!tourTranslatable()) return;
    var strings = [];
    steps.forEach(function (s) { strings.push(s.title, s.body); });
    strings.push(labels.next, labels.back, labels.done, labels.skip);
    var uniq = Array.from(new Set(strings.filter(Boolean)));
    var map = {}, i = 0;
    async function worker() { while (i < uniq.length) { var k = i++; map[uniq[k]] = await tr(uniq[k]); } }
    var workers = []; for (var w = 0; w < Math.min(4, uniq.length); w++) workers.push(worker());
    await Promise.all(workers);
    steps.forEach(function (s) { s.title = map[s.title] || s.title; s.body = map[s.body] || s.body; });
    labels.next = map[labels.next] || labels.next;
    labels.back = map[labels.back] || labels.back;
    labels.done = map[labels.done] || labels.done;
    labels.skip = map[labels.skip] || labels.skip;
  }

  function injectStyles() {
    if (document.getElementById("or-tour-styles")) return;
    var css = document.createElement("style");
    css.id = "or-tour-styles";
    css.textContent = [
      "#or-tour-dim{position:fixed;inset:0;background:rgba(20,32,24,0.62);z-index:100000;}",
      "#or-tour-spot{position:fixed;z-index:100001;border-radius:10px;box-shadow:0 0 0 9999px rgba(20,32,24,0.62);transition:all .28s cubic-bezier(.4,0,.2,1);pointer-events:none;}",
      "#or-tour-spot.or-hidden{width:0;height:0;left:50%;top:50%;}",
      "#or-tour-pop{position:fixed;z-index:100002;max-width:min(340px,92vw);background:#fffef9;border:1px solid rgba(20,40,30,.14);border-top:3px solid #b8860b;border-radius:16px;box-shadow:0 20px 48px rgba(15,45,30,.34);padding:20px 20px 16px;opacity:0;transform:translateY(6px);transition:opacity .2s ease,transform .2s ease,left .25s ease,top .25s ease;}",
      "#or-tour-pop.or-show{opacity:1;transform:translateY(0);}",
      "#or-tour-pop h3{margin:0 0 8px;font-size:18px;color:#0c3d24;font-family:'Source Serif 4',Georgia,serif;}",
      "#or-tour-pop .or-body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#2a3a30;}",
      "#or-tour-pop .or-progress{font-family:system-ui,sans-serif;font-size:12px;color:#8a9a90;margin-top:12px;}",
      "#or-tour-pop .or-actions{display:flex;gap:8px;align-items:center;margin-top:12px;}",
      "#or-tour-pop .or-actions .or-spacer{flex:1;}",
      "#or-tour-pop button{font-family:system-ui,sans-serif;font-weight:600;font-size:13px;border-radius:9px;padding:9px 16px;min-height:40px;cursor:pointer;border:none;transition:background .15s ease,transform .12s ease;}",
      "#or-tour-pop .or-next{background:#0f7b3d;color:#fff;box-shadow:0 3px 10px rgba(15,123,61,.24);}",
      "#or-tour-pop .or-next:hover{background:#0c6a34;transform:translateY(-1px);}",
      "#or-tour-pop .or-back{background:#fff;color:#0c3d24;border:1px solid rgba(20,40,30,.2);}",
      "#or-tour-pop .or-back:hover{background:#f1efe7;}",
      "#or-tour-pop .or-skip{background:transparent;color:#8a9a90;padding:9px 10px;min-height:auto;}",
      "#or-tour-pop .or-skip:hover{color:#0c3d24;}",
      "#or-tour-pop .or-arrow{position:absolute;width:14px;height:14px;background:#fffef9;transform:rotate(45deg);border:1px solid rgba(20,40,30,.14);}",
      "#or-tour-pop .or-arrow.or-arrow-up{top:-8px;border-right:none;border-bottom:none;}",
      "#or-tour-pop .or-arrow.or-arrow-down{bottom:-8px;border-left:none;border-top:none;}",
      "@media (max-width:480px){#or-tour-pop{padding:18px 16px 14px;}#or-tour-pop h3{font-size:16px;}}"
    ].join("\n");
    document.head.appendChild(css);
  }

  var _steps = [], _idx = 0, _active = false, _els = {};
  var _labels = { next: "Next →", back: "← Back", done: "✅ Done", skip: "Skip" };

  function isMobile() { return window.innerWidth < 576; }

  function buildOverlay() {
    injectStyles();
    var dim = document.createElement("div"); dim.id = "or-tour-dim";
    var spot = document.createElement("div"); spot.id = "or-tour-spot"; spot.className = "or-hidden";
    var pop = document.createElement("div"); pop.id = "or-tour-pop";
    pop.setAttribute("role", "dialog"); pop.setAttribute("aria-live", "polite");
    document.body.appendChild(dim);
    document.body.appendChild(spot);
    document.body.appendChild(pop);
    _els = { dim: dim, spot: spot, pop: pop };
    dim.addEventListener("click", next);
  }

  function teardownOverlay() {
    ["dim", "spot", "pop"].forEach(function (k) {
      if (_els[k] && _els[k].parentNode) _els[k].parentNode.removeChild(_els[k]);
    });
    _els = {};
  }

  function prepareStep(step) {
    if (isMobile()) {
      if (step.tabForMobile && typeof window.orFormTab === "function") window.orFormTab(step.tabForMobile);
      if (step.methodForMobile && typeof window.orNumMethod === "function") window.orNumMethod(step.methodForMobile);
    }
  }

  function position(step) {
    var node = document.querySelector(step.target);
    var spot = _els.spot, pop = _els.pop;
    if (!spot || !pop) return;

    if (!node) { spot.className = "or-hidden"; centerPopover(); return; }

    var r = node.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight, pad = 6;

    spot.className = "";
    spot.style.left = Math.max(0, r.left - pad) + "px";
    spot.style.top = Math.max(0, r.top - pad) + "px";
    spot.style.width = Math.min(vw, r.width + pad * 2) + "px";
    spot.style.height = Math.min(vh, r.height + pad * 2) + "px";

    var pr = pop.getBoundingClientRect();
    var m = 14, arrowFor = "up", top, left;

    if (vh - r.bottom >= pr.height + m + 8) { top = r.bottom + m; arrowFor = "up"; }
    else if (r.top >= pr.height + m + 8) { top = r.top - pr.height - m; arrowFor = "down"; }
    else { top = Math.max(m, Math.min(vh - pr.height - m, (vh - pr.height) / 2)); arrowFor = "none"; }

    var targetCenter = r.left + r.width / 2;
    left = targetCenter - pr.width / 2;
    if (left + pr.width > vw - m) left = vw - pr.width - m;
    if (left < m) left = m;
    if (top < m) top = m;

    pop.style.left = left + "px";
    pop.style.top = top + "px";

    var arrow = pop.querySelector(".or-arrow");
    if (arrow) {
      if (arrowFor === "none") { arrow.style.display = "none"; }
      else {
        arrow.style.display = "block";
        arrow.className = "or-arrow " + (arrowFor === "up" ? "or-arrow-up" : "or-arrow-down");
        var ax = targetCenter - left - 7;
        ax = Math.max(14, Math.min(pr.width - 28, ax));
        arrow.style.left = ax + "px";
      }
    }
  }

  function centerPopover() {
    var pop = _els.pop; if (!pop) return;
    var pr = pop.getBoundingClientRect();
    pop.style.left = Math.max(12, (window.innerWidth - pr.width) / 2) + "px";
    pop.style.top = Math.max(12, (window.innerHeight - pr.height) / 2) + "px";
    var arrow = pop.querySelector(".or-arrow"); if (arrow) arrow.style.display = "none";
  }

  function stopProp(fn) { return function (e) { if (e) e.stopPropagation(); fn(); }; }

  function renderStep() {
    var step = _steps[_idx];
    if (!step) return end();
    var pop = _els.pop;
    var isFirst = _idx === 0, isLast = _idx === _steps.length - 1;

    pop.innerHTML =
      '<div class="or-arrow or-arrow-up"></div>' +
      '<h3></h3><div class="or-body"></div><div class="or-progress"></div>' +
      '<div class="or-actions">' +
        '<button class="or-skip" type="button"></button><span class="or-spacer"></span>' +
        (isFirst ? "" : '<button class="or-back" type="button"></button>') +
        '<button class="or-next" type="button"></button>' +
      '</div>';

    pop.querySelector("h3").textContent = step.title;
    pop.querySelector(".or-body").innerHTML = step.body;
    pop.querySelector(".or-progress").textContent = (_idx + 1) + " of " + _steps.length;
    pop.querySelector(".or-skip").textContent = _labels.skip;
    pop.querySelector(".or-next").textContent = isLast ? _labels.done : _labels.next;
    var backBtn = pop.querySelector(".or-back");
    if (backBtn) { backBtn.textContent = _labels.back; backBtn.addEventListener("click", stopProp(prev)); }
    pop.querySelector(".or-next").addEventListener("click", stopProp(next));
    pop.querySelector(".or-skip").addEventListener("click", stopProp(end));
    pop.addEventListener("click", function (e) { e.stopPropagation(); });

    prepareStep(step);
    pop.classList.add("or-show");

    var node = document.querySelector(step.target);
    var needScroll = false;
    if (node) {
      var isFixed = false;
      try { isFixed = window.getComputedStyle(node).position === "fixed"; } catch (e) {}
      var r = node.getBoundingClientRect();
      needScroll = !isFixed && (r.top < 60 || r.bottom > window.innerHeight - 60);
      if (needScroll && node.scrollIntoView) {
        try { node.scrollIntoView({ behavior: "smooth", block: "center" }); }
        catch (e2) { try { node.scrollIntoView(); } catch (e3) {} }
      }
    }
    requestAnimationFrame(function () { position(step); });
    if (needScroll) setTimeout(function () { position(step); }, 360);
  }

  function next() { if (!_active) return; if (_idx >= _steps.length - 1) return end(); _idx++; renderStep(); }
  function prev() { if (!_active) return; if (_idx <= 0) return; _idx--; renderStep(); }

  function end() {
    if (!_active) return;
    _active = false;
    try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}
    if (isMobile() && typeof window.orFormTab === "function") { try { window.orFormTab("discover"); } catch (e) {} }
    window.removeEventListener("scroll", onReposition, true);
    window.removeEventListener("resize", onReposition);
    document.removeEventListener("keydown", onKey);
    teardownOverlay();
  }

  function onReposition() { if (!_active) return; var s = _steps[_idx]; if (s) position(s); }
  function onKey(e) {
    if (!_active) return;
    if (e.key === "Escape") end();
    else if (e.key === "ArrowRight" || e.key === "Enter") next();
    else if (e.key === "ArrowLeft") prev();
  }

  async function startTour() {
    if (_active) return;
    var steps = buildSteps();
    if (!steps.length) { console.warn("Orírùn tour: no target elements found."); return; }
    _steps = steps; _idx = 0;
    _labels = { next: "Next →", back: "← Back", done: "✅ Done", skip: "Skip" };
    await translateSteps(_steps, _labels);
    buildOverlay();
    _active = true;
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    document.addEventListener("keydown", onKey);
    renderStep();
    try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}
  }

  function showOnboarding() {
    injectStyles();
    var prev = document.getElementById("or-onboard");
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
    var modal = document.createElement("div");
    modal.id = "or-onboard";
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "or-ob-title");
    modal.style.cssText = "position:fixed;inset:0;z-index:100010;display:flex;align-items:center;justify-content:center;padding:16px;";
    modal.innerHTML =
      '<div class="or-ob-backdrop" style="position:absolute;inset:0;background:rgba(20,32,24,0.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);"></div>' +
      '<div style="position:relative;background:#fffef9;border:1px solid rgba(20,40,30,.14);border-top:3px solid #b8860b;border-radius:18px;padding:clamp(24px,5vw,38px) clamp(20px,5vw,32px);max-width:420px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(15,45,30,.34);">' +
        '<img src="public/img/logo.png" alt="Orírùn" width="270" height="115" style="height:48px;width:auto;margin-bottom:12px;" />' +
        '<h2 id="or-ob-title" style="font-family:\'Source Serif 4\',Georgia,serif;color:#0c3d24;font-size:clamp(18px,4vw,22px);margin:0 0 10px;" data-translate>Ekáàbọ̀ — Welcome to Orírùn</h2>' +
        '<p style="font-family:system-ui,sans-serif;color:#4a5a50;font-size:clamp(13px,3vw,15px);line-height:1.6;margin:0 0 22px;" data-translate>Discover yourself through Ifá, numerology, astrology and ancestral wisdom. Take a quick tour to get the most from your experience.</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px;align-items:center;">' +
          '<button id="or-ob-start" style="width:100%;max-width:300px;background:#0f7b3d;color:#fff;border:none;border-radius:11px;font-family:system-ui,sans-serif;font-weight:600;font-size:15px;padding:13px 24px;min-height:48px;cursor:pointer;box-shadow:0 4px 14px rgba(15,123,61,.3);display:flex;align-items:center;justify-content:center;gap:8px;">📖 <span data-translate>Take the Tour</span></button>' +
          '<button id="or-ob-skip" style="width:100%;max-width:300px;background:transparent;color:#5a6a60;border:1px solid rgba(20,40,30,.2);border-radius:11px;font-family:system-ui,sans-serif;font-weight:600;font-size:14px;padding:11px 24px;min-height:44px;cursor:pointer;" data-translate>Skip for now</button>' +
        '</div>' +
        '<p style="font-family:system-ui,sans-serif;margin-top:16px;font-size:11px;color:#5a6a60;font-style:italic;" data-translate>You can restart this tour any time from the footer.</p>' +
      '</div>';
    document.body.appendChild(modal);

    if (tourTranslatable() && typeof window.translateDynamicContent === "function") {
      try { window.translateDynamicContent(modal); } catch (e) {}
    }

    function close() {
      modal.style.transition = "opacity .25s ease"; modal.style.opacity = "0";
      setTimeout(function () { if (modal.parentNode) modal.parentNode.removeChild(modal); }, 260);
    }
    var startBtn = modal.querySelector("#or-ob-start");
    var skipBtn = modal.querySelector("#or-ob-skip");
    var backdrop = modal.querySelector(".or-ob-backdrop");
    if (startBtn) startBtn.addEventListener("click", function () { close(); setTimeout(startTour, 280); });
    if (skipBtn) skipBtn.addEventListener("click", function () {
      try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}
      close();
    });
    if (backdrop) backdrop.addEventListener("click", function () {
      try { localStorage.setItem(TOUR_KEY, "1"); } catch (e) {}
      close();
    });
  }

  window.orirun = window.orirun || {};
  window.orirun.restartTour = function () {
    try { localStorage.removeItem(TOUR_KEY); } catch (e) {}
    if (_active) end();
    showOnboarding();
  };

  function waitFor(selector, timeout) {
    timeout = timeout || 8000;
    return new Promise(function (resolve) {
      var deadline = Date.now() + timeout;
      (function check() {
        var node = document.querySelector(selector);
        if (node) return resolve(node);
        if (Date.now() > deadline) return resolve(null);
        setTimeout(check, 120);
      })();
    });
  }

  var alreadySeen = false;
  try { alreadySeen = localStorage.getItem(TOUR_KEY) === "1"; } catch (e) {}

  if (!alreadySeen) {
    waitFor("#divination-btn", 8000).then(function (found) {
      if (!found) return;
      var deadline = Date.now() + 25000;
      (function waitForPreloader() {
        var pre = document.getElementById("preloader");
        var gone = !pre || pre.style.display === "none";
        if (gone || Date.now() > deadline) { setTimeout(showOnboarding, 500); return; }
        setTimeout(waitForPreloader, 200);
      })();
    });
  }

}); // end DOMContentLoaded
