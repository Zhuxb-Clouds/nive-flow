import MarkdownIt from "markdown-it";
import katex from "@traptitech/markdown-it-katex";

import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

// 初始化代码高亮器
async function initHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["one-dark-pro", "github-light"],
      langs: [
        "javascript",
        "typescript",
        "vue",
        "html",
        "css",
        "json",
        "python",
        "java",
        "c",
        "cpp",
        "go",
        "rust",
        "bash",
        "shell",
        "markdown",
        "yaml",
        "sql",
        "dockerfile",
      ],
    });
  }
  return highlighter;
}

// 创建 Markdown 渲染器
function createMarkdownRenderer() {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  // 添加 KaTeX 支持 (数学公式)
  md.use(katex, {
    throwOnError: false,
    errorColor: "#cc0000",
  });

  return md;
}

const md = createMarkdownRenderer();

// 自定义代码块渲染
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const lang = token.info.trim() || "text";
  const code = token.content;

  // 如果高亮器已初始化，使用 Shiki 渲染
  if (highlighter) {
    try {
      return highlighter.codeToHtml(code, {
        lang: lang as any,
        theme: "one-dark-pro",
      });
    } catch {
      // 语言不支持时使用默认渲染
    }
  }

  return defaultFence(tokens, idx, options, env, self);
};

// 渲染 Markdown 为 HTML
export async function renderMarkdown(content: string): Promise<string> {
  await initHighlighter();
  return md.render(content);
}

// 同步渲染（需要先调用 initHighlighter）
export function renderMarkdownSync(content: string): string {
  return md.render(content);
}

// 导出初始化函数
export { initHighlighter };
