#!/usr/bin/env node
import fs from "fs-extra";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置项
const CONFIG = {
  sourceDir: process.cwd(),
  targetDir: path.join(__dirname, "../src/docs"),
  outputDir: path.join(process.cwd(), "_documents"),
  metaFile: "meta.json",
  ignoreList: ["node_modules", ".git", "_documents", ".github", "dist"],
  defaultMeta: {
    title: "NiveFlow Docs",
    logo: "NiveFlow",
    indexPath: "README.md",
    avatar: "",
  },
};

// 工具函数：检查路径是否在忽略列表中
const shouldIgnore = (item) => CONFIG.ignoreList.some((ignored) => item.includes(ignored));

// 安全创建目录（递归）
const ensureDir = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
};

// 清空目录（递归）
const clearDir = async (dir) => {
  if (!fs.existsSync(dir)) return;

  const items = await fs.readdir(dir);
  await Promise.all(
    items.map(async (item) => {
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);

      if (stat.isDirectory()) {
        await clearDir(itemPath);
        await fs.rmdir(itemPath);
      } else {
        await fs.unlink(itemPath);
        console.log(`  Deleted: ${itemPath}`);
      }
    })
  );
};

// 复制文件或目录（递归）
const copyItem = async (source, target) => {
  const stat = await fs.stat(source);

  if (stat.isDirectory()) {
    await ensureDir(target);
    const items = await fs.readdir(source);
    await Promise.all(
      items.map((item) => {
        if (shouldIgnore(item)) return Promise.resolve();
        return copyItem(path.join(source, item), path.join(target, item));
      })
    );
  } else if (!shouldIgnore(source)) {
    await fs.copyFile(source, target);
    console.log(`  Copied: ${path.basename(source)}`);
  }
};

// 跨平台执行命令
const runCommand = (command, args, cwd) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(`Command failed with code ${code}`)
    );
    proc.on("error", reject);
  });
};

// 构建项目
async function build() {
  try {
    const packageRoot = path.dirname(__dirname);

    console.log("\n📁 [1/4] Copying source files...");
    await ensureDir(CONFIG.targetDir);
    await clearDir(CONFIG.targetDir);
    await copyItem(CONFIG.sourceDir, CONFIG.targetDir);

    // 复制 meta.json 到 public 目录
    const metaPath = path.join(CONFIG.sourceDir, CONFIG.metaFile);
    if (fs.existsSync(metaPath)) {
      await fs.copyFile(metaPath, path.join(packageRoot, "public/meta.json"));
      console.log("  Updated: meta.json");
    }

    console.log("\n🔨 [2/4] Building project...");
    await runCommand("pnpm", ["run", "build:only"], packageRoot);

    console.log("\n📦 [3/4] Moving output files...");
    await ensureDir(CONFIG.outputDir);
    await clearDir(CONFIG.outputDir);
    await copyItem(path.join(packageRoot, "dist"), CONFIG.outputDir);

    console.log("\n🧹 [4/4] Cleaning up...");
    await clearDir(CONFIG.targetDir);

    console.log("\n✅ Done! Output: " + CONFIG.outputDir);
  } catch (err) {
    console.error("\n❌ Error:", err);
    process.exit(1);
  }
}

// 初始化命令：创建 meta.json
async function initProject() {
  const metaPath = path.join(process.cwd(), CONFIG.metaFile);

  if (fs.existsSync(metaPath)) {
    console.log("⚠️  meta.json already exists");
    return;
  }

  try {
    await fs.writeFile(metaPath, JSON.stringify(CONFIG.defaultMeta, null, 2));
    console.log("✅ Created meta.json");
    console.log("\nEdit meta.json to configure your documentation site:");
    console.log(JSON.stringify(CONFIG.defaultMeta, null, 2));
  } catch (err) {
    console.error("❌ Failed to create meta.json:", err);
  }
}

// 显示帮助信息
function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    🌊 NiveFlow CLI                        ║
║         Markdown to Static Site Generator                 ║
╚═══════════════════════════════════════════════════════════╝

Usage:
  nive-flow <command>

Commands:
  init     Create meta.json configuration file
  build    Build static site from markdown files

Examples:
  nive-flow init    # Initialize a new documentation project
  nive-flow build   # Build the documentation site

Output:
  Built files will be placed in ./_documents directory
`);
}

// 主入口
async function main() {
  const [, , command] = process.argv;

  console.log("\n🌊 NiveFlow v1.0.0\n");

  switch (command) {
    case "init":
      await initProject();
      break;
    case "build":
      await build();
      break;
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      showHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch(console.error);
