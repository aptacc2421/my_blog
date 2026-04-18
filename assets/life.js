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

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mdToHtml(s) {
    if (!s.trim()) return "<p> </p>";
    return s
      .split(/\n\n+/)
      .map(function (p) {
        return "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>";
      })
      .join("");
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
    var keys = Object.keys(idx);
    if (!keys.length) return "无名之地";
    return keys[Math.floor(Math.random() * keys.length)];
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
      var cat = pickCategory(idx);
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
              var div = document.createElement("div");
              div.innerHTML = mdToHtml(body);
              placeFragment(div);
            });
          })
        );
      });
    }).catch(function () {
      atmos.textContent = " ";
    });
  }

  run();
})();
