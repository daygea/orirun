/**
 * Orírùn — Result Export utility  (download + share as PDF)
 * ─────────────────────────────────────────────────────────
 * One reusable module that turns any on-screen result into a branded
 * PDF the user can download or share. Used by the Ifá reading, the Odù
 * configuration, the numerology birth chart, and daily guidance.
 *
 * Public API:
 *   window.orirunExport.pdf(opts)      → build + download/share a PDF
 *   window.orirunExport.attachBar(opts)→ inject a Download/Share button bar
 *
 * opts:
 *   sourceEl   : Element | () => Element   the result container to capture
 *   title      : string                    heading shown on the PDF + share
 *   filename   : string                    base file name (no extension)
 *   subtitle   : string (optional)         small line under the title
 *   button     : Element (optional)        button to show progress on
 *
 * Design notes
 *  • Libraries (jsPDF + html2canvas) are already bundled and load lazily
 *    via ensureLib(), so this file adds no upfront weight.
 *  • We never capture the live node directly (it carries app styles,
 *    animations, and the export buttons themselves). Instead we clone its
 *    content into a clean, print-safe "sheet" rendered off-screen, then
 *    rasterise that. This keeps output consistent and avoids capturing UI
 *    chrome.
 *  • Mobile → native share sheet (with the PDF file) when supported;
 *    otherwise (and on desktop) → direct download. Both always available.
 */
(function () {
  "use strict";

  var BRAND_GREEN = "#0c3d24";
  var BRAND_ACCENT = "#0f7b3d";
  var PAPER = "#fffef9";

  function getJsPDF() {
    // UMD build exposes it as window.jspdf.jsPDF; some builds as window.jsPDF.
    return (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || null;
  }

  function resolveEl(elOrFn) {
    var el = typeof elOrFn === "function" ? elOrFn() : elOrFn;
    return el && el.nodeType === 1 ? el : null;
  }

  // Strip interactive/no-print bits and inline the result content into a
  // clean sheet for capture. Returns the off-screen sheet element.
  function buildSheet(sourceEl, title, subtitle, includeConfig) {
    var sheet = document.createElement("div");
    sheet.setAttribute("data-orirun-sheet", "1");
    sheet.style.cssText = [
      "position:fixed", "top:-99999px", "left:-99999px",
      "width:720px", "box-sizing:border-box",
      "background:" + PAPER,
      "padding:36px 40px 28px",
      "font-family:'Source Serif 4',Georgia,serif",
      "color:#1b2a22", "z-index:2147482000"
    ].join(";");

    // Header: logo + homage banner + bird + title.
    // We pull the LIVE homage text from the page so it matches the user's
    // current language; fall back to the English original if not found.
    var homageEl = document.querySelector('[data-translate="header"]');
    var homageText = homageEl ? homageEl.textContent.trim() :
      "I pay homage to OLODUMARE, Oduduwa, Orunmila, Ajagunmale, Aworomaja, Odu Òlógboòjè, Ègàn, Gbogbo Ẹlẹ́yẹ, Gbogbo Irunmole, Ooni of Ife, Gbogbo Ọba Aláde, Àràbà Agbaye. I pay homage to all Elders.";

    var header = document.createElement("div");
    header.style.cssText = "text-align:center;margin-bottom:18px;border-bottom:2px solid " + BRAND_ACCENT + ";padding-bottom:16px;";
    header.innerHTML =
      '<img src="public/img/logo.png" crossorigin="anonymous" style="height:56px;width:auto;display:block;margin:0 auto 10px;" alt="Orírùn" />' +
      // Homage banner — mirrors the on-screen green homage strip.
      '<div style="background:linear-gradient(135deg,#0c3d24,#0f7b3d);color:#fffef9;font-family:\'Source Serif 4\',Georgia,serif;font-size:12px;line-height:1.6;letter-spacing:.2px;padding:12px 16px;border-radius:12px;margin:0 auto 12px;max-width:600px;">' + escapeHTML(homageText) + '</div>' +
      // Bird motif — shown only when there is NO Odù configuration below
      // (for numerology / pick-a-number). For the Ifá reading the real Odù
      // sign (opele on the opon board) renders just under the header instead.
      (includeConfig ? "" :
        '<img src="public/img/bird.gif" crossorigin="anonymous" style="height:38px;width:auto;display:block;margin:0 auto 12px;opacity:.85;" alt="" />') +
      '<div style="font-size:22px;font-weight:700;color:' + BRAND_GREEN + ';font-family:\'Source Serif 4\',Georgia,serif;">' + escapeHTML(title) + '</div>' +
      (subtitle ? '<div style="font-size:13px;color:#5a6a60;margin-top:4px;font-family:system-ui,sans-serif;">' + escapeHTML(subtitle) + '</div>' : "");
    sheet.appendChild(header);

    // Body: a cleaned clone of the source content, optionally preceded by the
    // displayed Odù configuration (the visual sign). For Ifá readings the
    // configuration lives in a separate #configurationResult element; we show
    // it at the TOP of the PDF, above the reading text.
    var body = document.createElement("div");
    body.style.cssText = "font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.65;color:#22332b;";

    var configEl = includeConfig ? document.getElementById("configurationResult") : null;
    if (configEl && configEl.textContent.trim() && configEl.querySelector("img, .odu-container")) {
      var cfgWrap = document.createElement("div");
      cfgWrap.style.cssText = "text-align:center;margin:0 auto 18px;padding-bottom:16px;border-bottom:1px solid #e0efe0;";
      var cfgClone = configEl.cloneNode(true);
      cleanClone(cfgClone);
      cfgWrap.appendChild(cfgClone);
      body.appendChild(cfgWrap);
    }

    var clone = sourceEl.cloneNode(true);
    cleanClone(clone);
    body.appendChild(clone);
    sheet.appendChild(body);

    // Traditional Ifá closing blessing — shown on the Ifá reading only
    // (same gate as the Odù configuration), not on numerology exports.
    if (includeConfig) {
      var blessing = document.createElement("div");
      blessing.style.cssText = "text-align:center;margin-top:20px;font-family:'Source Serif 4',Georgia,serif;font-size:15px;font-weight:600;color:" + BRAND_GREEN + ";letter-spacing:.3px;";
      blessing.textContent = "Àbọrú, Àbọyè, Àbọṣíṣẹ oo";
      sheet.appendChild(blessing);
    }

    // Footer
    var footer = document.createElement("div");
    var d = new Date();
    var dateStr = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    footer.style.cssText = "margin-top:22px;padding-top:14px;border-top:1px solid #d9e4dd;text-align:center;font-family:system-ui,sans-serif;font-size:11px;color:#7a8a80;";
    footer.innerHTML = '<span style="color:' + BRAND_ACCENT + ';font-weight:600;">www.orirun.com</span> &nbsp;·&nbsp; ' + escapeHTML(dateStr) + ' &nbsp;·&nbsp; Source of ancestral wisdom';
    sheet.appendChild(footer);

    return sheet;
  }

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Remove things that shouldn't be in the export: the export buttons
  // themselves, animated gifs/spinners, and any element flagged no-print.
  function cleanClone(root) {
    // Remove only NON-content chrome: the export bar/buttons, spinners,
    // animated gifs, scripts/styles, tip icons, and the feedback widget.
    // NB: we deliberately do NOT blanket-remove <button>, because accordion
    // headers are buttons that carry the section titles.
    var kill = root.querySelectorAll(
      "[data-orirun-export], .orirun-export-bar, .orexp-btn, .moving-bg, .spinner, script, style, .no-print, .ifa-tip, .feedback-section, [id^='feedback'], .dv-guide, #guide-btn, .alert, [class*='notif'], [id*='notif'], [class*='toast'], .announcement" 
    );
    kill.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });

    // Turn the app's onclick-based audio/video links into real hrefs so we
    // can later lay clickable PDF annotations over them. The real media URL
    // lives inside openAudioModal('URL') / openVideoModal('URL').
    root.querySelectorAll("a").forEach(function (a) {
      var oc = a.getAttribute("onclick") || "";
      var m = oc.match(/open(?:Audio|Video)Modal\((['"])(.*?)\1/);
      if (m && m[2]) {
        a.setAttribute("href", m[2]);
        a.setAttribute("data-pdf-link", m[2]);
      } else if (/openBabalawoContribution|contribut/i.test(oc)) {
        // "Contribute a verse or teaching" opens an in-app modal; in the PDF
        // we link it to the live contribution entry point.
        a.setAttribute("href", "https://orirun.com/?open=contribute");
        a.setAttribute("data-pdf-link", "https://orirun.com/?open=contribute");
      } else if (a.getAttribute("href") && a.getAttribute("href") !== "#") {
        a.setAttribute("data-pdf-link", a.getAttribute("href"));
      }
      a.removeAttribute("onclick");
      // Keep links looking clickable in the flattened image.
      a.style.color = BRAND_ACCENT;
      a.style.textDecoration = "underline";
      a.style.fontWeight = "600";
    });

    // Convert accordion header buttons into plain headings (keep the text,
    // drop the toggle chrome) so the PDF reads as a clean document.
    root.querySelectorAll("button").forEach(function (b) {
      // If it's an export/action button that slipped through, remove it.
      if (b.hasAttribute("data-orirun-export")) { if (b.parentNode) b.parentNode.removeChild(b); return; }
      var label = b.querySelector(".acc-arrow");
      if (label) label.remove();               // drop the ▼ arrow
      var heading = document.createElement("div");
      heading.style.cssText = "font-weight:700;color:#1b4332;font-size:14px;padding:10px 12px;background:linear-gradient(135deg,#f0f7f0,#e8f5e8);border-radius:8px 8px 0 0;";
      heading.innerHTML = b.innerHTML;
      if (b.parentNode) b.parentNode.replaceChild(heading, b);
    });

    // Neutralise positioning, animation, and — crucially — REVEAL collapsed
    // accordion / "read more" content so nothing is missing from the export.
    root.querySelectorAll("*").forEach(function (n) {
      if (!n.style) return;
      var p = n.style.position;
      if (p === "fixed" || p === "absolute") n.style.position = "static";
      n.style.animation = "none";
      n.style.transition = "none";

      // Results collapse content with inline display:none (extraAse,
      // energy-breakdown, ori-acc-*, hour panels, parseEnergyAccordion
      // bodies). We're on a CLONE, so forcing them open completes the PDF
      // without changing anything on screen.
      if (n.style.display === "none") n.style.display = "block";
      if (n.style.maxHeight && n.style.maxHeight !== "none") n.style.maxHeight = "none";
      if (n.style.overflow === "hidden") n.style.overflow = "visible";
      if (n.getAttribute && n.getAttribute("aria-expanded") === "false") {
        n.setAttribute("aria-expanded", "true");
      }
    });
    root.style.position = "static";
    root.style.color = root.style.color || "#22332b";
  }

  // Core: render a result to a PDF blob.
  async function renderPdfBlob(sourceEl, title, subtitle, includeConfig) {
    await ensureLibs(["jspdf", "html2canvas"]);
    var JsPDF = getJsPDF();
    if (!JsPDF || typeof html2canvas === "undefined") {
      throw new Error("PDF libraries unavailable");
    }

    var sheet = buildSheet(sourceEl, title, subtitle, includeConfig);
    document.body.appendChild(sheet);

    // Record where each real link sits within the sheet (CSS px, relative to
    // the sheet's top-left) so we can overlay clickable PDF annotations.
    var sheetRect = sheet.getBoundingClientRect();
    var links = [];
    sheet.querySelectorAll("a[data-pdf-link]").forEach(function (a) {
      var url = a.getAttribute("data-pdf-link");
      if (!url) return;
      var r = a.getBoundingClientRect();
      links.push({
        url: url,
        x: r.left - sheetRect.left,
        y: r.top - sheetRect.top,
        w: r.width,
        h: r.height
      });
    });
    var sheetW = sheet.offsetWidth;

    try {
      var canvas = await html2canvas(sheet, {
        backgroundColor: PAPER,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: sheet.offsetWidth,
        height: sheet.offsetHeight
      });

      var imgData = canvas.toDataURL("image/jpeg", 0.92);

      // A4 portrait. We fit the sheet to the page WIDTH, then paginate by
      // slicing the source CANVAS into page-height chunks. Slicing the actual
      // pixels (rather than re-placing the whole tall image shifted up) means
      // no row is lost or duplicated between pages.
      var pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      var pageW = pdf.internal.pageSize.getWidth();
      var pageH = pdf.internal.pageSize.getHeight();
      var margin = 0;                     // full-bleed image
      var usableW = pageW - margin * 2;
      var usableH = pageH - margin * 2;

      // How many source-canvas pixels fit on one PDF page (preserve aspect).
      var pxPerMm = canvas.width / usableW;
      var sliceHeightPx = Math.floor(usableH * pxPerMm);

      // Coordinate conversions for link annotations.
      var cssToMm = usableW / sheetW;              // CSS px → mm
      var canvasToCss = sheetW / canvas.width;     // canvas px → CSS px
      var pageSliceCssPx = sliceHeightPx * canvasToCss;

      var totalPx = canvas.height;
      var renderedPx = 0;
      var first = true;
      var pageIndex = 0;

      while (renderedPx < totalPx) {
        var thisSlicePx = Math.min(sliceHeightPx, totalPx - renderedPx);

        // Draw this slice onto a temp canvas, then add as its own page image.
        var slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = thisSlicePx;
        var ctx = slice.getContext("2d");
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(
          canvas,
          0, renderedPx, canvas.width, thisSlicePx,   // source rect
          0, 0, canvas.width, thisSlicePx             // dest rect
        );

        var sliceData = slice.toDataURL("image/jpeg", 0.92);
        var sliceHmm = thisSlicePx / pxPerMm;

        if (!first) pdf.addPage();
        pdf.addImage(sliceData, "JPEG", margin, margin, usableW, sliceHmm);

        // Faint centered "Orírùn" watermark on every page. Wrapped in
        // try/catch because GState opacity isn't available in every jsPDF
        // build — if it's missing we simply skip the watermark rather than
        // fail the export.
        try {
          var gsW = new pdf.GState({ opacity: 0.08 });
          pdf.setGState(gsW);
          pdf.setTextColor(12, 61, 36);            // brand green
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(64);
          pdf.text("Orírùn", pageW / 2, pageH / 2, {
            align: "center",
            angle: 35,
            baseline: "middle"
          });
          // Restore full opacity so subsequent pages' images aren't dimmed.
          pdf.setGState(new pdf.GState({ opacity: 1 }));
        } catch (wmErr) { /* watermark optional */ }

        // Overlay clickable link annotations that fall on THIS page.
        var pageTopCss = pageIndex * pageSliceCssPx;
        var pageBottomCss = pageTopCss + pageSliceCssPx;
        links.forEach(function (lk) {
          var linkBottom = lk.y + lk.h;
          if (linkBottom <= pageTopCss || lk.y >= pageBottomCss) return;  // not on this page
          var yOnPageCss = lk.y - pageTopCss;
          pdf.link(
            margin + lk.x * cssToMm,
            margin + yOnPageCss * cssToMm,
            lk.w * cssToMm,
            lk.h * cssToMm,
            { url: lk.url }
          );
        });

        renderedPx += thisSlicePx;
        first = false;
        pageIndex++;
      }

      return pdf.output("blob");
    } finally {
      if (document.body.contains(sheet)) document.body.removeChild(sheet);
    }
  }

  // Public: build + download/share a PDF from a result.
  async function pdf(opts) {
    opts = opts || {};
    var sourceEl = resolveEl(opts.sourceEl);
    var title = opts.title || "Orírùn Reading";
    var filename = (opts.filename || "orirun-reading").replace(/[^\w-]+/g, "-");
    var btn = opts.button || null;
    var originalHTML = btn ? btn.innerHTML : "";

    if (!sourceEl || !sourceEl.textContent.trim()) {
      toast(btn, "Nothing to export yet");
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = spinner() + " Preparing…"; }

    try {
      var blob = await renderPdfBlob(sourceEl, title, opts.subtitle || "", !!opts.includeConfig);
      var file = new File([blob], filename + ".pdf", { type: "application/pdf" });

      // Prefer native share (mobile) with the actual PDF file.
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: title + " — Orírùn",
            text: "From Orírùn · www.orirun.com"
          });
          if (btn) { btn.innerHTML = originalHTML; btn.disabled = false; }
          return;
        } catch (shareErr) {
          // User cancelled or share failed → fall through to download.
          if (shareErr && shareErr.name === "AbortError") {
            if (btn) { btn.innerHTML = originalHTML; btn.disabled = false; }
            return;
          }
        }
      }

      // Download (desktop, or no share support).
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename + ".pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);

      if (btn) { btn.innerHTML = "✅ Saved"; setTimeout(function () { btn.innerHTML = originalHTML; btn.disabled = false; }, 1800); }
    } catch (err) {
      if (btn) { btn.innerHTML = originalHTML; btn.disabled = false; }
      toast(btn, "Couldn't create the PDF");
      if (window.console) console.warn("orirunExport.pdf:", err);
    }
  }

  function spinner() {
    return '<span style="display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;vertical-align:-2px;animation:or-exp-spin .7s linear infinite;"></span>';
  }

  function toast(btn, msg) {
    if (!btn) { if (window.console) console.warn(msg); return; }
    var orig = btn.getAttribute("data-label") || btn.innerHTML;
    btn.innerHTML = msg;
    setTimeout(function () { btn.innerHTML = orig; }, 1800);
  }

  // Inject a compact Download/Share PDF bar just after a result container.
  // Safe to call repeatedly — it replaces any prior bar for that result.
  function attachBar(opts) {
    opts = opts || {};
    var sourceEl = resolveEl(opts.sourceEl);
    if (!sourceEl) return null;

    ensureBarStyles();

    // Remove an existing bar tied to this result (avoid duplicates on re-render).
    var existingId = "orexp-bar-" + (opts.key || (sourceEl.id || "result"));
    var prev = document.getElementById(existingId);
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    var bar = document.createElement("div");
    bar.id = existingId;
    bar.className = "orirun-export-bar";
    bar.setAttribute("data-orirun-export", "1");

    var shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "orexp-btn orexp-btn-primary";
    shareBtn.setAttribute("data-orirun-export", "1");
    shareBtn.innerHTML = "⤓ " + (opts.label || "Download / Share PDF");
    shareBtn.setAttribute("data-label", shareBtn.innerHTML);
    shareBtn.addEventListener("click", function () {
      pdf({
        sourceEl: opts.sourceEl,
        title: (typeof opts.title === "function" ? opts.title() : opts.title) || "Orírùn Reading",
        subtitle: (typeof opts.subtitle === "function" ? opts.subtitle() : opts.subtitle) || "",
        filename: (typeof opts.filename === "function" ? opts.filename() : opts.filename) || "orirun-reading",
        includeConfig: !!opts.includeConfig,
        button: shareBtn
      });
    });

    bar.appendChild(shareBtn);

    // Placement: append the bar INSIDE the result container, at its current
    // end. Because attachBar is called right after the reading renders but
    // BEFORE the feedback widget appends, the button naturally sits directly
    // under the reading content and above the feedback prompt — the natural
    // "here's your reading, save it" moment. An explicit `mount` overrides.
    var mount = opts.mount ? resolveEl(opts.mount) : sourceEl;
    if (mount) {
      if (opts.mount) {
        // Custom mount: place the bar right after it.
        if (mount.parentNode) mount.parentNode.insertBefore(bar, mount.nextSibling);
      } else {
        // Default: last child inside the result container.
        mount.appendChild(bar);
      }
    }
    return bar;
  }

  function ensureBarStyles() {
    if (document.getElementById("orexp-styles")) return;
    var s = document.createElement("style");
    s.id = "orexp-styles";
    s.textContent = [
      "@keyframes or-exp-spin{to{transform:rotate(360deg)}}",
      ".orirun-export-bar{display:flex;justify-content:center;gap:10px;margin:16px 0 4px;flex-wrap:wrap;}",
      ".orexp-btn{font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:13.5px;border-radius:11px;padding:11px 20px;min-height:44px;cursor:pointer;border:none;transition:background .15s ease,transform .12s ease,box-shadow .15s ease;}",
      ".orexp-btn-primary{background:" + BRAND_ACCENT + ";color:#fff;box-shadow:0 4px 12px rgba(15,123,61,.24);}",
      ".orexp-btn-primary:hover{background:#0c6a34;transform:translateY(-1px);}",
      ".orexp-btn-primary:active{transform:translateY(0);}",
      ".orexp-btn[disabled]{opacity:.7;cursor:default;transform:none;}"
    ].join("\n");
    document.head.appendChild(s);
  }

  window.orirunExport = { pdf: pdf, attachBar: attachBar, renderPdfBlob: renderPdfBlob };
})();
