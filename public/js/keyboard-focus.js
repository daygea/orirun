/* keyboard-focus.js
 * ─────────────────────────────────────────────────────────────
 *  Mobile keyboards cover the bottom of the screen, hiding whatever the user is
 *  typing into if the field sits low (the chat input is the worst case, but it
 *  affects any low field). This makes EVERY text field in the app keyboard-aware:
 *  when a field gains focus, it is scrolled into the visible area ABOVE the
 *  keyboard. Uses the visualViewport API (which reports the space left after the
 *  keyboard opens) where available, and a sensible fallback otherwise.
 *
 *  Applies app-wide via focus delegation — no per-field wiring needed, so it
 *  covers existing and future inputs everywhere.
 * ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // Only meaningful on touch devices with an on-screen keyboard.
  var isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
  if (!isTouch) return;

  var EDITABLE = "input, textarea, select, [contenteditable='true']";
  // Field types that DON'T raise a keyboard — no need to scroll for these.
  var NO_KEYBOARD = { checkbox: 1, radio: 1, range: 1, color: 1, file: 1, button: 1, submit: 1, reset: 1, image: 1 };

  function needsKeyboard(el) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
    if (el.tagName === "SELECT") return false; // native picker, not a keyboard
    if (el.tagName === "INPUT") return !NO_KEYBOARD[(el.type || "text").toLowerCase()];
    return false;
  }

  // The visible viewport height (space NOT covered by the keyboard), best-effort.
  function visibleHeight() {
    if (window.visualViewport) return window.visualViewport.height;
    return window.innerHeight;
  }

  // Scroll a focused field so it sits comfortably within the visible area above
  // the keyboard. We check the field's position against the visible viewport and
  // only scroll if it's hidden or too close to the keyboard line.
  function ensureVisible(el) {
    if (!el || !el.getBoundingClientRect) return;
    try {
      var rect = el.getBoundingClientRect();
      var visH = visibleHeight();
      var margin = 24; // breathing room above the keyboard
      // If the field's bottom is below the visible area (covered by keyboard),
      // or its top is above the viewport, bring it into view centered-ish.
      if (rect.bottom > visH - margin || rect.top < margin) {
        // scrollIntoView with block:"center" lands it in the middle of the space
        // the keyboard leaves. "nearest" would still leave it under the keyboard.
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (e) { /* non-blocking */ }
  }

  // Focus can fire before the keyboard has finished animating up, so we re-check
  // a couple of times over the first ~400ms.
  function onFocusIn(e) {
    var el = e.target;
    if (!el || !el.matches || !el.matches(EDITABLE)) return;
    if (!needsKeyboard(el)) return;
    ensureVisible(el);
    setTimeout(function () { ensureVisible(el); }, 150);
    setTimeout(function () { ensureVisible(el); }, 350);
  }

  document.addEventListener("focusin", onFocusIn, true);

  // When the keyboard opens/closes, the visual viewport resizes. If a field is
  // focused, keep it in view as the keyboard settles.
  if (window.visualViewport) {
    var vvTimer = null;
    window.visualViewport.addEventListener("resize", function () {
      clearTimeout(vvTimer);
      vvTimer = setTimeout(function () {
        _adjustChatForKeyboard();
        var el = document.activeElement;
        if (el && el.matches && el.matches(EDITABLE) && needsKeyboard(el)) {
          ensureVisible(el);
        }
      }, 100);
    });
  }

  // The chatbot input is absolutely positioned at the bottom of a fixed-height
  // panel, so scrollIntoView alone can't lift it above the keyboard — the whole
  // panel must shift up by the keyboard's height. We compute that from the
  // visualViewport (the gap between the layout viewport and the visible one) and
  // translate the chat container up by it while its input is focused.
  function _adjustChatForKeyboard() {
    var chat = document.getElementById("chatbot-container");
    if (!chat) return;
    var input = document.getElementById("chatbot-input");
    var focused = document.activeElement === input ||
      (chat.contains(document.activeElement) && needsKeyboard(document.activeElement));
    if (window.visualViewport && focused) {
      // Keyboard height ≈ layout height − (visible height + visible offsetTop).
      var vv = window.visualViewport;
      var keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      chat.style.transform = keyboard > 40 ? ("translateY(-" + keyboard + "px)") : "";
      chat.style.transition = "transform .15s ease-out";
    } else {
      chat.style.transform = "";
    }
  }

  // Reset the chat lift when its input loses focus.
  document.addEventListener("focusout", function (e) {
    if (e.target && e.target.id === "chatbot-input") {
      setTimeout(function () {
        var chat = document.getElementById("chatbot-container");
        var active = document.activeElement;
        if (chat && !(active && chat.contains(active) && needsKeyboard(active))) {
          chat.style.transform = "";
        }
      }, 100);
    }
  }, true);
})();
