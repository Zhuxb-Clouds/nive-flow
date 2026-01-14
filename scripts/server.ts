import express from "express";
import { syncAndBuild, parseDocsRepos, isLocalPath } from "./monitor.js";

const port = parseInt(process.env.WEBHOOK_PORT || "3001", 10);

// 构建锁，防止并发构建
let isBuilding = false;

async function startServer() {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║             🌊 NiveFlow Webhook 服务已启动                ║");
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
  console.log(`[Config] Webhook 端口: ${port}`);
  console.log("");

  // 初始构建
  console.log("[Init] 执行初始构建...");
  try {
    await syncAndBuild();
    console.log("[Init] 初始构建完成\n");
  } catch (err) {
    console.error("[Init] 初始构建失败:", err);
  }

  // 创建 Express 应用
  const app = express();

  // CORS 中间件
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // 健康检查接口
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", building: isBuilding });
  });

  // Webhook 触发构建接口
  app.all(["/webhook", "/build", "/webhook/:name", "/build/:name"], (req, res) => {
    if (isBuilding) {
      res.status(429).json({ success: false, message: "构建正在进行中，请稍后再试" });
      return;
    }

    // 获取 repo name：路径参数 > 查询参数
    const repoName = req.params.name || (req.query.name as string) || undefined;

    console.log(
      `\n[Webhook] ${new Date().toLocaleString()} 收到构建请求${
        repoName ? ` (repo: ${repoName})` : " (全部)"
      }`
    );

    // 立即返回响应，异步执行构建
    res.status(202).json({
      success: true,
      message: "构建任务已触发",
      repo: repoName || "all",
    });

    // 异步执行拉取和强制构建
    isBuilding = true;
    syncAndBuild(true, repoName?.toString())
      .then(() => console.log("[Webhook] 构建完成"))
      .catch((err) => console.error("[Webhook] 构建失败:", err))
      .finally(() => {
        isBuilding = false;
      });
  });

  // 404 处理
  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.listen(port, () => {
    console.log(`[Server] HTTP 服务已启动，监听端口 ${port}`);
    console.log(`[Server] 触发构建: POST/GET http://localhost:${port}/webhook[/:name]`);
    console.log(`[Server] 健康检查: GET http://localhost:${port}/health`);
  });
}

// 启动服务
startServer().catch((err) => {
  console.error("服务无法启动:", err);
  process.exit(1);
});
