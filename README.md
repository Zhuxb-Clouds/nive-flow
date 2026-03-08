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

# 构建指定仓库（name 为 ecosystem.config.cjs 中配置的仓库名）
curl -X POST http://localhost:3001/webhook/nive
curl "http://localhost:3001/build?name=hrsrive"

# 健康检查
curl http://localhost:3001/health

# 查询失败日志（默认返回最新 20 条）
curl http://localhost:3001/failures

# 按仓库过滤
curl "http://localhost:3001/failures?repo=nive"

# 按触发来源过滤（init 或 webhook）
curl "http://localhost:3001/failures?trigger=webhook"

# 分页参数
curl "http://localhost:3001/failures?limit=10&offset=20"
```

适合与 Git Hooks、CI/CD 或其他自动化工具集成。

### 接口说明

#### `GET /health`

返回服务状态、当前是否在构建、重试配置以及失败日志摘要。

示例响应：

```json
{
  "status": "ok",
  "building": false,
  "retry": {
    "maxAttempts": 3,
    "delayMs": 3000
  },
  "failures": {
    "count": 2,
    "logFile": "/path/to/project/logs/build-failures.jsonl"
  }
}
```

#### `POST|GET /webhook[/:name]` / `POST|GET /build[/:name]`

- 功能：触发异步同步+构建任务
- 返回码：
  - `202` 已受理（后台执行）
  - `429` 当前已有构建任务在执行
- 仓库指定方式：
  - 路径参数：`/webhook/:name`
  - 查询参数：`/build?name=xxx`

示例响应（`202`）：

```json
{
  "success": true,
  "message": "构建任务已触发",
  "repo": "nive",
  "retry": {
    "maxAttempts": 3,
    "delayMs": 3000
  }
}
```

#### `GET /failures`

- 功能：查询构建失败日志（内存缓存 + 持久化文件）
- 查询参数：
  - `repo`（可选）：按仓库名过滤
  - `trigger`（可选）：`init` / `webhook`
  - `limit`（可选）：返回条数，默认 `20`
  - `offset`（可选）：偏移量，默认 `0`

示例响应：

```json
{
  "success": true,
  "total": 3,
  "offset": 0,
  "limit": 20,
  "count": 3,
  "logs": [
    {
      "id": "f188be1d-7a21-4a17-b3cd-5d8f35ff2f2e",
      "timestamp": "2026-03-08T08:00:00.000Z",
      "trigger": "webhook",
      "repo": "nive",
      "attempt": 2,
      "maxAttempts": 3,
      "error": "[BuildFlow] 同步或构建失败: ...",
      "method": "POST",
      "endpoint": "/webhook/nive",
      "retryInMs": 3000
    }
  ]
}
```

### 重试与日志配置

可通过环境变量配置：

- `BUILD_RETRY_ATTEMPTS`：最大重试次数（默认 `3`，包含首次执行）
- `BUILD_RETRY_DELAY_MS`：重试间隔毫秒（默认 `3000`）
- `FAILURE_LOG_LIMIT`：内存中保留的失败日志条数（默认 `200`）
- `FAILURE_LOG_FILE`：失败日志持久化文件路径（默认 `logs/build-failures.jsonl`）

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
