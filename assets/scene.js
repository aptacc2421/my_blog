(function () {
  "use strict";

  var BLOB_PREFIX = "scene_blob_";

  var articleEl = document.getElementById("content");
  var errEl = document.getElementById("err");

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

  var params = new URLSearchParams(location.search);
  var cat = params.get("cat") || "";
  var file = params.get("file") || "";

  if (!cat || !file) {
    errEl.hidden = false;
    errEl.textContent = "缺少栏目或文件名。";
    return;
  }

  loadSceneText(cat, file).then(function (md) {
    if (!md.trim()) {
      errEl.hidden = false;
      errEl.textContent = "无法加载该片段。";
      return;
    }
    var base = file.replace(/\.md$/i, "");
    document.title = base + " · " + cat + " — 生活";
    articleEl.innerHTML = parseMd(md);
    errEl.hidden = true;
  });
})();
