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
- 数据结构说明：[`public/docs/DATA-STRUCTURE.md`](public/docs/DATA-STRUCTURE.md)。
- 完整批量示例：[`public/examples/course-batch.json`](public/examples/course-batch.json)。
- 增量知识点示例：[`public/examples/knowledge-points-batch.json`](public/examples/knowledge-points-batch.json)。

「合并导入 JSON」保留已有内容；「恢复完整备份」用于将整个知识库回到备份状态，需要额外勾选确认，操作前可先导出当前备份。

JSON 合并导入规则：新增 ID 加入、已有 ID 保留原内容；不覆盖已有笔记。层级错误会拒绝整批导入。页面会先显示预览数量，再由用户确认。导入 .md 时，先进入编辑器检查，保存后才写入。

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
