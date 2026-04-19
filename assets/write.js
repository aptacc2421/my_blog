(function () {
  "use strict";

  var LS_DRAFT = "draft";
  var LS_SCENES = "scenes_index";
  var LS_ARCHIVED = "archived_pending";
  var LS_TECH = "tech_index";
  var BLOB_PREFIX = "scene_blob_";
  var TECH_BLOB_PREFIX = "tech_blob_";
  var LS_GH_REPO = "gh_repo";
  var LS_GH_BRANCH = "gh_branch";

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
  var categoryInput = document.getElementById("category-input");

  var mode = "insert";
  var cmdBuffer = "";
  var tabMatches = [];
  var tabIndex = 0;

  function syncBodyClass() {
    document.body.classList.toggle("mode-insert", mode === "insert");
    document.body.classList.toggle("mode-command", mode !== "insert");
    document.body.classList.toggle("mode-ask-category", mode === "askCategory");
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
      if (Object.prototype.hasOwnProperty.call(base, k))
        out[k] = base[k].slice();
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
        if (!db.objectStoreNames.contains(FS_STORE))
          db.createObjectStore(FS_STORE);
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
    cmdline.textContent = "";
    categoryInput.hidden = true;
    categoryInput.value = "";
    buf.tabIndex = 0;
  }

  function renderCmdline() {
    if (mode === "cmdline") {
      cmdline.textContent = ":" + cmdBuffer;
    } else if (mode === "askCategory") {
      cmdline.textContent = "栏目：";
    }
  }

  function openCmdline() {
    mode = "cmdline";
    syncBodyClass();
    cmdBuffer = "";
    categoryInput.hidden = true;
    categoryInput.value = "";
    cmdlineWrap.hidden = false;
    catHint.hidden = true;
    renderCmdline();
  }

  function focusCategoryField() {
    buf.blur();
    window.setTimeout(function () {
      categoryInput.focus({ preventScroll: true });
    }, 0);
  }

  function openAskCategory() {
    mode = "askCategory";
    syncBodyClass();
    tabIndex = -1;
    buf.tabIndex = -1;
    categoryInput.value = "";
    categoryInput.hidden = false;
    var cols = categoriesSorted();
    catHint.textContent = cols.join("　");
    catHint.hidden = false;
    cmdlineWrap.hidden = false;
    renderCmdline();
    buf.blur();
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(focusCategoryField);
    });
  }

  function flashHint(msg, holdMs) {
    var ms = holdMs == null ? 4200 : holdMs;
    catHint.hidden = false;
    catHint.textContent = msg;
    window.setTimeout(function () {
      if (mode === "insert") catHint.hidden = true;
    }, ms);
  }

  function getGhAuth() {
    var token = (localStorage.getItem("gh_pat") || "").trim();
    var repo = (localStorage.getItem(LS_GH_REPO) || "").trim();
    var i = repo.indexOf("/");
    if (!token || i < 1) return null;
    return {
      token: token,
      owner: repo.slice(0, i),
      repo: repo.slice(i + 1),
      branch: (localStorage.getItem(LS_GH_BRANCH) || "main").trim() || "main",
    };
  }

  function encGhPath(relPath) {
    return String(relPath)
      .split("/")
      .map(function (s) {
        return encodeURIComponent(s);
      })
      .join("/");
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function ghGetContentMeta(encPath) {
    var a = getGhAuth();
    if (!a) return Promise.resolve(null);
    var url =
      "https://api.github.com/repos/" +
      encodeURIComponent(a.owner) +
      "/" +
      encodeURIComponent(a.repo) +
      "/contents/" +
      encPath +
      "?ref=" +
      encodeURIComponent(a.branch);
    return fetch(url, {
      headers: {
        Authorization: "Bearer " + a.token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }).then(function (r) {
      if (r.status === 404) return null;
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.message) || String(r.status));
        return j;
      });
    });
  }

  function ghPutFile(relPath, content, message) {
    var a = getGhAuth();
    if (!a) return Promise.reject(new Error("未配置 PAT 或仓库"));
    var enc = encGhPath(relPath);
    return ghGetContentMeta(enc).then(function (meta) {
      var url =
        "https://api.github.com/repos/" +
        encodeURIComponent(a.owner) +
        "/" +
        encodeURIComponent(a.repo) +
        "/contents/" +
        enc;
      var body = {
        message: message,
        content: utf8ToBase64(content),
        branch: a.branch,
      };
      if (meta && meta.sha) body.sha = meta.sha;
      return fetch(url, {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + a.token,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(body),
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error((j && j.message) || String(r.status));
          return j;
        });
      });
    });
  }

  function tryGithubSceneOrQueue(rel, text, idx) {
    if (!getGhAuth()) {
      pushPending(rel, text);
      return Promise.resolve(null);
    }
    return ghPutFile(rel, text, "write: " + rel)
      .then(function () {
        return ghPutFile(
          "scenes/index.json",
          JSON.stringify(idx, null, 2),
          "sync scenes/index.json",
        );
      })
      .then(function () {
        return "已推送到 GitHub。";
      })
      .catch(function (e) {
        pushPending(rel, text);
        return (
          "GitHub 失败，已入队：" + String(e.message || e).slice(0, 72)
        );
      });
  }

  function tryGithubTechOrQueue(rel, text, list) {
    if (!getGhAuth()) {
      pushPending(rel, text);
      return Promise.resolve(null);
    }
    return ghPutFile(rel, text, "write: " + rel)
      .then(function () {
        return ghPutFile(
          "tech/index.json",
          JSON.stringify(list, null, 2),
          "sync tech/index.json",
        );
      })
      .then(function () {
        return "已推送到 GitHub。";
      })
      .catch(function (e) {
        pushPending(rel, text);
        return (
          "GitHub 失败，已入队：" + String(e.message || e).slice(0, 72)
        );
      });
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
    tryGithubSceneOrQueue(rel, text, idx).then(function (hint) {
      if (hint)
        flashHint(hint, hint.indexOf("失败") >= 0 ? 10000 : 4500);
    });
    Promise.all([
      persistToDisk(rel, text),
      persistToDisk("scenes/index.json", JSON.stringify(idx, null, 2)),
    ])
      .then(function () {
        return idbGetRoot();
      })
      .then(function (root) {
        if (root) flashHint("已写入 :bind 绑定的本地目录。", 3200);
      })
      .catch(function (e) {
        var m =
          e && (e.message || e.name) ? String(e.message || e.name) : String(e);
        flashHint(
          "写入本地目录失败：" + m.slice(0, 140) + "。内容已在 localStorage。",
          10000,
        );
        console.error(e);
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
    var a = getGhAuth();
    if (!a) {
      flashHint("请先 :token 保存 PAT，并填写 owner/repo（第二个弹窗）或 :repo。", 9000);
      hideCmdUi();
      setMode("insert");
      buf.focus();
      return;
    }
    var q = getArchivedPending();
    if (!q.length) {
      flashHint("暂无待同步条目。");
      hideCmdUi();
      setMode("insert");
      buf.focus();
      return;
    }
    var chain = Promise.resolve();
    q.forEach(function (item) {
      chain = chain.then(function () {
        return ghPutFile(
          item.path,
          item.content,
          "push: " + item.path,
        );
      });
    });
    chain
      .then(function () {
        return ghPutFile(
          "scenes/index.json",
          localStorage.getItem(LS_SCENES) || "{}",
          "sync scenes/index.json",
        );
      })
      .then(function () {
        return ghPutFile(
          "tech/index.json",
          localStorage.getItem(LS_TECH) || "[]",
          "sync tech/index.json",
        );
      })
      .then(function () {
        setArchivedPending([]);
        flashHint("GitHub 同步完成（" + q.length + " 个文件 + index）。");
      })
      .catch(function (e) {
        flashHint(
          "同步失败：" + String(e.message || e).slice(0, 140),
          12000,
        );
        console.error(e);
      })
      .finally(function () {
        hideCmdUi();
        setMode("insert");
        buf.focus();
      });
  }

  function runToken() {
    var t = window.prompt(
      "GitHub PAT（仅保存在本机 localStorage，不会进仓库）：",
      localStorage.getItem("gh_pat") || "",
    );
    if (t != null && t !== "") localStorage.setItem("gh_pat", t.trim());
    var rep = window.prompt(
      "仓库 owner/repo（例如 yourname/a_opus_plan_version）：",
      localStorage.getItem(LS_GH_REPO) || "",
    );
    if (rep != null && rep.trim().indexOf("/") > 0)
      localStorage.setItem(LS_GH_REPO, rep.trim());
    var saved = [];
    if (t != null && t !== "") saved.push("PAT");
    if (rep != null && rep.trim().indexOf("/") > 0) saved.push("仓库");
    var hint =
      saved.length > 0
        ? "已保存 " + saved.join("、") + "。"
        : "未输入有效内容。";
    if (
      t != null &&
      t !== "" &&
      (!rep || rep.trim().indexOf("/") <= 0)
    )
      hint += " 可用 :repo owner/repo 指定仓库。";
    flashHint(hint, 7000);
    hideCmdUi();
    setMode("insert");
    buf.focus();
  }

  function runRepo(arg) {
    var s = (arg || "").trim();
    if (s.indexOf("/") > 0) {
      localStorage.setItem(LS_GH_REPO, s);
      flashHint("已保存仓库 " + s, 5000);
    } else {
      flashHint(":repo 格式为 owner/repo", 5000);
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
    tryGithubTechOrQueue(rel, text, list).then(function (hint) {
      if (hint)
        flashHint(hint, hint.indexOf("失败") >= 0 ? 10000 : 4500);
    });
    Promise.all([
      persistToDisk(rel, text),
      persistToDisk("tech/index.json", JSON.stringify(list, null, 2)),
    ])
      .then(function () {
        return idbGetRoot();
      })
      .then(function (root) {
        if (root) flashHint("已写入 :bind 绑定的本地目录。", 3200);
      })
      .catch(function (e) {
        var m =
          e && (e.message || e.name) ? String(e.message || e.name) : String(e);
        flashHint(
          "写入本地目录失败：" + m.slice(0, 140) + "。内容已在 localStorage。",
          10000,
        );
        console.error(e);
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
        "当前浏览器不能选本地文件夹（请用 Chrome / Edge）。换浏览器后可用 :bind：在弹窗里选中你的项目根目录（含 assets、scenes 的那一层，例如 a_opus_plan_version）。",
        9000,
      );
      setMode("insert");
      buf.focus();
      return;
    }
    if (!sessionStorage.getItem("bind_folder_tip_v1")) {
      sessionStorage.setItem("bind_folder_tip_v1", "1");
      window.alert(
        "在下一步「选择文件夹」窗口里：\n\n" +
          "• 项目在 WSL：不要点左侧「网络」。在窗口顶部地址栏粘贴：\n" +
          "  \\\\wsl$\\Ubuntu\\home\\你的用户名\\my_websets\\a_opus_plan_version\n" +
          "  （发行版可能是 Ubuntu-22.04 等，在资源管理器里看一下）\n" +
          "  粘贴后按回车，再点右下角「选择文件夹」。\n\n" +
          "• 项目在 Windows 盘：从左侧「此电脑」进 C: 或 D: 找到 a_opus_plan_version 即可。",
      );
    }
    window
      .showDirectoryPicker({ mode: "readwrite" })
      .then(function (dir) {
        return idbPutRoot(dir);
      })
      .then(function () {
        flashHint(
          "已绑定本地目录。:wq / :t 会写入其中的 scenes/、tech/ 与 index.json。",
          8000,
        );
      })
      .catch(function (e) {
        if (e && e.name === "AbortError") {
          flashHint("已取消选择文件夹。", 6000);
        } else {
          var m =
            e && (e.message || e.name)
              ? String(e.message || e.name)
              : String(e);
          flashHint("绑定失败：" + m.slice(0, 160), 12000);
          console.error(e);
        }
      })
      .finally(function () {
        setMode("insert");
        buf.focus();
      });
  }

  function execCommandLine() {
    var line = cmdBuffer.trim();

    if (line === "wq") {
      cmdBuffer = "";
      cmdline.textContent = "";
      catHint.hidden = true;
      runWq();
      return;
    }

    hideCmdUi();
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
    var rm = line.match(/^repo\s*(.*)$/);
    if (rm) {
      runRepo(rm[1] || "");
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
    var prefix = categoryInput.value;
    tabMatches = cols.filter(function (c) {
      return !prefix || c.indexOf(prefix) === 0;
    });
    if (!tabMatches.length) return;
    tabIndex = (tabIndex + 1) % tabMatches.length;
    categoryInput.value = tabMatches[tabIndex];
  }

  function submitCategory() {
    var raw = categoryInput.value.trim();
    var category = raw || "无名之地";
    var idx = ensureScenesIndex();
    var isNew = !Object.prototype.hasOwnProperty.call(idx, category);
    if (isNew) {
      idx[category] = [];
      setScenesIndex(idx);
    }
    archiveScene(category);
    if (isNew) {
      flashHint(
        "记得给它配一张字符画背景（atmospheres/" + category + ".txt）。",
      );
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
      if (ev.target === buf) {
        ev.preventDefault();
        ev.stopPropagation();
        focusCategoryField();
        return;
      }
      var catFocused = ev.target === categoryInput;
      if (catFocused && (ev.isComposing || ev.key === "Process")) {
        return;
      }
      if (catFocused) {
        if (ev.key === "Tab") {
          ev.preventDefault();
          ev.stopPropagation();
          tabCompleteCategory();
          return;
        }
        if (ev.key === "Enter") {
          ev.preventDefault();
          ev.stopPropagation();
          submitCategory();
          return;
        }
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
        categoryInput.value = categoryInput.value.slice(0, -1);
        categoryInput.focus();
        tabIndex = -1;
        return;
      }
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        ev.stopPropagation();
        categoryInput.value += ev.key;
        categoryInput.focus();
        tabIndex = -1;
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
