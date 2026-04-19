# 操作说明（全站）

静态站无后台：**内容 = 仓库里的文件**；日常写作主要在 **`write.html`**，也可用编辑器或 GitHub 网页直接改文件。

---

## 一、页面与访客动线

| 页面 | 路径 | 作用 |
|------|------|------|
| 门厅 | `index.html` | 自述文案 + 入口「若有人问起我」→ 生活，「技术」→ 技术侧；英文段内可点 **tech** 链到技术页。 |
| 生活 | `life.html` | 随机一个栏目：字符画背景 + 该栏目片段；刷新重掷；左下 **回** → 门厅。 |
| 技术 | `tech.html` | 列表 + 点击用 marked 渲染正文；**回门厅 · Back** → 门厅。 |
| 写作 | `write.html` | **不挂在门厅**，只作者收藏 URL 使用。 |

---

## 二、写作页：模式与按键

- **Insert 模式（默认）**：直接输入正文；实时写入浏览器 `localStorage` 的 `draft`。
- **`Esc`** → **Normal 模式**（命令模式，无光标条 UI，仅光标样式可能变化）。
- **Normal 下按 `:`** → 底部出现命令行，输入命令后 **`Enter`** 执行。
- **Normal 下按 `i`** → 回到 Insert。
- **命令行里 `Esc`**：取消命令行，回到 Normal；再按 `i` 进入 Insert。

---

## 三、写作页：命令一览

在命令行输入（带前导 `:` 由界面显示，你只需输入下表「输入」部分）：

| 输入 | 作用 |
|------|------|
| `wq` | 归档当前正文到**生活侧**：出现「栏目：」提示；可直接 **`Enter`**（空名 = **无名之地**），或输入已有/新栏目名后 **`Enter`**。新栏目会提示补 `atmospheres/<栏目名>.txt`。归档生成 `scenes/<栏目>/<ISO时间戳>.md`，并更新本地 `scenes/index.json`（及可选 GitHub）。完成后清空编辑区并回到 Insert。 |
| `t <标题>` | 归档到**技术侧**：生成 `tech/<YYYY-MM-DD-slug>.md`，并更新 `tech/index.json`。标题含空格则整段作为标题参数（以实现对标题的匹配规则为准）。 |
| `q` | 离开当前页（关闭标签/后退）；`localStorage` 中 **`draft` 保留**。 |
| `q!` | **丢弃**当前编辑缓冲并删除 `draft`（不保存地退出写作）。 |
| `push` | 将仅存在本地的队列（若有）通过 **GitHub Contents API** 推送到远程（需已 `:token` 且仓库信息正确）。同时会同步索引等（见 `write.js` 实现）。 |
| `token` | 弹出提示，设置/更新 **GitHub PAT**（存 `localStorage`，**不进仓库**）。 |
| `repo owner/repo` | 设置仓库，如 `repo aptacc2421/my_blog`（具体交互以页面提示为准）。 |
| `bind` | （Chrome/Edge）通过 **File System Access** 绑定本地**项目根目录**（含 `assets/`、`scenes/` 的那一层）。绑定后 `:wq` / `:t` 可写入该目录，便于与 `git` 工作流一致。 |

**栏目询问阶段**：可 **`Tab`** 在已有栏目名间补全（若有列表）。

---

## 四、数据落在哪里

| 数据 | 说明 |
|------|------|
| 草稿 | `localStorage.draft` |
| 生活索引 | 与 `scenes/index.json` 合并逻辑以 `write.js` / `life.js` 为准；归档会更新本地索引键值。 |
| 技术索引 | `tech/index.json`；`:t` 会追加条目。 |
| GitHub | 配置 `token` + 仓库后，`:wq` / `:t` 可尝试直接 API 提交；否则先入队，靠 **`:push`** 或本机 **git**。 |

**PAT 权限**：至少 **`contents: write`**（读写仓库内容与更新 JSON）。

---

## 五、不打开写作页时的操作

### 5.1 新增 / 修改内容

- 在 **`scenes/<栏目>/`** 下增删改 `.md` 文件；同步维护 **`scenes/index.json`**（栏目名 → 文件名数组）。
- 在 **`tech/`** 下增删改 `.md`；同步维护 **`tech/index.json`**（`[{ "file": "...", "title": "..." }, ...]`）。
- 生活侧**新栏目**：新建 `scenes/<栏目>/`，在 `scenes/index.json` 增加对应 key；建议补 **`atmospheres/<栏目名>.txt`**（字符画背景）。

### 5.2 删除

| 目标 | 操作 |
|------|------|
| 删除某篇生活片段 | 删除对应 `scenes/<栏目>/某文件.md`，并从 **`scenes/index.json`** 该栏目数组中移除该文件名。 |
| 删除某篇技术文章 | 删除 `tech/某文件.md`，并从 **`tech/index.json`** 中移除对应对象。 |
| 删除整个生活栏目 | 删除 `scenes/<栏目>/`（或其中全部 md），从 **`scenes/index.json`** 删除该 key；可选删除 **`atmospheres/<栏目名>.txt`**。 |

### 5.3 改门厅 / 样式

- 门厅文案与链接：**`index.html`**。
- 全站书写向样式：**`assets/style.css`**、**`assets/fonts.css`**。
- 生活页逻辑：**`assets/life.js`**；技术页逻辑：**`assets/tech.js`**；技术页外观内联：**`tech.html`**。

---

## 六、Git 与 GitHub

### 6.1 常规（能直连或已配代理）

```bash
git add -A
git commit -m "说明"
git push
```

远程可为 HTTPS 或 SSH，以你 `git remote -v` 为准。

### 6.2 校园网 + WSL（终端需走本机 Clash）

```bash
./scripts/wsl-curl.sh -I --connect-timeout 10 https://github.com   # 测代理
./scripts/wsl-git.sh push -u origin master                         # 分支名按实际修改
```

端口非 `7890` 时：`CLASH_HTTP_PORT=端口 ./scripts/wsl-git.sh push ...`  
若代理目标 IP 不对：`export WSL_WINDOWS_HOST=默认网关IP` 后再执行（见 `README.md`）。

### 6.3 GitHub 仓库网页设置（首次部署）

1. **Settings → Pages**：**Branch** 选推送分支，**Folder** 选 **`/ (root)`**。  
2. 站点地址一般为：`https://<用户>.github.io/<仓库名>/`  
3. 写作页示例 URL：`.../write.html`（需随仓库一起推送）。

---

## 七、本地预览

在项目根目录：

```bash
python3 -m http.server 8000
```

浏览器访问 `http://localhost:8000/`（若本机 `localhost` 异常，可用 WSL 的局域网 IP 替代）。

---

## 八、相关文件索引

| 文件 | 用途 |
|------|------|
| `README.md` | 概览、部署、WSL 代理、拆分域名摘要 |
| `PLAN.md` | 原始设计与数据格式约定 |
| `PROMPTS.md` | 字符画生成用 prompt 参考 |
| `scripts/wsl-proxy-env.sh` | 被 `wsl-git.sh` / `wsl-curl.sh` 引用，设置代理环境变量 |

更细的格式约定见 **`PLAN.md`** 第三章；写作命令实现细节以 **`assets/write.js`** 为准。
