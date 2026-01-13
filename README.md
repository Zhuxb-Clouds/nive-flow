# NiveFlow

> 🚀 零配置 Markdown 文档发布引擎 — 专注写作，自动发布

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## ✨ 特性

- 📝 **零配置** — 放入 Markdown，自动生成精美网站
- 🔄 **自动同步** — 支持 Git 仓库或本地目录，定时自动更新
- 🎨 **主题切换** — 深色/浅色模式，一键切换
- 📐 **LaTeX 公式** — 原生支持数学公式渲染
- 🌈 **代码高亮** — VS Code 级别的语法高亮 (Shiki)
- 📱 **响应式** — 移动端完美适配
- ⚡ **极速构建** — 基于 Vite，秒级热更新

## 🚀 快速开始

```bash
# 安装
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build
```

## 📦 CLI 工具

```bash
# 初始化配置
nive-flow init

# 构建静态站点
nive-flow build
```

## ⚙️ 配置

在文档根目录创建 `meta.json`：

```json
{
  "title": "My Docs",
  "logo": "📚 Docs",
  "indexPath": "README.md",
  "avatar": "https://example.com/avatar.png"
}
```

## 🔧 部署配置

编辑 `ecosystem.config.cjs`：

```javascript
module.exports = {
  apps: [{
    name: 'nive-flow',
    script: './scripts/monitor.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx',
    env: {
      // Git 仓库模式
      GIT_REPO_URL: 'https://github.com/your-org/docs.git',
      
      // 或本地目录模式
      // LOCAL_DOCS_PATH: './docs',
      
      POLL_INTERVAL: '*/30 * * * *',  // 每30分钟同步
      OUTPUT_PATH: '/var/www/docs',
      NODE_ENV: 'production'
    }
  }]
};
```

### 多文档源

```javascript
env: {
  DOCS_REPOS: JSON.stringify([
    { name: "api-docs", url: "https://github.com/org/api-docs" },
    { name: "guides", url: "~/Documents/guides" },
    { name: "notes", url: "./local-notes" }
  ])
}
```

## 🏗️ 项目结构

```
nive-flow/
├── bin/nive-flow.js       # CLI 入口
├── scripts/monitor.ts     # 同步引擎
├── src/
│   ├── components/        # Vue 组件
│   ├── views/             # 页面视图
│   ├── utils/markdown.ts  # Markdown 渲染
│   └── styles/            # 样式文件
├── ecosystem.config.cjs   # PM2 配置
└── meta.json              # 站点配置
```

## 🛠️ 技术栈

| 类别     | 技术                        |
| -------- | --------------------------- |
| 前端     | Vue 3 + TypeScript + Vite   |
| Markdown | markdown-it + Shiki + KaTeX |
| 部署     | PM2 + simple-git            |

## 📄 License

MIT © NiveFlow
