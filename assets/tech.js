(function () {
  "use strict";

  var LS_TECH = "tech_index";
  var BLOB_PREFIX = "tech_blob_";

  var listEl = document.getElementById("list");
  var articleEl = document.getElementById("article");

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

  function mergeTechIndex(remote, local) {
    var map = {};
    [remote, local].forEach(function (arr) {
      if (!Array.isArray(arr)) return;
      arr.forEach(function (row) {
        if (!row || !row.file) return;
        map[row.file] = { file: row.file, title: row.title || row.file };
      });
    });
    return Object.keys(map).map(function (k) {
      return map[k];
    });
  }

  function loadIndex() {
    return fetchTimed("tech/index.json", 8000)
      .then(function (r) {
        if (!r.ok) return [];
        return r.json();
      })
      .catch(function () {
        return [];
      })
      .then(function (remote) {
        var local = [];
        try {
          local = JSON.parse(localStorage.getItem(LS_TECH) || "[]");
        } catch (_) {}
        if (!Array.isArray(remote)) remote = [];
        if (!Array.isArray(local)) local = [];
        return mergeTechIndex(remote, local);
      });
  }

  function parseMd(md) {
    if (window.marked && typeof window.marked.parse === "function") {
      try {
        return window.marked.parse(md);
      } catch (_) {
        return "<pre>" + esc(md) + "</pre>";
      }
    }
    return "<pre>" + esc(md) + "</pre>";
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function loadArticle(file) {
    var rel = "tech/" + file;
    var url =
      "tech/" +
      file
        .split("/")
        .map(function (seg) {
          return encodeURIComponent(seg);
        })
        .join("/");
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

  function renderList(rows) {
    listEl.innerHTML = "";
    var h = document.createElement("h1");
    h.textContent = "技术";
    listEl.appendChild(h);
    if (!rows.length) {
      var p = document.createElement("p");
      p.className = "muted";
      p.textContent = "暂无条目。可在写作页使用 :t 标题 归档。";
      listEl.appendChild(p);
      return;
    }
    var ul = document.createElement("ul");
    rows.forEach(function (row) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#";
      a.textContent = row.title;
      a.setAttribute("data-file", row.file);
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        openArticle(row.file, row.title);
      });
      li.appendChild(a);
      ul.appendChild(li);
    });
    listEl.appendChild(ul);
  }

  function openArticle(file, title) {
    articleEl.innerHTML = "";
    loadArticle(file).then(function (md) {
      if (!md.trim()) {
        articleEl.innerHTML =
          "<p class=\"muted\">无法加载「" + esc(file) + "」。</p>";
        return;
      }
      articleEl.innerHTML = parseMd(md);
    });
    window.scrollTo({ top: articleEl.offsetTop - 8, behavior: "smooth" });
  }

  loadIndex().then(renderList);
})();
