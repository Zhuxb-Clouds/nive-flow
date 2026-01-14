# NiveFlow

> 🚀 零配置 Markdown 文档发布引擎 — 专注写作，自动发布

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## ✨ 特性

- 📝 **零配置** — 放入 Markdown，自动生成精美网站
- 🔄 **Webhook 触发** — 支持 Git 仓库或本地目录，通过 HTTP 接口触发构建
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
      DOCS_REPOS: [
        {
          name: "docs",
          url: "https://github.com/your-org/docs.git",  // Git 仓库
          branch: "main",
          outputPath: "dist/docs"
        },
        {
          name: "notes",
          url: "/path/to/local/notes",  // 本地目录
          outputPath: "dist/notes"
        }
      ],
      WEBHOOK_PORT: 3001,  // Webhook 监听端口
      NODE_ENV: 'production'
    }
  }]
};
```

## 🔌 Webhook API

启动服务后，可通过 HTTP 接口触发构建：

```bash
# 触发构建
curl http://localhost:3001/webhook
# 或
curl -X POST http://localhost:3001/build

# 健康检查
curl http://localhost:3001/health
# 返回: {"status":"ok","building":false}
```

适合与 Git Hooks、CI/CD 或其他自动化工具集成。

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

| 类别     | 技术                          |
| -------- | ----------------------------- |
| 前端     | Vue 3 + TypeScript + Vite     |
| Markdown | markdown-it + Shiki + KaTeX   |
| 服务     | Express.js + PM2 + simple-git |

## 📄 License

MIT © NiveFlow
