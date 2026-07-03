/* ==================================================================
   ORÍRÙN — lazy-libs.js  (~1 KB, loads up front so nothing else has to)

   Heavy vendor libraries used to load on EVERY visit for features most
   visitors never touch: ~600 KB of PDF machinery for the download
   button, 208 KB of Chart.js for the admin dashboard, 47 KB of
   Driver.js for the one-time tour. On Nigerian mobile networks that
   is seconds of dead weight before the first reading.

   Now each library loads the first time its feature is actually used,
   via ensureLib(name). Loading is deduplicated (concurrent callers
   share one promise) and cached by the service worker's runtime cache
   after first use, so the cost is paid once, and only by users of the
   feature.
   ================================================================== */
(function () {
  "use strict";

  var REGISTRY = {
    jspdf:       "public/js/jspdf.js",
    html2canvas: "public/js/html2canvas.js",
    chart:       "public/js/chart.js",
    driver:      "public/js/driver.js",
  };

  var _loading = {};

  function ensureLib(name) {
    var src = REGISTRY[name];
    if (!src) return Promise.reject(new Error("Unknown lazy lib: " + name));
    if (_loading[name]) return _loading[name];

    _loading[name] = new Promise(function (resolve, reject) {
      // Already present (e.g. loaded by an earlier page state)?
      if (
        (name === "jspdf" && window.jsPDF) ||
        (name === "html2canvas" && window.html2canvas) ||
        (name === "chart" && window.Chart) ||
        (name === "driver" && typeof window.Driver !== "undefined")
      ) return resolve();

      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        delete _loading[name]; // allow retry on flaky networks
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(s);
    });
    return _loading[name];
  }

  function ensureLibs(names) {
    return Promise.all(names.map(ensureLib));
  }

  window.ensureLib = ensureLib;
  window.ensureLibs = ensureLibs;
})();
