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

  /* ── helpers ─────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }

  // Real options only — skip blank/placeholder entries.
  function realOptions(sel) {
    if (!sel) return [];
    return Array.prototype.filter.call(sel.options, function (o) {
      return o.value !== "" && o.value != null;
    });
  }

  // Choose one option at random and select it.
  function pickRandom(sel) {
    var opts = realOptions(sel);
    if (!opts.length) return null;
    var choice = opts[Math.floor(Math.random() * opts.length)];
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

    try {
      // Make sure the Ifá form is the visible flow.
      if (typeof window.orFormTab === "function") window.orFormTab("discover");

      // Bring the form into view so the cast is seen falling into place.
      var form = $("main-content");
      if (form && form.scrollIntoView) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      await sleep(260);

      // Let the fields land one after another — a cast resolving, not a
      // form snapping shut.
      pickRandom(mainCast);
      await sleep(180);
      pickRandom(orientation);
      await sleep(180);
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
      await sleep(140);

      // Reveal through the real button, exactly as a person would.
      var btn = $("divination-btn");
      if (btn) btn.click();
    } catch (err) {
      console.error("Cast Ifá failed:", err);
    } finally {
      casting = false;
      if (label) { label.textContent = original || CAST_LABEL; }
      if (link) { link.style.opacity = ""; link.style.pointerEvents = ""; }
    }
  }

  /* ── entry point ─────────────────────────────────────────────
     The link lives in index.html's footer alongside the others and
     calls this, matching how every other footer link is wired. */
  window.orirunCastIfa = function () {
    return castIfa(document.getElementById("or-cast-link"));
  };
})();
