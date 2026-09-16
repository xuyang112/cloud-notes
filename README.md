# NOTE · 个人技术笔记

Vite + React + TypeScript + React Router + Tailwind CSS + Tiptap。
云端仅使用托管的 Supabase（数据库、邮箱密码登录、图片存储），前端直接调用 Supabase JS SDK；前端托管在 Cloudflare Pages。没有 Node 后端，没有自建数据库，也不需要服务器。

## 当前交付状态

- 本地前台与管理预览已实现，附带 5 篇原创示例。示例不取自参考网站。
- 未配置 Supabase 时，进入**本机预览模式**。管理页明确提示数据只在当前浏览器，刷新后保留，但不同设备/浏览器不共享。
- `.env` 两项同时配置后，使用真实 Supabase Auth、数据库和 Storage，不再读写本机预览笔记；云端失败不会偷偷退回本机模式。
- Supabase 建表、RLS 基础检查和管理员授权已完成；本机已连接真实项目，并验证管理员登录、笔记保存及刷新后读取。
- GitHub Actions 保活 workflow 已提供，仓库 Secrets 尚未配置；Cloudflare Pages 部署和域名绑定尚未完成。
- 本地效果已确认。**本地预览数据不会自动上传到云端**，原有本机预览数据保留，正式笔记以 Supabase 为准。

## 本地预览

需要 Node.js 22.12+（本机已使用 Node 24 验证），首次运行：

```bash
npm ci
npm run dev
```

打开终端打印的地址，默认 `http://127.0.0.1:5173`。

- 首页：`http://127.0.0.1:5173/`
- 示例文章：`http://127.0.0.1:5173/notes/java-getting-started`
- 管理预览：`http://127.0.0.1:5173/admin`
- 登录页：`http://127.0.0.1:5173/admin/login`

首次启动无需账号，公开页面有“本机预览”标记。预览数据保存在浏览器 `localStorage` 的 `note-local-preview-v1`，只能在这个浏览器中使用，空间有限；不要在这里长期写正式笔记。先导出备份，再清理浏览器数据。大图片可能使本地空间不足，此时会显示保存失败，而不是“已保存”。

```bash
npm run build
npm run preview
```

`build` 执行 TypeScript 检查并输出 `dist/`；`preview` 默认在 `http://127.0.0.1:4173`。

## 创建 Supabase 项目

1. 在 [Supabase](https://supabase.com/dashboard) 创建免费项目，选择可用的海外区域，妥善保管数据库密码。
2. 在 SQL Editor 新建查询，执行完整的 `supabase/schema.sql`。它会创建 `categories`、`notes`、管理员白名单、更新时间触发器、RLS、图片桶和四个初始分类。不包含你的正式笔记。
3. 在 Authentication > Users 手动新增你自己的邮箱密码账户，并启用邮箱确认/直接确认此账户。网站没有公共注册入口；在 Auth 设置中关闭新用户注册。
4. 从 Users 页取得你的 UUID，在 SQL Editor 执行以下语句。只需把示例 UUID 换成你自己的，不要把真实账号密码写入代码：

```sql
insert into note_private.admins (user_id)
values ('00000000-0000-0000-0000-000000000000')
on conflict do nothing;
```

5. 核查 Project Settings / API Keys，取得项目 URL 和客户端 anon key（或 publishable key）。**禁止使用 service_role key、secret key 或数据库密码作为前端环境变量。**
6. 在 Auth URL Configuration 将 Site URL 设置为 `site.config.mjs` 中的 `SITE_URL`。需要使用预览站登录时，可把实际的 Pages URL 和本地地址加入允许的 redirect URL；本站使用邮箱密码直接登录，不依赖邮件回跳。不要把所有域名通配放进白名单。

### 数据权限

匿名访客、普通登录用户只能读取已发布笔记；只有 `note_private.admins` 白名单里的用户才能读取草稿及增删改。不能通过注册账号或修改用户 metadata 自封管理员。分类对所有人可读，但只有管理员可写。

图片桶 `note-images` 最大单文件 5 MB，只允许 PNG/JPEG/WebP/GIF，只有白名单管理员可以上传/修改/删除自己的路径。**图片采用公开 URL，知道图片地址的人可读取，包括草稿中引用的图片**，因此不要上传敏感资料。删除笔记不会自动删除可能被别的笔记引用的图片；定期在 Storage 面板手动清理不再引用的图片。

在数据库更新时通过 `updated_at` 做乐观锁检查。其他设备已更新同一篇时，本机不会静默覆盖，会显示冲突；可以先用编辑页的“导出当前笔记”保留未保存内容，再刷新并合并修改。

## 配置环境变量

在项目根目录基于 `.env.example` 创建 `.env`：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

修改后重启 dev server。`.env` 已被 Git 忽略，`.env.example` 不含密钥。

注意：Vite 的 `VITE_` 变量会进入浏览器构建产物，anon/publishable key 本来就是客户端公开凭证，实际权限由 RLS 保护。不能把“使用 .env”理解为密钥不会出现在浏览器里。

配置后 `/admin` 要求登录。初次云端工作区没有笔记，可以直接新建。错误提示会报告网络、权限或表不存在等问题，不会显示本地示例来掩盖云端故障。

## 写作与管理

1. 打开 `/admin` 并使用自己的邮箱密码登录。
2. “新建笔记”创建未发布草稿。填写标题、分类和 slug，点击“生成”可根据标题生成 slug；slug 必须唯一，支持中文、数字、连字符、下划线。后续改 slug 会改变公开链接，旧链接不会自动重定向。
3. Tiptap 工具栏支持标题、粗体、斜体、字体颜色、链接、列表、引用、代码、表格、图片、撤销重做。选中文字后点击带颜色下划线的字体颜色图标，可以选择常用色、自定义色或恢复默认颜色；没有选择文字时，新输入的文字使用选定颜色。代码块保留语法高亮，不覆盖其中的颜色；选中代码块可切换 Java、SQL、C、C++ 等语言。表格选中后可添加/删除行列。
4. 粘贴/拖入图片或点击图片按钮，配置云端后直接上传到 Supabase Storage。上传结束才插入正文；失败会给出提示。
5. 停止修改 2 秒后自动保存，观察“已保存”状态。保存图标可立即保存。网络异常时内容留在当前编辑器，可重试或导出当前笔记；离开页面前会尝试保存，刷新/关闭窗口有未保存警告。
6. 勾选“发布文章”后，保存成功即可在公开站看到；管理列表也可发布/下架。删除需要确认，无法撤销，请先备份。
7. `/admin/categories` 可新增、修改、排序和删除分类。分类只有一层，分类下直接挂文章；有笔记的分类不能直接删除。

首页分类过滤、标题+正文搜索都针对已发布笔记。当前实现读取 RLS 允许的数据后在浏览器匹配，中文关键词也可用；按 500 条分页读取，避免单次 API 默认上限造成漏导出。个人小规模笔记适用，内容量显著增大时可再改为数据库全文搜索与分页，减少传输量。

正文折叠由 `src/components/Tutorial.tsx` 统一提供，默认展开。状态保存在 `note-tutorial-collapsed`，跨文章和刷新保持；标题、上一篇/下一篇始终保留，正文以 250ms 高度动画完全收起。不需给单篇添加组件。

## 导出备份

管理页点击“导出备份”，下载 `NOTE-backup-YYYY-MM-DD.zip`，包含：

```text
notes/          每篇 Markdown，含标题、分类、slug、发布状态及时间
assets/         下载到本地的图片
notebook.json   完整原始数据（含 Tiptap JSON、草稿和分类）
README.txt      导出时间、数量和图片打包警告
```

普通表格转换成 GFM Markdown 表格；合并单元格表格保留内嵌 HTML，原始 JSON 同时保留，不丢弃结构。代码块保留语言标签。字体颜色用内嵌 `<span style="color: ...">` 保留（Markdown 本身没有颜色语法，部分阅读器会过滤内联样式）；原始 JSON 也保留完整颜色信息。外部图片可能因 CORS、失效或网络问题无法下载，此时 Markdown 保留原地址，并在 ZIP 内记录警告；收到警告必须另行备份这些图片，不要把它当作完整离线备份。

编辑页下载图标导出**当前编辑内容**，即使保存失败也可用于抢救未保存的修改。建议每次重要修改后导出，并定期将 ZIP 放到另一台设备或个人云盘。这里提供的是文件备份，不包含自动恢复/批量导入界面；`notebook.json` 保留了后续恢复需要的原始字段。

## Cloudflare Pages 部署

建议在本地预览确认、Supabase 权限检查通过后操作。只部署静态 `dist/`，不要创建 Pages Functions 或自己的后端。

### Git 集成发布

1. 将项目推送到 GitHub 仓库 [xuyang112/cloud-notes](https://github.com/xuyang112/cloud-notes)（不要提交 `.env`、`node_modules`、`.local`）。
2. 在 Cloudflare 的 Workers & Pages 中创建 **Pages** 项目并连接 GitHub，选择仓库。
3. 构建配置：

| 项目 | 值 |
| --- | --- |
| 项目名（建议） | `cangxinge-notes`，若被占用自行更换 |
| Production branch | `main` |
| Framework preset | React / Vite，或手动配置 |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 仓库根目录 |
| Node.js | 设置 `NODE_VERSION=24`，或使用仓库 `.node-version` |

4. Production 和 Preview 环境均填写 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。如果预览环境也用正式数据库，预览站管理操作会直接影响正式数据。
5. 部署后先打开 Cloudflare 实际分配的 `https://<项目名>.pages.dev`，验证登录、写入、图片、刷新文章深层链接。
6. 之后每次推送 `main`，Pages 自动重新构建。修改的是 Supabase 中的文章内容时无需重新部署前端。修改环境变量/域名代码配置时需要重新构建。

`public/_redirects` 提供 React Router 深层路径回退，`public/_headers` 提供基础浏览器安全头。

### 手动命令发布（可选）

Git 集成之外，也可选择 Direct Upload 项目。不要随意在两种创建方式间来回切换：

```bash
npx wrangler login
npx wrangler pages project create cangxinge-notes --production-branch main
npm run build
npx wrangler pages deploy dist --project-name cangxinge-notes --branch main
```

预览分支发布：

```bash
npm run build
npx wrangler pages deploy dist --project-name cangxinge-notes --branch preview
```

手动上传前必须在本地 `.env` 配置 Supabase，因为静态产物使用构建时变量。这里只给出操作命令，尚未代你创建 Pages 项目或发布。

### 自有域名与免费预览域名

- 目标生产 URL：`https://cangxinge.xyz`。
- `SITE_URL` 唯一代码配置源：`site.config.mjs`。域名文字、页脚均从它派生，改域名只改这一处代码；外部平台的 DNS/域名关联和 Supabase Auth URL 仍需同步修改。
- 建议 Pages 项目名对应 `https://cangxinge-notes.pages.dev`，但只有项目创建成功后才确定实际地址，当前不是已上线地址。
- 分支预览常见形式为 `https://preview.<项目名>.pages.dev`，以每次部署输出为准。

绑定根域名时，先将 `cangxinge.xyz` 添加为 Cloudflare zone，并在域名注册商处把 nameserver 改为 Cloudflare 给出的地址。**更改前核对并保留已有 DNS 记录，尤其是邮箱 MX/TXT，避免影响其他服务。**再到 Pages 项目 > Custom domains > Set up a domain 添加域名，等待 DNS 和证书生效。不要只手动加 CNAME 而漏掉 Pages 域名关联。

使用 Cloudflare 全球 Pages 方案，不选择中国网络/国内服务器；页面不显示备案号。平台规则、地区可达性和免费额度以控制台与官方政策为准，免费不意味着可无限使用。保留 `pages.dev` 地址，不创建强制跳转到自有域名的规则，方便先看预览。

## GitHub Actions 保活

文件：`.github/workflows/keep-alive.yml`。

1. 在 GitHub 仓库 Settings > Secrets and variables > Actions > New repository secret 添加：
   - `SUPABASE_URL`：项目 URL，与前端 URL 相同。
   - `SUPABASE_ANON_KEY`：客户端 anon/publishable key，不用 service_role。
2. 确保 workflow 已提交到默认分支，仓库 Actions 已启用。
3. 在 Actions 中打开 “Supabase keep-alive”，点 Run workflow 手动运行，确认成功。
4. 它在每月 1、4、7……日 UTC 04:17（北京时间 12:17）请求一次公开 REST API，读取最多一个已发布笔记 ID；月界可能缩短间隔，不是严格每 72 小时。空站返回 `[]` 也会实际执行数据库查询。
5. 请求有超时与失败重试；非成功 HTTP 状态或非数组响应使任务失败。Secret 不打印到日志。不需要 checkout，也没有仓库写权限。

**保活是尽力而为，不是永久在线保证。** Supabase 官方描述免费计划在 7 天低活跃期间可能被暂停，并不保证一次轻量请求就必定避免暂停。GitHub schedule 可能延迟/丢失；公开仓库 60 天无活动会自动禁用计划任务。定期检查 Actions 状态、保留失败邮件通知，禁用后手动重新启用。项目已暂停时需到 Supabase Dashboard 恢复，再手动运行保活。免费方案不能承诺 SLA，也不能用保活替代备份。

## 样式和配置

- `site.config.mjs`：站名、唯一站点 URL、版权年份、Pages 项目名。
- `src/styles.css` 的 `:root`：`--note-primary`、`--note-font-size`、`--note-title-size`、`--note-line-height`、`--note-sidebar-width`、`--note-content-width`、`--note-page-padding`、`--note-section-gap`、`--note-code-size`。
- 同文件 `@theme`：Tailwind 的语义颜色和字体。
- `src/data/seed.ts`：本机预览的 5 篇示例 JSON，不是正式数据库。
- `public/images/java-workflow.png`：原创示意图，生成源在 `scripts/create-example-image.ps1`，没有引用参考站图片。

## 验证

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

Windows 已安装 Edge 时也可在 PowerShell 使用：

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

端到端测试默认使用未配置 Supabase 的本机预览，不应对正式笔记运行破坏性测试。覆盖文章真实渲染、标题/正文搜索、折叠状态跨刷新/换页、移动端导航、编辑自动保存、分类操作、ZIP 内容校验等。截图与验证 ZIP 存在 `.local/`，该目录不提交。

云端上线前还需要用真实项目验收：匿名不能读草稿/写数据、普通账号不能冒充管理员、管理员可以读写和上传、不同设备读取同一文章、两端冲突提示、Pages 深链刷新和域名 HTTPS。这些检查不能用本地预览测试代替。

## 官方参考

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage 权限](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase 免费项目暂停说明](https://supabase.com/docs/guides/deployment/going-into-prod#availability)
- [Cloudflare Pages React 部署](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Cloudflare Pages 自定义域名](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [GitHub Actions schedule 限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
