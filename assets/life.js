(function () {
  "use strict";

  var LS_SCENES = "scenes_index";
  var BLOB_PREFIX = "scene_blob_";

  var MSG_EMPTY_DEFAULT =
    "本世界还没有片段。其它栏目若为空，会一直抽到「无名之地」；也可在写作页 :wq 归档后再刷新。";

  var atmos = document.getElementById("atmos");
  var shards = document.getElementById("shards");

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

  function stripBom(s) {
    return String(s).replace(/^\uFEFF/, "");
  }

  /** 与 md-unfussy 一致：###紧贴正文 → ### 正文，便于按标题解析 */
  function normalizeAtxHeadingSpaces(line) {
    return String(line).replace(/^(#{1,6})([^\s#])/m, function (_, h, rest) {
      return h + " " + rest;
    });
  }

  /** 链接上只显示「标题」二字，绝不带上 ### */
  function cleanTitleForDisplay(t) {
    var s = stripBom(String(t || "").trim());
    s = s.replace(/^#{1,6}\s*/, "").trim();
    return s || "（无题）";
  }

  /** 第一行若为 # 标题则取标题文案；否则首行作标题 */
  function extractTitleAndRest(text) {
    var raw = stripBom(String(text || "").replace(/\r\n/g, "\n"));
    var lines = raw.split("\n");
    var first = normalizeAtxHeadingSpaces(stripBom((lines[0] || "").trim()));
    var hm = first.match(/^#{1,6}\s*(.*)$/);
    if (hm) {
      var title = (hm[1] || "").trim();
      if (!title) title = first.replace(/^#+\s*/, "").trim() || "（无题）";
      return {
        title: title,
        rest: lines.slice(1).join("\n").trim(),
        full: raw,
      };
    }
    if (lines.length <= 1) {
      return { title: first || "（无题）", rest: "", full: raw };
    }
    return {
      title: first,
      rest: lines.slice(1).join("\n").trim(),
      full: raw,
    };
  }

  function buildFragment(body, cat, file) {
    var meta = extractTitleAndRest(body);
    var label = cleanTitleForDisplay(meta.title);
    var div = document.createElement("div");
    div.className = "fragment";

    var a = document.createElement("a");
    a.className = "fragment-title-link";
    a.textContent = label;
    a.href =
      "scene.html?cat=" +
      encodeURIComponent(cat) +
      "&file=" +
      encodeURIComponent(file);
    a.setAttribute("aria-label", label + "，打开全文");

    div.appendChild(a);
    return div;
  }

  function shuffle(a) {
    var i = a.length;
    while (i > 1) {
      var j = Math.floor(Math.random() * i);
      i--;
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function randInt(a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  }

  function mergeIndex(remote, local) {
    var keys = {};
    var k;
    for (k in remote) {
      if (Object.prototype.hasOwnProperty.call(remote, k)) keys[k] = true;
    }
    for (k in local) {
      if (Object.prototype.hasOwnProperty.call(local, k)) keys[k] = true;
    }
    var out = {};
    for (k in keys) {
      var a = Array.isArray(remote[k]) ? remote[k].slice() : [];
      var b = Array.isArray(local[k]) ? local[k].slice() : [];
      var seen = {};
      var merged = [];
      function add(arr) {
        arr.forEach(function (f) {
          if (!seen[f]) {
            seen[f] = true;
            merged.push(f);
          }
        });
      }
      add(a);
      add(b);
      out[k] = merged;
    }
    return out;
  }

  function loadIndex() {
    return fetchTimed("scenes/index.json", 8000)
      .then(function (r) {
        if (!r.ok) return {};
        return r.json();
      })
      .catch(function () {
        return {};
      })
      .then(function (remote) {
        var local = {};
        try {
          local = JSON.parse(localStorage.getItem(LS_SCENES) || "{}");
        } catch (_) {}
        if (!remote || typeof remote !== "object") remote = {};
        if (!local || typeof local !== "object") local = {};
        return mergeIndex(remote, local);
      });
  }

  function pickCategory(idx) {
    var all = Object.keys(idx);
    var withFiles = all.filter(function (k) {
      return Array.isArray(idx[k]) && idx[k].length > 0;
    });
    var pool = withFiles.length ? withFiles : all;
    if (!pool.length) return "无名之地";
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * ?cat= / ?world= 与 scenes/index.json 的 key 完全一致时固定栏目；
   * 写错栏目名时单独提示，不再偷偷随机（避免以为 ?cat= 没生效）。
   */
  function urlCatRequest(idx) {
    try {
      var p = new URLSearchParams(location.search);
      var raw = p.get("cat") || p.get("world");
      if (raw == null || String(raw).trim() === "") return { kind: "none" };
      var name = String(raw).trim();
      if (!Object.prototype.hasOwnProperty.call(idx, name))
        return { kind: "bad", name: name };
      return { kind: "ok", name: name };
    } catch (_) {
      return { kind: "none" };
    }
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
    atmos.classList.remove("atmos-raster");
    atmos.style.backgroundImage = "";
    atmos.style.backgroundSize = "";
    atmos.style.backgroundPosition = "";
  }

  function applyAtmosResult(res) {
    clearAtmosRaster();
    if (res.mode === "image") {
      atmos.classList.add("atmos-raster");
      atmos.textContent = "";
      atmos.style.backgroundImage = 'url("' + res.url + '")';
      return;
    }
    atmos.textContent = res.text != null && res.text !== "" ? res.text : " ";
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

  /** 优先同栏目名的 .png/.jpg/.webp，否则回退 atmospheres/<栏目>.txt 字符画 */
  function loadAtmosphere(cat) {
    return tryRasterExt(cat, [".png", ".jpg", ".jpeg", ".webp"], 0).then(function (imgUrl) {
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
          return { mode: "ascii", text: txt || " " };
        });
    });
  }

  function placeFragment(el) {
    el.className = "fragment";
    el.style.top = randInt(6, 68) + "%";
    el.style.left = randInt(4, 72) + "%";
    el.style.transform = "rotate(" + randInt(-9, 9) + "deg)";
    el.style.opacity = String(randInt(50, 95) / 100);
    shards.appendChild(el);
  }

  function run() {
    loadIndex().then(function (idx) {
      var emptyEl = document.getElementById("shard-empty");
      var req = urlCatRequest(idx);

      if (req.kind === "bad") {
        applyAtmosResult({ mode: "ascii", text: " " });
        if (emptyEl) {
          emptyEl.hidden = false;
          emptyEl.textContent =
            "没有「" +
            req.name +
            "」这个栏目（请对照仓库 scenes/index.json 里的栏目名，须完全一致）。本页不会随机到其它世界。";
        }
        try {
          document.title = "生活";
        } catch (_) {}
        return;
      }

      var forced = req.kind === "ok";
      var cat = forced ? req.name : pickCategory(idx);
      if (forced) {
        try {
          document.title = cat + " — 生活";
        } catch (_) {}
      }

      var files = (idx[cat] && idx[cat].slice()) || [];

      if (forced && files.length === 0) {
        return loadAtmosphere(cat).then(function (res) {
          applyAtmosResult(res);
          if (emptyEl) {
            emptyEl.hidden = false;
            emptyEl.textContent =
              "「" +
              cat +
              "」在索引里还没有任何 .md 文件。请先在写作页 :wq 归入此栏目并推送；或换一个 ?cat= 。";
          }
        });
      }

      var n = Math.min(files.length, randInt(3, 6));
      if (files.length && n < 3) n = files.length;

      return loadAtmosphere(cat).then(function (res) {
        applyAtmosResult(res);
        var picks = shuffle(files).slice(0, n);
        return Promise.all(
          picks.map(function (f) {
            return loadSceneText(cat, f).then(function (body) {
              if (!body.trim()) return;
              placeFragment(buildFragment(body, cat, f));
            });
          })
        ).then(function () {
          if (emptyEl) {
            emptyEl.hidden = shards.children.length > 0;
            if (!emptyEl.hidden) emptyEl.textContent = MSG_EMPTY_DEFAULT;
          }
        });
      });
    }).catch(function () {
      applyAtmosResult({ mode: "ascii", text: " " });
    });
  }

  run();
})();
