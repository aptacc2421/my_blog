(function () {
  "use strict";

  var LS_SCENES = "scenes_index";
  var BLOB_PREFIX = "scene_blob_";

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

  /** 第一行若为 # 标题则取标题文案；否则首行作标题 */
  function extractTitleAndRest(text) {
    var raw = String(text || "").replace(/\r\n/g, "\n");
    var lines = raw.split("\n");
    var first = (lines[0] || "").trim();
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
    var div = document.createElement("div");
    div.className = "fragment";

    var a = document.createElement("a");
    a.className = "fragment-title-link";
    a.textContent = meta.title;
    a.href =
      "scene.html?cat=" +
      encodeURIComponent(cat) +
      "&file=" +
      encodeURIComponent(file);
    a.setAttribute("aria-label", meta.title + "，打开全文");

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

  /** 若地址栏带 ?cat= 或 ?world=（栏目名须与 scenes/index.json 的 key 完全一致），则固定进入该场景，不随机 */
  function categoryFromUrl(idx) {
    try {
      var p = new URLSearchParams(location.search);
      var raw = p.get("cat") || p.get("world") || "";
      if (!raw) return null;
      var name = String(raw).trim();
      if (!name) return null;
      if (Object.prototype.hasOwnProperty.call(idx, name)) return name;
      return null;
    } catch (_) {
      return null;
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

  function loadAtmosphere(cat) {
    var url = "atmospheres/" + encodeURIComponent(cat) + ".txt";
    return fetchTimed(url, 8000)
      .then(function (r) {
        if (r.ok) return r.text();
        return "";
      })
      .catch(function () {
        return "";
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
      var forced = categoryFromUrl(idx);
      var cat = forced != null ? forced : pickCategory(idx);
      if (forced != null) {
        try {
          document.title = cat + " — 生活";
        } catch (_) {}
      }
      var files = (idx[cat] && idx[cat].slice()) || [];
      var n = Math.min(files.length, randInt(3, 6));
      if (files.length && n < 3) n = files.length;

      return loadAtmosphere(cat).then(function (txt) {
        atmos.textContent = txt || " ";
        var picks = shuffle(files).slice(0, n);
        return Promise.all(
          picks.map(function (f) {
            return loadSceneText(cat, f).then(function (body) {
              if (!body.trim()) return;
              placeFragment(buildFragment(body, cat, f));
            });
          })
        ).then(function () {
          var empty = document.getElementById("shard-empty");
          if (empty) empty.hidden = shards.children.length > 0;
        });
      });
    }).catch(function () {
      atmos.textContent = " ";
    });
  }

  run();
})();
