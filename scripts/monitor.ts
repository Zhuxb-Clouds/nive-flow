import { execSync } from "child_process";
import path from "path";
import fs from "fs-extra";
import simpleGit from "simple-git";
import cron from "node-cron";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_SOURCE = path.resolve(__dirname, "../src/docs-temp");

async function syncAndBuild() {
  const git = simpleGit();

  try {
    // 克隆或拉取仓库
    if (!fs.existsSync(DOCS_SOURCE)) {
      console.log("[Git] 正在克隆文档仓库...");
      await git.clone(process.env.GIT_REPO_URL!, DOCS_SOURCE, [
        "--branch",
        process.env.GIT_BRANCH || "main",
      ]);
      console.log("[Git] 克隆完成");
    }

    const pull = await git.cwd(DOCS_SOURCE).pull();

    // 变更检测：有新文件或输出目录不存在时构建
    const buildOutputDir = process.env.BUILD_OUTPUT_DIR || "./dist";

    if (pull.summary.changes > 0 || !fs.existsSync(buildOutputDir)) {
      console.log("[Build] 检测到变更，正在重新生成网页...");

      // 复制 meta.json 到 public 目录供前端读取
      const metaPath = path.join(DOCS_SOURCE, "meta.json");
      if (fs.existsSync(metaPath)) {
        fs.copySync(metaPath, path.resolve(__dirname, "../public/meta.json"));
        console.log("[Meta] 已更新 meta.json");
      }

      // 复制文档到 src/docs 目录
      const docsTarget = path.resolve(__dirname, "../src/docs");
      fs.ensureDirSync(docsTarget);
      fs.copySync(DOCS_SOURCE, docsTarget, {
        filter: (src) => !src.includes(".git"),
      });
      console.log("[Docs] 已同步文档文件");

      // 执行 Vite 构建
      execSync("pnpm build", {
        cwd: path.resolve(__dirname, ".."),
        env: { ...process.env },
        stdio: "inherit",
      });

      console.log("[Build] 构建完成！");
    } else {
      console.log("[Check] 无变更，跳过构建");
    }
  } catch (error) {
    console.error("[Error] 同步或构建失败:", error);
  }
}

// 启动时立即执行一次
console.log("[NiveFlow] 文档监控服务已启动");
console.log(`[Config] Git 仓库: ${process.env.GIT_REPO_URL}`);
console.log(`[Config] 轮询间隔: ${process.env.POLL_INTERVAL}`);
console.log(`[Config] 输出目录: ${process.env.BUILD_OUTPUT_DIR}`);

syncAndBuild();

// 定时任务
const cronExpression = process.env.POLL_INTERVAL || "*/30 * * * *";
cron.schedule(cronExpression, () => {
  console.log(`[Cron] ${new Date().toISOString()} 执行定时同步...`);
  syncAndBuild();
});
