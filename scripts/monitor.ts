import { execSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import simpleGit from "simple-git";
import cron from "node-cron";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文档仓库配置接口
interface DocsRepo {
  name: string; // 文档名称（用于目录命名）
  url: string; // Git 仓库地址 或 本地路径
  branch?: string; // 分支名（默认 main，仅 Git 模式）
  outputPath?: string; // 输出路径（可选，覆盖全局配置）
}

// 用于存储上次的文件哈希，检测本地文件变更
const localHashCache: Map<string, string> = new Map();

// 判断是否为本地路径
function isLocalPath(url: string): boolean {
  // 本地路径特征：以 / 开头（Unix）、./ 或 ../ 开头、或包含盘符（Windows）
  return (
    url.startsWith("/") ||
    url.startsWith("./") ||
    url.startsWith("../") ||
    url.startsWith("~") ||
    /^[a-zA-Z]:[\\/]/.test(url) // Windows 盘符路径
  );
}

// 计算目录的内容哈希（用于检测本地文件变更）
function calculateDirHash(dirPath: string): string {
  const hash = crypto.createHash("md5");

  function processDir(dir: string) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir).sort();
    for (const item of items) {
      // 忽略隐藏文件和常见非文档目录
      if (item.startsWith(".") || item === "node_modules") continue;

      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        processDir(fullPath);
      } else if (item.endsWith(".md") || item.endsWith(".json")) {
        // 只检查 markdown 和 json 文件的变更
        const content = fs.readFileSync(fullPath);
        hash.update(fullPath + stat.mtime.getTime() + content.length);
      }
    }
  }

  processDir(dirPath);
  return hash.digest("hex");
}

// 加载配置文件
async function loadConfigFile(): Promise<DocsRepo[]> {
  const configPath = path.resolve(__dirname, "../ecosystem.config.cjs");
  try {
    if (fs.existsSync(configPath)) {
      // 动态导入 CommonJS 配置文件
      const configModule = await import(`file://${configPath}`);
      const config = configModule.default || configModule;
      const appConfig = config.apps?.[0]?.env;

      // 直接读取数组配置
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

// 解析文档仓库配置
async function parseDocsRepos(): Promise<DocsRepo[]> {
  return loadConfigFile();
}

// 同步 Git 仓库
async function syncGitRepo(repo: DocsRepo): Promise<boolean> {
  const git = simpleGit();
  const repoDir = path.resolve(__dirname, `../src/docs-temp/${repo.name}`);

  try {
    if (!fs.existsSync(repoDir)) {
      console.log(`[Git] 正在克隆仓库: ${repo.name}...`);
      await git.clone(repo.url, repoDir, ["--branch", repo.branch || "main"]);
      console.log(`[Git] ${repo.name} 克隆完成`);
      return true;
    }

    const pull = await git.cwd(repoDir).pull();
    if (pull.summary.changes > 0) {
      console.log(`[Git] ${repo.name} 检测到 ${pull.summary.changes} 个变更`);
      return true;
    }

    console.log(`[Git] ${repo.name} 无变更`);
    return false;
  } catch (error) {
    console.error(`[Error] ${repo.name} Git 同步失败:`, error);
    return false;
  }
}

// 同步本地文档
async function syncLocalRepo(repo: DocsRepo): Promise<boolean> {
  // 解析本地路径
  let localPath = repo.url;
  if (localPath.startsWith("~")) {
    localPath = path.join(process.env.HOME || "", localPath.slice(1));
  } else if (!path.isAbsolute(localPath)) {
    localPath = path.resolve(process.cwd(), localPath);
  }

  if (!fs.existsSync(localPath)) {
    console.error(`[Local] ${repo.name} 本地路径不存在: ${localPath}`);
    return false;
  }

  // 计算当前哈希
  const currentHash = calculateDirHash(localPath);
  const cachedHash = localHashCache.get(repo.name);

  if (cachedHash === currentHash) {
    console.log(`[Local] ${repo.name} 无变更`);
    return false;
  }

  // 更新哈希缓存
  localHashCache.set(repo.name, currentHash);

  // 复制本地文件到 docs-temp
  const targetDir = path.resolve(__dirname, `../src/docs-temp/${repo.name}`);
  fs.ensureDirSync(targetDir);
  fs.emptyDirSync(targetDir);
  fs.copySync(localPath, targetDir, {
    filter: (src) => {
      const basename = path.basename(src);
      return !basename.startsWith(".") && basename !== "node_modules";
    },
  });

  console.log(`[Local] ${repo.name} 已同步本地文件 (${localPath})`);
  return true;
}

// 同步单个仓库（自动判断类型）
async function syncRepo(repo: DocsRepo): Promise<boolean> {
  if (isLocalPath(repo.url)) {
    return syncLocalRepo(repo);
  } else {
    return syncGitRepo(repo);
  }
}

// 获取仓库的实际文档目录
function getRepoDocsDir(repo: DocsRepo): string {
  if (isLocalPath(repo.url)) {
    // 本地模式：docs-temp 中的副本
    return path.resolve(__dirname, `../src/docs-temp/${repo.name}`);
  } else {
    // Git 模式：docs-temp 中的克隆
    return path.resolve(__dirname, `../src/docs-temp/${repo.name}`);
  }
}

// 复制文档到构建目录
function copyDocsToPublic(repos: DocsRepo[]) {
  const docsTarget = path.resolve(__dirname, "../public/docs");
  fs.ensureDirSync(docsTarget);
  fs.emptyDirSync(docsTarget);

  for (const repo of repos) {
    const repoDir = getRepoDocsDir(repo);
    // 始终按 name 分文件夹存放，支持多仓库
    const targetDir = path.join(docsTarget, repo.name);

    if (fs.existsSync(repoDir)) {
      fs.ensureDirSync(targetDir);
      fs.copySync(repoDir, targetDir, {
        filter: (src) => !src.includes(".git"),
      });
      console.log(`[Docs] 已复制: ${repo.name} -> ${targetDir}`);

      // 复制 meta.json 到各自目录
      const metaPath = path.join(repoDir, "meta.json");
      if (fs.existsSync(metaPath)) {
        fs.copySync(metaPath, path.join(targetDir, "meta.json"));
        console.log(`[Meta] 已复制 meta.json -> ${repo.name}/`);
      }
    }
  }
}

// 构建项目
async function buildProject(repos: DocsRepo[]) {
  // 获取输出路径
  const globalOutputPath = process.env.OUTPUT_PATH || "./dist";
  const absoluteOutputPath = path.isAbsolute(globalOutputPath)
    ? globalOutputPath
    : path.resolve(process.cwd(), globalOutputPath);

  console.log("[Build] 正在构建项目...");

  // 执行 Vite 构建
  execSync(`pnpm build:only --outDir "${absoluteOutputPath}"`, {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env },
    stdio: "inherit",
  });

  console.log(`[Build] 构建完成！输出目录: ${absoluteOutputPath}`);

  // 如果有多个仓库且各自配置了输出路径，复制到各自目录
  if (repos.length > 1) {
    for (const repo of repos) {
      if (repo.outputPath) {
        const repoOutputPath = path.isAbsolute(repo.outputPath)
          ? repo.outputPath
          : path.resolve(process.cwd(), repo.outputPath);

        fs.ensureDirSync(repoOutputPath);
        fs.copySync(absoluteOutputPath, repoOutputPath);
        console.log(`[Build] 已复制到: ${repoOutputPath} (${repo.name})`);
      }
    }
  }
}

// 主同步和构建流程
async function syncAndBuild() {
  const repos = await parseDocsRepos();
  if (repos.length === 0) {
    console.error("[Error] 没有配置有效的文档仓库");
    return;
  }

  try {
    // 同步所有仓库
    console.log(`\n[Sync] 开始同步 ${repos.length} 个文档仓库...`);
    const results = await Promise.all(repos.map(syncRepo));
    const hasChanges = results.some((changed) => changed);

    // 检查输出目录是否存在
    const outputPath = process.env.OUTPUT_PATH || "./dist";
    const absoluteOutputPath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(process.cwd(), outputPath);
    const needsBuild = hasChanges || !fs.existsSync(absoluteOutputPath);

    if (needsBuild) {
      console.log("[Build] 检测到变更，正在重新生成网页...");

      // 复制文档
      copyDocsToPublic(repos);

      // 构建
      await buildProject(repos);
    } else {
      console.log("[Check] 所有仓库无变更，跳过构建");
    }
  } catch (error) {
    console.error("[Error] 同步或构建失败:", error);
  }
}

// 启动服务
async function startMonitor() {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║             🌊 NiveFlow 文档监控服务已启动                ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const repos = await parseDocsRepos();
  if (repos.length > 0) {
    console.log(`[Config] 文档源 (${repos.length} 个):`);
    repos.forEach((repo, index) => {
      const type = isLocalPath(repo.url) ? "📁 本地" : "🌐 Git";
      const branch = isLocalPath(repo.url) ? "" : ` (${repo.branch})`;
      console.log(`  ${index + 1}. [${type}] ${repo.name}: ${repo.url}${branch}`);
    });
  } else {
    console.log("[Config] 文档源: 未配置");
  }
  console.log(`[Config] 轮询间隔: ${process.env.POLL_INTERVAL || "*/30 * * * *"}`);
  console.log(`[Config] 输出目录: ${process.env.OUTPUT_PATH || "./dist"}`);
  console.log("");

  // 启动时立即执行一次
  await syncAndBuild();

  // 定时任务
  const cronExpression = process.env.POLL_INTERVAL || "*/30 * * * *";
  cron.schedule(cronExpression, () => {
    console.log(`\n[Cron] ${new Date().toISOString()} 执行定时同步...`);
    syncAndBuild();
  });
}

// 启动
startMonitor();
