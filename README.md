# 极简写作空间

纯静态站点，托管在 GitHub Pages：无构建步骤，内容即 repo 里的 Markdown 与字符画文本。

**完整操作清单（访客路径、写作命令、删改、Git、部署）见 [`OPERATIONS.md`](OPERATIONS.md)。**

## 访客路径

1. **`index.html`（门厅）**：深色底、居中；上方为简短自述（中文 + 英文，英文里可点 **tech** 直达技术页）。下方两个入口：**若有人问起我**（More about me）→ `life.html`；**技术**（Tech）→ `tech.html`。字体由 `assets/style.css` 与异步加载的 `assets/fonts.css` 提供。
2. **生活** `life.html`：随机进入一个栏目，字符画铺底；每个片段只显示**标题**，**点击**进入 **`scene.html`** 阅读该篇 Markdown 全文。刷新即重掷。要看**指定栏目**，在 URL 加 **`?cat=栏目名`**（与 `scenes/index.json` 的 key 一致）。左下角 **回** → 门厅。
3. **技术** `tech.html`：暗色 monospace 页；按 `tech/index.json` 列出标题，点击后用 marked 渲染正文。顶链 **回门厅 · Back** → `index.html`。列表为空时对外只显示一句占位（中文「内容将陆续补充。」/ 英文 *Coming soon.*），不涉及写作页。

写作页 `write.html` 不挂在门厅；只有你本人记 URL 使用。

## 作者：本地写作与归档

- 打开 `write.html`：默认 Insert 模式，内容实时写入浏览器 `localStorage` 的 `draft`。
- `Esc` 进入 Command 模式；按 `:` 在页面底部出现命令行。
- **`:wq`**：按提示输入栏目名后归档到生活侧（空名即「无名之地」）；若已配置 GitHub，会尝试提交 `scenes/<栏目>/<时间戳>.md` 并更新 `scenes/index.json`，否则先入本地队列，之后用 **`:push`** 推送。
- **`:t 标题`**：归档到技术侧 `tech/<日期-slug>.md`，并追加 `tech/index.json`。
- **`:q`**：离开页面，草稿保留；**`:q!`**：丢弃草稿。
- **`:token`** / **`:repo`**：在浏览器里设置 PAT 与 `owner/repo`（仅存 `localStorage`，不进 repo）。

## GitHub PAT 权限

创建 Fine-grained 或 classic token 时，对本仓库至少需要 **`contents: write`**（读写仓库内容以提交文件与更新 index JSON）。不要勾选超出需要的权限。

## 新建栏目（生活侧）

1. 在写作页用 **`:wq`** 输入**新栏目名**并回车：本地会更新索引；若已 `:push`，远程会创建 `scenes/<栏目名>/` 与首条 md。
2. 在仓库中新增 **`atmospheres/<栏目名>.txt`**：纯 ASCII 字符画，与栏目名一致（可参考 `PROMPTS.md` 里的流程）。未放置时前端仍可运行，只是缺少该栏目的背景图。
3. 之后该栏目会出现在 `scenes/index.json` 中，与生活页随机抽取逻辑一致。

技术侧新文：用 **`:t 标题`** 或直接向 `tech/` 添加 md 并手工维护 `tech/index.json`（格式为 `[{ "file": "...", "title": "..." }]`）。

## 未来拆分域名（摘自架构约定）

- **生活域**：拷贝 `life.html`、`write.html`、`assets/style.css`、`assets/fonts.css`、`assets/life.js`、`assets/write.js`、`atmospheres/`、`scenes/`，将 `life.html` 改名为 `index.html`，去掉返回门厅的链接。
- **技术域**：将 `tech.html` 升为 `index.html`，删门厅与生活/写作相关文件与资源。
- 门厅 `index.html` 在拆分后由各自首页替代，不再保留。

## 部署要点

- 仓库根目录开启 **GitHub Pages**（通常 `main` / `root`）即可；根目录已有 **`.nojekyll`**，避免 Jekyll 误处理。
- 本地预览：`python3 -m http.server 8000`，浏览器打开对应路径（若 `localhost` 不通，可用 WSL 下的局域网 IP）。

## 校园网 + WSL：用脚本走 Windows 代理推代码

浏览器能上 GitHub、终端超时，多半是 **终端没走本机 Clash**。本仓库已把 `origin` 设为 **HTTPS**（代理对 `git` 生效；SSH 不走 HTTP 代理）。

1. Windows 上 Clash / 同类软件：**打开「允许来自局域网的连接」**，HTTP 端口默认 **7890**（若不同，见下）。
2. 若仍连不上代理，在 WSL 里执行 `ip route show default`，把「`default via` 后面的 IP」设给脚本（VPN 下 `resolv.conf` 的 nameserver 往往不是宿主机）：  
   `export WSL_WINDOWS_HOST=172.xx.xx.1`（示例，以你机器为准）  
   然后再跑下面的 `wsl-git.sh` / `wsl-curl.sh`。
3. 在 **WSL** 项目根目录执行（把 `master` 换成你的分支名）：

```bash
./scripts/wsl-git.sh push -u origin master
```

4. 第一次 HTTPS 推送会要登录：用 **GitHub 用户名 + PAT**（或已配置的 credential helper）。PAT 权限同上文 **`contents: write`**。
5. 测代理是否通：`./scripts/wsl-curl.sh -I --connect-timeout 10 https://github.com`
6. 代理端口不是 7890 时：`CLASH_HTTP_PORT=你的端口 ./scripts/wsl-git.sh push -u origin master`

离开校园网后若要改回 **SSH** 远程：`git remote set-url origin git@github.com:aptacc2421/my_blog.git`。
