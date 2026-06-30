(function () {
  "use strict";

  var LS_TECH = "tech_index";
  var LS_LANG = "tech_lang";
  var BLOB_PREFIX = "tech_blob_";
  /* 正文或样式更新后递增，避免浏览器沿用旧的半截 .md 缓存 */
  var TECH_CACHE_REV = "20260630b";

  var listEl = document.getElementById("list");
  var articleEl = document.getElementById("article");
  var langSwitchEl = document.getElementById("lang-switch");

  var indexRows = [];
  var currentLang = "zh";
  var currentRow = null;

  var MONTHS_EN = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

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
          titleEn: row.titleEn || (prev && prev.titleEn) || "",
          fileEn: row.fileEn || (prev && prev.fileEn) || "",
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

  function queryLang() {
    try {
      var q = new URLSearchParams(window.location.search).get("lang");
      if (q === "en" || q === "zh") return q;
    } catch (_) {}
    try {
      var stored = localStorage.getItem(LS_LANG);
      if (stored === "en" || stored === "zh") return stored;
    } catch (_) {}
    return "zh";
  }

  function setLang(lang) {
    currentLang = lang === "en" ? "en" : "zh";
    try {
      localStorage.setItem(LS_LANG, currentLang);
    } catch (_) {}
    document.documentElement.lang = currentLang === "en" ? "en" : "zh-CN";
    syncLangInUrl();
    renderLangSwitch();
  }

  function syncLangInUrl() {
    if (!window.history || !window.history.replaceState) return;
    try {
      var u = new URL(window.location.href);
      if (currentLang === "zh") u.searchParams.delete("lang");
      else u.searchParams.set("lang", currentLang);
      window.history.replaceState(null, "", u.pathname + u.search);
    } catch (_) {}
  }

  function hasEnglish(row) {
    return !!(row && row.fileEn);
  }

  function getTitle(row, lang) {
    lang = lang || currentLang;
    if (lang === "en" && row.titleEn) return row.titleEn;
    return row.title || row.file;
  }

  function getArticleFile(row, lang) {
    lang = lang || currentLang;
    if (lang === "en" && row.fileEn) return row.fileEn;
    return row.file;
  }

  function formatWrittenAt(iso, lang) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    var p = iso.split("-");
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10);
    var d = parseInt(p[2], 10);
    if (lang === "en") {
      return MONTHS_EN[m - 1] + " " + d + ", " + y;
    }
    return y + " 年 " + m + " 月 " + d + " 日";
  }

  function writtenAtLabel(lang) {
    return lang === "en" ? "Written" : "写于";
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

  function decorateArticle(root) {
    if (!root) return;
    var h2s = root.querySelectorAll("h2");
    for (var i = 0; i < h2s.length; i++) {
      var t = h2s[i].textContent.trim();
      if (t === "目录" || t === "Contents") {
        var ul = h2s[i].nextElementSibling;
        if (ul && ul.tagName === "UL") ul.classList.add("tech-toc");
        break;
      }
    }
    root.querySelectorAll("table").forEach(function (table) {
      if (
        table.parentElement &&
        table.parentElement.classList.contains("tech-table-wrap")
      ) {
        return;
      }
      var wrap = document.createElement("div");
      wrap.className = "tech-table-wrap";
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  function enterReadMode(file) {
    document.body.classList.add("tech-read");
    listEl.setAttribute("hidden", "");
    if (!file || !window.history || !window.history.replaceState) return;
    try {
      var u = new URL(window.location.href);
      u.searchParams.set("file", file);
      if (currentLang === "en") u.searchParams.set("lang", "en");
      else u.searchParams.delete("lang");
      window.history.replaceState(null, "", u.pathname + u.search);
    } catch (_) {}
  }

  function renderLangSwitch() {
    if (!langSwitchEl) return;
    langSwitchEl.querySelectorAll("[data-lang]").forEach(function (btn) {
      var on = btn.getAttribute("data-lang") === currentLang;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function bindLangSwitch() {
    if (!langSwitchEl) return;
    langSwitchEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-lang]");
      if (!btn || !langSwitchEl.contains(btn)) return;
      var lang = btn.getAttribute("data-lang");
      if (lang !== "zh" && lang !== "en") return;
      if (lang === currentLang) return;
      switchLang(lang);
    });
  }

  function switchLang(lang) {
    setLang(lang);
    renderList(indexRows);
    if (currentRow) openArticle(currentRow, { keepScroll: true });
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

  function articleFetchUrl(file, bust) {
    var url =
      "tech/" +
      file
        .split("/")
        .map(function (seg) {
          return encodeURIComponent(seg);
        })
        .join("/");
    url += "?v=" + encodeURIComponent(TECH_CACHE_REV);
    if (bust) url += "&_=" + Date.now();
    return url;
  }

  function loadArticle(file, bust) {
    var rel = "tech/" + file;
    return fetchTimed(articleFetchUrl(file, bust), 8000)
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

  function isSuspiciouslyShortArticle(md, html) {
    if (!md || md.length < 8000) return false;
    var h2 = (html.match(/<h2\b/g) || []).length;
    var p = (html.match(/<p\b/g) || []).length;
    return h2 < 4 || p < 8;
  }

  function articleLoadingHtml() {
    return (
      "<p class=\"muted\">" +
      (currentLang === "en" ? "Loading…" : "加载中…") +
      "</p>"
    );
  }

  function showArticleLoadError(file) {
    var errZh =
      currentLang === "en"
        ? "Could not load this file."
        : "无法加载「" + esc(file) + "」。";
    var errEn =
      currentLang === "en"
        ? ""
        : "<p class=\"muted muted-en\" lang=\"en\">Could not load this file.</p>";
    articleEl.innerHTML = "<p class=\"muted\">" + errZh + "</p>" + errEn;
  }

  function renderArticleBody(row, md) {
    var html = parseMd(md);
    var written = articleDate(row);
    if (written) {
      html +=
        "<p class=\"tech-written-at\">" +
        esc(writtenAtLabel(currentLang)) +
        " " +
        esc(formatWrittenAt(written, currentLang)) +
        "</p>";
    }
    articleEl.innerHTML = html;
    highlightCode(articleEl);
    decorateArticle(articleEl);
  }

  function loadAndRenderArticle(row, file, bust) {
    return loadArticle(file, bust).then(function (md) {
      if (!md.trim()) {
        showArticleLoadError(file);
        return;
      }
      var html = parseMd(md);
      if (!bust && isSuspiciouslyShortArticle(md, html)) {
        return loadAndRenderArticle(row, file, true);
      }
      renderArticleBody(row, md);
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
      a.textContent = getTitle(row, currentLang);
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

  function openArticle(row, opts) {
    opts = opts || {};
    currentRow = row;
    var file = getArticleFile(row, currentLang);
    var canonicalFile = row.file;
    articleEl.innerHTML = articleLoadingHtml();
    loadAndRenderArticle(row, file, false);
    enterReadMode(canonicalFile);
    if (!opts.keepScroll) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  currentLang = queryLang();
  document.documentElement.lang = currentLang === "en" ? "en" : "zh-CN";
  bindLangSwitch();
  renderLangSwitch();

  loadIndex().then(function (rows) {
    indexRows = rows;
    renderList(rows);
    var file = queryFile();
    if (!file) {
      document.body.classList.remove("tech-read");
      listEl.removeAttribute("hidden");
      return;
    }
    var row = rows.filter(function (r) {
      return r.file === file;
    })[0];
    if (row) openArticle(row);
  });
})();
