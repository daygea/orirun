/* ==================================================================
   ORÍRÙN — babalawo-contribution.js
   A dignified path for babaláwos and ìyánífá to contribute verses and
   teachings WITH their lineage, so their knowledge is credited to them
   by name once a verifying elder has reviewed it.

   Design: this is an ADDITIVE layer over the existing "Share Insight"
   contribution modal (index.html + submitContribution() in utils.js).
   It does not replace or rewrite that flow — it:
     1. reveals a lineage fieldset when the "Babalawo" category is chosen,
     2. opens the modal pre-set to that category from the footer link,
     3. wraps submitContribution() so babaláwo lineage + consent travel
        with the same /api/contribution/submit payload.

   Remove this one <script> tag and the app behaves exactly as before.
   Load AFTER utils.js (which defines submitContribution + the modal
   helpers) and after main.js. No new endpoint is introduced.
   ================================================================== */
(function () {
  "use strict";

  var CATEGORY = "Babalawo";

  function $(id) { return document.getElementById(id); }

  /* ── Toggle the lineage fieldset + intro when the category changes ── */
  function syncBabalawoFields() {
    var sel = $("contributionCategory");
    if (!sel) return;
    var on = sel.value === CATEGORY;
    var fields = $("babalawoFields");
    var intro = $("babalawoIntro");
    if (fields) fields.style.display = on ? "block" : "none";
    if (intro) intro.style.display = on ? "block" : "none";
    // The existing Ifá fields (title/media) shouldn't show for this category.
    if (on) {
      var ifaFields = $("ifaFields");
      if (ifaFields) ifaFields.style.display = "none";
    }
  }

  /* ── Footer entry: open the shared modal, pre-set to Babaláwo ── */
  // Wrap the general modal opener so that entering via "Share Insight"
  // always RESTORES the category selector (in case a prior babaláwo entry
  // hid it) and clears the babaláwo fields. Keeps utils.js untouched.
  function wrapShowModal() {
    if (typeof window.showContributionModal !== "function" || window.__babShowWrapped) {
      return typeof window.showContributionModal === "function";
    }
    var originalShow = window.showContributionModal;
    window.showContributionModal = function () {
      var r = originalShow.apply(this, arguments);
      // Only restore if THIS call isn't the babaláwo entry (which hides it
      // again right after). We restore by default; the babaláwo opener
      // re-hides synchronously after calling through.
      var catField = $("contributionCategoryField");
      if (catField) catField.style.display = "";
      return r;
    };
    window.__babShowWrapped = true;
    return true;
  }

  window.openBabalawoContribution = function () {
    if (typeof showContributionModal !== "function") return;
    showContributionModal();
    var sel = $("contributionCategory");
    if (sel) {
      sel.value = CATEGORY;
      // fire the app's own change handlers, then our sync
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // The category is fixed to Babaláwo on this entry, so hide the selector
    // (it would just be a redundant menu). The value is still set and sent,
    // so backend routing is unaffected. General "Share Insight" still shows it.
    var catField = $("contributionCategoryField");
    if (catField) catField.style.display = "none";
    syncBabalawoFields();
    setTimeout(function () { var el = $("babOdu"); if (el) el.focus(); }, 60);
  };

  /* ── Keep our fieldset in sync with the category select ── */
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "contributionCategory") syncBabalawoFields();
  });

  /* ── Wrap submitContribution() so babaláwo submissions send STRUCTURED
     fields (a `babalawo` object) to /api/contribution/submit, instead of
     the lineage riding inside the text. The backend validates these and
     marks the record "pending" for the Studio review queue. ── */
  function installSubmitWrapper() {
    if (typeof window.submitContribution !== "function") return false;
    if (window.__babalawoWrapped) return true;
    var original = window.submitContribution;

    window.submitContribution = function () {
      var sel = $("contributionCategory");
      if (!sel || sel.value !== CATEGORY) return original.apply(this, arguments);

      var odu     = ($("babOdu")   || {}).value ? $("babOdu").value.trim()   : "";
      var title   = ($("babTitle") || {}).value ? $("babTitle").value.trim() : "";
      var media   = ($("ifaMedia") || {}).value ? $("ifaMedia").value.trim() : "";
      var consent = ($("babConsent") || {}).checked || false;
      var name    = ($("contributorName") || {}).value ? $("contributorName").value.trim() : "";
      var textEl  = $("contributionText");
      var body    = textEl && textEl.value ? textEl.value.trim() : "";

      if (!name)    { alert("Please enter your name, so this teaching can be credited to you."); return; }
      if (!odu)     { alert("Please name the Odù this verse or teaching belongs to."); return; }
      if (!body)    { alert("Please enter the verse or teaching you wish to contribute."); return; }
      if (!consent) { alert("Please confirm consent to be credited once an elder has reviewed this."); return; }

      var btn = document.querySelector(".btn.btn-primary.mt-2");
      if (btn) { btn.disabled = true; btn.innerText = "Submitting..."; }

      var payload = {
        name: name,
        category: CATEGORY,
        text: body,
        title: title || "",
        media: media || "",
        babalawo: { odu: odu, title: title, lineage: "", town: "", consent: true }
      };

      return fetch("/api/contribution/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok || (r.j && r.j.error)) throw new Error((r.j && r.j.error) || "Submission failed");
          // reset our fields + the shared ones, show the app's success popup
          ["babOdu", "babTitle", "ifaMedia"].forEach(function (id) { var el = $(id); if (el) el.value = ""; });
          var c = $("babConsent"); if (c) c.checked = false;
          if (textEl) textEl.value = "";
          var nm = $("contributorName"); if (nm) nm.value = "";
          syncBabalawoFields();
          if (typeof closeModal === "function") closeModal();
          if (typeof showSuccessPopup === "function") showSuccessPopup();
        })
        .catch(function (err) {
          alert(err.message || "Submission failed. Please try again.");
        })
        .then(function () {
          if (btn) { btn.disabled = false; btn.innerText = "Submit"; }
        });
    };

    window.__babalawoWrapped = true;
    return true;
  }

  // utils.js defines these at parse time, but be defensive: try each now,
  // and retry briefly if load order ever changes. Evaluate BOTH each round
  // (no short-circuit) so one failing doesn't skip the other.
  var okSubmit = installSubmitWrapper();
  var okShow = wrapShowModal();
  if (!okSubmit || !okShow) {
    var tries = 0;
    var iv = setInterval(function () {
      if (!okSubmit) okSubmit = installSubmitWrapper();
      if (!okShow) okShow = wrapShowModal();
      if ((okSubmit && okShow) || ++tries > 20) clearInterval(iv);
    }, 100);
  }

  // Ensure initial state is correct if the modal is opened directly.
  document.addEventListener("DOMContentLoaded", syncBabalawoFields);
})();
