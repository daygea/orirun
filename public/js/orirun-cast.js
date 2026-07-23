/* ─────────────────────────────────────────────────────────────
 *  orirun-cast.js — "Cast Ifá": a one-tap live divination.
 *
 *  Adds a link in the footer, beside Today's Guidance, that casts a
 *  reading the way the opèlè does: the Odù, its orientation (Ire /
 *  Ayewo) and the prescribed solution all fall at random, then the
 *  wisdom is revealed.
 *
 *  Deliberately drives the app the same way a person would — it fills
 *  the visible fields, lets the app's own cascade fetch the dependent
 *  options, then clicks the real "Reveal Wisdom" button. No internal
 *  functions are reached into, so this keeps working if main.js changes.
 *
 *  Self-contained: no dependencies, no build step.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var CAST_LABEL = "Cast Ifá";
  var BUSY_LABEL = "Casting…";
  // Shortest time the casting veil stays up, so a fast connection still
  // feels like a cast rather than a flicker.
  var MIN_CAST_MS = 900;

  /* ── helpers ─────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }

  // Real options only — skip blank/placeholder entries.
  function realOptions(sel) {
    if (!sel) return [];
    return Array.prototype.filter.call(sel.options, function (o) {
      return o.value !== "" && o.value != null;
    });
  }

  /* An unbiased random integer in [0, n), drawn from the operating
   * system's cryptographic entropy pool.
   *
   * Two deliberate choices:
   *
   *  • crypto.getRandomValues, not Math.random. Math.random is a
   *    *pseudo*-random generator — deterministic from a hidden seed and
   *    never designed to resist prediction. getRandomValues draws on the
   *    OS entropy pool, which is not reproducible or foreseeable.
   *
   *  • Rejection sampling, not modulo. Taking `value % n` would make the
   *    first few options fractionally likelier than the rest, because
   *    2^32 does not divide evenly by n. We discard draws that fall in
   *    the final incomplete range so every Odù is exactly equally
   *    likely — no thumb on the scale, however slight.
   */
  function randomInt(n) {
    if (!n || n <= 0) return 0;
    var c = window.crypto || window.msCrypto;
    if (c && c.getRandomValues) {
      var limit = Math.floor(0x100000000 / n) * n;
      var buf = new Uint32Array(1);
      var v;
      do { c.getRandomValues(buf); v = buf[0]; } while (v >= limit);
      return v % n;
    }
    // Only reached on browsers without Web Crypto, which this app's
    // secure/PWA context effectively rules out.
    return Math.floor(Math.random() * n);
  }

  // Choose one option and select it. Every option carries equal weight,
  // and nothing about the previous cast influences this one — a repeat is
  // as legitimate an outcome as any other.
  function pickRandom(sel) {
    var opts = realOptions(sel);
    if (!opts.length) return null;
    var choice = opts[randomInt(opts.length)];
    sel.value = choice.value;
    return choice.value;
  }

  function fire(el, type) {
    if (!el) return;
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // Wait until a dropdown has real options again (the app refills these
  // from the API after the Odù changes). Resolves false on timeout so a
  // slow/offline connection degrades instead of hanging.
  function waitForOptions(sel, timeoutMs) {
    var deadline = Date.now() + (timeoutMs || 8000);
    return new Promise(function (resolve) {
      (function poll() {
        if (realOptions(sel).length) return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        setTimeout(poll, 120);
      })();
    });
  }

  /* ── the cast ────────────────────────────────────────────── */
  var casting = false;

  async function castIfa(link) {
    if (casting) return;
    var mainCast = $("mainCast");
    var orientation = $("orientation");
    var specific = $("specificOrientation");
    var solution = $("solution");
    var details = $("solutionDetails");

    if (!mainCast || !orientation || !solution) return;

    // The 256 Odù load from the server; if they aren't in yet, say so
    // rather than casting from an empty set. (alert matches how the rest
    // of the app surfaces this same "data not ready" case.)
    if (!realOptions(mainCast).length) {
      alert("Ifá is still waking — please try again in a moment.");
      return;
    }

    casting = true;
    // The link wraps a <span data-translate> like its siblings — change the
    // span's text, not the link's, so the translation hook survives.
    var label = link ? (link.querySelector("span") || link) : null;
    var original = label ? label.textContent : "";
    if (label) { label.textContent = BUSY_LABEL; }
    if (link) { link.style.opacity = ".65"; link.style.pointerEvents = "none"; }

    // Cover the screen FIRST. The fields are then set behind the veil, so the
    // moment reads as a cast being thrown rather than dropdowns twitching.
    // performUserDivination() takes ownership of the preloader once the
    // button is clicked; if we never get there, we lift it ourselves.
    var handedOff = false;
    var startedAt = Date.now();
    if (typeof window.showPreloader === "function") {
      window.showPreloader('<span data-translate>Casting Ifá…</span>');
    }

    try {
      // Make sure the Ifá form is the visible flow.
      if (typeof window.orFormTab === "function") window.orFormTab("discover");

      // Scroll now so the reading is what greets them when the veil lifts.
      var form = $("main-content");
      if (form && form.scrollIntoView) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Set the three independent fields. No artificial stagger — these are
      // hidden behind the preloader, so a delay here would just be dead time.
      pickRandom(mainCast);
      pickRandom(orientation);
      pickRandom(solution);

      // Clear the dependent dropdowns so we can tell when the app has
      // refilled them for this Odù.
      if (specific) specific.innerHTML = "";
      if (details) details.innerHTML = "";

      // One change on the Odù triggers the app's own cascade, which
      // refetches BOTH dependent lists using the values just set.
      fire(mainCast, "change");

      await Promise.all([
        waitForOptions(specific, 8000),
        waitForOptions(details, 8000)
      ]);

      pickRandom(specific);
      pickRandom(details);

      // Let the cast be felt. On a fast connection the work above can finish
      // in a blink; hold just long enough that the moment registers, without
      // adding any wait when the network was already slow.
      var elapsed = Date.now() - startedAt;
      if (elapsed < MIN_CAST_MS) await sleep(MIN_CAST_MS - elapsed);

      // Reveal through the real button, exactly as a person would.
      var btn = $("divination-btn");
      if (btn) { handedOff = true; btn.click(); }
    } catch (err) {
      console.error("Cast Ifá failed:", err);
    } finally {
      casting = false;
      if (label) { label.textContent = original || CAST_LABEL; }
      if (link) { link.style.opacity = ""; link.style.pointerEvents = ""; }
      // Only lift the veil if the reading never took over — otherwise
      // performUserDivination() hides it when the wisdom is ready.
      if (!handedOff && typeof window.hidePreloader === "function") {
        window.hidePreloader();
      }
    }
  }

  /* ── entry point ─────────────────────────────────────────────
     The link lives in index.html's footer alongside the others and
     calls this, matching how every other footer link is wired. */
  window.orirunCastIfa = function () {
    return castIfa(document.getElementById("or-cast-link"));
  };
})();
