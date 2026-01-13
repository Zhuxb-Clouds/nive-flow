# NiveFlow 示例文档

欢迎使用 **NiveFlow** 文档发布引擎！

## 功能特性

- ✅ 自动同步 Git 仓库
- ✅ Markdown 渲染
- ✅ LaTeX 公式支持
- ✅ 代码语法高亮
- ✅ 响应式设计

## 数学公式示例

行内公式：$E = mc^2$

块级公式：

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

## 代码示例

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet('NiveFlow'));
```

## 开始使用

1. 配置 `ecosystem.config.cjs` 中的 Git 仓库地址
2. 运行 `npm install` 安装依赖
3. 运行 `npm run dev` 启动开发服务器
4. 或使用 `pm2 start ecosystem.config.cjs` 启动生产服务
