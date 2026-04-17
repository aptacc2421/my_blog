(function () {
  "use strict";

  var LS_DRAFT = "draft";
  var LS_SCENES = "scenes_index";
  var LS_ARCHIVED = "archived_pending";
  var LS_TECH = "tech_index";
  var BLOB_PREFIX = "scene_blob_";
  var TECH_BLOB_PREFIX = "tech_blob_";

  var FS_DB = "minimal-write-fs";
  var FS_STORE = "handles";
  var FS_KEY_ROOT = "projectRoot";

  var DEFAULT_SCENES = {
    雨落狂流之暗: [],
    盛夏大逃亡: [],
    巨大落地窗: [],
    无名之地: [],
  };

  var buf = document.getElementById("buf");
  var catHint = document.getElementById("cat-hint");
  var cmdlineWrap = document.getElementById("cmdline-wrap");
  var cmdline = document.getElementById("cmdline");

  var mode = "insert";
  var cmdBuffer = "";
  var categoryBuffer = "";
  var tabMatches = [];
  var tabIndex = 0;

  function syncBodyClass() {
    document.body.classList.toggle("mode-insert", mode === "insert");
    document.body.classList.toggle("mode-command", mode !== "insert");
  }

  function setMode(next) {
    mode = next;
    syncBodyClass();
  }

  function getLocalScenesIndex() {
    try {
      var raw = localStorage.getItem(LS_SCENES);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") return o;
      }
    } catch (_) {}
    return null;
  }

  function mergeScenes(base, extra) {
    var out = {};
    var k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k].slice();
    }
    for (k in extra) {
      if (!Object.prototype.hasOwnProperty.call(extra, k)) continue;
      var arr = extra[k];
      if (!Array.isArray(arr)) continue;
      if (!out[k]) out[k] = [];
      var seen = {};
      out[k].forEach(function (f) {
        seen[f] = true;
      });
      arr.forEach(function (f) {
        if (!seen[f]) {
          seen[f] = true;
          out[k].push(f);
        }
      });
    }
    return out;
  }

  function setScenesIndex(obj) {
    localStorage.setItem(LS_SCENES, JSON.stringify(obj));
  }

  function ensureScenesIndex() {
    var local = getLocalScenesIndex();
    var merged = mergeScenes(DEFAULT_SCENES, local || {});
    setScenesIndex(merged);
    return merged;
  }

  function hydrateFromFetch() {
    fetch("scenes/index.json")
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (remote) {
        if (!remote || typeof remote !== "object") return;
        var local = getLocalScenesIndex() || {};
        var merged = mergeScenes(mergeScenes(DEFAULT_SCENES, remote), local);
        setScenesIndex(merged);
      })
      .catch(function () {});
  }

  function categoriesSorted() {
    var idx = ensureScenesIndex();
    return Object.keys(idx).sort(function (a, b) {
      return a.localeCompare(b, "zh-CN");
    });
  }

  function isoSceneFilename() {
    return new Date().toISOString().slice(0, 19).replace(/:/g, "-") + ".md";
  }

  /** 第一行非空为标题；去掉行首 markdown ATX 标题的 #（含 ## 等） */
  function firstLineAsTitle(text) {
    var lines = String(text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].trim();
      if (!s) continue;
      return s.replace(/^#{1,6}\s+/, "").trim();
    }
    return "";
  }

  function safeSceneBasenameFromTitle(title) {
    if (!title) return null;
    var stem = title
      .replace(/[/\\:*?"<>|\r\n\t\x00-\x1f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    stem = stem.replace(/^\.+|\.+$/g, "").trim();
    if (!stem) return null;
    if (stem.toLowerCase().endsWith(".md")) stem = stem.slice(0, -4).trim();
    if (!stem) return null;
    if (stem.length > 100) stem = stem.slice(0, 100).trim();
    return stem + ".md";
  }

  function uniqueSceneFilename(idx, category, basename) {
    var list = idx[category] || [];
    if (list.indexOf(basename) === -1) return basename;
    var stem = basename.replace(/\.md$/i, "");
    var n = 2;
    var candidate;
    do {
      candidate = stem + "_" + n + ".md";
      n++;
    } while (list.indexOf(candidate) !== -1);
    return candidate;
  }

  function sceneFilenameFromDraft(text, idx, category) {
    var t = firstLineAsTitle(text);
    var base = safeSceneBasenameFromTitle(t);
    if (!base) return isoSceneFilename();
    return uniqueSceneFilename(idx, category, base);
  }

  function openFsDb() {
    return new Promise(function (resolve, reject) {
      var r = indexedDB.open(FS_DB, 1);
      r.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        if (!db.objectStoreNames.contains(FS_STORE)) db.createObjectStore(FS_STORE);
      };
      r.onsuccess = function () {
        resolve(r.result);
      };
      r.onerror = function () {
        reject(r.error);
      };
    });
  }

  function idbGetRoot() {
    return openFsDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(FS_STORE, "readonly");
        var req = tx.objectStore(FS_STORE).get(FS_KEY_ROOT);
        req.onsuccess = function () {
          resolve(req.result || null);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }

  function idbPutRoot(handle) {
    return openFsDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(FS_STORE, "readwrite");
        tx.objectStore(FS_STORE).put(handle, FS_KEY_ROOT);
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  function writePathUnderRoot(root, relPath, text) {
    var parts = String(relPath).split("/").filter(Boolean);
    if (!parts.length) return Promise.resolve();
    var fileName = parts.pop();
    var chain = Promise.resolve(root);
    parts.forEach(function (seg) {
      chain = chain.then(function (dh) {
        return dh.getDirectoryHandle(seg, { create: true });
      });
    });
    return chain
      .then(function (dir) {
        return dir.getFileHandle(fileName, { create: true });
      })
      .then(function (fh) {
        return fh.createWritable();
      })
      .then(function (w) {
        return w.write(text).then(function () {
          return w.close();
        });
      });
  }

  /** 若曾用 :bind 选过「项目根」（含 assets/、scenes/ 的那一层），则写入该本机目录；浏览器不允许脚本未经弹窗写死路径。 */
  function persistToDisk(relPath, text) {
    return idbGetRoot().then(function (root) {
      if (!root) return;
      var perm = root.requestPermission
        ? root.requestPermission({ mode: "readwrite" })
        : Promise.resolve("granted");
      return perm.then(function (st) {
        if (st !== "granted") return;
        return writePathUnderRoot(root, relPath, text);
      });
    });
  }

  function techFilename(title) {
    var d = new Date().toISOString().slice(0, 10);
    var slug = title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/gi, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) slug = "note";
    return d + "-" + slug + ".md";
  }

  function getArchivedPending() {
    try {
      var raw = localStorage.getItem(LS_ARCHIVED);
      if (raw) {
        var a = JSON.parse(raw);
        return Array.isArray(a) ? a : [];
      }
    } catch (_) {}
    return [];
  }

  function setArchivedPending(arr) {
    localStorage.setItem(LS_ARCHIVED, JSON.stringify(arr));
  }

  function pushPending(path, content) {
    var q = getArchivedPending();
    q.push({ path: path, content: content });
    setArchivedPending(q);
  }

  function getTechIndex() {
    try {
      var raw = localStorage.getItem(LS_TECH);
      if (raw) {
        var a = JSON.parse(raw);
        return Array.isArray(a) ? a : [];
      }
    } catch (_) {}
    return [];
  }

  function setTechIndex(arr) {
    localStorage.setItem(LS_TECH, JSON.stringify(arr));
  }

  function insertAtCursor(textarea, text) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var v = textarea.value;
    textarea.value = v.slice(0, start) + text + v.slice(end);
    var pos = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = pos;
  }

  function saveDraft() {
    localStorage.setItem(LS_DRAFT, buf.value);
  }

  function hideCmdUi() {
    cmdlineWrap.hidden = true;
    catHint.hidden = true;
    cmdBuffer = "";
    categoryBuffer = "";
    cmdline.textContent = "";
  }

  function renderCmdline() {
    if (mode === "cmdline") {
      cmdline.textContent = ":" + cmdBuffer;
    } else if (mode === "askCategory") {
      cmdline.textContent = "栏目：" + categoryBuffer;
    }
  }

  function openCmdline() {
    mode = "cmdline";
    syncBodyClass();
    cmdBuffer = "";
    cmdlineWrap.hidden = false;
    catHint.hidden = true;
    renderCmdline();
  }

  function openAskCategory() {
    mode = "askCategory";
    syncBodyClass();
    categoryBuffer = "";
    var cols = categoriesSorted();
    catHint.textContent = cols.join("　");
    catHint.hidden = false;
    cmdlineWrap.hidden = false;
    renderCmdline();
  }

  function flashHint(msg) {
    catHint.hidden = false;
    catHint.textContent = msg;
    window.setTimeout(function () {
      if (mode === "insert") catHint.hidden = true;
    }, 4200);
  }

  function archiveScene(category) {
    var text = buf.value;
    var idx = ensureScenesIndex();
    var fname = sceneFilenameFromDraft(text, idx, category);
    var rel = "scenes/" + category + "/" + fname;
    if (!idx[category]) idx[category] = [];
    if (idx[category].indexOf(fname) === -1) idx[category].push(fname);
    setScenesIndex(idx);
    localStorage.setItem(BLOB_PREFIX + rel, text);
    pushPending(rel, text);
    Promise.all([
      persistToDisk(rel, text),
      persistToDisk("scenes/index.json", JSON.stringify(idx, null, 2)),
    ]).catch(function () {
      flashHint("项目目录写入失败（权限或 :bind 路径）；内容已在 localStorage。");
    });
    buf.value = "";
    saveDraft();
    hideCmdUi();
    setMode("insert");
    buf.focus();
  }

  function runWq() {
    openAskCategory();
  }

  function runQBang() {
    buf.value = "";
    localStorage.removeItem(LS_DRAFT);
    hideCmdUi();
    setMode("insert");
    buf.focus();
  }

  function runQ() {
    saveDraft();
    window.close();
    window.setTimeout(function () {
      if (window.history.length > 1) window.history.back();
      else window.location.href = "index.html";
    }, 80);
  }

  function runPush() {
    var q = getArchivedPending();
    if (!q.length) {
      flashHint("暂无待同步条目。");
    } else {
      flashHint("离线已就绪 " + q.length + " 条；配置 PAT 后 :push 将同步到 GitHub。");
    }
    hideCmdUi();
    setMode("insert");
    buf.focus();
  }

  function runToken() {
    var t = window.prompt("GitHub PAT（仅保存在本机 localStorage，不会进仓库）：");
    if (t != null && t !== "") {
      localStorage.setItem("gh_pat", t.trim());
      flashHint("PAT 已保存。");
    }
    hideCmdUi();
    setMode("insert");
    buf.focus();
  }

  function runTechTitle(title) {
    if (!title || !title.trim()) {
      flashHint(":t 需要标题。");
      hideCmdUi();
      setMode("insert");
      buf.focus();
      return;
    }
    var name = title.trim();
    var file = techFilename(name);
    var rel = "tech/" + file;
    var text = buf.value;
    var list = getTechIndex();
    list.push({ file: file, title: name });
    setTechIndex(list);
    localStorage.setItem(TECH_BLOB_PREFIX + rel, text);
    pushPending(rel, text);
    Promise.all([
      persistToDisk(rel, text),
      persistToDisk("tech/index.json", JSON.stringify(list, null, 2)),
    ]).catch(function () {
      flashHint("项目目录写入失败；内容已在 localStorage。");
    });
    buf.value = "";
    saveDraft();
    hideCmdUi();
    setMode("insert");
    buf.focus();
  }

  function runBind() {
    hideCmdUi();
    if (typeof window.showDirectoryPicker !== "function") {
      flashHint(
        "当前浏览器不能选本地文件夹（请用 Chrome / Edge）。换浏览器后可用 :bind：在弹窗里选中你的项目根目录（含 assets、scenes 的那一层，例如 a_opus_plan_version）。"
      );
      setMode("insert");
      buf.focus();
      return;
    }
    window
      .showDirectoryPicker({ mode: "readwrite" })
      .then(function (dir) {
        return idbPutRoot(dir).then(function () {
          flashHint(
            "已绑定为当前选中的项目根目录。此后 :wq / :t 会写入该目录下的 scenes/、tech/ 与 index.json（与你在资源管理器里打开的是同一棵树）。"
          );
        });
      })
      .catch(function () {
        flashHint("未绑定（已取消）。仍可只用 localStorage；要写入本机项目请再执行 :bind 并选中 a_opus_plan_version 根目录。");
      })
      .finally(function () {
        setMode("insert");
        buf.focus();
      });
  }

  function execCommandLine() {
    var line = cmdBuffer.trim();
    hideCmdUi();

    if (line === "wq") {
      runWq();
      return;
    }
    if (line === "q!") {
      runQBang();
      return;
    }
    if (line === "q") {
      runQ();
      return;
    }
    if (line === "push") {
      runPush();
      return;
    }
    if (line === "token") {
      runToken();
      return;
    }
    if (line === "bind") {
      runBind();
      return;
    }
    var tMatch = line.match(/^t\s+(.+)$/);
    if (tMatch) {
      runTechTitle(tMatch[1]);
      return;
    }

    setMode("insert");
    buf.focus();
  }

  function tabCompleteCategory() {
    var cols = categoriesSorted();
    var prefix = categoryBuffer;
    tabMatches = cols.filter(function (c) {
      return !prefix || c.indexOf(prefix) === 0;
    });
    if (!tabMatches.length) return;
    tabIndex = (tabIndex + 1) % tabMatches.length;
    categoryBuffer = tabMatches[tabIndex];
    renderCmdline();
  }

  function submitCategory() {
    var raw = categoryBuffer.trim();
    var category = raw || "无名之地";
    var idx = ensureScenesIndex();
    var isNew = !Object.prototype.hasOwnProperty.call(idx, category);
    if (isNew) {
      idx[category] = [];
      setScenesIndex(idx);
    }
    archiveScene(category);
    if (isNew) {
      flashHint("记得给它配一张字符画背景（atmospheres/" + category + ".txt）。");
    }
  }

  function onKeyDownCapture(ev) {
    if (mode === "insert") {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        hideCmdUi();
        setMode("normal");
        buf.focus();
      }
      return;
    }

    if (mode === "normal") {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (ev.key === ":") {
        ev.preventDefault();
        ev.stopPropagation();
        openCmdline();
        return;
      }
      if (ev.key === "i" || ev.key === "I") {
        ev.preventDefault();
        ev.stopPropagation();
        setMode("insert");
        buf.focus();
        return;
      }
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        ev.stopPropagation();
        setMode("insert");
        insertAtCursor(buf, ev.key);
        saveDraft();
        buf.focus();
        return;
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        setMode("insert");
        buf.focus();
        return;
      }
      return;
    }

    if (mode === "cmdline") {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        cmdBuffer = "";
        hideCmdUi();
        setMode("normal");
        buf.focus();
        return;
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        execCommandLine();
        return;
      }
      if (ev.key === "Backspace") {
        ev.preventDefault();
        ev.stopPropagation();
        if (cmdBuffer.length) cmdBuffer = cmdBuffer.slice(0, -1);
        else {
          hideCmdUi();
          setMode("normal");
          buf.focus();
        }
        renderCmdline();
        return;
      }
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        ev.stopPropagation();
        cmdBuffer += ev.key;
        renderCmdline();
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (mode === "askCategory") {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        hideCmdUi();
        setMode("normal");
        buf.focus();
        return;
      }
      if (ev.key === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        submitCategory();
        return;
      }
      if (ev.key === "Tab") {
        ev.preventDefault();
        ev.stopPropagation();
        tabCompleteCategory();
        return;
      }
      if (ev.key === "Backspace") {
        ev.preventDefault();
        ev.stopPropagation();
        categoryBuffer = categoryBuffer.slice(0, -1);
        tabIndex = -1;
        renderCmdline();
        return;
      }
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        ev.stopPropagation();
        categoryBuffer += ev.key;
        tabIndex = -1;
        renderCmdline();
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
    }
  }

  buf.addEventListener("input", saveDraft);

  document.addEventListener("keydown", onKeyDownCapture, true);

  buf.value = localStorage.getItem(LS_DRAFT) || "";
  ensureScenesIndex();
  hydrateFromFetch();
  setMode("insert");
  buf.focus();
})();
