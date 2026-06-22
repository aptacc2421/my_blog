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
    return fetch(url, { signal: ctrl.signal, cache: "no-store" }).finally(function () {
      clearTimeout(t);
    });
  }

  function mergeTechIndex(remote, local) {
    var map = {};
    [remote, local].forEach(function (arr) {
      if (!Array.isArray(arr)) return;
      arr.forEach(function (row) {
        if (!row || !row.file) return;
        var prev = map[row.file];
        map[row.file] = {
          file: row.file,
          title: row.title || (prev && prev.title) || row.file,
          date: row.date || (prev && prev.date) || parseDateFromFile(row.file),
        };
      });
    });
    return Object.keys(map).map(function (k) {
      return map[k];
    });
  }

  function parseDateFromFile(file) {
    var m = String(file || "").match(/^(\d{4}-\d{2}-\d{2})-/);
    return m ? m[1] : "";
  }

  function formatWrittenAt(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    var p = iso.split("-");
    return p[0] + " 年 " + parseInt(p[1], 10) + " 月 " + parseInt(p[2], 10) + " 日";
  }

  function articleDate(row) {
    return (row && row.date) || parseDateFromFile(row && row.file) || "";
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

  function highlightCode(root) {
    if (!window.hljs || !root) return;
    root.querySelectorAll("pre code").forEach(function (el) {
      hljs.highlightElement(el);
    });
  }

  function parseMd(md) {
    var raw =
      typeof window.normalizeMarkdownForParse === "function"
        ? window.normalizeMarkdownForParse(md)
        : md;
    if (window.marked && typeof window.marked.parse === "function") {
      try {
        if (typeof window.marked.use === "function") {
          window.marked.use({ gfm: true, breaks: false });
        }
        return window.marked.parse(raw);
      } catch (_) {
        return "<pre>" + esc(raw) + "</pre>";
      }
    }
    return "<pre>" + esc(raw) + "</pre>";
  }

  function queryFile() {
    try {
      return new URLSearchParams(window.location.search).get("file") || "";
    } catch (_) {
      return "";
    }
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
    h.className = "tech-h1";
    var hZh = document.createElement("span");
    hZh.className = "tech-h1-zh";
    hZh.setAttribute("lang", "zh-CN");
    hZh.textContent = "技术";
    var hEn = document.createElement("span");
    hEn.className = "tech-h1-en";
    hEn.setAttribute("lang", "en");
    hEn.textContent = "Tech";
    h.appendChild(hZh);
    h.appendChild(hEn);
    listEl.appendChild(h);
    if (!rows.length) {
      var pZh = document.createElement("p");
      pZh.className = "muted";
      pZh.textContent = "内容将陆续补充。";
      var pEn = document.createElement("p");
      pEn.className = "muted muted-en";
      pEn.setAttribute("lang", "en");
      pEn.textContent = "Coming soon.";
      listEl.appendChild(pZh);
      listEl.appendChild(pEn);
      return;
    }
    var ul = document.createElement("ul");
    rows.forEach(function (row) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#";
      a.className = "tech-list-title";
      a.textContent = row.title;
      a.setAttribute("data-file", row.file);
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        openArticle(row);
      });
      li.appendChild(a);
      var written = articleDate(row);
      if (written) {
        var time = document.createElement("time");
        time.className = "tech-list-date";
        time.dateTime = written;
        time.textContent = written;
        li.appendChild(time);
      }
      ul.appendChild(li);
    });
    listEl.appendChild(ul);
  }

  function openArticle(row) {
    var file = row.file;
    articleEl.innerHTML = "";
    loadArticle(file).then(function (md) {
      if (!md.trim()) {
        articleEl.innerHTML =
          "<p class=\"muted\">无法加载「" +
          esc(file) +
          "」。</p>" +
          "<p class=\"muted muted-en\" lang=\"en\">Could not load this file.</p>";
        return;
      }
      var html = parseMd(md);
      var written = articleDate(row);
      if (written) {
        html +=
          "<p class=\"tech-written-at\">写于 " +
          esc(formatWrittenAt(written)) +
          "</p>";
      }
      articleEl.innerHTML = html;
      highlightCode(articleEl);
    });
    window.scrollTo({ top: articleEl.offsetTop - 8, behavior: "smooth" });
  }

  loadIndex().then(function (rows) {
    renderList(rows);
    var file = queryFile();
    if (!file) return;
    var row = rows.filter(function (r) {
      return r.file === file;
    })[0];
    if (row) openArticle(row);
  });
})();
