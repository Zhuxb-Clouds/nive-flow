#!/usr/bin/env tsx
/**
 * 开发服务器启动脚本
 * 支持通过 --name 参数指定调试哪个仓库
 *
 * 用法:
 *   pnpm dev              # 使用第一个仓库
 *   pnpm dev --name=game-docs  # 指定仓库名称
 */

import { execSync, spawn } from "child_process";
import path from "path";
import fs from "fs-extra";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DocsRepo {
  name: string;
  url: string;
  branch?: string;
  outputPath?: string;
}

// 解析命令行参数
function parseArgs(): { name?: string } {
  const args = process.argv.slice(2);
  const result: { name?: string } = {};

  for (const arg of args) {
    if (arg.startsWith("--name=")) {
      result.name = arg.replace("--name=", "");
    } else if (arg === "--name" || arg === "-n") {
      const idx = args.indexOf(arg);
      if (idx + 1 < args.length) {
        result.name = args[idx + 1];
      }
    }
  }

  return result;
}

// 加载配置文件
async function loadConfigFile(): Promise<DocsRepo[]> {
  const configPath = path.resolve(__dirname, "../ecosystem.config.cjs");
  try {
    if (fs.existsSync(configPath)) {
      const configModule = await import(`file://${configPath}`);
      const config = configModule.default || configModule;
      const appConfig = config.apps?.[0]?.env;

      if (Array.isArray(appConfig?.DOCS_REPOS)) {
        return appConfig.DOCS_REPOS.map((repo: DocsRepo) => ({
          ...repo,
          branch: repo.branch || "main",
        }));
      }
    }
  } catch (error) {
    console.error("[Config] 配置文件读取失败:", error);
  }
  return [];
}

// 判断是否为本地路径
function isLocalPath(url: string): boolean {
  return (
    url.startsWith("/") ||
    url.startsWith("./") ||
    url.startsWith("../") ||
    url.startsWith("~") ||
    /^[a-zA-Z]:[\\/]/.test(url)
  );
}

// 导航树节点接口
interface NavTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: NavTreeNode[];
}

// 生成导航树 JSON
function generateNavTree(docsDir: string) {
  function scanDir(dir: string, basePath: string = ""): NavTreeNode[] {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const result: NavTreeNode[] = [];

    // 先处理文件夹，再处理文件
    const folders = items.filter((item) => item.isDirectory() && !item.name.startsWith("."));
    const files = items.filter(
      (item) => item.isFile() && item.name.endsWith(".md") && item.name !== "meta.json"
    );

    // 文件夹
    for (const folder of folders.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
      const folderPath = path.join(dir, folder.name);
      const relativePath = basePath ? `${basePath}/${folder.name}` : folder.name;
      const children = scanDir(folderPath, relativePath);

      if (children.length > 0) {
        result.push({
          name: folder.name,
          path: relativePath,
          type: "folder",
          children,
        });
      }
    }

    // 文件
    for (const file of files.sort((a, b) => {
      // README 放最前面
      if (a.name === "README.md") return -1;
      if (b.name === "README.md") return 1;
      return a.name.localeCompare(b.name, "zh-CN");
    })) {
      const fileName = file.name.replace(/\.md$/, "");
      const relativePath = basePath ? `${basePath}/${fileName}` : fileName;
      result.push({
        name: fileName === "README" ? "概述" : fileName,
        path: relativePath,
        type: "file",
      });
    }

    return result;
  }

  const tree = scanDir(docsDir);
  const outputPath = path.resolve(docsDir, "../nav-tree.json");
  fs.writeJsonSync(outputPath, tree, { spaces: 2 });
  console.log(`[Nav] 已生成导航树: ${outputPath}`);
}

// 复制文档到 public
function copyDocsToPublic(repo: DocsRepo) {
  const docsTarget = path.resolve(__dirname, "../public/docs");
  fs.ensureDirSync(docsTarget);
  fs.emptyDirSync(docsTarget);

  let sourceDir: string;
  if (isLocalPath(repo.url)) {
    // 本地路径
    let localPath = repo.url;
    if (localPath.startsWith("~")) {
      localPath = localPath.replace("~", process.env.HOME || "");
    }
    sourceDir = path.isAbsolute(localPath) ? localPath : path.resolve(process.cwd(), localPath);
  } else {
    // Git 仓库（从 docs-temp 读取）
    sourceDir = path.resolve(__dirname, `../src/docs-temp/${repo.name}`);
  }

  if (fs.existsSync(sourceDir)) {
    // 直接复制到 docs 根目录
    fs.copySync(sourceDir, docsTarget, {
      filter: (src) => !src.includes(".git"),
    });
    console.log(`[Docs] 已复制: ${repo.name} -> ${docsTarget}`);

    // 生成导航树 JSON
    generateNavTree(docsTarget);

    // 复制 meta.json 到 public 根目录
    const metaPath = path.join(sourceDir, "meta.json");
    if (fs.existsSync(metaPath)) {
      fs.copySync(metaPath, path.resolve(__dirname, "../public/meta.json"));
      console.log(`[Meta] 已复制 meta.json 到 public/`);
    }
  } else {
    console.error(`[Error] 文档源不存在: ${sourceDir}`);
    process.exit(1);
  }
}

async function main() {
  const { name } = parseArgs();
  const repos = await loadConfigFile();

  if (repos.length === 0) {
    console.error("[Error] 未配置文档仓库，请检查 ecosystem.config.cjs");
    process.exit(1);
  }

  // 查找指定的仓库
  let targetRepo: DocsRepo;
  if (name) {
    const found = repos.find((r) => r.name === name);
    if (!found) {
      console.error(`[Error] 未找到名为 "${name}" 的仓库`);
      console.log("[Info] 可用的仓库:");
      repos.forEach((r) => console.log(`  - ${r.name}`));
      process.exit(1);
    }
    targetRepo = found;
  } else {
    // 默认使用第一个
    targetRepo = repos[0];
  }

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║              🌊 NiveFlow 开发服务器                       ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const type = isLocalPath(targetRepo.url) ? "📁 本地" : "🌐 Git";
  console.log(`[Dev] 调试仓库: ${targetRepo.name}`);
  console.log(`[Dev] 类型: ${type}`);
  console.log(`[Dev] 路径: ${targetRepo.url}`);
  console.log("");

  // 复制文档
  copyDocsToPublic(targetRepo);

  // 启动 Vite 开发服务器
  console.log("[Dev] 启动 Vite 开发服务器...\n");

  const vite = spawn("npx", ["vite"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  });

  vite.on("close", (code) => {
    process.exit(code || 0);
  });
}

main();
