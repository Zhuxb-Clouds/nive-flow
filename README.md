# 📑 NiveFlow 全栈自动化工具开发白皮书

## 1. 项目定位

**NiveFlow** 是一个“无感化”的文档发布引擎。开发者只需关注 Git 仓库中的 Markdown 文件，工具会自动处理同步、解析、构建与静态部署，最终输出一个高性能的 Vue 3 单页应用。

## 2. 核心技术栈

* **运行时**: Node.js (v18+) + `tsx` (直接执行 TypeScript)
* **前端框架**: Vue 3 + TypeScript + Vite
* **Git 管理**: `simple-git`
* **任务调度**: `node-cron` (30 分钟轮询)
* **Markdown 解析系统**:
* `markdown-it` (核心)
* `markdown-it-katex` (渲染 LaTeX 公式)
* `shiki` (基于 VS Code 的代码块高亮)


* **进程管理**: PM2 (利用 `ecosystem.config.js` 管理环境)

---

## 3. 系统架构

### 3.1 逻辑流

1. **Monitor (后端)**: 依据 PM2 配置的 Cron 表达式，每 30 分钟执行 `git pull`。
2. **Meta 解析**: 读取 Git 根目录下的 `meta.json`，获取标题、Logo、首页路径。
3. **构建触发**: 若检测到文件变更，调用 `vite build`。
4. **渲染 (前端)**: Vite 配合插件将 `.md` 转换为 HTML 字符串，注入  样式和代码高亮 CSS。
5. **输出**: 静态资源输出至 PM2 中 `BUILD_OUTPUT_DIR` 指定的物理路径。

---

## 4. 关键代码实现

### 4.1 自动化配置文件 (`ecosystem.config.js`)

将 Git 仓库地址等敏感信息解耦。

```javascript
module.exports = {
  apps: [{
    name: 'autodoc-engine',
    script: './scripts/monitor.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx', // 直接运行 TS 脚本
    env: {
      GIT_REPO_URL: 'https://github.com/nive-studio/docs.git',
      GIT_BRANCH: 'main',
      POLL_INTERVAL: '*/30 * * * *',
      BUILD_OUTPUT_DIR: '/var/www/nive-docs-html', // 最终网页存放地
      NODE_ENV: 'production'
    }
  }]
};

```

### 4.2 后端：同步与构建引擎 (`scripts/monitor.ts`)

```typescript
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import cron from 'node-cron';

const DOCS_SOURCE = path.resolve(__dirname, '../src/docs-temp');

async function syncAndBuild() {
  const git = simpleGit();
  if (!fs.existsSync(DOCS_SOURCE)) await git.clone(process.env.GIT_REPO_URL!, DOCS_SOURCE);
  
  const pull = await git.cwd(DOCS_SOURCE).pull();
  
  // 变更检测：有新文件或输出目录不存在时构建
  if (pull.summary.changes > 0 || !fs.existsSync(process.env.BUILD_OUTPUT_DIR!)) {
    console.log('[Build] 检测到变更，正在重新生成网页...');
    
    // 执行 Vite 构建，通过环境变量传递 meta 数据给前端
    execSync(`pnpm build`, {
      env: { ...process.env },
      stdio: 'inherit'
    });
  }
}

cron.schedule(process.env.POLL_INTERVAL!, syncAndBuild);

```

### 4.3 前端：Markdown 增强渲染器

```typescript
// src/utils/markdown.ts
import MarkdownIt from 'markdown-it';
import mdKatex from 'markdown-it-katex';
import shiki from 'markdown-it-shiki';

const md = new MarkdownIt({ html: true })
  .use(mdKatex) // 支持 $E=mc^2$
  .use(shiki, { theme: 'one-dark-pro' }); // 支持代码高亮

export const renderMarkdown = (content: string) => md.render(content);

```

---

## 5. 项目配置规范 (`meta.json`)

此文件需放在 Git 仓库根目录，用于驱动前端 UI。

```json
{
  "title": "Nive Game Docs | 飞雪工作室 共识文档",
  "logo": "Nive Docs",
  "indexPath": "README.md",
  "avatar": "https://huashuo-oss.oss-cn-beijing.aliyuncs.com/icon.ico"
}

```

---

## 6. 部署与使用

1. **准备环境**: 服务器安装 Node.js, Git, PM2, pnpm。
2. **安装依赖**: `pnpm install`。
3. **配置变量**: 修改 `ecosystem.config.cjs` 中的 `GIT_REPO_URL` 和 `BUILD_OUTPUT_DIR`。
4. **启动服务**: `pm2 start ecosystem.config.cjs`。
5. **自动化流程**:
* 每 30 分钟检查一次仓库。
* 自动识别 `meta.json` 更新。
* 自动编译  公式和代码块。
* 自动将最新的 SPA 部署到固定 Web 目录。

