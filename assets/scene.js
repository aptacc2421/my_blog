(function () {
  "use strict";

  var BLOB_PREFIX = "scene_blob_";

  var articleEl = document.getElementById("content");
  var errEl = document.getElementById("err");
  var atmosEl = document.getElementById("atmos");

  function fetchTimed(url, ms) {
    ms = ms || 8000;
    var ctrl = new AbortController();
    var t = setTimeout(function () {
      ctrl.abort();
    }, ms);
    return fetch(url, { signal: ctrl.signal }).finally(function () {
      clearTimeout(t);
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function parseMd(md) {
    var raw =
      typeof window.normalizeMarkdownForParse === "function"
        ? window.normalizeMarkdownForParse(md)
        : md;
    if (window.marked && typeof window.marked.parse === "function") {
      try {
        return window.marked.parse(raw);
      } catch (_) {
        return "<pre>" + esc(raw) + "</pre>";
      }
    }
    return "<pre>" + esc(raw) + "</pre>";
  }

  function sceneUrl(cat, file) {
    return (
      "scenes/" +
      encodeURIComponent(cat) +
      "/" +
      encodeURIComponent(file)
    );
  }

  function loadSceneText(cat, file) {
    var rel = "scenes/" + cat + "/" + file;
    var url = sceneUrl(cat, file);
    return fetchTimed(url, 8000)
      .then(function (r) {
        if (r.ok) return r.text();
        return null;
      })
      .catch(function () {
        return null;
      })
      .then(function (text) {
        if (text != null) return text;
        return localStorage.getItem(BLOB_PREFIX + rel) || "";
      });
  }

  function clearAtmosRaster() {
    if (!atmosEl) return;
    atmosEl.classList.remove("atmos-raster");
    atmosEl.style.backgroundImage = "";
    atmosEl.style.backgroundSize = "";
    atmosEl.style.backgroundPosition = "";
  }

  function applyAtmosResult(res) {
    if (!atmosEl) return;
    clearAtmosRaster();
    if (res.mode === "image") {
      atmosEl.classList.add("atmos-raster");
      atmosEl.textContent = "";
      atmosEl.style.backgroundImage = 'url("' + res.url + '")';
      return;
    }
    atmosEl.textContent = res.text != null && res.text !== "" ? res.text : " ";
  }

  var ATMOS_RASTER_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

  function fillAtmosAscii(txt) {
    var t = String(txt || "").replace(/\r\n/g, "\n").trim();
    if (t) return t;
    return (
      "      * . * . * . * . * . *\n" +
      "    .   ~   ~   ~   ~   .\n" +
      "      * . * . * . * . * . *\n" +
      "  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~\n" +
      "      . * . * . * . * . *\n" +
      "    *   ~   ~   ~   ~   *\n" +
      "      . * . * . * . * . *\n"
    );
  }

  function tryRasterExt(cat, exts, idx) {
    if (idx >= exts.length) return Promise.resolve(null);
    var url = "atmospheres/" + encodeURIComponent(cat) + exts[idx];
    return fetchTimed(url, 8000)
      .then(function (r) {
        if (r.ok) return url;
        return tryRasterExt(cat, exts, idx + 1);
      })
      .catch(function () {
        return tryRasterExt(cat, exts, idx + 1);
      });
  }

  /** 与 life.js 一致：优先栅格图，否则 atmospheres/<栏目>.txt 字符画（空则内置底纹） */
  function loadAtmosphere(cat) {
    return tryRasterExt(cat, ATMOS_RASTER_EXTS, 0).then(function (imgUrl) {
      if (imgUrl) return { mode: "image", url: imgUrl };
      return fetchTimed("atmospheres/" + encodeURIComponent(cat) + ".txt", 8000)
        .then(function (r) {
          if (r.ok) return r.text();
          return "";
        })
        .catch(function () {
          return "";
        })
        .then(function (txt) {
          return { mode: "ascii", text: fillAtmosAscii(txt) };
        });
    });
  }

  var params = new URLSearchParams(location.search);
  var cat = params.get("cat") || "";
  var file = params.get("file") || "";

  if (!cat || !file) {
    errEl.hidden = false;
    errEl.textContent = "缺少栏目或文件名。";
    return;
  }

  if (atmosEl) {
    loadAtmosphere(cat)
      .then(applyAtmosResult)
      .catch(function () {
        applyAtmosResult({ mode: "ascii", text: fillAtmosAscii("") });
      });
  }

  loadSceneText(cat, file).then(function (md) {
    if (!md.trim()) {
      errEl.hidden = false;
      errEl.textContent = "无法加载该片段。";
      return;
    }
    var base = file.replace(/\.md$/i, "");
    var brand =
      typeof window !== "undefined" && window.SITE_META && window.SITE_META.brand
        ? window.SITE_META.brand
        : "生活 · 手记与片段";
    document.title = base + " · " + cat + " — " + brand;
    articleEl.innerHTML = parseMd(md);
    errEl.hidden = true;
  });
})();
