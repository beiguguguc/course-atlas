# 知序 · 课程知识库

独立的 React + TypeScript + Vite 网站。按学期 → 课程 → 章节 → 知识点逐层浏览，支持 Markdown、LaTeX 公式、分开查看的例题与解答。

## 本地启动

需要 Node.js 20.19+ 或兼容版本。

```powershell
npm.cmd ci
npm.cmd run dev
```

打开终端显示的 Local URL，默认 `http://127.0.0.1:4186/`。首次安装依赖需要联网；运行网站不需要 AI、API Key 或在线字体。请通过 HTTP 服务使用本项目，不能直接双击构建后的 index.html。

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`dist/` 是完整可部署文件；`npm run preview` 用来检查构建结果。网址里的哈希路由支持 GitHub Pages 子目录部署和刷新。

## 数据与课件整理

- 初始课程数据：`src/seed.json` 当前为空。新知识库从空白开始；旧版预置示例会清理一次，保留用户自行添加或修改的内容及必要上级，并提供清理前备份下载。刷新不会重新填充示例。
- 数据类型、验证、合并、MD转换：`src/model.ts`。
- 本地数据库：`src/db.ts`，通过 Dexie 管理 IndexedDB 事务。
- 界面与编辑：`src/App.tsx`、`src/Editor.tsx`、`src/styles.css`。
- 学期封面、课程目录与连续转场：`src/BrowseSurface.tsx`、`src/browse.css`。
- 数据结构说明：[`public/docs/DATA-STRUCTURE.md`](public/docs/DATA-STRUCTURE.md)。
- 完整批量示例：[`public/examples/course-batch.json`](public/examples/course-batch.json)。
- 增量知识点示例：[`public/examples/knowledge-points-batch.json`](public/examples/knowledge-points-batch.json)。

「合并导入 JSON」保留已有内容；「更新知识点 JSON」用导入版本整体覆盖同编号知识点；「恢复完整备份」用于将整个知识库回到备份状态，需要额外勾选确认，操作前可先导出当前备份。

JSON 合并导入规则：新增 ID 加入、已有 ID 保留原内容。选择「更新知识点 JSON」时，同编号的知识点由文件中的完整版本替换，例题列表也整体替换；同编号的学期、课程和章节仍保留，文件外的记录不变。更新前显示新增、更新和保留数量，并自动保存最近一次更新前的整库备份，可在「导入与备份」中下载。内容相同的记录不重复更新。

更新文件沿用现有 `schemaVersion: 1` 格式与稳定 ID，不按标题匹配。省略的可选字段使用默认值，因此更新文件应包含想保留的完整知识点。层级错误会拒绝整批导入。页面会先显示预览数量，再由用户确认。导入 .md 时，先进入编辑器检查，保存后才写入。

## 界面与动效

顶部搜索旁提供「使用教程与说明」。正文维护在 [`src/content/user-guide.md`](src/content/user-guide.md)，由 `src/GuideModal.tsx` 渲染为带目录的阅读窗口，支持直接复制 AI 提示词和下载完整 Markdown。开头提供将教程交给外部 AI 的快捷用法；手册包含新手流程、功能介绍、Markdown 与 JSON 导入、目录分组、关联、备份迁移、常见问题和整理提示词。

教程界面示例图维护在 `public/docs/images/`，只使用演示数据。Markdown 使用公开图片链接，下载后联网可查看；站内渲染为当前部署目录下的资源，可点击放大。`GuideModal.tsx` 只允许这几张指定图片。新增教程图片时，同时更新文件和白名单。修改教程后重新构建发布即可更新，无需修改课程数据。

普通知识点支持随正文携带的 PNG、JPEG、WebP Base64 图片，由 `src/EmbeddedImage.tsx` 检查数据类型、文件头和大小，显示后可点击放大。图片保存在用户浏览器及备份中，不上传到公共仓库，也不请求远程图片地址。普通外链和文件路径仍显示为说明文字；Markdown 的默认危险链接过滤和禁用原始 HTML 规则保留。

课程页面的「课程总览」默认展示全部章节、主题、子主题和知识点名称，不需要逐章点击展开。使用紧凑的多栏文字目录，窄屏自动变为单栏；点击具体名称仍可直接阅读。搜索可匹配章节、分组或知识点，并保留匹配项的上层路径。

知识点可设置 `outlinePath`（最多5层分组路径），例如 `['知识主题','子主题']`；在知识点编辑页用 `>` 分隔填写，Markdown 使用 `## 目录分组` 一节。没有分组的旧笔记仍正常显示。目录归类不改变所属章节，也不自动推断概念之间的逻辑关系。

已有笔记只需调整目录时，可合并导入 `{"schemaVersion":1,"nodes":[],"outlineUpdates":[{"id":"已有知识点编号","outlinePath":["主题","子主题"]}]}`。这类更新只调整分组路径，保留原有标题、正文、例题、备注和关联，并自动保存更新前的整库备份。重复导入相同路径没有额外改动；未知编号或非法路径会整批拒绝。普通内容覆盖导入未提供 `outlinePath` 时保留原分组，显式提供空数组才取消分组。

知识点底部支持「添加关联」：搜索同课程或其他课程中的知识点，可附上一句说明。关联自动双向显示，可以修改说明或移除；移除关联不会删除笔记。从关联跳转后，页面顶部可以返回来源知识点，并保留本次浏览的内容页签与滚动位置。

关联独立保存在本地数据库，覆盖导入知识点不会移除手动关联。完整 JSON 备份包含关联；合并导入添加新关联，已有同一对知识点的关联及说明保留。恢复整库时，使用备份中的关联替换本地关联；旧备份不含关联时，恢复后的关联为空。删除课程、章节或知识点时，一并清理涉及被删内容的关联。

整体使用白色背景，蓝色用于按钮、图标和选中状态。首页以学期封面展示，进入学期、课程与章节时，用 Motion 的共享布局转场连接原来的入口与新页面的标题、图标和内容区域。返回沿原路径收回，并保留各层的滚动位置。

系统开启减少动态效果时，关闭布局变形和悬停位移。动效只影响显示，不改变知识库的数据结构或保存方式。

每个知识点预留 `sourceFile`（来源文件）、`sourcePage`（页码或范围）、`supplement`（Markdown补充说明）。这几个字段不涉及原文件上传。

## 内容存在哪里

内容只保存在当前站点地址下的浏览器 IndexedDB 中，不会自动上传到 GitHub。不同设备、浏览器以及不同站点地址的数据独立；本地预览和 GitHub Pages 也各有自己的数据库。换设备、换网址、清理浏览器数据前请导出 JSON 备份，再到新地址合并导入。

本版本不包含账户、云同步或多人协作编辑。其他人访问公开网址时，会拥有各自的本地知识库。

## GitHub Pages

仓库已提供 `.github/workflows/pages.yml`。将完整源代码推送到自己的独立仓库，并在 GitHub Settings → Pages 中选择 GitHub Actions，推送 main 分支即可构建、发布 `dist/`。不要把此项目覆盖到其他工具的仓库根目录，也不要将个人浏览器导出的知识库备份提交到公共仓库。

## 安全与无障碍

Markdown 使用 react-markdown、remark-gfm、remark-math、rehype-katex；不启用原始HTML，保留默认危险链接协议过滤，KaTeX 禁用信任模式。数据导入有大小、字段和层级验证，不执行输入内容。

支持键盘、对话框焦点、移动布局及 `prefers-reduced-motion`。公式字体与脚本随网站一起打包。

## 示例与测试说明

网站默认从空白知识库开始。`public/examples/` 中的 JSON 文件仅供下载、了解导入格式，不会自动加载。`tests/fixtures/legacy-seed.json` 仅用于旧版示例清理和数据逻辑测试。

测试中的回归公式采用常见最小二乘定义，三个观测点的系数与残差平方和有独立数值测试。参考 Penn State STAT 501 的 Simple Linear Regression：<https://online.stat.psu.edu/stat501/Lesson01>。

视觉参考 Mobbin 的留白和层次，页面围绕课程阅读独立设计。
