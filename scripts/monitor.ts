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

export interface NavTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: NavTreeNode[];
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

export function generateNavTree(docsDir: string, outputFile?: string): string | null {
  if (!fs.existsSync(docsDir)) {
    console.warn(`[Nav] 文档目录不存在，跳过导航树生成: ${docsDir}`);
    return null;
  }

  function scanDir(dir: string, basePath = ""): NavTreeNode[] {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    const result: NavTreeNode[] = [];

    const folders = items.filter((item) => item.isDirectory() && !item.name.startsWith("."));
    const files = items.filter(
      (item) => item.isFile() && item.name.endsWith(".md") && item.name !== "meta.json"
    );

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

    for (const file of files.sort((a, b) => {
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
  const targetFile = outputFile ?? path.resolve(docsDir, "../nav-tree.json");
  fs.ensureDirSync(path.dirname(targetFile));
  fs.writeJsonSync(targetFile, tree, { spaces: 2 });
  console.log(`[Nav] 已生成导航树: ${targetFile}`);
  return targetFile;
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

  // 获取构建缓存目录
  const targetDir = path.resolve(__dirname, `../src/docs-temp/${repo.name}`);
  const hashFile = path.join(targetDir, ".source-hash");

  // 尝试获取上次的哈希（内存缓存 或 文件记录）
  let lastHash = localHashCache.get(repo.name);
  if (!lastHash && fs.existsSync(hashFile)) {
    try {
      lastHash = fs.readFileSync(hashFile, "utf-8").trim();
    } catch (e) {}
  }

  if (lastHash === currentHash) {
    console.log(`[Local] ${repo.name} 无变更`);
    localHashCache.set(repo.name, currentHash); // 更新内存缓存
    return false;
  }

  // 更新哈希缓存
  localHashCache.set(repo.name, currentHash);

  // 复制本地文件到 docs-temp
  fs.ensureDirSync(targetDir);
  fs.emptyDirSync(targetDir);

  // 写入哈希记录
  fs.writeFileSync(hashFile, currentHash);

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
// 复制文档到 public（每次构建只处理一个仓库）
function copyDocsToPublic(repo: DocsRepo) {
  const docsTarget = path.resolve(__dirname, "../public/docs");
  fs.ensureDirSync(docsTarget);
  fs.emptyDirSync(docsTarget);

  const repoDir = getRepoDocsDir(repo);

  if (fs.existsSync(repoDir)) {
    // 直接复制到 docs 根目录
    fs.copySync(repoDir, docsTarget, {
      filter: (src) => !src.includes(".git"),
    });
    console.log(`[Docs] 已复制: ${repo.name} -> ${docsTarget}`);

    generateNavTree(docsTarget);

    // 复制 meta.json 到 public 根目录
    const metaPath = path.join(repoDir, "meta.json");
    const rootMetaPath = path.resolve(__dirname, "../public/meta.json");
    if (fs.existsSync(metaPath)) {
      fs.copySync(metaPath, rootMetaPath);
      console.log(`[Meta] 已复制 meta.json 到 public/`);
    }
  } else {
    console.error(`[Error] 文档源不存在: ${repoDir}`);
  }
}

// 构建单个仓库
async function buildProject(repo: DocsRepo) {
  const outputPath = repo.outputPath || `./dist/${repo.name}`;
  const absoluteOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(process.cwd(), outputPath);

  console.log(`[Build] 构建 ${repo.name} -> ${absoluteOutputPath}`);

  // 执行 Vite 构建
  execSync(`pnpm build:only --outDir "${absoluteOutputPath}"`, {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env },
    stdio: "inherit",
  });

  console.log(`[Build] ${repo.name} 构建完成！`);

  const navTreeSrc = path.resolve(__dirname, "../public/nav-tree.json");
  if (fs.existsSync(navTreeSrc)) {
    const navTreeDest = path.join(absoluteOutputPath, "nav-tree.json");
    fs.copySync(navTreeSrc, navTreeDest);
    console.log(`[Nav] 已同步导航树到输出目录: ${navTreeDest}`);
  }
}

// 主同步和构建流程
async function syncAndBuild(force = false) {
  const repos = await parseDocsRepos();
  if (repos.length === 0) {
    console.error("[Error] 没有配置有效的文档仓库");
    return;
  }

  try {
    // 同步所有仓库
    console.log(`\n[Sync] 开始同步 ${repos.length} 个文档仓库...`);
    const syncResults = await Promise.all(repos.map(syncRepo));

    // 逐个构建每个仓库
    for (const [index, repo] of repos.entries()) {
      const outputPath = repo.outputPath || `./dist/${repo.name}`;
      const absoluteOutputPath = path.isAbsolute(outputPath)
        ? outputPath
        : path.resolve(process.cwd(), outputPath);

      // 检查是否需要构建
      const hasChanges = syncResults[index];
      const needsBuild = force || !fs.existsSync(absoluteOutputPath) || hasChanges;

      if (needsBuild) {
        if (force) {
          console.log(`[Build] ${repo.name} 强制构建...`);
        } else if (!fs.existsSync(absoluteOutputPath)) {
          console.log(`[Build] ${repo.name} 首次构建...`);
        } else if (hasChanges) {
          console.log(`[Build] ${repo.name} 检测到变更，更新构建...`);
        }

        // 复制文档
        copyDocsToPublic(repo);

        // 构建
        await buildProject(repo);
      } else {
        console.log(`[Check] ${repo.name} 无需构建，跳过`);
      }
    }
  } catch (error) {
    console.error("[Error] 同步或构建失败:", error);
    if (force) process.exit(1);
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
      const output = repo.outputPath || `./dist/${repo.name}`;
      console.log(`  ${index + 1}. [${type}] ${repo.name}: ${repo.url}${branch}`);
      console.log(`      📤 输出: ${output}`);
    });
  } else {
    console.log("[Config] 文档源: 未配置");
  }
  console.log(`[Config] 轮询间隔: ${process.env.POLL_INTERVAL || "*/30 * * * *"}`);
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

// 检查命令行参数
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  if (args.includes("--once") || args.includes("--force")) {
    // 单次执行模式（支持强制构建）
    const force = args.includes("--force");
    console.log(`[Mode] 单次执行模式 ${force ? "(强制构建)" : "(增量构建)"}`);
    syncAndBuild(force).then(() => {
      console.log("[Done] 执行完成");
      process.exit(0);
    });
  } else {
    // 监控服务模式
    startMonitor();
  }
}
