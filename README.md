# 📑 NiveFlow 全栈自动化工具开发白皮书

## 1. 项目定位

**NiveFlow** 是一个"无感化"的文档发布引擎。开发者只需关注 Git 仓库中的 Markdown 文件，工具会自动处理同步、解析、构建与静态部署，最终输出一个高性能的 Vue 3 单页应用。

## 2. 核心技术栈

* **运行时**: Node.js (v18+) + `tsx` (直接执行 TypeScript)
* **包管理**: pnpm
* **前端框架**: Vue 3 + TypeScript + Vite
* **Git 管理**: `simple-git`
* **任务调度**: `node-cron` (30 分钟轮询)
* **Markdown 解析系统**:
  * `markdown-it` (核心)
  * `markdown-it-katex` (渲染 LaTeX 公式)
  * `shiki` (基于 VS Code 的代码块高亮)
* **进程管理**: PM2 (利用 `ecosystem.config.cjs` 管理环境)

---

## 3. 系统架构

### 3.1 逻辑流

1. **Monitor (后端)**: 依据 PM2 配置的 Cron 表达式，每 30 分钟执行 `git pull`。
2. **Meta 解析**: 读取 Git 根目录下的 `meta.json`，获取标题、Logo、首页路径。
3. **构建触发**: 若检测到文件变更，调用 `vite build`。
4. **渲染 (前端)**: Vite 配合插件将 `.md` 转换为 HTML 字符串，注入样式和代码高亮 CSS。
5. **输出**: 静态资源输出至 `OUTPUT_PATH` 指定的物理路径。

---

## 4. CLI 命令行工具

NiveFlow 提供命令行工具，支持快速初始化和构建：

```bash
# 全局安装（可选）
pnpm link --global

# 初始化项目 - 创建 meta.json 配置文件
nive-flow init

# 构建静态站点
nive-flow build

# 查看帮助
nive-flow --help
```

### 4.1 命令说明

| 命令 | 说明 |
|------|------|
| `nive-flow init` | 在当前目录创建 `meta.json` 配置文件 |
| `nive-flow build` | 将 Markdown 文件构建为静态 HTML，输出到 `_documents` 目录 |

---

## 5. 关键代码实现

### 5.1 自动化配置文件 (`ecosystem.config.cjs`)

将 Git 仓库地址等敏感信息解耦，支持配置输出路径。

```javascript
module.exports = {
  apps: [{
    name: 'nive-flow',
    script: './scripts/monitor.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx',
    env: {
      GIT_REPO_URL: 'https://github.com/nive-studio/docs.git',
      GIT_BRANCH: 'main',
      POLL_INTERVAL: '*/30 * * * *',
      OUTPUT_PATH: '/var/www/nive-docs-html',  // 构建输出路径
      NODE_ENV: 'production'
    }
  }]
};
```

### 5.2 配置项说明

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `GIT_REPO_URL` | 文档 Git 仓库地址 | - |
| `GIT_BRANCH` | Git 分支 | `main` |
| `POLL_INTERVAL` | Cron 轮询表达式 | `*/30 * * * *` |
| `OUTPUT_PATH` | 构建输出目录 | `./_documents` |
| `BUILD_OUTPUT_DIR` | 备用输出目录（兼容旧版） | `./dist` |

### 5.3 后端：同步与构建引擎 (`scripts/monitor.ts`)

```typescript
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import cron from 'node-cron';

const DOCS_SOURCE = path.resolve(__dirname, '../src/docs-temp');

async function syncAndBuild() {
  const git = simpleGit();
  if (!fs.existsSync(DOCS_SOURCE)) {
    await git.clone(process.env.GIT_REPO_URL!, DOCS_SOURCE);
  }
  
  const pull = await git.cwd(DOCS_SOURCE).pull();
  const outputPath = process.env.OUTPUT_PATH || './dist';
  
  if (pull.summary.changes > 0 || !fs.existsSync(outputPath)) {
    console.log('[Build] 检测到变更，正在重新生成网页...');
    execSync(`pnpm build:only --outDir "${outputPath}"`, {
      env: { ...process.env },
      stdio: 'inherit'
    });
  }
}

cron.schedule(process.env.POLL_INTERVAL!, syncAndBuild);
```

### 5.4 前端：Markdown 增强渲染器

```typescript
// src/utils/markdown.ts
import MarkdownIt from 'markdown-it';
import katex from 'markdown-it-katex';
import { createHighlighter } from 'shiki';

const md = new MarkdownIt({ html: true, linkify: true })
  .use(katex);  // 支持 $E=mc^2$

// Shiki 代码高亮
const highlighter = await createHighlighter({
  themes: ['one-dark-pro'],
  langs: ['typescript', 'javascript', 'vue', 'json', 'bash']
});

export async function renderMarkdown(content: string): Promise<string> {
  return md.render(content);
}
```

---

## 6. 项目配置规范 (`meta.json`)

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

## 7. 部署与使用

### 7.1 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

### 7.2 服务器部署

1. **准备环境**: 服务器安装 Node.js (v18+), Git, PM2, pnpm
2. **安装依赖**: `pnpm install`
3. **配置变量**: 修改 `ecosystem.config.cjs` 中的环境变量
   - `GIT_REPO_URL`: 文档仓库地址
   - `OUTPUT_PATH`: 构建输出路径
4. **启动服务**: `pm2 start ecosystem.config.cjs`

### 7.3 自动化流程

* ⏰ 每 30 分钟检查一次仓库
* 📝 自动识别 `meta.json` 更新
* 🔢 自动编译 LaTeX 公式和代码块
* 🌙 支持深色/浅色主题切换
* 📦 自动将最新的 SPA 部署到指定 Web 目录

---

## 8. 项目结构

```
nive-flow/
├── bin/
│   └── nive-flow.js        # CLI 命令行工具
├── scripts/
│   └── monitor.ts          # Git 同步与构建引擎
├── src/
│   ├── components/
│   │   └── ThemeToggle.vue # 主题切换组件
│   ├── styles/
│   │   ├── globals.css     # 全局样式 (深色/浅色模式)
│   │   └── post.css        # Markdown 文章样式
│   ├── views/
│   │   ├── Home.vue        # 首页
│   │   └── DocView.vue     # 文档页
│   ├── utils/
│   │   └── markdown.ts     # Markdown 渲染器
│   ├── App.vue             # 根组件
│   └── main.ts             # 入口文件
├── public/
│   └── meta.json           # 站点配置
├── ecosystem.config.cjs    # PM2 配置
├── vite.config.ts          # Vite 配置
└── package.json
```
